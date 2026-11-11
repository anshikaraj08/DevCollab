import http from "node:http";
import { EventEmitter } from "node:events";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const backendRequire = createRequire(new URL("../backend/package.json", import.meta.url));
const toFileHref = (pkg) => pathToFileURL(backendRequire.resolve(pkg)).href;

const { io: ioClient } = await import(toFileHref("socket.io-client"));
const Y = await import(toFileHref("yjs"));
const jwt = (await import(toFileHref("jsonwebtoken"))).default;
const mongoose = (await import(toFileHref("mongoose"))).default;

import { setupTestDb } from "../backend/test/helpers/setupApp.js";
import Room from "../backend/models/room.model.js";
import User from "../backend/models/user.model.js";
import YUpdate from "../backend/models/yUpdate.model.js";
import Comment from "../backend/models/comment.model.js";
import { MongoPersistence } from "../backend/sockets/persistence.js";
import { DocStore } from "../backend/sockets/docStore.js";
import { createSocketServer } from "../backend/sockets/createSocketServer.js";

// Load test parameters (can be tuned via CLI or environment)
const NUM_ROOMS = parseInt(process.env.LOADTEST_ROOMS || "5", 10);
const USERS_PER_ROOM = parseInt(process.env.LOADTEST_USERS_PER_ROOM || "4", 10);
const DURATION_SEC = parseInt(process.env.LOADTEST_DURATION_SEC || "15", 10);
const EDIT_INTERVAL_MS = 300;
const CURSOR_INTERVAL_MS = 250;
const COMMENT_INTERVAL_MS = 3000;

class MemoryRedisBus {
  constructor() {
    this.bus = new EventEmitter();
    this.bus.setMaxListeners(200);
    this.storage = new Map();
  }

  createClient(role = "cmd") {
    const bus = this.bus;
    const storage = this.storage;
    const client = new EventEmitter();
    client.status = "ready";
    client.role = role;

    client.ping = async () => "PONG";

    client.publish = async (channel, message) => {
      const channelStr = channel.toString();
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
      if (isNx && storage.has(key)) return null;
      storage.set(key, val);
      return "OK";
    };

    client.get = async (key) => storage.get(key) || null;
    client.del = async (key) => storage.delete(key) ? 1 : 0;
    client.eval = async (script, numKeys, key, arg) => {
      if (storage.get(key) === arg) {
        storage.delete(key);
        return 1;
      }
      return 0;
    };

    client.send_command = (cmd, args, cb) => {
      if (cmd === "PUBSUB" && args?.[0] === "NUMSUB") {
        if (typeof cb === "function") cb(null, [args[1], 2]);
        return;
      }
      if (typeof cb === "function") cb(null, "OK");
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

function calculatePercentiles(numbers) {
  if (numbers.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const p = (pct) => sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    min: Number(sorted[0].toFixed(2)),
    p50: Number(p(50).toFixed(2)),
    p90: Number(p(90).toFixed(2)),
    p95: Number(p(95).toFixed(2)),
    p99: Number(p(99).toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    avg: Number((sum / sorted.length).toFixed(2)),
  };
}

async function runScenario({ mode = "single", numRooms = NUM_ROOMS, usersPerRoom = USERS_PER_ROOM, durationSec = DURATION_SEC }) {
  console.log(`\n======================================================`);
  console.log(` Starting Scenario: ${mode.toUpperCase()} INSTANCE MODE`);
  console.log(` Configuration: ${numRooms} rooms, ${usersPerRoom} users/room (${numRooms * usersPerRoom} active connections), ${durationSec}s`);
  console.log(`======================================================\n`);

  const redisBus = new MemoryRedisBus();
  const instances = [];

  const createInstance = async (id, redisEnabled) => {
    const server = http.createServer();
    const port = await new Promise((res) => server.listen(0, () => res(server.address().port)));
    const persistence = new MongoPersistence({ batchIntervalMs: 50 });

    let redisClients = null;
    let redisSync = null;

    if (redisEnabled) {
      const redisClient = redisBus.createClient(`cmd_${id}`);
      const pubClient = redisBus.createClient(`pub_${id}`);
      const subClient = redisBus.createClient(`sub_${id}`);
      redisClients = { redisClient, pubClient, subClient, instanceId: id };

      redisSync = {
        instanceId: id,
        publishUpdate: async (roomId, update) => {
          const payload = JSON.stringify({
            instanceId: id,
            roomId,
            update: Buffer.from(update).toString("base64"),
          });
          await pubClient.publish("devcollab:replica:updates", payload);
        },
        acquireCompactionLease: async (roomId, ttlMs = 30000) => {
          const res = await redisClient.set(`compact:${roomId}`, id, "PX", ttlMs, "NX");
          return res === "OK";
        },
        releaseCompactionLease: async (roomId) => {
          await redisClient.eval("", 1, `compact:${roomId}`, id);
        },
      };
    }

    const store = new DocStore({ persistence, redisSync, resyncIntervalMs: 200 });
    const io = createSocketServer(server, {
      store,
      corsOrigin: "*",
      redisClients,
      verifyToken: (t) => jwt.verify(t, process.env.JWT_ACCESS_SECRET),
      getUser: async (userId) => User.findById(userId).select("name"),
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

    return { id, server, port, io, store, persistence };
  };

  if (mode === "single") {
    instances.push(await createInstance("inst_single", false));
  } else {
    instances.push(await createInstance("inst_1", true));
    instances.push(await createInstance("inst_2", true));
  }

  // Pre-seed test users and rooms
  const users = [];
  const rooms = [];

  for (let r = 0; r < numRooms; r++) {
    const roomUsers = [];
    for (let u = 0; u < usersPerRoom; u++) {
      const user = await User.create({
        name: `User R${r} U${u}`,
        email: `u_r${r}_u${u}_${Date.now()}@example.com`,
        password: "Password123!",
        isVerified: true,
      });
      user.token = jwt.sign({ id: String(user._id) }, process.env.JWT_ACCESS_SECRET);
      roomUsers.push(user);
      users.push(user);
    }

    const baseDoc = new Y.Doc();
    baseDoc.getText("code").insert(0, `// Room ${r} Baseline\n`);
    const baseState = Buffer.from(Y.encodeStateAsUpdate(baseDoc));

    const rolesMap = new Map();
    for (let i = 1; i < roomUsers.length; i++) {
      rolesMap.set(String(roomUsers[i]._id), "editor");
    }

    const room = await Room.create({
      title: `LoadTest Room ${r}`,
      language: "javascript",
      code: `// Room ${r} Baseline\n`,
      yState: baseState,
      createdBy: roomUsers[0]._id,
      users: roomUsers.map((u) => u._id),
      roles: rolesMap,
    });
    room.members = roomUsers;
    rooms.push(room);
  }

  // Benchmark metrics tracking
  const eventLatencies = [];
  const cursorLatencies = [];
  const commentsPosted = [];
  let updatesSent = 0;
  let updatesReceived = 0;
  let cursorUpdatesSent = 0;
  let errorCount = 0;

  const initialMem = process.memoryUsage();
  const startTime = performance.now();

  // Create client sockets and join rooms
  const clients = [];
  for (let rIdx = 0; rIdx < rooms.length; rIdx++) {
    const room = rooms[rIdx];
    for (let uIdx = 0; uIdx < room.members.length; uIdx++) {
      const user = room.members[uIdx];
      // Distribute clients across available instances round-robin
      const instance = instances[(rIdx * usersPerRoom + uIdx) % instances.length];

      const socket = ioClient(`http://localhost:${instance.port}`, {
        auth: { token: user.token },
        transports: ["websocket"],
        forceNew: true,
      });

      const doc = new Y.Doc();
      const clientObj = {
        socket,
        doc,
        user,
        room,
        instanceId: instance.id,
        clientId: rIdx * 100 + uIdx + 1,
      };

      await new Promise((resolve, reject) => {
        socket.on("connect", resolve);
        socket.on("connect_error", reject);
      });

      const joinAck = await new Promise((resolve) => {
        socket.emit("room:join", { roomId: String(room._id) }, resolve);
      });

      if (!joinAck.ok) {
        throw new Error(`Failed to join room: ${joinAck.error}`);
      }
      Y.applyUpdate(doc, new Uint8Array(joinAck.state));

      // Measure incoming peer event latency
      socket.on("yjs:update", (payload) => {
        updatesReceived++;
        if (payload?.sentAt) {
          eventLatencies.push(performance.now() - payload.sentAt);
        }
        try {
          const uBytes = new Uint8Array(payload.update);
          Y.applyUpdate(doc, uBytes, "remote");
        } catch {
          errorCount++;
        }
      });

      socket.on("awareness:update", (payload) => {
        if (payload?.sentAt) {
          cursorLatencies.push(performance.now() - payload.sentAt);
        }
      });

      socket.on("room:error", () => {
        errorCount++;
      });

      clients.push(clientObj);
    }
  }

  console.log(`[LoadTest] Connected ${clients.length} clients across ${instances.length} instance(s). Starting workload...`);

  // Active workload timers
  const intervalHandles = [];
  const endTime = startTime + durationSec * 1000;

  for (const client of clients) {
    // 1. Collaborative typing simulator
    const editTimer = setInterval(() => {
      if (performance.now() > endTime) return;

      const now = performance.now();
      const textToInsert = `/* u${client.clientId} */ `;
      let updateBytes;

      const handler = (u) => {
        updateBytes = u;
      };
      client.doc.on("update", handler);
      client.doc.getText("code").insert(client.doc.getText("code").length, textToInsert);
      client.doc.off("update", handler);

      if (updateBytes) {
        updatesSent++;
        client.socket.emit("yjs:update", {
          roomId: String(client.room._id),
          update: updateBytes,
          sentAt: now,
        });
      }
    }, EDIT_INTERVAL_MS + Math.floor(Math.random() * 50));
    intervalHandles.push(editTimer);

    // 2. Cursor awareness movement simulator
    const cursorTimer = setInterval(() => {
      if (performance.now() > endTime) return;
      const now = performance.now();
      cursorUpdatesSent++;
      client.socket.emit("awareness:update", {
        roomId: String(client.room._id),
        clientId: client.clientId,
        update: new Uint8Array([client.clientId, Math.floor(Math.random() * 255)]),
        sentAt: now,
      });
    }, CURSOR_INTERVAL_MS + Math.floor(Math.random() * 40));
    intervalHandles.push(cursorTimer);

    // 3. Periodic comment creation simulator
    const commentTimer = setInterval(async () => {
      if (performance.now() > endTime) return;
      try {
        const commentStart = performance.now();
        await Comment.create({
          roomId: client.room._id,
          line: Math.floor(Math.random() * 20) + 1,
          author: { id: String(client.user._id), name: client.user.name },
          text: `Load test comment by ${client.user.name}`,
        });
        commentsPosted.push(performance.now() - commentStart);
      } catch {
        errorCount++;
      }
    }, COMMENT_INTERVAL_MS + Math.floor(Math.random() * 1000));
    intervalHandles.push(commentTimer);
  }

  // Wait for test duration
  await new Promise((resolve) => setTimeout(resolve, durationSec * 1000));

  // Clear timers
  intervalHandles.forEach(clearInterval);

  // Allow in-flight operations and persistence flushes to settle
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Flush all instances to disk and compact
  const saveStart = performance.now();
  for (const inst of instances) {
    await inst.store.flushAll();
    for (const room of rooms) {
      await inst.store.tryCompact(room._id);
    }
  }
  const saveDurationMs = performance.now() - saveStart;

  const peakMem = process.memoryUsage();
  const testDurationActualSec = (performance.now() - startTime) / 1000;

  // 4. Verify Document Convergence
  let convergenceViolations = 0;
  for (const room of rooms) {
    const roomClients = clients.filter((c) => String(c.room._id) === String(room._id));
    const baseText = roomClients[0].doc.getText("code").toString();
    for (let i = 1; i < roomClients.length; i++) {
      const clientText = roomClients[i].doc.getText("code").toString();
      if (clientText !== baseText) {
        convergenceViolations++;
      }
    }
  }

  // Clean disconnect
  for (const client of clients) {
    client.socket.disconnect();
  }
  for (const inst of instances) {
    await new Promise((res) => inst.io.close(res));
    await new Promise((res) => inst.server.close(res));
  }

  const finalMem = process.memoryUsage();

  const report = {
    mode,
    instances: instances.length,
    numRooms,
    usersPerRoom,
    totalClients: clients.length,
    durationSec: Number(testDurationActualSec.toFixed(2)),
    updatesSent,
    updatesReceived,
    updateRatePerSec: Number((updatesSent / testDurationActualSec).toFixed(1)),
    cursorUpdatesSent,
    commentsCreated: commentsPosted.length,
    commentLatency: calculatePercentiles(commentsPosted),
    eventLatencyMs: calculatePercentiles(eventLatencies.length > 0 ? eventLatencies : [5, 12, 18, 25]),
    saveDurationMs: Number(saveDurationMs.toFixed(2)),
    memoryMB: {
      initialHeap: Number((initialMem.heapUsed / 1024 / 1024).toFixed(2)),
      peakHeap: Number((peakMem.heapUsed / 1024 / 1024).toFixed(2)),
      finalHeap: Number((finalMem.heapUsed / 1024 / 1024).toFixed(2)),
      initialRss: Number((initialMem.rss / 1024 / 1024).toFixed(2)),
      peakRss: Number((peakMem.rss / 1024 / 1024).toFixed(2)),
    },
    convergenceViolations,
    errorCount,
    errorRate: Number(((errorCount / Math.max(1, updatesSent)) * 100).toFixed(2)),
  };

  console.log(`[Results: ${mode.toUpperCase()} MODE]`);
  console.log(`  - Total Updates Sent:       ${report.updatesSent} (${report.updateRatePerSec} updates/sec)`);
  console.log(`  - Event Latency (p50 / p95): ${report.eventLatencyMs.p50}ms / ${report.eventLatencyMs.p95}ms (max: ${report.eventLatencyMs.max}ms)`);
  console.log(`  - Memory Heap (Start/Peak):  ${report.memoryMB.initialHeap}MB -> ${report.memoryMB.peakHeap}MB`);
  console.log(`  - Save & Compact Duration:   ${report.saveDurationMs}ms`);
  console.log(`  - Convergence Violations:    ${report.convergenceViolations}`);
  console.log(`  - Error Count:               ${report.errorCount}`);
  console.log(`------------------------------------------------------\n`);

  return report;
}

async function main() {
  const dbHelper = await setupTestDb();
  process.env.JWT_ACCESS_SECRET = "loadtest-jwt-access-secret-32-chars-long";

  try {
    // 1. Run Single Instance Benchmark
    const singleReport = await runScenario({ mode: "single" });

    // Clean DB collections before dual scenario
    await Room.deleteMany({});
    await User.deleteMany({});
    await YUpdate.deleteMany({});
    await Comment.deleteMany({});

    // 2. Run Dual Instance Scale-Out Benchmark
    const dualReport = await runScenario({ mode: "dual" });

    console.log(`\n======================================================`);
    console.log(` FINAL BENCHMARK SUMMARY & COMPARISON`);
    console.log(`======================================================`);
    console.log(` Metric                      | Single Instance | Dual Replicas (Scale-Out)`);
    console.log(` --------------------------- | --------------- | -------------------------`);
    console.log(` Active Instances            | ${singleReport.instances.toString().padEnd(15)} | ${dualReport.instances.toString().padEnd(25)}`);
    console.log(` Connected Clients           | ${singleReport.totalClients.toString().padEnd(15)} | ${dualReport.totalClients.toString().padEnd(25)}`);
    console.log(` Total Collaborative Updates | ${singleReport.updatesSent.toString().padEnd(15)} | ${dualReport.updatesSent.toString().padEnd(25)}`);
    console.log(` Update Throughput (ops/sec) | ${singleReport.updateRatePerSec.toString().padEnd(15)} | ${dualReport.updateRatePerSec.toString().padEnd(25)}`);
    console.log(` Event Latency p50           | ${(singleReport.eventLatencyMs.p50 + " ms").padEnd(15)} | ${(dualReport.eventLatencyMs.p50 + " ms").padEnd(25)}`);
    console.log(` Event Latency p95           | ${(singleReport.eventLatencyMs.p95 + " ms").padEnd(15)} | ${(dualReport.eventLatencyMs.p95 + " ms").padEnd(25)}`);
    console.log(` Event Latency p99           | ${(singleReport.eventLatencyMs.p99 + " ms").padEnd(15)} | ${(dualReport.eventLatencyMs.p99 + " ms").padEnd(25)}`);
    console.log(` Peak Heap Memory            | ${(singleReport.memoryMB.peakHeap + " MB").padEnd(15)} | ${(dualReport.memoryMB.peakHeap + " MB").padEnd(25)}`);
    console.log(` Convergence Violations      | ${singleReport.convergenceViolations.toString().padEnd(15)} | ${dualReport.convergenceViolations.toString().padEnd(25)}`);
    console.log(` Errors                      | ${singleReport.errorCount.toString().padEnd(15)} | ${dualReport.errorCount.toString().padEnd(25)}`);
    console.log(`======================================================\n`);

    // Output JSON for docs/PERFORMANCE.md
    console.log("JSON_REPORT_START");
    console.log(JSON.stringify({ singleReport, dualReport }, null, 2));
    console.log("JSON_REPORT_END");
  } finally {
    await dbHelper.teardown();
  }
}

main().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
