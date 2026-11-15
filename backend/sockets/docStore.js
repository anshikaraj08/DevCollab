import * as Y from "yjs";
import { MongoPersistence } from "./persistence.js";
import {
  loadedRoomsGauge,
  logLengthGauge,
  compactionDurationHistogram,
  resyncUpdatesCounter,
} from "../config/metrics.js";

const SAVE_DELAY_MS = 2000;
const IDLE_UNLOAD_MS = 30000;
// How far before the resync cursor to re-read (covers ObjectId ordering skew between instances)
const RESYNC_OVERLAP_MS = 120000;

/**
 * Adapter that maintains legacy { loadRoom, saveRoom } compatibility for tests
 * or environments not yet utilizing the full MongoPersistence update log.
 */
class LegacyPersistenceAdapter {
  constructor({ loadRoom, saveRoom, logger = console }) {
    this.loadRoom = loadRoom;
    this.saveRoom = saveRoom;
    this.logger = logger;
    this.onSaved = null;
    this.onFlushed = null;
  }

  async load(roomId) {
    const saved = await this.loadRoom(roomId);
    if (!saved) return null;
    const doc = new Y.Doc();
    const ytext = doc.getText("code");
    if (saved.yState && saved.yState.length > 0) {
      Y.applyUpdate(doc, new Uint8Array(saved.yState));
    } else if (saved.code) {
      ytext.insert(0, saved.code);
    }
    return {
      doc,
      ytext,
      code: ytext.toString(),
      yState: Buffer.from(Y.encodeStateAsUpdate(doc)),
      lastSeenId: null,
      compactedUntil: null,
    };
  }

  append() {}

  async flush(roomId, doc, ytext) {
    if (doc && ytext) {
      await this.saveRoom(roomId, {
        code: ytext.toString(),
        yState: Buffer.from(Y.encodeStateAsUpdate(doc)),
      });
      this.onSaved?.(roomId, new Date().toISOString());
    }
  }

  async flushAll() {}

  async compact(roomId, doc, ytext) {
    if (doc && ytext) {
      await this.saveRoom(roomId, {
        code: ytext.toString(),
        yState: Buffer.from(Y.encodeStateAsUpdate(doc)),
      });
    }
    return { compacted: true, count: 0 };
  }

  async loadSince() {
    return [];
  }

  async countLogEntries() {
    return 0;
  }
}

/**
 * Keeps one live Yjs document per room in memory.
 *
 * Backed by MongoPersistence (with debounced 500ms YUpdate batches,
 * 200-entry compaction thresholds, and lease-based locking in multi-instance clusters).
 */
export class DocStore {
  constructor({
    persistence = null,
    loadRoom = null,
    saveRoom = null,
    redisSync = null,
    logger = console,
    resyncIntervalMs = 30000,
    compactionThreshold = 200,
  } = {}) {
    this.logger = logger;
    this.redisSync = redisSync;
    this.resyncIntervalMs = resyncIntervalMs;
    this.compactionThreshold = compactionThreshold;

    if (persistence) {
      this.persistence = persistence;
    } else if (loadRoom && saveRoom) {
      this.persistence = new LegacyPersistenceAdapter({ loadRoom, saveRoom, logger });
    } else {
      this.persistence = new MongoPersistence({ logger });
    }

    if (this.persistence) {
      this.persistence.onFlushed = (roomId, lastId) => {
        const entry = this.entries.get(String(roomId));
        if (entry) {
          entry.lastSeenId = lastId;
        }
      };
    }

    this.onSaved = null; // (roomId, isoTime) => void
    this.onServerUpdate = null; // (roomId, update) => void
    this.entries = new Map(); // roomId -> { doc, ytext, refs, ... }
    this.loading = new Map(); // roomId -> Promise
    this.savedTimers = new Map(); // roomId -> Timeout
    this.lastSavedAt = new Map(); // roomId -> timestamp
  }

  peek(roomId) {
    return this.entries.get(String(roomId));
  }

  /** Return the current code: from the active memory document if loaded, otherwise from persistence. */
  async getText(roomId) {
    const id = String(roomId);
    const entry = this.entries.get(id);
    if (entry) return entry.ytext.toString();
    const saved = await this.persistence.load(id);
    return saved?.code ?? "";
  }

  /**
   * Creates a Yjs relative position anchor for a given 1-based line number in the document.
   * Enables AI review findings to move along with subsequent collaborative edits.
   * @param {string} roomId
   * @param {number} lineNumber
   * @returns {Promise<any|null>}
   */
  async createAnchorForLine(roomId, lineNumber) {
    const id = String(roomId);
    let entry = this.entries.get(id);
    let acquired = false;
    if (!entry) {
      entry = await this.acquire(id);
      acquired = true;
    }
    try {
      const text = entry.ytext.toString();
      const offset = getLineStartOffset(text, lineNumber);
      const relPos = Y.createRelativePositionFromTypeIndex(entry.ytext, offset);
      return Y.relativePositionToJSON(relPos);
    } catch (err) {
      this.logger.error?.({ roomId: id, lineNumber, err: err.message }, "Failed to create line anchor");
      return null;
    } finally {
      if (acquired) {
        await this.release(id);
      }
    }
  }

  /** Replace the room document's content with text in one transaction originating from "server". */
  async replaceText(roomId, text) {
    const id = String(roomId);
    let entry = this.entries.get(id);
    let acquired = false;
    if (!entry) {
      entry = await this.acquire(id);
      acquired = true;
    }
    entry.doc.transact(() => {
      const len = entry.ytext.length;
      if (len > 0) entry.ytext.delete(0, len);
      if (text) entry.ytext.insert(0, text);
    }, "server");

    if (acquired) {
      await this.flush(id);
      await this.tryCompact(id);
      await this.release(id);
    }
  }

  /** Load (or reuse) the document and count one more user of it. */
  async acquire(roomId) {
    const id = String(roomId);
    let entry = this.entries.get(id);
    if (!entry) {
      let pending = this.loading.get(id);
      if (!pending) {
        pending = this._load(id).finally(() => this.loading.delete(id));
        this.loading.set(id, pending);
      }
      entry = await pending;
    }
    entry.refs += 1;
    clearTimeout(entry.idleTimer);
    this._startResync(entry);
    return entry;
  }

  /** One user less. When nobody is left: flush, compact, and unload later. */
  async release(roomId) {
    const id = String(roomId);
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;

    this._stopResync(entry);
    await this.flush(id);
    await this.tryCompact(id);

    entry.idleTimer = setTimeout(() => {
      if (entry.refs === 0) {
        this._stopResync(entry);
        entry.doc.destroy();
        this.entries.delete(id);
        loadedRoomsGauge?.set?.(this.entries.size);
      }
    }, IDLE_UNLOAD_MS);
    entry.idleTimer.unref?.();
  }

  /** Forget a room entirely (it was deleted): no flush, no compaction. */
  evict(roomId) {
    const id = String(roomId);
    const entry = this.entries.get(id);
    if (entry) {
      clearTimeout(entry.idleTimer);
      this._stopResync(entry);
      entry.doc.destroy();
      this.entries.delete(id);
      loadedRoomsGauge?.set?.(this.entries.size);
    }
    clearTimeout(this.savedTimers.get(id));
    this.savedTimers.delete(id);
    this.persistence.discard?.(id);
  }

  async flush(roomId) {
    const id = String(roomId);
    const entry = this.entries.get(id);
    if (entry && this.persistence instanceof LegacyPersistenceAdapter) {
      await this.persistence.flush(id, entry.doc, entry.ytext);
    } else {
      await this.persistence.flush(id);
    }
  }

  async flushAll() {
    for (const roomId of this.entries.keys()) {
      await this.flush(roomId);
    }
    await this.persistence.flushAll();
  }

  async tryCompact(roomId) {
    const id = String(roomId);
    const entry = this.entries.get(id);
    let hasLease = false;
    if (this.redisSync?.acquireCompactionLease) {
      hasLease = await this.redisSync.acquireCompactionLease(id);
      if (!hasLease) {
        return { compacted: false, reason: "LEASE_BUSY" };
      }
    }
    const start = Date.now();
    try {
      let res;
      if (entry && this.persistence instanceof LegacyPersistenceAdapter) {
        res = await this.persistence.compact(id, entry.doc, entry.ytext);
      } else {
        res = await this.persistence.compact(id);
      }
      const duration = (Date.now() - start) / 1000;
      compactionDurationHistogram?.observe?.(duration);

      if (res?.compacted) {
        const count = await this.persistence.countLogEntries?.(id).catch(() => 0);
        logLengthGauge?.set?.({ roomId: id }, count || 0);
      }
      return res;
    } catch (err) {
      this.logger.error?.({ err: err.message, roomId: id }, "Compaction failed");
      throw err;
    } finally {
      if (hasLease && this.redisSync?.releaseCompactionLease) {
        await this.redisSync.releaseCompactionLease(id).catch(() => {});
      }
    }
  }

  async _load(roomId) {
    const loaded = await this.persistence.load(roomId);
    if (!loaded) throw new Error("ROOM_NOT_FOUND");

    const { doc, ytext } = loaded;
    const entry = {
      roomId,
      doc,
      ytext,
      refs: 0,
      uncompactedCount: 0,
      lastSeenId: loaded.lastSeenId || null,
      idleTimer: null,
      resyncTimer: null,
    };

    doc.on("update", (update, origin) => {
      // Updates from Redis replica pub/sub or 30s resync poll should never be re-appended or re-published
      if (origin === "redis" || origin === "sync") {
        return;
      }

      // 1. Append to update log persistence
      this.persistence.append(roomId, update);
      this._notifySaved(roomId);

      // 2. Publish to Redis replica channel if configured
      if (this.redisSync?.publishUpdate) {
        this.redisSync.publishUpdate(roomId, update).catch((err) => {
          this.logger.error?.({ err: err.message, roomId }, "Failed to publish replica update to Redis");
        });
      }

      // 3. Emit onServerUpdate if origin is server
      if (origin === "server") {
        this.onServerUpdate?.(roomId, update);
      }

      // 4. Threshold compaction check (> 200 entries)
      entry.uncompactedCount = (entry.uncompactedCount || 0) + 1;
      if (entry.uncompactedCount >= this.compactionThreshold) {
        entry.uncompactedCount = 0;
        this.tryCompact(roomId).catch((err) => {
          this.logger.error?.({ err: err.message, roomId }, "Threshold compaction error");
        });
      }
    });

    this.entries.set(roomId, entry);
    loadedRoomsGauge?.set?.(this.entries.size);
    return entry;
  }

  _startResync(entry) {
    if (this.resyncIntervalMs <= 0 || entry.resyncTimer) return;
    entry.resyncTimer = setInterval(async () => {
      if (!entry.doc || entry.refs <= 0) return;
      try {
        const updates = await this.persistence.loadSince(entry.roomId, entry.lastSeenId, {
          overlapMs: RESYNC_OVERLAP_MS,
        });
        if (updates && updates.length > 0) {
          for (const u of updates) {
            const uBytes = new Uint8Array(u.update);
            const diff = Y.diffUpdate(uBytes, Y.encodeStateVector(entry.doc));
            if (diff && diff.byteLength > 2) {
              resyncUpdatesCounter?.inc?.({ roomId: entry.roomId });
              Y.applyUpdate(entry.doc, uBytes, "sync");
              this.onServerUpdate?.(entry.roomId, u.update);
            }
            if (!entry.lastSeenId || String(u._id) > String(entry.lastSeenId)) entry.lastSeenId = u._id;
          }
        }
      } catch (err) {
        this.logger.error?.({ err: err.message, roomId: entry.roomId }, "Resync poll failed");
      }
    }, this.resyncIntervalMs);
    entry.resyncTimer.unref?.();
  }

  _stopResync(entry) {
    if (entry.resyncTimer) {
      clearInterval(entry.resyncTimer);
      entry.resyncTimer = null;
    }
  }

  _notifySaved(roomId) {
    const id = String(roomId);
    const now = Date.now();
    const last = this.lastSavedAt.get(id) || 0;
    if (now - last >= SAVE_DELAY_MS) {
      this.lastSavedAt.set(id, now);
      this.onSaved?.(id, new Date(now).toISOString());
    } else {
      if (!this.savedTimers.has(id)) {
        const wait = Math.max(0, SAVE_DELAY_MS - (now - last));
        const timer = setTimeout(() => {
          this.savedTimers.delete(id);
          const t = Date.now();
          this.lastSavedAt.set(id, t);
          this.onSaved?.(id, new Date(t).toISOString());
        }, wait);
        timer.unref?.();
        this.savedTimers.set(id, timer);
      }
    }
  }
}

/**
 * Calculates 0-based character offset for start of a 1-based lineNumber.
 */
export function getLineStartOffset(text, lineNumber) {
  if (!text || lineNumber <= 1) return 0;
  let currentLine = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      currentLine++;
      if (currentLine === lineNumber) {
        return i + 1;
      }
    }
  }
  return text.length;
}
