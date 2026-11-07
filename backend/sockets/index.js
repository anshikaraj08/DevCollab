import jwt from "jsonwebtoken";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";
import { getRole } from "../utils/roles.js";
import { getAllowedOrigins } from "../config/env.js";
import { DocStore } from "./docStore.js";
import { MongoPersistence } from "./persistence.js";
import { createSocketServer } from "./createSocketServer.js";

/** Connects the real-time server to MongoDB persistence, Redis scale-out adapter, and JWT settings. */
export function initSockets(httpServer, { redisClients = null, persistence = null } = {}) {
  const redisSync = redisClients
    ? {
        instanceId: redisClients.instanceId,
        publishUpdate: async (roomId, update) => {
          const payload = JSON.stringify({
            instanceId: redisClients.instanceId,
            roomId,
            update: Buffer.from(update).toString("base64"),
          });
          await redisClients.pubClient.publish("devcollab:replica:updates", payload);
        },
        acquireCompactionLease: async (roomId, ttlMs = 30000) => {
          const res = await redisClients.redisClient.set(
            `compact:${roomId}`,
            redisClients.instanceId,
            "PX",
            ttlMs,
            "NX"
          );
          return res === "OK";
        },
        releaseCompactionLease: async (roomId) => {
          const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
            else
              return 0
            end
          `;
          try {
            await redisClients.redisClient.eval(script, 1, `compact:${roomId}`, redisClients.instanceId);
          } catch (err) {
            logger.error?.({ err: err.message, roomId }, "Failed to release compaction lease");
          }
        },
      }
    : null;

  const store = new DocStore({
    logger,
    persistence: persistence || new MongoPersistence({ logger }),
    redisSync,
  });

  const allowedOrigins = getAllowedOrigins(process.env);

  const io = createSocketServer(httpServer, {
    store,
    logger,
    corsOrigin: allowedOrigins,
    redisClients,
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
