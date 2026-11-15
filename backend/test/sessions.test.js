import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { setupTestDb } from "./helpers/setupApp.js";
import app from "../app.js";
import Session from "../models/session.model.js";
import { ROTATION_GRACE_MS } from "../utils/sessions.js";

const refreshCookieOf = (res) =>
  (res.headers["set-cookie"] || []).find((c) => c.startsWith("refreshToken=") && !c.startsWith("refreshToken=;"))
    ?.split(";")[0];

describe("Refresh token sessions", () => {
  let db;
  let ipCounter = 0;
  const nextIp = () => `198.51.100.${++ipCounter}`;

  before(async () => {
    db = await setupTestDb();
    app.set("trust proxy", 1);
  });

  after(async () => {
    await db.teardown();
  });

  beforeEach(async () => {
    await db.clear();
  });

  async function registerAndGetCookie(email = "sess@example.com") {
    const res = await request(app)
      .post("/users/register")
      .set("X-Forwarded-For", nextIp())
      .send({ name: "Session User", email, password: "Passw0rd!" });
    assert.equal(res.status, 201);
    const cookie = refreshCookieOf(res);
    assert.ok(cookie, "register must set a refresh cookie");
    return cookie;
  }

  test("refresh token is opaque and stored only as a hash", async () => {
    const cookie = await registerAndGetCookie();
    const raw = cookie.split("=")[1];
    assert.match(raw, /^[a-f0-9]{64}$/);
    const sessions = await Session.find({});
    assert.equal(sessions.length, 1);
    assert.notEqual(sessions[0].tokenHash, raw);
  });

  test("refresh rotates the token", async () => {
    const cookie = await registerAndGetCookie();
    const res = await request(app).post("/users/refresh").set("Cookie", cookie);
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    const rotated = refreshCookieOf(res);
    assert.ok(rotated);
    assert.notEqual(rotated, cookie);

    const again = await request(app).post("/users/refresh").set("Cookie", rotated);
    assert.equal(again.status, 200);
  });

  test("concurrent refresh with the same token within the grace window succeeds", async () => {
    const cookie = await registerAndGetCookie();
    const [a, b] = await Promise.all([
      request(app).post("/users/refresh").set("Cookie", cookie),
      request(app).post("/users/refresh").set("Cookie", cookie),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
  });

  test("replaying a rotated token after the grace window revokes every session", async () => {
    const cookie = await registerAndGetCookie();
    const res = await request(app).post("/users/refresh").set("Cookie", cookie);
    const rotated = refreshCookieOf(res);

    // Age the replaced session past the grace window
    await Session.updateMany(
      { replacedAt: { $ne: null } },
      { $set: { replacedAt: new Date(Date.now() - ROTATION_GRACE_MS - 1000) } }
    );

    const replay = await request(app).post("/users/refresh").set("Cookie", cookie);
    assert.equal(replay.status, 401);

    // The legitimate, newer token is revoked as well
    const legit = await request(app).post("/users/refresh").set("Cookie", rotated);
    assert.equal(legit.status, 401);
    assert.equal(await Session.countDocuments({}), 0);
  });

  test("logout revokes the session server-side", async () => {
    const cookie = await registerAndGetCookie();
    const out = await request(app).post("/users/logout").set("Cookie", cookie);
    assert.equal(out.status, 200);

    const res = await request(app).post("/users/refresh").set("Cookie", cookie);
    assert.equal(res.status, 401);
  });

  test("unsubscribe link without a token answers 400, not 500", async () => {
    const res = await request(app).get("/users/unsubscribe-digest");
    assert.equal(res.status, 400);
  });

  test("a forged or legacy JWT refresh cookie is rejected", async () => {
    const res = await request(app)
      .post("/users/refresh")
      .set("Cookie", "refreshToken=eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMyJ9.sig");
    assert.equal(res.status, 401);
  });
});
