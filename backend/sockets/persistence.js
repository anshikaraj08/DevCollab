import * as Y from "yjs";
import mongoose from "mongoose";
import Room from "../models/room.model.js";
import YUpdate from "../models/yUpdate.model.js";

/**
 * MongoDB Append-Only Update Log Persistence for Yjs CRDTs
 *
 * Adheres to the Stage 5 persistence specification:
 * - load(roomId): base yState + every update still in the log
 * - append(roomId, update): buffered and written every 500ms merged with Y.mergeUpdates
 * - compact(roomId): folds the log into Room.yState and deletes exactly the entries it folded in
 * - loadSince(roomId, afterId): returns updates after afterId (optionally with a time overlap)
 *
 * ObjectIds from different server instances are not strictly ordered (they embed a
 * per-machine random part and only second-level time), so no correctness decision
 * here relies on "_id greater than X". Yjs updates are idempotent, so re-applying an
 * update that is already part of yState is harmless; deleting one that is not would
 * lose an edit.
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
    this.compacting = new Map(); // roomId -> Promise (serializes compactions in this process)
    this.retryDelayMs = 1000;
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

    // 2. Apply every update still in the log. Compaction deletes only entries it has
    //    folded into yState, so anything left may be missing from it.
    const updates = await this.yUpdateModel.find({ room: id }).sort({ _id: 1 });

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
      // Put the edits back so they are retried instead of silently dropped.
      const newer = this.buffers.get(id) || [];
      this.buffers.set(id, [...pending, ...newer]);
      if (!this.timers.has(id)) {
        const retry = setTimeout(() => {
          this.timers.delete(id);
          this.flush(id).catch(() => {});
        }, this.retryDelayMs);
        retry.unref?.();
        this.timers.set(id, retry);
      }
      this.logger.error?.({ err: err.message, roomId: id }, "Failed to persist merged YUpdate; will retry");
      throw err;
    }
  }

  /** Drop buffered edits and timers for a room that was deleted. */
  discard(roomId) {
    const id = String(roomId);
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.buffers.delete(id);
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
   * 2. Rebuilds the state from Room.yState plus every log entry.
   * 3. Writes Room.yState / code / compactedUntil, but only if no other compaction
   *    wrote in between (optimistic check on Room.stateVersion).
   * 4. Deletes exactly the log entries that were folded in.
   * Invariant: never removes an entry that has not been applied to the written state.
   * @param {string} roomId
   * @returns {Promise<{ compacted: boolean, count: number, compactedUntil?: any, reason?: string }>}
   */
  async compact(roomId) {
    const id = String(roomId);
    // Serialize compactions of the same room inside this process
    const previous = this.compacting.get(id) || Promise.resolve();
    const run = previous.catch(() => {}).then(() => this._compact(id));
    this.compacting.set(id, run);
    try {
      return await run;
    } finally {
      if (this.compacting.get(id) === run) this.compacting.delete(id);
    }
  }

  async _compact(id) {
    await this.flush(id);

    const room = await this.roomModel.findById(id).select("+yState code compactedUntil stateVersion");
    if (!room) return { compacted: false, count: 0 };

    const updates = await this.yUpdateModel.find({ room: id }).sort({ _id: 1 });
    if (updates.length === 0) {
      return { compacted: false, count: 0, compactedUntil: room.compactedUntil };
    }

    const doc = new Y.Doc();
    const ytext = doc.getText("code");
    if (room.yState && room.yState.length > 0) {
      Y.applyUpdate(doc, new Uint8Array(room.yState));
    } else if (room.code) {
      ytext.insert(0, room.code);
    }

    const appliedIds = [];
    let highestAppliedId = room.compactedUntil;
    for (const u of updates) {
      Y.applyUpdate(doc, new Uint8Array(u.update));
      appliedIds.push(u._id);
      if (!highestAppliedId || String(u._id) > String(highestAppliedId)) highestAppliedId = u._id;
    }

    const encodedState = Buffer.from(Y.encodeStateAsUpdate(doc));
    const fullCode = ytext.toString();
    doc.destroy();

    // Only write if nobody else compacted since we read the room: another instance
    // could otherwise overwrite a newer yState with this older one.
    const version = room.stateVersion || 0;
    const versionFilter =
      version === 0
        ? { $or: [{ stateVersion: 0 }, { stateVersion: { $exists: false } }, { stateVersion: null }] }
        : { stateVersion: version };
    const written = await this.roomModel.findOneAndUpdate(
      { _id: id, ...versionFilter },
      {
        $set: { yState: encodedState, code: fullCode, compactedUntil: highestAppliedId, stateVersion: version + 1 },
      },
      { new: true }
    );
    if (!written) {
      return { compacted: false, count: 0, reason: "CONCURRENT_COMPACTION" };
    }

    await this.yUpdateModel.deleteMany({ room: id, _id: { $in: appliedIds } });

    this.onCompacted?.(id, { count: updates.length, compactedUntil: highestAppliedId });
    return { compacted: true, count: updates.length, compactedUntil: highestAppliedId };
  }

  /**
   * Load updates created after a specific _id (used by the 30s resync safety net).
   * @param {string} roomId
   * @param {any} afterId
   * @returns {Promise<Array<YUpdate>>}
   */
  async loadSince(roomId, afterId, { overlapMs = 0 } = {}) {
    const query = { room: String(roomId) };
    if (afterId) {
      if (overlapMs > 0) {
        // Re-read a time window before the cursor: entries written by another
        // instance can carry a slightly lower _id than ones already seen.
        const seenAt = new mongoose.Types.ObjectId(String(afterId)).getTimestamp().getTime();
        const from = mongoose.Types.ObjectId.createFromTime(Math.floor((seenAt - overlapMs) / 1000));
        query._id = { $gte: from };
      } else {
        query._id = { $gt: afterId };
      }
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
