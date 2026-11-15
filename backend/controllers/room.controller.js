import Room from "../models/room.model.js";
import Invite from "../models/invite.model.js";
import Comment from "../models/comment.model.js";
import Snapshot from "../models/snapshot.model.js";
import YUpdate from "../models/yUpdate.model.js";
import AiReview from "../models/aiReview.model.js";
import Notification from "../models/notification.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { getRole } from "../utils/roles.js";

export const getRoom = asyncHandler(async (req, res) => {
  const { _id, title, language, createdBy, code } = req.room;
  res.json({
    room: {
      _id,
      title,
      language,
      createdBy,
      role: req.role,
      code,
    },
  });
});

export const createRoom = asyncHandler(async (req, res) => {
  const { title, language } = req.body;
  const room = await Room.create({
    title,
    language,
    createdBy: req.user.id,
    users: [req.user.id],
  });
  logger.info({ roomId: room._id, userId: req.user.id }, "Room created");
  res.status(201).json({
    room: {
      _id: room._id,
      title: room.title,
      language: room.language,
      createdBy: room.createdBy,
      role: "owner",
    },
  });
});

export const getAllRooms = asyncHandler(async (req, res) => {
  const rooms = await Room.find({ users: req.user.id })
    .select("-code")
    .sort({ updatedAt: -1 });

  const formatted = rooms.map((r) => ({
    _id: r._id,
    title: r.title,
    language: r.language,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    memberCount: r.users?.length || 0,
    role: getRole(r, req.user.id),
  }));

  res.json({ rooms: formatted });
});

export const saveCode = asyncHandler(async (req, res) => {
  req.room.code = req.body.code;
  await req.room.save();
  res.json({ room: req.room });
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const roomId = req.room._id;

  // Remove the room first so no new member can join or edit it
  await req.room.deleteOne();

  // Disconnect live collaborators and unload the document on every instance
  await req.app.get("io")?.closeRoom?.(String(roomId));

  await Promise.all([
    Invite.deleteMany({ room: roomId }),
    Comment.deleteMany({ roomId }),
    Snapshot.deleteMany({ room: roomId }),
    YUpdate.deleteMany({ room: roomId }),
    AiReview.deleteMany({ room: roomId }),
    Notification.deleteMany({ room: roomId }),
  ]);
  logger.info({ roomId, userId: req.user.id }, "Room and associated data deleted");
  res.json({ message: "Room deleted" });
});
