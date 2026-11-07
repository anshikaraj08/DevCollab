import * as Y from "yjs";
import Room from "../models/room.model.js";
import YUpdate from "../models/yUpdate.model.js";

/**
 * MongoDB Append-Only Update Log Persistence for Yjs CRDTs
 *
 * Adheres to the Stage 5 persistence specification:
 * - load(roomId): base yState + updates > compactedUntil
 * - append(roomId, update): buffered and written every 500ms merged with Y.mergeUpdates
 * - compact(roomId): encodes full state, updates Room.compactedUntil, deletes applied updates <= compactedUntil
 * - loadSince(roomId, afterId): returns updates after afterId
 */
export class MongoPersistence {
  constructor({
    roomModel = Room,
    yUpdateModel = YUpdate,
    logger = console,
    batchIntervalMs = 500,
    compactionThreshold = 200,
  } = {}) {
    this.roomModel = roomModel;
    this.yUpdateModel = yUpdateModel;
    this.logger = logger;
    this.batchIntervalMs = batchIntervalMs;
    this.compactionThreshold = compactionThreshold;

    this.buffers = new Map(); // roomId -> Array<Uint8Array>
    this.timers = new Map();  // roomId -> Timeout
    this.onSaved = null;      // (roomId, isoTime) => void
    this.onFlushed = null;    // (roomId, lastId) => void
    this.onCompacted = null;  // (roomId, details) => void
  }

  /**
   * Load room state: applies base Room.yState, then all YUpdates after compactedUntil.
   * @param {string} roomId
   * @returns {Promise<{ doc: Y.Doc, ytext: Y.Text, code: string, yState: Buffer, lastSeenId: any, compactedUntil: any } | null>}
   */
  async load(roomId) {
    const id = String(roomId);
    const room = await this.roomModel.findById(id).select("+yState code compactedUntil");
    if (!room) return null;

    const doc = new Y.Doc();
    const ytext = doc.getText("code");

    // 1. Apply base state
    if (room.yState && room.yState.length > 0) {
      Y.applyUpdate(doc, new Uint8Array(room.yState));
    } else if (room.code) {
      ytext.insert(0, room.code);
    }

    // 2. Fetch and apply all log updates created after compactedUntil
    const query = { room: id };
    if (room.compactedUntil) {
      query._id = { $gt: room.compactedUntil };
    }
    const updates = await this.yUpdateModel.find(query).sort({ _id: 1 });

    let lastSeenId = room.compactedUntil || null;
    for (const u of updates) {
      Y.applyUpdate(doc, new Uint8Array(u.update));
      lastSeenId = u._id;
    }

    return {
      doc,
      ytext,
      code: ytext.toString(),
      yState: Buffer.from(Y.encodeStateAsUpdate(doc)),
      lastSeenId,
      compactedUntil: room.compactedUntil || null,
    };
  }

  /**
   * Buffer an update for a room to be written within batchIntervalMs (500ms).
   * @param {string} roomId
   * @param {Uint8Array|Buffer} update
   */
  append(roomId, update) {
    const id = String(roomId);
    const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);

    let buf = this.buffers.get(id);
    if (!buf) {
      buf = [];
      this.buffers.set(id, buf);
    }
    buf.push(bytes);

    if (!this.timers.has(id)) {
      const timer = setTimeout(() => {
        this.timers.delete(id);
        this.flush(id).catch((err) => {
          this.logger.error?.({ err: err.message, roomId: id }, "Error during persistence batch flush");
        });
      }, this.batchIntervalMs);
      timer.unref?.();
      this.timers.set(id, timer);
    }
  }

  /**
   * Flush pending buffered updates for a room as one merged YUpdate.
   * @param {string} roomId
   * @returns {Promise<YUpdate|null>}
   */
  async flush(roomId) {
    const id = String(roomId);
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    const pending = this.buffers.get(id);
    if (!pending || pending.length === 0) return null;

    this.buffers.delete(id);

    try {
      const merged = pending.length === 1 ? pending[0] : Y.mergeUpdates(pending);
      const created = await this.yUpdateModel.create({
        room: id,
        update: Buffer.from(merged),
      });

      this.onFlushed?.(id, created._id);
      this.onSaved?.(id, new Date().toISOString());
      return created;
    } catch (err) {
      this.logger.error?.({ err: err.message, roomId: id }, "Failed to persist merged YUpdate");
      throw err;
    }
  }

  /**
   * Flush all buffered updates across all rooms.
   */
  async flushAll() {
    const roomIds = Array.from(this.buffers.keys());
    await Promise.all(roomIds.map((id) => this.flush(id)));
  }

  /**
   * Compacts the update log for a room:
   * 1. Flushes any pending updates.
   * 2. Loads base yState and all updates up to highest applied _id.
   * 3. Writes Room.yState, Room.code, Room.compactedUntil = <highest applied id>.
   * 4. Deletes YUpdates with _id <= compactedUntil.
   * Invariant: Never removes an entry that has not been applied to the written state.
   * @param {string} roomId
   * @returns {Promise<{ compacted: boolean, count: number, compactedUntil?: any }>}
   */
  async compact(roomId) {
    const id = String(roomId);

    // 1. Flush any pending memory buffers first
    await this.flush(id);

    // 2. Fetch room and updates
    const room = await this.roomModel.findById(id).select("+yState code compactedUntil");
    if (!room) return { compacted: false, count: 0 };

    const query = { room: id };
    if (room.compactedUntil) {
      query._id = { $gt: room.compactedUntil };
    }
    const updates = await this.yUpdateModel.find(query).sort({ _id: 1 });

    if (updates.length === 0) {
      return { compacted: false, count: 0, compactedUntil: room.compactedUntil };
    }

    // 3. Rebuild complete state from base up to the last update in the batch
    const doc = new Y.Doc();
    const ytext = doc.getText("code");

    if (room.yState && room.yState.length > 0) {
      Y.applyUpdate(doc, new Uint8Array(room.yState));
    } else if (room.code) {
      ytext.insert(0, room.code);
    }

    let highestAppliedId = room.compactedUntil;
    for (const u of updates) {
      Y.applyUpdate(doc, new Uint8Array(u.update));
      highestAppliedId = u._id;
    }

    const encodedState = Buffer.from(Y.encodeStateAsUpdate(doc));
    const fullCode = ytext.toString();

    // 4. Atomically persist compacted state and checkpoint into Room
    await this.roomModel.findByIdAndUpdate(id, {
      yState: encodedState,
      code: fullCode,
      compactedUntil: highestAppliedId,
    });

    // 5. Delete only the updates that have been successfully applied to the written state
    await this.yUpdateModel.deleteMany({
      room: id,
      _id: { $lte: highestAppliedId },
    });

    this.onCompacted?.(id, { count: updates.length, compactedUntil: highestAppliedId });
    return { compacted: true, count: updates.length, compactedUntil: highestAppliedId };
  }

  /**
   * Load updates created after a specific _id (used by the 30s resync safety net).
   * @param {string} roomId
   * @param {any} afterId
   * @returns {Promise<Array<YUpdate>>}
   */
  async loadSince(roomId, afterId) {
    const query = { room: String(roomId) };
    if (afterId) {
      query._id = { $gt: afterId };
    }
    return this.yUpdateModel.find(query).sort({ _id: 1 });
  }

  /**
   * Count uncompacted log entries for a room.
   * @param {string} roomId
   * @param {any} [sinceId]
   * @returns {Promise<number>}
   */
  async countLogEntries(roomId, sinceId = null) {
    const query = { room: String(roomId) };
    if (sinceId) {
      query._id = { $gt: sinceId };
    }
    return this.yUpdateModel.countDocuments(query);
  }
}
