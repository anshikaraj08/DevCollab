import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { setupTestDb } from "./helpers/setupApp.js";
import app from "../app.js";
import roomModel from "../models/room.model.js";

describe("Auth and Rooms Route Coverage", () => {
  let db;

  before(async () => {
    db = await setupTestDb();
  });

  after(async () => {
    await db.teardown();
  });

  beforeEach(async () => {
    await db.clear();
  });

  describe("Authentication Routes", () => {
    test("registers a new user successfully", async () => {
      const res = await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.1.101")
        .send({
          name: "Alice Developer",
          email: "alice@example.com",
          password: "Password123!",
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.user.email, "alice@example.com");
      assert.ok(res.body.accessToken);
    });

    test("fails registration with duplicate email (409 Conflict)", async () => {
      await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.1.102")
        .send({
          name: "Alice",
          email: "dup@example.com",
          password: "Password123!",
        });

      const res = await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.1.102")
        .send({
          name: "Alice Dup",
          email: "dup@example.com",
          password: "Password123!",
        });

      assert.equal(res.status, 409);
      assert.match(res.body.message, /already registered/i);
    });

    test("login succeeds with valid credentials and sets HttpOnly refresh cookie", async () => {
      await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.1.103")
        .send({
          name: "Bob",
          email: "bob@example.com",
          password: "Password123!",
        });

      const res = await request(app)
        .post("/users/login")
        .set("X-Forwarded-For", "192.168.1.103")
        .send({
          email: "bob@example.com",
          password: "Password123!",
        });

      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      const cookies = res.headers["set-cookie"];
      assert.ok(cookies);
      assert.ok(cookies.some((c) => c.includes("refreshToken") && c.includes("HttpOnly")));
    });

    test("login fails with invalid password (401 Unauthorized)", async () => {
      await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.1.104")
        .send({
          name: "Charlie",
          email: "charlie@example.com",
          password: "Password123!",
        });

      const res = await request(app)
        .post("/users/login")
        .set("X-Forwarded-For", "192.168.1.104")
        .send({
          email: "charlie@example.com",
          password: "WrongPassword!",
        });

      assert.equal(res.status, 401);
      assert.match(res.body.message, /invalid email or password/i);
    });

    test("refresh token issues new access token when valid cookie present", async () => {
      const reg = await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.1.105")
        .send({
          name: "Dave",
          email: "dave@example.com",
          password: "Password123!",
        });

      const cookie = reg.headers["set-cookie"];
      assert.ok(cookie);

      const res = await request(app)
        .post("/users/refresh")
        .set("Cookie", cookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
    });

    test("refresh token returns 401 when no token cookie", async () => {
      const res = await request(app).post("/users/refresh");
      assert.equal(res.status, 401);
    });

    test("logout clears refreshToken cookie", async () => {
      const res = await request(app).post("/users/logout");
      assert.equal(res.status, 200);
      const cookies = res.headers["set-cookie"];
      assert.ok(cookies);
      assert.ok(cookies.some((c) => c.includes("refreshToken=;")));
    });
  });

  describe("Rooms Routes", () => {
    let ownerToken, editorToken, outsiderToken;
    let ownerId, editorId;

    beforeEach(async () => {
      const r1 = await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.2.1")
        .send({ name: "Owner", email: "owner@rooms.com", password: "Password123!" });
      ownerToken = r1.body.accessToken;
      ownerId = r1.body.user._id || r1.body.user.id;

      const r2 = await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.2.2")
        .send({ name: "Editor", email: "editor@rooms.com", password: "Password123!" });
      editorToken = r2.body.accessToken;
      editorId = r2.body.user._id || r2.body.user.id;

      const r3 = await request(app)
        .post("/users/register")
        .set("X-Forwarded-For", "192.168.2.3")
        .send({ name: "Outsider", email: "outsider@rooms.com", password: "Password123!" });
      outsiderToken = r3.body.accessToken;
    });

    test("creates room and lists user rooms", async () => {
      const createRes = await request(app)
        .post("/rooms/create")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Algorithm Workspace",
          language: "javascript",
        });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.room.title, "Algorithm Workspace");

      const listRes = await request(app)
        .get("/rooms/all")
        .set("Authorization", `Bearer ${ownerToken}`);

      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.rooms.length, 1);
    });

    test("room access returns 200 for member and 404 for outsider", async () => {
      const room = await roomModel.create({
        title: "Test Room",
        language: "python",
        createdBy: ownerId,
        users: [ownerId, editorId],
      });

      const memberRes = await request(app)
        .get(`/rooms/${room._id}`)
        .set("Authorization", `Bearer ${editorToken}`);

      assert.equal(memberRes.status, 200);
      assert.equal(memberRes.body.room.title, "Test Room");

      const outsiderRes = await request(app)
        .get(`/rooms/${room._id}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      assert.equal(outsiderRes.status, 404);
    });

    test("deleting room is permitted for owner and forbidden for non-owner member", async () => {
      const room = await roomModel.create({
        title: "Protected Room",
        language: "cpp",
        createdBy: ownerId,
        users: [ownerId, editorId],
      });

      const forbiddenRes = await request(app)
        .delete(`/rooms/${room._id}`)
        .set("Authorization", `Bearer ${editorToken}`);

      assert.equal(forbiddenRes.status, 403);

      const successRes = await request(app)
        .delete(`/rooms/${room._id}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      assert.equal(successRes.status, 200);
    });
  });
});
