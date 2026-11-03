import jwt from "jsonwebtoken";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";
import { DocStore } from "./docStore.js";
import { createSocketServer } from "./createSocketServer.js";
 
/** Connects the real-time server to your real database and JWT settings. */
export function initSockets(httpServer) {
  const store = new DocStore({
    logger,
    loadRoom: async (roomId) => {
      const room = await Room.findById(roomId).select("+yState code");   // not .lean(): keeps yState a Buffer
      return room ? { code: room.code, yState: room.yState } : null;
    },
    saveRoom: (roomId, { code, yState }) =>
      Room.updateOne({ _id: roomId }, { $set: { code, yState } }),
  });
 
  const io = createSocketServer(httpServer, {
    store,
    logger,
    corsOrigin: process.env.CLIENT_URL,
    verifyToken: (token) => jwt.verify(token, process.env.JWT_ACCESS_SECRET),
    getUser: async (id) => {
      const user = await User.findById(id).select("name");
      return user ? { id: user._id, name: user.name } : null;
    },
    getRoomForMember: async (roomId, userId) => {
      const room = await Room.findOne({ _id: roomId, users: userId }).select("title language").lean();
      return room ? { id: String(room._id), title: room.title, language: room.language } : null;
    },
  });
 
  return { io, store };
}

