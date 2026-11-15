import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { setupTestDb } from "./helpers/setupApp.js";
import app from "../app.js";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import { roomKey } from "../sockets/roomKey.js";

describe("Live comment broadcasts", () => {
  let db;
  let owner;
  let token;
  let room;
  let emitted;

  before(async () => {
    db = await setupTestDb();
  });

  after(async () => {
    await db.teardown();
  });

  beforeEach(async () => {
    await db.clear();
    owner = await User.create({ name: "Owner", email: "owner_comments@example.com" });
    token = jwt.sign({ id: String(owner._id), email: owner.email }, process.env.JWT_ACCESS_SECRET);
    room = await Room.create({ title: "Chatty", createdBy: owner._id, users: [owner._id] });
    emitted = [];
    app.set("io", {
      to: (channel) => ({ emit: (event) => emitted.push({ channel, event }) }),
      syncRoomMembership: async () => {},
    });
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  test("every comment event goes to the channel that room sockets join", async () => {
    const created = await request(app)
      .post(`/rooms/${room._id}/comments`)
      .set(auth())
      .send({ line: 1, content: "first" });
    assert.equal(created.status, 201);
    const id = created.body.comment._id;

    await request(app).patch(`/comments/${id}`).set(auth()).send({ content: "edited" });
    await request(app).post(`/comments/${id}/reply`).set(auth()).send({ content: "reply" });
    await request(app).patch(`/comments/${id}/resolve`).set(auth());
    await request(app).patch(`/comments/${id}/unresolve`).set(auth());
    await request(app).delete(`/comments/${id}`).set(auth());

    const commentEvents = emitted.filter((e) => e.event.startsWith("comment:"));
    assert.deepEqual(
      commentEvents.map((e) => e.event),
      ["comment:new", "comment:updated", "comment:reply", "comment:resolved", "comment:resolved", "comment:deleted"]
    );
    for (const e of commentEvents) {
      assert.equal(e.channel, roomKey(room._id), `${e.event} sent to wrong channel`);
    }
  });
});
