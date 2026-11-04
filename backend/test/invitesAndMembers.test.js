import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, createTestUser } from "./helpers/setupApp.js";
import request from "supertest";
import app from "../app.js";
import Room from "../models/room.model.js";
import Invite from "../models/invite.model.js";

describe("Stage 1: Invites and Live Membership API", () => {
  let db;
  let owner;
  let editorUser;
  let viewerUser;
  let outsider;
  let room;

  before(async () => {
    db = await setupTestDb();
    owner = await createTestUser(app, { name: "Room Owner", email: "owner_stage1@example.com" });
    editorUser = await createTestUser(app, { name: "Editor User", email: "editor_stage1@example.com" });
    viewerUser = await createTestUser(app, { name: "Viewer User", email: "viewer_stage1@example.com" });
    outsider = await createTestUser(app, { name: "Outsider", email: "outsider_stage1@example.com" });

    // Create room owned by owner
    room = await Room.create({
      title: "Algorithms Review",
      language: "python",
      code: "print('hello')",
      createdBy: owner.user._id,
      users: [owner.user._id],
      roles: new Map(),
    });
  });

  after(async () => {
    await db.teardown();
  });

  test("legacy open join route PUT /rooms/join/:roomId is removed (404)", async () => {
    const res = await request(app)
      .put(`/rooms/join/${room._id}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    assert.equal(res.status, 404);
  });

  test("non-members get 404 on GET /rooms/:roomId (no info leakage)", async () => {
    const res = await request(app)
      .get(`/rooms/${room._id}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    assert.equal(res.status, 404);
    assert.match(res.body.message || "", /Room not found/i);
  });

  test("owner can get room details on GET /rooms/:roomId", async () => {
    const res = await request(app)
      .get(`/rooms/${room._id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.room.role, "owner");
    assert.equal(res.body.room.title, "Algorithms Review");
  });

  test("owner can create invite link; plaintext token returned once", async () => {
    const res = await request(app)
      .post(`/rooms/${room._id}/invites`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "editor", maxUses: 2, expiresInHours: 24 });

    assert.equal(res.status, 201);
    assert.ok(res.body.link);
    assert.ok(res.body.invite);
    assert.equal(res.body.invite.role, "editor");
    assert.equal(res.body.invite.maxUses, 2);

    // Verify token itself is NOT stored in the database, only tokenHash
    const saved = await Invite.findById(res.body.invite._id);
    assert.ok(saved.tokenHash);
    assert.equal(saved.token, undefined);
  });

  test("invite preview GET /invites/:token returns preview data", async () => {
    const createRes = await request(app)
      .post(`/rooms/${room._id}/invites`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "viewer", maxUses: 1, expiresInHours: 1 });

    const token = createRes.body.link.split("/invite/")[1];

    // Preview as outsider
    const prevRes = await request(app)
      .get(`/invites/${token}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);

    assert.equal(prevRes.status, 200);
    assert.equal(prevRes.body.roomTitle, "Algorithms Review");
    assert.equal(prevRes.body.role, "viewer");
    assert.equal(prevRes.body.alreadyMember, false);
  });

  test("accept invite POST /invites/:token/accept atomically adds user to room with role", async () => {
    const createRes = await request(app)
      .post(`/rooms/${room._id}/invites`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "viewer", maxUses: 1 });

    const token = createRes.body.link.split("/invite/")[1];

    // Accept invite as viewerUser
    const acceptRes = await request(app)
      .post(`/invites/${token}/accept`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`);

    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.room.role, "viewer");

    // Check DB room document
    const updatedRoom = await Room.findById(room._id);
    assert.ok(updatedRoom.users.map(String).includes(String(viewerUser.user._id)));
    assert.equal(updatedRoom.roles.get(String(viewerUser.user._id)), "viewer");

    // Single use invite now exhausted: second user should get 404
    const secondAccept = await request(app)
      .post(`/invites/${token}/accept`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    assert.equal(secondAccept.status, 404);
  });

  test("already member accepting invite does not throw error", async () => {
    const createRes = await request(app)
      .post(`/rooms/${room._id}/invites`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "editor", maxUses: 5 });

    const token = createRes.body.link.split("/invite/")[1];

    // Accept as owner who is already member
    const acceptRes = await request(app)
      .post(`/invites/${token}/accept`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.room.role, "owner");
  });

  test("GET /rooms/:roomId/members lists room members with owner first", async () => {
    const res = await request(app)
      .get(`/rooms/${room._id}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.members));
    assert.equal(res.body.members[0].role, "owner");
    assert.equal(String(res.body.members[0].user._id), String(owner.user._id));
  });

  test("PATCH /rooms/:roomId/members/:userId changes role; owner only", async () => {
    // Non-owner cannot change role (403)
    const failRes = await request(app)
      .patch(`/rooms/${room._id}/members/${viewerUser.user._id}`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`)
      .send({ role: "editor" });
    assert.equal(failRes.status, 403);

    // Owner can change viewer to editor
    const okRes = await request(app)
      .patch(`/rooms/${room._id}/members/${viewerUser.user._id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "editor" });

    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.role, "editor");

    // Owner cannot change owner's role
    const ownerChange = await request(app)
      .patch(`/rooms/${room._id}/members/${owner.user._id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "viewer" });
    assert.equal(ownerChange.status, 403);
  });

  test("DELETE /rooms/:roomId/members/:userId allows member to leave or owner to remove", async () => {
    // Owner cannot be removed or leave
    const ownerLeave = await request(app)
      .delete(`/rooms/${room._id}/members/${owner.user._id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    assert.equal(ownerLeave.status, 403);

    // Member can leave room (remove themselves)
    const leaveRes = await request(app)
      .delete(`/rooms/${room._id}/members/${viewerUser.user._id}`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`);
    assert.equal(leaveRes.status, 200);

    // Verify member is removed from Room.users and Room.roles
    const checkedRoom = await Room.findById(room._id);
    assert.ok(!checkedRoom.users.map(String).includes(String(viewerUser.user._id)));
    assert.equal(checkedRoom.roles.get(String(viewerUser.user._id)), undefined);
  });

  test("accepting invite enforces 25-member limit", async () => {
    // Fill room to 25 members
    const fakeIds = [];
    for (let i = 0; i < 24; i++) {
      fakeIds.push(new Room()._id);
    }
    await Room.findByIdAndUpdate(room._id, { $set: { users: [owner.user._id, ...fakeIds] } });

    const createRes = await request(app)
      .post(`/rooms/${room._id}/invites`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "editor", maxUses: 10 });

    const token = createRes.body.link.split("/invite/")[1];

    const overflowRes = await request(app)
      .post(`/invites/${token}/accept`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);

    assert.equal(overflowRes.status, 409);
    assert.match(overflowRes.body.message || "", /25 members/i);
  });
});
