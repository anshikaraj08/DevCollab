import { Server } from "socket.io";
import * as Y from "yjs";
import { roomKey } from "./roomKey.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_UPDATE_BYTES = 512 * 1024; // largest single Yjs update we accept
const MAX_EVENTS_PER_SECOND = 120;   // per socket

const toBytes = (x) => (x instanceof Uint8Array ? x : x instanceof ArrayBuffer ? new Uint8Array(x) : null);

/**
 * All the real-time logic. Everything it needs from the outside is passed in,
 * so it can be tested without MongoDB.
 */
export function createSocketServer(httpServer, deps) {
  const { store, corsOrigin, verifyToken, getUser, getRoomForMember, logger = console } = deps;

  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    maxHttpBufferSize: 1e6,
  });
  const awarenessByRoom = new Map(); // roomId -> Map(socketId -> { clientId, update })
  const socketsByUserId = new Map(); // userId -> Set(socketId)

  store.onSaved = (roomId, at) => io.to(roomKey(roomId)).emit("room:saved", { roomId, at });
  store.onServerUpdate = (roomId, update) => io.to(roomKey(roomId)).emit("yjs:update", { roomId, update });

  // 1) Who is connecting? The access token is sent in the handshake.
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
      next();
    } catch {
      next(new Error("AUTH"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.user.id;
    let userSockets = socketsByUserId.get(userId);
    if (!userSockets) socketsByUserId.set(userId, (userSockets = new Set()));
    userSockets.add(socket.id);

    socket.data.rooms = new Set();
    socket.data.roles = {};
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
      const map = awarenessByRoom.get(roomId);
      const info = map?.get(socket.id);
      if (info) {
        map.delete(socket.id);
        if (map.size === 0) awarenessByRoom.delete(roomId);
        io.to(roomKey(roomId)).emit("awareness:remove", { roomId, clientId: info.clientId });
      }
      await socket.leave(roomKey(roomId));
      await store.release(roomId);
      logger.info({ userId: socket.data.user.id, roomId }, "Socket left room");
    };

    // 2) Join a room: only members are allowed. The reply carries the whole document and role.
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
        const awareness = [...(awarenessByRoom.get(roomId)?.values() ?? [])].map((s) => s.update);
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
      socket.to(roomKey(roomId)).emit("yjs:update", { roomId, update });
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
      let map = awarenessByRoom.get(roomId);
      if (!map) awarenessByRoom.set(roomId, (map = new Map()));
      map.set(socket.id, { clientId, update });
      socket.to(roomKey(roomId)).emit("awareness:update", { roomId, update });
    });

    socket.on("disconnect", () => {
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

  // Synchronize room membership: updates roles or removes disconnected/removed members
  io.syncRoomMembership = async (roomId) => {
    try {
      const socketsInRoom = await io.in(roomKey(roomId)).fetchSockets();
      for (const s of socketsInRoom) {
        const room = await getRoomForMember(roomId, s.data.user.id);
        if (!room) {
          logger.info({ userId: s.data.user.id, roomId }, "Socket removed from room via sync");
          s.emit("room:removed", { roomId });
          const map = awarenessByRoom.get(roomId);
          const info = map?.get(s.id);
          if (info) {
            map.delete(s.id);
            if (map.size === 0) awarenessByRoom.delete(roomId);
            io.to(roomKey(roomId)).emit("awareness:remove", { roomId, clientId: info.clientId });
          }
          s.data.rooms?.delete(roomId);
          delete s.data.roles?.[roomId];
          await s.leave(roomKey(roomId));
          await store.release(roomId);
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
