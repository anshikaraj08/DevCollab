import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { setupTestDb } from "./helpers/setupApp.js";
import app from "../app.js";
import Room from "../models/room.model.js";
import User from "../models/user.model.js";
import YUpdate from "../models/yUpdate.model.js";
import Notification from "../models/notification.model.js";
import Comment from "../models/comment.model.js";

describe("Room deletion", () => {
  let db;
  let owner;
  let token;
  let closedRooms;

  before(async () => {
    db = await setupTestDb();
  });

  after(async () => {
    await db.teardown();
  });

  beforeEach(async () => {
    await db.clear();
    owner = await User.create({ name: "Owner", email: "owner_delete@example.com" });
    token = jwt.sign({ id: String(owner._id), email: owner.email }, process.env.JWT_ACCESS_SECRET);
    closedRooms = [];
    app.set("io", {
      to: () => ({ emit() {} }),
      closeRoom: async (roomId) => closedRooms.push(roomId),
      syncRoomMembership: async () => {},
    });
  });

  test("deletes the room's log, notifications and comments and disconnects live sockets", async () => {
    const room = await Room.create({ title: "Doomed", createdBy: owner._id, users: [owner._id] });
    await YUpdate.create({ room: room._id, update: Buffer.from([0, 0]) });
    await Notification.create({ user: owner._id, actor: owner._id, type: "mention", room: room._id });
    await Comment.create({ roomId: room._id, line: 1, text: "hi", author: { id: String(owner._id), name: "Owner" } });

    const res = await request(app).delete(`/rooms/${room._id}`).set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);

    assert.equal(await Room.countDocuments({ _id: room._id }), 0);
    assert.equal(await YUpdate.countDocuments({ room: room._id }), 0);
    assert.equal(await Notification.countDocuments({ room: room._id }), 0);
    assert.equal(await Comment.countDocuments({ roomId: room._id }), 0);
    assert.deepEqual(closedRooms, [String(room._id)]);
  });
});
