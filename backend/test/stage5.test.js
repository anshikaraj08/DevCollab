import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import { io as ioClient } from "socket.io-client";
import * as Y from "yjs";
import jwt from "jsonwebtoken";
import { setupTestDb } from "./helpers/setupApp.js";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import YUpdate from "../models/yUpdate.model.js";
import { MongoPersistence } from "../sockets/persistence.js";
import { DocStore } from "../sockets/docStore.js";
import { createSocketServer } from "../sockets/createSocketServer.js";

/**
 * In-memory Redis Mock that implements pub/sub and distributed lock primitives
 * matching ioredis and @socket.io/redis-adapter for isolated multi-instance testing.
 */
class MemoryRedisBus {
  constructor() {
    this.bus = new EventEmitter();
    this.bus.setMaxListeners(100);
    this.storage = new Map();
    this.dropPubSub = false; // Chaos test flag
  }

  createClient(role = "cmd") {
    const bus = this.bus;
    const storage = this.storage;
    const self = this;
    const client = new EventEmitter();
    client.status = "ready";
    client.role = role;

    client.ping = async () => "PONG";

    client.publish = async (channel, message) => {
      const channelStr = channel.toString();
      if (self.dropPubSub) {
        return 0; // Simulate dropped pub/sub packet across all channels
      }
      const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
      setImmediate(() => {
        bus.emit("pub", channelStr, buf);
      });
      return 1;
    };

    client.subscribe = async (channels, cb) => {
      const list = Array.isArray(channels) ? channels : [channels];
      const handler = (ch, buf) => {
        if (list.includes(ch)) {
          client.emit("message", ch, buf.toString("utf8"));
          client.emit("messageBuffer", Buffer.from(ch), buf);
        }
      };
      bus.on("pub", handler);
      client.on("close", () => bus.off("pub", handler));
      if (typeof cb === "function") cb(null);
      return "OK";
    };

    client.psubscribe = async (pattern, cb) => {
      const prefix = pattern.replace(/\*$/, "");
      const handler = (ch, buf) => {
        if (ch.startsWith(prefix)) {
          client.emit("pmessage", pattern, ch, buf.toString("utf8"));
          client.emit("pmessageBuffer", Buffer.from(pattern), Buffer.from(ch), buf);
        }
      };
      bus.on("pub", handler);
      client.on("close", () => bus.off("pub", handler));
      if (typeof cb === "function") cb(null);
      return "OK";
    };

    client.punsubscribe = async (pattern, cb) => {
      if (typeof cb === "function") cb(null);
      return "OK";
    };

    client.set = async (key, val, ...args) => {
      const isNx = args.includes("NX");
      if (isNx && storage.has(key)) {
        return null;
      }
      storage.set(key, val);
      const pxIdx = args.indexOf("PX");
      if (pxIdx !== -1) {
        const ttl = Number(args[pxIdx + 1]);
        if (ttl > 0) {
          setTimeout(() => {
            if (storage.get(key) === val) {
              storage.delete(key);
            }
          }, ttl).unref?.();
        }
      }
      return "OK";
    };

    client.get = async (key) => storage.get(key) || null;
    client.del = async (key) => {
      const has = storage.has(key);
      storage.delete(key);
      return has ? 1 : 0;
    };

    client.eval = async (script, numKeys, key, arg) => {
      if (storage.get(key) === arg) {
        storage.delete(key);
        return 1;
      }
      return 0;
    };

    client.send_command = (cmd, args, cb) => {
      if (cmd === "PUBSUB" && args?.[0] === "NUMSUB") {
        const channel = args[1];
        if (typeof cb === "function") {
          cb(null, [channel, 2]);
        }
        return;
      }
      if (typeof cb === "function") {
        cb(null, "OK");
      }
    };

    client.quit = async () => {
      client.status = "end";
      client.emit("close");
      return "OK";
    };

    client.disconnect = () => {
      client.status = "end";
      client.emit("close");
    };

    return client;
  }
}

describe("Stage 5: Scale-out with Redis & Append-Only Log Persistence", () => {
  let dbHelper;
  let testUserA;
  let testUserB;
  let tokenA;
  let tokenB;

  before(async () => {
    dbHelper = await setupTestDb();
    process.env.JWT_ACCESS_SECRET = "stage-5-test-secret-32-chars-long";

    testUserA = await User.create({
      name: "Alice Instance 1",
      email: "alice_scale@example.com",
      password: "Password123!",
      isVerified: true,
    });
    tokenA = jwt.sign({ id: String(testUserA._id) }, process.env.JWT_ACCESS_SECRET);

    testUserB = await User.create({
      name: "Bob Instance 2",
      email: "bob_scale@example.com",
      password: "Password123!",
      isVerified: true,
    });
    tokenB = jwt.sign({ id: String(testUserB._id) }, process.env.JWT_ACCESS_SECRET);
  });

  after(async () => {
    await dbHelper.teardown();
  });

  beforeEach(async () => {
    await Room.deleteMany({});
    await YUpdate.deleteMany({});
  });

  describe("1. MongoPersistence Unit Tests", () => {
    it("buffers rapid appends within 500ms and flushes as one merged YUpdate", async () => {
      const baseDoc = new Y.Doc();
      baseDoc.getText("code").insert(0, "const x = 1;");
      const baseState = Buffer.from(Y.encodeStateAsUpdate(baseDoc));

      const room = await Room.create({
        title: "Append Batching Room",
        language: "javascript",
        code: "const x = 1;",
        yState: baseState,
        createdBy: testUserA._id,
        users: [testUserA._id],
      });

      const persistence = new MongoPersistence({ batchIntervalMs: 50 });

      // Generate 2 Yjs updates on top of baseDoc
      const updates = [];
      baseDoc.on("update", (u) => updates.push(u));

      baseDoc.getText("code").insert(baseDoc.getText("code").length, "\nconst y = 2;");
      baseDoc.getText("code").insert(baseDoc.getText("code").length, "\nconst z = 3;");

      assert.equal(updates.length, 2);

      // Append both to persistence
      persistence.append(room._id, updates[0]);
      persistence.append(room._id, updates[1]);

      // Assert queued in memory before flush
      assert.equal(persistence.buffers.get(String(room._id))?.length, 2);

      // Flush to MongoDB
      const created = await persistence.flush(room._id);
      assert.ok(created);

      // Assert exactly 1 YUpdate document created in MongoDB
      const dbUpdates = await YUpdate.find({ room: room._id });
      assert.equal(dbUpdates.length, 1);

      // Assert loading the room reproduces the merged content
      const loaded = await persistence.load(room._id);
      assert.equal(loaded.code, "const x = 1;\nconst y = 2;\nconst z = 3;");
    });

    it("applies base yState then all updates in _id order during load", async () => {
      const doc = new Y.Doc();
      const ytext = doc.getText("code");
      ytext.insert(0, "Line 1\n");
      const baseState = Buffer.from(Y.encodeStateAsUpdate(doc));

      const room = await Room.create({
        title: "Load Order Room",
        language: "javascript",
        code: "Line 1\n",
        yState: baseState,
        createdBy: testUserA._id,
        users: [testUserA._id],
      });

      // Create two sequential updates in MongoDB
      const uDoc1 = new Y.Doc();
      Y.applyUpdate(uDoc1, baseState);
      let update1;
      uDoc1.on("update", (u) => (update1 = u));
      uDoc1.getText("code").insert(7, "Line 2\n");

      const uDoc2 = new Y.Doc();
      Y.applyUpdate(uDoc2, baseState);
      Y.applyUpdate(uDoc2, update1);
      let update2;
      uDoc2.on("update", (u) => (update2 = u));
      uDoc2.getText("code").insert(14, "Line 3\n");

      const rec1 = await YUpdate.create({ room: room._id, update: Buffer.from(update1) });
      const rec2 = await YUpdate.create({ room: room._id, update: Buffer.from(update2) });

      const persistence = new MongoPersistence();
      const loaded = await persistence.load(room._id);

      assert.equal(loaded.code, "Line 1\nLine 2\nLine 3\n");
      assert.equal(String(loaded.lastSeenId), String(rec2._id));
    });

    it("compacts room log, updates Room.compactedUntil, and removes only applied updates", async () => {
      const doc = new Y.Doc();
      const ytext = doc.getText("code");
      ytext.insert(0, "init");
      const baseState = Buffer.from(Y.encodeStateAsUpdate(doc));

      const room = await Room.create({
        title: "Compaction Test Room",
        language: "javascript",
        code: "init",
        yState: baseState,
        createdBy: testUserA._id,
        users: [testUserA._id],
      });

      const persistence = new MongoPersistence();

      // Append 3 updates
      const updates = [];
      doc.on("update", (u) => updates.push(u));

      ytext.insert(4, " - part 1");
      ytext.insert(13, " - part 2");
      ytext.insert(22, " - part 3");

      for (const u of updates) {
        await YUpdate.create({ room: room._id, update: Buffer.from(u) });
      }

      assert.equal(await YUpdate.countDocuments({ room: room._id }), 3);

      const compactResult = await persistence.compact(room._id);
      assert.equal(compactResult.compacted, true);
      assert.equal(compactResult.count, 3);

      // Verify Room was updated with full compacted state and checkpoint
      const updatedRoom = await Room.findById(room._id).select("+yState code compactedUntil");
      assert.equal(updatedRoom.code, "init - part 1 - part 2 - part 3");
      assert.ok(updatedRoom.compactedUntil);
      assert.equal(String(updatedRoom.compactedUntil), String(compactResult.compactedUntil));

      // Verify all applied updates <= compactedUntil were deleted
      const remainingUpdates = await YUpdate.find({ room: room._id });
      assert.equal(remainingUpdates.length, 0);
    });

    it("preserves uncompacted concurrent updates (_id > compactedUntil)", async () => {
      const doc = new Y.Doc();
      doc.getText("code").insert(0, "start");
      const baseState = Buffer.from(Y.encodeStateAsUpdate(doc));

      const room = await Room.create({
        title: "Race Invariant Room",
        language: "javascript",
        code: "start",
        yState: baseState,
        createdBy: testUserA._id,
        users: [testUserA._id],
      });

      const persistence = new MongoPersistence();
      const updates = [];
      doc.on("update", (u) => updates.push(u));

      doc.getText("code").insert(5, " A");
      doc.getText("code").insert(7, " B");

      await YUpdate.create({ room: room._id, update: Buffer.from(updates[0]) });
      await YUpdate.create({ room: room._id, update: Buffer.from(updates[1]) });

      // Run compaction on updates 1 and 2
      await persistence.compact(room._id);

      // Simulate concurrent update arriving with newer _id
      doc.getText("code").insert(9, " C");
      const rec3 = await YUpdate.create({ room: room._id, update: Buffer.from(updates[2]) });

      // Load room: compacted base + newer update
      const loaded = await persistence.load(room._id);
      assert.equal(loaded.code, "start A B C");
      assert.equal(String(loaded.lastSeenId), String(rec3._id));
    });

    it("loads legacy rooms with text-only and empty log without errors", async () => {
      const room = await Room.create({
        title: "Legacy Phase 1 Room",
        language: "python",
        code: "print('hello')",
        yState: null,
        createdBy: testUserA._id,
        users: [testUserA._id],
      });

      const persistence = new MongoPersistence();
      const loaded = await persistence.load(room._id);
      assert.equal(loaded.code, "print('hello')");
      assert.equal(loaded.lastSeenId, null);
    });
  });

  describe("2. Multi-Instance Socket & Redis Integration Tests", () => {
    let redisBus;
    let server1, server2;
    let io1, io2;
    let store1, store2;
    let persistence1, persistence2;
    let port1, port2;
    let testRoom;

    before(async () => {
      redisBus = new MemoryRedisBus();
      persistence1 = new MongoPersistence({ batchIntervalMs: 50 });
      persistence2 = new MongoPersistence({ batchIntervalMs: 50 });

      // Setup Server Instance 1
      const httpServer1 = http.createServer();
      port1 = await new Promise((resolve) => httpServer1.listen(0, () => resolve(httpServer1.address().port)));
      server1 = httpServer1;

      const redisClients1 = {
        redisClient: redisBus.createClient("cmd1"),
        pubClient: redisBus.createClient("pub1"),
        subClient: redisBus.createClient("sub1"),
        instanceId: "inst_1",
      };

      const redisSync1 = {
        instanceId: "inst_1",
        publishUpdate: async (roomId, update) => {
          const payload = JSON.stringify({
            instanceId: "inst_1",
            roomId,
            update: Buffer.from(update).toString("base64"),
          });
          await redisClients1.pubClient.publish("devcollab:replica:updates", payload);
        },
        acquireCompactionLease: async (roomId, ttlMs = 30000) => {
          const res = await redisClients1.redisClient.set(`compact:${roomId}`, "inst_1", "PX", ttlMs, "NX");
          return res === "OK";
        },
        releaseCompactionLease: async (roomId) => {
          await redisClients1.redisClient.eval("", 1, `compact:${roomId}`, "inst_1");
        },
      };

      store1 = new DocStore({
        persistence: persistence1,
        redisSync: redisSync1,
        resyncIntervalMs: 200,
      });

      io1 = createSocketServer(httpServer1, {
        store: store1,
        corsOrigin: "*",
        redisClients: redisClients1,
        verifyToken: (t) => jwt.verify(t, process.env.JWT_ACCESS_SECRET),
        getUser: async (id) => User.findById(id).select("name"),
        getRoomForMember: async (roomId, userId) => {
          const r = await Room.findOne({ _id: roomId, users: userId });
          if (!r) return null;
          return {
            id: String(r._id),
            title: r.title,
            language: r.language,
            role: r.roles?.get?.(String(userId)) || "editor",
          };
        },
      });

      // Setup Server Instance 2
      const httpServer2 = http.createServer();
      port2 = await new Promise((resolve) => httpServer2.listen(0, () => resolve(httpServer2.address().port)));
      server2 = httpServer2;

      const redisClients2 = {
        redisClient: redisBus.createClient("cmd2"),
        pubClient: redisBus.createClient("pub2"),
        subClient: redisBus.createClient("sub2"),
        instanceId: "inst_2",
      };

      const redisSync2 = {
        instanceId: "inst_2",
        publishUpdate: async (roomId, update) => {
          const payload = JSON.stringify({
            instanceId: "inst_2",
            roomId,
            update: Buffer.from(update).toString("base64"),
          });
          await redisClients2.pubClient.publish("devcollab:replica:updates", payload);
        },
        acquireCompactionLease: async (roomId, ttlMs = 30000) => {
          const res = await redisClients2.redisClient.set(`compact:${roomId}`, "inst_2", "PX", ttlMs, "NX");
          return res === "OK";
        },
        releaseCompactionLease: async (roomId) => {
          await redisClients2.redisClient.eval("", 1, `compact:${roomId}`, "inst_2");
        },
      };

      store2 = new DocStore({
        persistence: persistence2,
        redisSync: redisSync2,
        resyncIntervalMs: 200,
      });

      io2 = createSocketServer(httpServer2, {
        store: store2,
        corsOrigin: "*",
        redisClients: redisClients2,
        verifyToken: (t) => jwt.verify(t, process.env.JWT_ACCESS_SECRET),
        getUser: async (id) => User.findById(id).select("name"),
        getRoomForMember: async (roomId, userId) => {
          const r = await Room.findOne({ _id: roomId, users: userId });
          if (!r) return null;
          return {
            id: String(r._id),
            title: r.title,
            language: r.language,
            role: r.roles?.get?.(String(userId)) || "editor",
          };
        },
      });
    });

    after(async () => {
      await new Promise((r) => io1.close(r));
      await new Promise((r) => io2.close(r));
      await new Promise((r) => server1.close(r));
      await new Promise((r) => server2.close(r));
    });

    beforeEach(async () => {
      redisBus.dropPubSub = false;
      const baseDoc = new Y.Doc();
      baseDoc.getText("code").insert(0, "// Start\n");
      const baseState = Buffer.from(Y.encodeStateAsUpdate(baseDoc));

      testRoom = await Room.create({
        title: "Scale-Out Room",
        language: "javascript",
        code: "// Start\n",
        yState: baseState,
        createdBy: testUserA._id,
        users: [testUserA._id, testUserB._id],
        roles: new Map([
          [String(testUserB._id), "editor"],
        ]),
      });
    });

    it("two clients on DIFFERENT server instances edit and converge", async () => {
      const client1 = ioClient(`http://localhost:${port1}`, {
        auth: { token: tokenA },
        transports: ["websocket"],
      });

      const client2 = ioClient(`http://localhost:${port2}`, {
        auth: { token: tokenB },
        transports: ["websocket"],
      });

      await Promise.all([
        new Promise((resolve) => client1.on("connect", resolve)),
        new Promise((resolve) => client2.on("connect", resolve)),
      ]);

      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      // 1. Join room from both instances
      const join1 = await new Promise((resolve) =>
        client1.emit("room:join", { roomId: String(testRoom._id) }, resolve)
      );
      assert.equal(join1.ok, true);
      Y.applyUpdate(doc1, new Uint8Array(join1.state));

      const join2 = await new Promise((resolve) =>
        client2.emit("room:join", { roomId: String(testRoom._id) }, resolve)
      );
      assert.equal(join2.ok, true);
      Y.applyUpdate(doc2, new Uint8Array(join2.state));

      // Listen for updates on both clients
      client1.on("yjs:update", (p) => Y.applyUpdate(doc1, new Uint8Array(p.update)));
      client2.on("yjs:update", (p) => Y.applyUpdate(doc2, new Uint8Array(p.update)));

      // 2. Client 1 on Instance 1 types
      let updateFrom1;
      doc1.on("update", (u, origin) => {
        if (origin !== "remote") updateFrom1 = u;
      });
      doc1.getText("code").insert(9, "const a = 100;\n");
      client1.emit("yjs:update", { roomId: String(testRoom._id), update: updateFrom1 });

      // Wait for Client 2 on Instance 2 to receive it
      await new Promise((r) => setTimeout(r, 200));

      assert.equal(doc2.getText("code").toString(), "// Start\nconst a = 100;\n");

      // 3. Client 2 on Instance 2 types
      let updateFrom2;
      doc2.on("update", (u, origin) => {
        if (origin !== "remote") updateFrom2 = u;
      });
      doc2.getText("code").insert(24, "const b = 200;\n");
      client2.emit("yjs:update", { roomId: String(testRoom._id), update: updateFrom2 });

      // Wait for Client 1 on Instance 1 to receive it
      await new Promise((r) => setTimeout(r, 200));

      // Assert full convergence across both clients and both servers
      const expectedText = "// Start\nconst a = 100;\nconst b = 200;\n";
      assert.equal(doc1.getText("code").toString(), expectedText);
      assert.equal(doc2.getText("code").toString(), expectedText);
      assert.equal(await store1.getText(testRoom._id), expectedText);
      assert.equal(await store2.getText(testRoom._id), expectedText);

      client1.disconnect();
      client2.disconnect();
    });

    it("shares awareness cursors and presence across different instances", async () => {
      const client1 = ioClient(`http://localhost:${port1}`, {
        auth: { token: tokenA },
        transports: ["websocket"],
      });

      const client2 = ioClient(`http://localhost:${port2}`, {
        auth: { token: tokenB },
        transports: ["websocket"],
      });

      await Promise.all([
        new Promise((resolve) => client1.on("connect", resolve)),
        new Promise((resolve) => client2.on("connect", resolve)),
      ]);

      await new Promise((resolve) => client1.emit("room:join", { roomId: String(testRoom._id) }, resolve));
      await new Promise((resolve) => client2.emit("room:join", { roomId: String(testRoom._id) }, resolve));

      // Client 1 sends awareness on Instance 1
      const awarenessPromise = new Promise((resolve) => {
        client2.on("awareness:update", (p) => {
          if (p.roomId === String(testRoom._id)) {
            resolve(p);
          }
        });
      });

      client1.emit("awareness:update", {
        roomId: String(testRoom._id),
        clientId: 42,
        update: new Uint8Array([1, 2, 3, 4]),
      });

      const received = await awarenessPromise;
      assert.ok(received);
      assert.deepEqual(Array.from(new Uint8Array(received.update)), [1, 2, 3, 4]);

      // A new client joining on Instance 2 receives Client 1's awareness in join response
      const client3 = ioClient(`http://localhost:${port2}`, {
        auth: { token: tokenB },
        transports: ["websocket"],
      });
      await new Promise((resolve) => client3.on("connect", resolve));

      const join3 = await new Promise((resolve) =>
        client3.emit("room:join", { roomId: String(testRoom._id) }, resolve)
      );

      assert.equal(join3.ok, true);
      assert.ok(join3.awareness.length >= 1);

      client1.disconnect();
      client2.disconnect();
      client3.disconnect();
    });

    it("synchronizes membership and role updates across instances", async () => {
      const client2 = ioClient(`http://localhost:${port2}`, {
        auth: { token: tokenB },
        transports: ["websocket"],
      });
      await new Promise((resolve) => client2.on("connect", resolve));

      await new Promise((resolve) => client2.emit("room:join", { roomId: String(testRoom._id) }, resolve));

      const roleUpdatePromise = new Promise((resolve) => {
        client2.on("room:role", (data) => {
          if (data.roomId === String(testRoom._id)) resolve(data.role);
        });
      });

      // Update role in DB and trigger sync from Instance 1
      testRoom.roles.set(String(testUserB._id), "viewer");
      await testRoom.save();

      await io1.syncRoomMembership(String(testRoom._id));

      const newRole = await roleUpdatePromise;
      assert.equal(newRole, "viewer");

      // The demotion must be enforced on Instance 2, not only announced
      const readOnlyPromise = new Promise((resolve) => {
        client2.on("room:error", (e) => {
          if (e.error === "READ_ONLY") resolve(e);
        });
      });
      const probe = new Y.Doc();
      probe.getText("code").insert(0, "x");
      client2.emit("yjs:update", {
        roomId: String(testRoom._id),
        update: Y.encodeStateAsUpdate(probe),
      });
      const rejected = await readOnlyPromise;
      assert.equal(rejected.error, "READ_ONLY");

      // Restore editor role for later tests
      testRoom.roles.delete(String(testUserB._id));
      await testRoom.save();

      client2.disconnect();
    });

    it("converges via 30-second resync poll when Redis pub/sub is dropped (chaos test)", async () => {
      const client1 = ioClient(`http://localhost:${port1}`, {
        auth: { token: tokenA },
        transports: ["websocket"],
      });

      const client2 = ioClient(`http://localhost:${port2}`, {
        auth: { token: tokenB },
        transports: ["websocket"],
      });

      await Promise.all([
        new Promise((resolve) => client1.on("connect", resolve)),
        new Promise((resolve) => client2.on("connect", resolve)),
      ]);

      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      const join1 = await new Promise((resolve) =>
        client1.emit("room:join", { roomId: String(testRoom._id) }, resolve)
      );
      Y.applyUpdate(doc1, new Uint8Array(join1.state));

      const join2 = await new Promise((resolve) =>
        client2.emit("room:join", { roomId: String(testRoom._id) }, resolve)
      );
      Y.applyUpdate(doc2, new Uint8Array(join2.state));

      client1.on("yjs:update", (p) => Y.applyUpdate(doc1, new Uint8Array(p.update)));
      client2.on("yjs:update", (p) => Y.applyUpdate(doc2, new Uint8Array(p.update)));

      // Enable CHAOS mode: drop replica pub/sub updates
      redisBus.dropPubSub = true;

      // Client 1 types on Instance 1
      let update;
      doc1.on("update", (u, origin) => {
        if (origin !== "remote") update = u;
      });
      doc1.getText("code").insert(9, "// dropped edit\n");
      client1.emit("yjs:update", { roomId: String(testRoom._id), update });

      // Flush Instance 1 updates to MongoDB
      await persistence1.flush(testRoom._id);

      // Verify Client 2 has NOT received the edit because pub/sub was dropped
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(doc2.getText("code").toString(), "// Start\n");

      // Now wait for Instance 2's resync timer (configured to 200ms) to poll MongoDB
      await new Promise((r) => setTimeout(r, 350));

      // Assert Client 2 and Server 2 have recovered the dropped edit and converged!
      assert.equal(doc2.getText("code").toString(), "// Start\n// dropped edit\n");
      assert.equal(await store2.getText(testRoom._id), "// Start\n// dropped edit\n");

      client1.disconnect();
      client2.disconnect();
    });

    it("prevents split-brain compaction races using Redis lease lock", async () => {
      const leaseKey = `compact:${testRoom._id}`;
      const redisClient1 = redisBus.createClient("cmd1");
      const redisClient2 = redisBus.createClient("cmd2");

      // Instance 1 acquires lease
      const acquired1 = await redisClient1.set(leaseKey, "inst_1", "PX", 30000, "NX");
      assert.equal(acquired1, "OK");

      // Instance 2 attempts to acquire lease on same room -> rejected
      const acquired2 = await redisClient2.set(leaseKey, "inst_2", "PX", 30000, "NX");
      assert.equal(acquired2, null);

      // Instance 1 releases lease
      await redisClient1.eval("", 1, leaseKey, "inst_1");

      // Instance 2 can now acquire lease
      const acquired3 = await redisClient2.set(leaseKey, "inst_2", "PX", 30000, "NX");
      assert.equal(acquired3, "OK");

      await redisClient2.eval("", 1, leaseKey, "inst_2");
    });

    it("continuous typing under concurrent compaction never loses an edit (race test)", async () => {
      const entry = await store1.acquire(testRoom._id);
      const totalEdits = 30;

      // Simultaneously append edits and trigger compaction
      const editsPromise = (async () => {
        for (let i = 0; i < totalEdits; i++) {
          entry.doc.getText("code").insert(entry.doc.getText("code").length, `[${i}]`);
          if (i === 10 || i === 20) {
            // Trigger compaction mid-flight
            await store1.tryCompact(testRoom._id);
          }
          await new Promise((r) => setTimeout(r, 5));
        }
      })();

      await editsPromise;
      await store1.flush(testRoom._id);
      await store1.tryCompact(testRoom._id);
      await store1.release(testRoom._id);

      // Verify that every single edit [0] through [29] is intact
      const finalText = await store1.getText(testRoom._id);
      assert.ok(finalText.startsWith("// Start\n"));
      for (let i = 0; i < totalEdits; i++) {
        assert.ok(finalText.includes(`[${i}]`), `Expected text to include edit [${i}]`);
      }

      // Load with a fresh DocStore (simulating full server reboot)
      const freshStore = new DocStore({ persistence: persistence1 });
      const rebootText = await freshStore.getText(testRoom._id);
      assert.equal(rebootText, finalText);
    });
  });
});
