import Snapshot from "../models/snapshot.model.js";
import User from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getSavedBy = async (userId) => {
  const u = await User.findById(userId).select("name");
  return { id: String(userId), name: u?.name ?? "Unknown" };
};

/** GET /snapshots/:roomId */
export const listSnapshots = asyncHandler(async (req, res) => {
  const snapshots = await Snapshot.find({ roomId: req.params.roomId })
    .select("-code")
    .sort({ createdAt: -1 });
  res.json({ snapshots });
});

/** POST /snapshots/:roomId */
export const createSnapshot = asyncHandler(async (req, res) => {
  const { name, code } = req.body;
  if (!code) return res.status(400).json({ message: "code required" });
  const savedBy = await getSavedBy(req.user.id);
  const snapshot = await Snapshot.create({
    roomId: req.params.roomId,
    name: name?.trim() || `Snapshot ${new Date().toLocaleString()}`,
    code,
    savedBy,
  });
  res.status(201).json({ snapshot });
});

/** GET /snapshots/single/:snapshotId */
export const getSnapshot = asyncHandler(async (req, res) => {
  const snapshot = await Snapshot.findById(req.params.snapshotId);
  if (!snapshot) return res.status(404).json({ message: "Not found" });
  res.json({ snapshot });
});

/** DELETE /snapshots/single/:snapshotId */
export const deleteSnapshot = asyncHandler(async (req, res) => {
  await Snapshot.findByIdAndDelete(req.params.snapshotId);
  res.json({ ok: true });
});
