import jwt from "jsonwebtoken";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";
import { getRole } from "../utils/roles.js";
import { getAllowedOrigins } from "../config/env.js";
import { DocStore } from "./docStore.js";
import { createSocketServer } from "./createSocketServer.js";

/** Connects the real-time server to your real database and JWT settings. */
export function initSockets(httpServer) {
  const store = new DocStore({
    logger,
    loadRoom: async (roomId) => {
      const room = await Room.findById(roomId).select("+yState code"); // not .lean(): keeps yState a Buffer
      return room ? { code: room.code, yState: room.yState } : null;
    },
    saveRoom: (roomId, { code, yState }) =>
      Room.updateOne({ _id: roomId }, { $set: { code, yState } }),
  });

  const allowedOrigins = getAllowedOrigins(process.env);

  const io = createSocketServer(httpServer, {
    store,
    logger,
    corsOrigin: allowedOrigins,
    verifyToken: (token) => jwt.verify(token, process.env.JWT_ACCESS_SECRET),
    getUser: async (id) => {
      const user = await User.findById(id).select("name");
      return user ? { id: user._id, name: user.name } : null;
    },
    getRoomForMember: async (roomId, userId) => {
      const room = await Room.findOne({ _id: roomId, users: userId }).select("title language createdBy roles users");
      if (!room) return null;
      return {
        id: String(room._id),
        title: room.title,
        language: room.language,
        role: getRole(room, userId),
      };
    },
  });

  return { io, store };
}
