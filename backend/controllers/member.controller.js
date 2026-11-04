import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRole } from "../utils/roles.js";
import { roomKey } from "../sockets/roomKey.js";

/** GET /rooms/:roomId/members */
export const getMembers = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.room._id).populate("users", "name email");
  const ownerId = String(room.createdBy);

  const members = (room.users || []).map((u) => {
    const uId = String(u._id);
    return {
      user: { _id: u._id, name: u.name, email: u.email },
      role: getRole(room, uId),
      isOwner: uId === ownerId,
    };
  });

  // Owner first, then sorted alphabetically by name
  members.sort((a, b) => {
    if (a.isOwner) return -1;
    if (b.isOwner) return 1;
    return (a.user.name || "").localeCompare(b.user.name || "");
  });

  res.json({ members });
});

/** PATCH /rooms/:roomId/members/:userId */
export const updateMemberRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const targetId = String(req.params.userId);
  const roomId = req.room._id;

  if (role !== "editor" && role !== "viewer") {
    throw new ApiError(400, "Role must be 'editor' or 'viewer'");
  }

  const room = await Room.findById(roomId);
  if (!room) throw new ApiError(404, "Room not found");

  const ownerId = String(room.createdBy);
  if (targetId === ownerId) {
    throw new ApiError(403, "Cannot change the role of the room owner");
  }

  const isMember = (room.users || []).some((u) => String(u) === targetId);
  if (!isMember) {
    throw new ApiError(404, "Member not found in this room");
  }

  if (!room.roles) {
    room.roles = new Map();
  }

  if (role === "editor") {
    room.roles.delete(targetId);
  } else {
    room.roles.set(targetId, "viewer");
  }

  await room.save();

  const io = req.app.get("io");
  if (io) {
    await io.syncRoomMembership(String(roomId));
    io.to(roomKey(roomId)).emit("room:members", { roomId });
  }

  res.json({ ok: true, userId: targetId, role });
});

/** DELETE /rooms/:roomId/members/:userId */
export const removeMember = asyncHandler(async (req, res) => {
  const targetId = String(req.params.userId);
  const callerId = String(req.user.id);
  const roomId = req.room._id;

  const room = await Room.findById(roomId);
  if (!room) throw new ApiError(404, "Room not found");

  const ownerId = String(room.createdBy);
  if (targetId === ownerId) {
    throw new ApiError(403, "The owner cannot be removed and cannot leave the room");
  }

  // Caller must be the owner (members.manage) OR removing themselves (leaving)
  if (callerId !== ownerId && callerId !== targetId) {
    throw new ApiError(403, "You can only remove yourself from the workspace");
  }

  const isMember = (room.users || []).some((u) => String(u) === targetId);
  if (!isMember) {
    throw new ApiError(404, "Member not found in this room");
  }

  room.users = room.users.filter((u) => String(u) !== targetId);
  if (room.roles) {
    room.roles.delete(targetId);
  }

  await room.save();

  const io = req.app.get("io");
  if (io) {
    await io.syncRoomMembership(String(roomId));
    io.to(roomKey(roomId)).emit("room:members", { roomId });
  }

  res.json({ ok: true, message: callerId === targetId ? "Left workspace" : "Member removed" });
});

