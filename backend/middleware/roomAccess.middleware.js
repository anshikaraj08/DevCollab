import mongoose from "mongoose";
import Room from "../models/room.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRole, can } from "../utils/roles.js";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

/**
 * Middleware to check room membership and role-based permissions.
 * Answers 404 if the room does not exist or user is not a member (avoids leaking existence).
 * Answers 403 if user lacks permission for the action.
 *
 * @param {string} [action] - Permission action to enforce (e.g. "room.read", "comment.write")
 */
export function roomAccess(action) {
  return asyncHandler(async (req, res, next) => {
    const { roomId } = req.params;

    if (!roomId || !OBJECT_ID_REGEX.test(roomId)) {
      throw new ApiError(404, "Room not found");
    }

    const room = await Room.findById(roomId);
    if (!room) {
      throw new ApiError(404, "Room not found");
    }

    const role = getRole(room, req.user?.id);
    if (!role) {
      throw new ApiError(404, "Room not found");
    }

    if (action && !can(role, action)) {
      throw new ApiError(403, "You do not have permission to perform this action");
    }

    req.room = room;
    req.role = role;
    next();
  });
}

export default roomAccess;

