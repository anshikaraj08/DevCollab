import Room from "../models/room.model.js";
import ApiError from "../utils/ApiError.js";
// asyncHandler: Forwards asynchronous errors to error-handling middleware.
import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
// What is it?
// This file contains the main logic for creating rooms, listing rooms, joining rooms, saving code, and deleting rooms in DevCollab.
const isMember = (room, userId) => room.users.some((id) => id.toString() === userId);
 
export const createRoom = asyncHandler(async (req, res) => {
  const { title, language } = req.body; // already checked by Zod
  const room = await Room.create({//Room.create(...) saves the room in MongoDB.
    title,
    language,
    createdBy: req.user.id,
    users: [req.user.id],
  });
  logger.info({ roomId: room._id, userId: req.user.id }, "Room created");
  res.status(201).json({ room });
});
 
export const getAllRooms = asyncHandler(async (req, res) => {
  const rooms = await Room.find({ users: req.user.id })
    .select("-code")//select("-code"): Excludes the code field from the results to avoid sending potentially large code content in the room list.
    .sort({ updatedAt: -1 });  //Sorts rooms by most recently updated first.
  res.json({ rooms });//Returns the list.
});
 
// Opening a room link adds you as a member (invites and roles come later)
export const joinRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.roomId); // a bad id throws CastError, handled globally
  if (!room) throw new ApiError(404, "Room not found");
  if (!isMember(room, req.user.id)) {
    room.users.push(req.user.id);//room.users.push(...): Adds the user only if they are not already a member.
    await room.save();//Saves the membership change.
  }
  res.json({ room });
});

export const saveCode = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.roomId);
  if (!room) throw new ApiError(404, "Room not found");
  if (!isMember(room, req.user.id)) throw new ApiError(403, "Forbidden");
  room.code = req.body.code;
  await room.save();
  res.json({ room });
});
// In DevCollab: This ensures only room members can save code through this controller. The route's validation middleware also checks the code's type and maximum length.
 
export const deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.roomId);
  if (!room) throw new ApiError(404, "Room not found");
  if (room.createdBy.toString() !== req.user.id) {
    throw new ApiError(403, "Only the owner can delete");
  }
  await room.deleteOne();
  res.json({ message: "Room deleted" });
});
