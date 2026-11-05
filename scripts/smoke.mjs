#!/usr/bin/env node

/**
 * End-to-end smoke test script for DevCollab deployment verification.
 * Tests:
 *  1. GET /readyz (system readiness)
 *  2. Authentication (Register/Login & JWT issuance)
 *  3. Workspace creation (POST /rooms/create)
 *  4. Real-time collaboration handshake & doc acquisition over Socket.IO (room:join)
 *  5. Clean departure and disconnect (room:leave)
 *
 * Usage:
 *   API_URL=http://localhost:5000 node scripts/smoke.mjs
 */

import { io } from "socket.io-client";

const API_URL = (process.env.API_URL || "http://localhost:5000").replace(/\/+$/, "");
const TEST_EMAIL = process.env.SMOKE_EMAIL || `smoke_${Date.now()}@devcollab.local`;
const TEST_PASSWORD = process.env.SMOKE_PASSWORD || "SmokePass123!Secure";
const TEST_NAME = "Smoke Test Runner";

async function runSmokeTest() {
  console.log(`[Smoke Test] Target API: ${API_URL}`);

  // 1. Health & Readiness Check
  console.log("[Smoke Test] 1. Checking readiness endpoint GET /readyz...");
  const readyRes = await fetch(`${API_URL}/readyz`);
  if (!readyRes.ok) {
    throw new Error(`Readiness check failed with HTTP ${readyRes.status}`);
  }
  const readyData = await readyRes.json();
  if (readyData.status !== "ok" || readyData.checks?.database !== "connected") {
    throw new Error(`Unhealthy readiness response: ${JSON.stringify(readyData)}`);
  }
  console.log("  ✓ /readyz is healthy and database is connected");

  // 2. Authentication: Register test user
  console.log(`[Smoke Test] 2. Registering smoke test user (${TEST_EMAIL})...`);
  const regRes = await fetch(`${API_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  let token = null;
  if (regRes.ok) {
    const regData = await regRes.json();
    token = regData.accessToken;
    console.log("  ✓ Test user registered successfully");
  } else if (regRes.status === 409) {
    // If user already exists, login instead
    console.log("  User already exists, attempting login...");
    const loginRes = await fetch(`${API_URL}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (!loginRes.ok) {
      throw new Error(`Login failed with HTTP ${loginRes.status}`);
    }
    const loginData = await loginRes.json();
    token = loginData.accessToken;
    console.log("  ✓ Test user logged in successfully");
  } else {
    throw new Error(`Registration failed with HTTP ${regRes.status}`);
  }

  if (!token) throw new Error("No access token acquired");

  // 3. Create a test workspace room
  console.log("[Smoke Test] 3. Creating test workspace room...");
  const roomRes = await fetch(`${API_URL}/rooms/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: `Smoke Test Room ${Date.now()}`,
      language: "javascript",
    }),
  });

  if (!roomRes.ok) {
    throw new Error(`Room creation failed with HTTP ${roomRes.status}`);
  }
  const room = await roomRes.json();
  const roomId = room._id || room.id;
  console.log(`  ✓ Created room ${roomId} (${room.title})`);

  // 4. Connect via Socket.IO and join room
  console.log("[Smoke Test] 4. Connecting via Socket.IO and joining room...");
  const socket = io(API_URL, {
    transports: ["websocket", "polling"],
    auth: { token },
    timeout: 10000,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection timed out after 10s"));
    }, 10000);

    socket.on("connect", () => {
      console.log(`  ✓ Socket connected with id: ${socket.id}`);
      socket.emit("room:join", { roomId }, (ack) => {
        clearTimeout(timeout);
        if (!ack || !ack.ok) {
          reject(new Error(`room:join failed: ${JSON.stringify(ack)}`));
          return;
        }
        console.log(`  ✓ Joined room successfully (role: ${ack.room?.role || "editor"}, state bytes: ${ack.state ? ack.state.length || ack.state.byteLength : 0})`);

        // 5. Leave room and disconnect
        console.log("[Smoke Test] 5. Leaving room and cleaning up...");
        socket.emit("room:leave", { roomId });
        socket.disconnect();
        resolve();
      });
    });

    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Socket connection error: ${err.message}`));
    });
  });

  console.log("\n🎉 Smoke test passed completely! All core systems operational.\n");
}

runSmokeTest().catch((err) => {
  console.error("\n❌ Smoke test failed:", err.message);
  process.exit(1);
});
