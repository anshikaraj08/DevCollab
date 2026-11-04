import Snapshot from "../models/snapshot.model.js";
import User from "../models/user.model.js";
import Room from "../models/room.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { roomKey } from "../sockets/roomKey.js";
import {
  MAX_SNAPSHOTS_PER_ROOM,
  MAX_SNAPSHOT_CODE_CHARS,
} from "../config/limits.js";

/**
 * GET /rooms/:roomId/snapshots
 * Action: snapshot.read
 * List without code: [{ _id, name, kind, createdBy: { _id, name }, createdAt, size }], newest first.
 */
export const listSnapshots = asyncHandler(async (req, res) => {
  const snapshots = await Snapshot.find({ room: req.room._id })
    .sort({ createdAt: -1 })
    .populate("createdBy", "name")
    .lean();

  const formatted = snapshots.map((s) => ({
    _id: s._id,
    name: s.name,
    kind: s.kind,
    createdBy: s.createdBy
      ? { _id: s.createdBy._id, name: s.createdBy.name }
      : { _id: null, name: "Unknown" },
    createdAt: s.createdAt,
    size: typeof s.code === "string" ? s.code.length : 0,
  }));

  res.json({ snapshots: formatted });
});

/**
 * POST /rooms/:roomId/snapshots
 * Action: snapshot.create (rate limited)
 * Takes text from DocStore.getText (or DB fallback), rejects > 200k chars (413),
 * uses "Version <n>" when name is not given, enforces 50-snapshot limit (409),
 * emits snapshots:changed.
 */
export const createSnapshot = asyncHandler(async (req, res) => {
  const roomId = String(req.room._id);
  const count = await Snapshot.countDocuments({ room: roomId });
  if (count >= MAX_SNAPSHOTS_PER_ROOM) {
    throw new ApiError(
      409,
      `Maximum of ${MAX_SNAPSHOTS_PER_ROOM} snapshots reached for this workspace. Please delete an older snapshot first.`
    );
  }

  const store = req.app.get("store");
  const text = store ? await store.getText(roomId) : req.room.code || "";

  if (text.length > MAX_SNAPSHOT_CODE_CHARS) {
    throw new ApiError(
      413,
      `Snapshot code exceeds maximum allowed size of ${MAX_SNAPSHOT_CODE_CHARS} characters`
    );
  }

  const name = req.body?.name?.trim() || `Version ${count + 1}`;
  const user = await User.findById(req.user.id).select("name");

  const snapshot = await Snapshot.create({
    room: roomId,
    name,
    code: text,
    kind: "manual",
    createdBy: req.user.id,
  });

  const io = req.app.get("io");
  if (io) {
    io.to(roomKey(roomId)).emit("snapshots:changed", { roomId });
  }

  res.status(201).json({
    snapshot: {
      _id: snapshot._id,
      name: snapshot.name,
      kind: snapshot.kind,
      createdBy: { _id: req.user.id, name: user?.name || "Unknown" },
      createdAt: snapshot.createdAt,
      size: text.length,
    },
  });
});

/**
 * GET /rooms/:roomId/snapshots/:snapshotId
 * Action: snapshot.read
 * Returns snapshot including code.
 */
export const getSnapshot = asyncHandler(async (req, res) => {
  const { snapshotId } = req.params;
  const snapshot = await Snapshot.findOne({ _id: snapshotId, room: req.room._id })
    .populate("createdBy", "name")
    .lean();

  if (!snapshot) {
    throw new ApiError(404, "Snapshot not found");
  }

  res.json({
    snapshot: {
      _id: snapshot._id,
      name: snapshot.name,
      code: snapshot.code,
      kind: snapshot.kind,
      createdBy: snapshot.createdBy
        ? { _id: snapshot.createdBy._id, name: snapshot.createdBy.name }
        : { _id: null, name: "Unknown" },
      createdAt: snapshot.createdAt,
      size: typeof snapshot.code === "string" ? snapshot.code.length : 0,
    },
  });
});

/**
 * DELETE /rooms/:roomId/snapshots/:snapshotId
 * Action: snapshot.delete
 * Owner can delete any snapshot; editor can delete only their own.
 * Emits snapshots:changed.
 */
export const deleteSnapshot = asyncHandler(async (req, res) => {
  const { snapshotId } = req.params;
  const snapshot = await Snapshot.findOne({ _id: snapshotId, room: req.room._id });

  if (!snapshot) {
    throw new ApiError(404, "Snapshot not found");
  }

  if (req.role === "editor" && String(snapshot.createdBy) !== String(req.user.id)) {
    throw new ApiError(403, "Editors may only delete their own snapshots");
  }

  await snapshot.deleteOne();

  const io = req.app.get("io");
  if (io) {
    io.to(roomKey(req.room._id)).emit("snapshots:changed", { roomId: req.room._id });
  }

  res.json({ ok: true, message: "Snapshot deleted" });
});

/**
 * POST /rooms/:roomId/snapshots/:snapshotId/restore
 * Action: snapshot.restore (rate limited)
 * Creates a pre-restore backup snapshot of current text first,
 * then replaces text in DocStore (or DB fallback), flushes,
 * emits room:restored and snapshots:changed.
 */
export const restoreSnapshot = asyncHandler(async (req, res) => {
  const { snapshotId } = req.params;
  const roomId = String(req.room._id);

  const snapshot = await Snapshot.findOne({ _id: snapshotId, room: roomId });
  if (!snapshot) {
    throw new ApiError(404, "Snapshot not found");
  }

  const store = req.app.get("store");
  const currentText = store ? await store.getText(roomId) : req.room.code || "";

  // 1. Save pre-restore backup
  const preRestoreName = `Pre-restore: before ${snapshot.name || "snapshot"}`;
  await Snapshot.create({
    room: roomId,
    name: preRestoreName,
    code: currentText,
    kind: "pre-restore",
    createdBy: req.user.id,
  });

  // 2. Replace text in DocStore / DB
  if (store) {
    await store.replaceText(roomId, snapshot.code);
    await store.flush(roomId);
  } else {
    await Room.updateOne({ _id: roomId }, { $set: { code: snapshot.code } });
  }

  const user = await User.findById(req.user.id).select("name");
  const userName = user?.name || "A collaborator";

  // 3. Emit socket events
  const io = req.app.get("io");
  if (io) {
    io.to(roomKey(roomId)).emit("room:restored", {
      roomId,
      snapshotId: snapshot._id,
      name: snapshot.name,
      by: userName,
    });
    io.to(roomKey(roomId)).emit("snapshots:changed", { roomId });
  }

  res.json({
    ok: true,
    message: `Restored snapshot "${snapshot.name}"`,
  });
});
