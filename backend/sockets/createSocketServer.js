import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import * as Y from "yjs";
import { roomKey } from "./roomKey.js";
import { activeSocketsGauge } from "../config/metrics.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_UPDATE_BYTES = 512 * 1024; // largest single Yjs update we accept
const MAX_EVENTS_PER_SECOND = 120; // per socket

const toBytes = (x) => {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (x && Array.isArray(x.data)) return new Uint8Array(x.data);
  if (Array.isArray(x)) return new Uint8Array(x);
  return null;
};

/**
 * All real-time socket and collaborative logic.
 * Supports both standalone single-process mode and multi-instance scale-out via Redis adapter.
 */
export function createSocketServer(httpServer, deps) {
  const {
    store,
    corsOrigin,
    verifyToken,
    getUser,
    getRoomForMember,
    redisClients = null,
    logger = console,
  } = deps;

  const allowedOrigins = Array.isArray(corsOrigin)
    ? corsOrigin
    : typeof corsOrigin === "string"
    ? [corsOrigin]
    : corsOrigin;

  const corsConfig =
    typeof corsOrigin === "function"
      ? { origin: corsOrigin, credentials: true }
      : {
          origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const normalized = origin.trim().replace(/\/+$/, "");
            const list = (Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins]).map((o) =>
              typeof o === "string" ? o.trim().replace(/\/+$/, "") : o
            );
            if (list.includes(normalized)) {
              return callback(null, true);
            }
            return callback(new Error("CORS origin denied"), false);
          },
          credentials: true,
        };

  const io = new Server(httpServer, {
    cors: corsConfig,
    maxHttpBufferSize: 1e6,
  });

  // Attach Redis adapter and replica updates subscriber if Redis is configured
  if (redisClients?.pubClient && redisClients?.subClient) {
    const { pubClient, subClient, instanceId } = redisClients;
    io.adapter(createAdapter(pubClient, subClient));

    const REPLICA_CHANNEL = "devcollab:replica:updates";
    subClient.subscribe(REPLICA_CHANNEL, (err) => {
      if (err) {
        logger.error?.({ err: err.message }, "[Redis] Failed to subscribe to replica channel");
      }
    });

    subClient.on("message", (channel, message) => {
      if (channel !== REPLICA_CHANNEL) return;
      try {
        const data = JSON.parse(message);
        if (!data || data.instanceId === instanceId) return;
        const { roomId, update: base64Update } = data;
        const entry = store.peek(roomId);
        if (!entry) return;

        const update = Buffer.from(base64Update, "base64");
        Y.applyUpdate(entry.doc, new Uint8Array(update), "redis");
      } catch (err) {
        logger.error?.({ err: err.message }, "[Redis] Error applying replica update");
      }
    });
  }

  const socketsByUserId = new Map(); // userId -> Set(socketId)

  store.onSaved = (roomId, at) => io.to(roomKey(roomId)).emit("room:saved", { roomId, at });
  store.onServerUpdate = (roomId, update) => io.to(roomKey(roomId)).emit("yjs:update", { roomId, update });

  // 1) Authentication handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("AUTH"));
      const payload = verifyToken(token);
      const user = await getUser(payload.id);
      if (!user) return next(new Error("AUTH"));
      const userId = String(user.id);

      // Max 10 concurrent sockets per user
      const existing = socketsByUserId.get(userId);
      if (existing && existing.size >= 10) {
        logger.warn({ userId }, "Max concurrent sockets reached (10), connection rejected");
        return next(new Error("TOO_MANY"));
      }

      socket.data.user = { id: userId, name: user.name };
      socket.data.awareness = {};
      next();
    } catch {
      next(new Error("AUTH"));
    }
  });

  io.on("connection", (socket) => {
    activeSocketsGauge?.inc?.();
    const userId = socket.data.user.id;
    let userSockets = socketsByUserId.get(userId);
    if (!userSockets) socketsByUserId.set(userId, (userSockets = new Set()));
    userSockets.add(socket.id);

    // Join per-user notification channel
    socket.join(`user:${userId}`);

    socket.data.rooms = new Set();
    socket.data.roles = {};
    socket.data.awareness = {};
    socket.data.queue = Promise.resolve();

    const serial = (fn) => {
      const run = socket.data.queue.then(fn);
      socket.data.queue = run.catch(() => {});
      return run;
    };

    let windowStart = Date.now();
    let count = 0;
    const allowed = () => {
      const now = Date.now();
      if (now - windowStart > 1000) {
        windowStart = now;
        count = 0;
      }
      return ++count <= MAX_EVENTS_PER_SECOND;
    };

    const joined = (roomId) => socket.data.rooms.has(roomId);

    const leaveRoom = async (roomId) => {
      if (!joined(roomId)) return;
      socket.data.rooms.delete(roomId);
      delete socket.data.roles[roomId];
      const info = socket.data.awareness?.[roomId];
      if (info) {
        delete socket.data.awareness[roomId];
        io.to(roomKey(roomId)).emit("awareness:remove", { roomId, clientId: info.clientId });
      }
      await socket.leave(roomKey(roomId));
      await store.release(roomId);
      logger.info({ userId: socket.data.user.id, roomId }, "Socket left room");
    };

    // 2) Join a room: only members are allowed. Cross-instance awareness collected.
    socket.on("room:join", (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      serial(async () => {
        const roomId = String(payload?.roomId ?? "");
        if (!OBJECT_ID.test(roomId)) return reply({ ok: false, error: "BAD_ROOM_ID" });
        const room = await getRoomForMember(roomId, socket.data.user.id);
        if (!room) return reply({ ok: false, error: "FORBIDDEN" });

        socket.data.roles[roomId] = room.role;

        let entry;
        if (joined(roomId)) {
          entry = store.peek(roomId);
        } else {
          entry = await store.acquire(roomId);
          socket.data.rooms.add(roomId);
          await socket.join(roomKey(roomId));
        }

        // Collect awareness updates from all sockets across all cluster instances
        const remoteSockets = await io.in(roomKey(roomId)).fetchSockets();
        const awareness = [];
        for (const s of remoteSockets) {
          if (s.id === socket.id) continue;
          const aw = s.data?.awareness?.[roomId];
          const b = toBytes(aw?.update);
          if (b) awareness.push(b);
        }

        logger.info({ userId: socket.data.user.id, roomId, role: room.role }, "Socket joined room");
        reply({ ok: true, state: Y.encodeStateAsUpdate(entry.doc), awareness, room, user: socket.data.user });
      }).catch((err) => {
        logger.error({ err }, "room:join failed");
        reply({ ok: false, error: "SERVER" });
      });
    });

    socket.on("room:leave", (payload) => {
      serial(() => leaveRoom(String(payload?.roomId ?? ""))).catch((err) =>
        logger.error({ err }, "room:leave failed"));
    });

    // 3) Document changes: viewers rejected with READ_ONLY
    socket.on("yjs:update", (payload) => {
      if (!allowed()) {
        logger.warn({ userId: socket.data.user.id }, "Socket event rate limit hit on yjs:update");
        return socket.emit("room:error", { error: "RATE_LIMIT" });
      }
      const roomId = String(payload?.roomId ?? "");
      if (socket.data.roles[roomId] === "viewer") {
        return socket.emit("room:error", { roomId, error: "READ_ONLY" });
      }
      const update = toBytes(payload?.update);
      if (!joined(roomId) || !update || update.byteLength > MAX_UPDATE_BYTES) {
        return socket.emit("room:error", { roomId, error: "BAD_UPDATE" });
      }
      try {
        Y.applyUpdate(store.peek(roomId).doc, update, socket.id);
      } catch {
        return socket.emit("room:error", { roomId, error: "BAD_UPDATE" });
      }
      socket.to(roomKey(roomId)).emit("yjs:update", {
        roomId,
        update,
        sentAt: payload?.sentAt,
      });
    });

    // 4) Cursor and presence
    socket.on("awareness:update", (payload) => {
      if (!allowed()) {
        logger.warn({ userId: socket.data.user.id }, "Socket event rate limit hit on awareness:update");
        return;
      }
      const roomId = String(payload?.roomId ?? "");
      const update = toBytes(payload?.update);
      const clientId = Number(payload?.clientId);
      if (!joined(roomId) || !update || update.byteLength > 4096 || !Number.isInteger(clientId)) return;

      socket.data.awareness = socket.data.awareness || {};
      socket.data.awareness[roomId] = { clientId, update };

      socket.to(roomKey(roomId)).emit("awareness:update", {
        roomId,
        update,
        sentAt: payload?.sentAt,
      });
    });

    socket.on("disconnect", () => {
      activeSocketsGauge?.dec?.();
      const uSockets = socketsByUserId.get(userId);
      if (uSockets) {
        uSockets.delete(socket.id);
        if (uSockets.size === 0) socketsByUserId.delete(userId);
      }

      serial(async () => {
        for (const roomId of [...socket.data.rooms]) await leaveRoom(roomId);
      }).catch((err) => logger.error({ err }, "cleanup after disconnect failed"));
    });
  });

  // Synchronize room membership across all instances
  io.syncRoomMembership = async (roomId) => {
    try {
      const socketsInRoom = await io.in(roomKey(roomId)).fetchSockets();
      for (const s of socketsInRoom) {
        const room = await getRoomForMember(roomId, s.data.user.id);
        if (!room) {
          logger.info({ userId: s.data.user.id, roomId }, "Socket removed from room via sync");
          s.emit("room:removed", { roomId });
          const info = s.data?.awareness?.[roomId];
          if (info) {
            if (s.data?.awareness) delete s.data.awareness[roomId];
            io.to(roomKey(roomId)).emit("awareness:remove", { roomId, clientId: info.clientId });
          }
          await s.leave(roomKey(roomId));

          const local = io.sockets.sockets.get(s.id);
          if (local) {
            local.data.rooms?.delete(roomId);
            delete local.data.roles?.[roomId];
            await store.release(roomId);
          }
        } else {
          s.data.roles = s.data.roles || {};
          if (s.data.roles[roomId] !== room.role) {
            logger.info(
              { userId: s.data.user.id, roomId, oldRole: s.data.roles[roomId], newRole: room.role },
              "Socket role updated via sync"
            );
            s.data.roles[roomId] = room.role;
            s.emit("room:role", { roomId, role: room.role });
          }
        }
      }
    } catch (err) {
      logger.error({ err, roomId }, "syncRoomMembership error");
    }
  };

  return io;
}
