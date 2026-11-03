import * as Y from "yjs";
 
// Saving rules: save 2 seconds after the last edit, but never wait longer than 10 seconds
// while people keep typing. Unload an idle document from memory after 30 seconds.
const SAVE_DELAY_MS = 2000;
const SAVE_MAX_WAIT_MS = 10000;
const IDLE_UNLOAD_MS = 30000;
 
/**
 * Keeps one live Yjs document per room in memory.
 *
 * loadRoom(roomId)            -> { code, yState } or null
 * saveRoom(roomId, { code, yState })
 */
export class DocStore {
  constructor({ loadRoom, saveRoom, logger = console }) {
    this.loadRoom = loadRoom;
    this.saveRoom = saveRoom;
    this.logger = logger;
    this.onSaved = null;          // set by the socket server: (roomId, isoTime) => void
    this.entries = new Map();     // roomId -> { doc, ytext, refs, ... }
    this.loading = new Map();     // roomId -> Promise (so two joins never load twice)
  }
 
  peek(roomId) {
    return this.entries.get(roomId);
  }
 
  /** Load (or reuse) the document and count one more user of it. */
  async acquire(roomId) {
    let entry = this.entries.get(roomId);
    if (!entry) {
      let pending = this.loading.get(roomId);
      if (!pending) {
        pending = this._load(roomId).finally(() => this.loading.delete(roomId));
        this.loading.set(roomId, pending);
      }
      entry = await pending;
    }
    entry.refs += 1;
    clearTimeout(entry.idleTimer);
    return entry;
  }
 
  /** One user less. When nobody is left: save now, unload later. */
  async release(roomId) {
    const entry = this.entries.get(roomId);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;
    await this.flush(roomId);
    entry.idleTimer = setTimeout(() => {
      if (entry.refs === 0) {
        clearTimeout(entry.timer);
        entry.doc.destroy();
        this.entries.delete(roomId);
      }
    }, IDLE_UNLOAD_MS);
    entry.idleTimer.unref?.();
  }
 
  async flush(roomId) {
    const entry = this.entries.get(roomId);
    if (entry && entry.dirtySince !== null) await this._save(entry);
  }
 
  async flushAll() {
    for (const roomId of this.entries.keys()) await this.flush(roomId);
  }
 
  async _load(roomId) {
    const saved = await this.loadRoom(roomId);
    if (!saved) throw new Error("ROOM_NOT_FOUND");
 
    const doc = new Y.Doc();
    const ytext = doc.getText("code");
    let firstTime = false;
    if (saved.yState && saved.yState.length > 0) {
      Y.applyUpdate(doc, new Uint8Array(saved.yState));   // normal case: restore the CRDT state
    } else {
      if (saved.code) ytext.insert(0, saved.code);        // room made in Phase 1: start from its text
      firstTime = true;
    }
 
    const entry = { roomId, doc, ytext, refs: 0, dirtySince: null, timer: null, idleTimer: null };
    doc.on("update", () => this._markDirty(entry));
    this.entries.set(roomId, entry);
    if (firstTime) await this._save(entry);
    return entry;
  }
 
  _markDirty(entry) {
    const now = Date.now();
    if (entry.dirtySince === null) entry.dirtySince = now;
    clearTimeout(entry.timer);
    const wait = Math.max(0, Math.min(SAVE_DELAY_MS, entry.dirtySince + SAVE_MAX_WAIT_MS - now));
    entry.timer = setTimeout(() => this._save(entry), wait);
    entry.timer.unref?.();
  }
 
  async _save(entry) {
    clearTimeout(entry.timer);
    entry.dirtySince = null;
    try {
      await this.saveRoom(entry.roomId, {
        code: entry.ytext.toString(),
        yState: Buffer.from(Y.encodeStateAsUpdate(entry.doc)),
      });
      this.onSaved?.(entry.roomId, new Date().toISOString());
    } catch (err) {
      this.logger.error({ err, roomId: entry.roomId }, "saving room failed, will retry");
      entry.dirtySince = Date.now();
      entry.timer = setTimeout(() => this._save(entry), 5000);   // try again soon
      entry.timer.unref?.();
    }
  }
}

