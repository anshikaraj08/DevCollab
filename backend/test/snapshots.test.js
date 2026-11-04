import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { setupTestDb, createTestUser } from "./helpers/setupApp.js";
import Room from "../models/room.model.js";
import Snapshot from "../models/snapshot.model.js";
import { DocStore } from "../sockets/docStore.js";

describe("Snapshots and Version History API", () => {
  let dbHelper;
  let owner, editorUser, viewerUser, nonMember;
  let room;
  let testStore;

  before(async () => {
    dbHelper = await setupTestDb();
    owner = await createTestUser(app, { name: "Owner Alice", email: "alice_snap@example.com" });
    editorUser = await createTestUser(app, { name: "Editor Bob", email: "bob_snap@example.com" });
    viewerUser = await createTestUser(app, { name: "Viewer Charlie", email: "charlie_snap@example.com" });
    nonMember = await createTestUser(app, { name: "Outsider Dan", email: "dan_snap@example.com" });
  });

  after(async () => {
    await dbHelper.teardown();
  });

  beforeEach(async () => {
    await Room.deleteMany({});
    await Snapshot.deleteMany({});

    const ownerId = owner.user._id || owner.user.id;
    const editorId = editorUser.user._id || editorUser.user.id;
    const viewerId = viewerUser.user._id || viewerUser.user.id;

    // Create room with owner, editor, viewer
    room = await Room.create({
      title: "Test Snapshot Room",
      language: "javascript",
      code: "console.log('original code');",
      createdBy: ownerId,
      users: [ownerId, editorId, viewerId],
      roles: new Map([
        [String(editorId), "editor"],
        [String(viewerId), "viewer"],
      ]),
    });

    testStore = new DocStore({
      loadRoom: async (roomId) => {
        const r = await Room.findById(roomId).select("+yState code");
        return r ? { code: r.code, yState: r.yState } : null;
      },
      saveRoom: (roomId, { code, yState }) =>
        Room.updateOne({ _id: roomId }, { $set: { code, yState } }),
    });

    app.set("store", testStore);
  });

  it("lists snapshots without code, newest first", async () => {
    const ownerId = owner.user._id || owner.user.id;
    const editorId = editorUser.user._id || editorUser.user.id;

    await Snapshot.create({
      room: room._id,
      name: "Version 1",
      code: "code 1",
      kind: "manual",
      createdBy: ownerId,
      createdAt: new Date(Date.now() - 5000),
    });
    await Snapshot.create({
      room: room._id,
      name: "Version 2",
      code: "code 2",
      kind: "manual",
      createdBy: editorId,
      createdAt: new Date(Date.now()),
    });

    const res = await request(app)
      .get(`/rooms/${room._id}/snapshots`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.snapshots.length, 2);
    assert.equal(res.body.snapshots[0].name, "Version 2");
    assert.equal(res.body.snapshots[0].code, undefined); // does not leak code
    assert.equal(res.body.snapshots[0].size, 6);
  });

  it("allows owner and editor to create a snapshot", async () => {
    const res = await request(app)
      .post(`/rooms/${room._id}/snapshots`)
      .set("Authorization", `Bearer ${editorUser.accessToken}`)
      .send({ name: "My Feature" });

    assert.equal(res.status, 201);
    assert.equal(res.body.snapshot.name, "My Feature");
    assert.equal(res.body.snapshot.kind, "manual");

    // Default name if none given
    const res2 = await request(app)
      .post(`/rooms/${room._id}/snapshots`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({});

    assert.equal(res2.status, 201);
    assert.match(res2.body.snapshot.name, /^Version \d+/);
  });

  it("forbids viewers from creating a snapshot", async () => {
    const res = await request(app)
      .post(`/rooms/${room._id}/snapshots`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`)
      .send({ name: "Viewer Snapshot" });

    assert.equal(res.status, 403);
  });

  it("gets single snapshot with full code", async () => {
    const ownerId = owner.user._id || owner.user.id;
    const created = await Snapshot.create({
      room: room._id,
      name: "Full Code Snapshot",
      code: "let x = 42;",
      kind: "manual",
      createdBy: ownerId,
    });

    const res = await request(app)
      .get(`/rooms/${room._id}/snapshots/${created._id}`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.snapshot.code, "let x = 42;");
  });

  it("enforces delete permissions: owner any, editor own, viewer none", async () => {
    const ownerId = owner.user._id || owner.user.id;
    const editorId = editorUser.user._id || editorUser.user.id;

    const ownerSnap = await Snapshot.create({
      room: room._id,
      name: "Owner Snap",
      code: "owner",
      kind: "manual",
      createdBy: ownerId,
    });

    const editorSnap = await Snapshot.create({
      room: room._id,
      name: "Editor Snap",
      code: "editor",
      kind: "manual",
      createdBy: editorId,
    });

    // Viewer cannot delete
    const vRes = await request(app)
      .delete(`/rooms/${room._id}/snapshots/${editorSnap._id}`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`);
    assert.equal(vRes.status, 403);

    // Editor cannot delete owner snapshot
    const eResFail = await request(app)
      .delete(`/rooms/${room._id}/snapshots/${ownerSnap._id}`)
      .set("Authorization", `Bearer ${editorUser.accessToken}`);
    assert.equal(eResFail.status, 403);

    // Editor can delete their own
    const eResOk = await request(app)
      .delete(`/rooms/${room._id}/snapshots/${editorSnap._id}`)
      .set("Authorization", `Bearer ${editorUser.accessToken}`);
    assert.equal(eResOk.status, 200);

    // Owner can delete any
    const oResOk = await request(app)
      .delete(`/rooms/${room._id}/snapshots/${ownerSnap._id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    assert.equal(oResOk.status, 200);
  });

  it("restores snapshot, saves pre-restore backup, and replaces live doc", async () => {
    const ownerId = owner.user._id || owner.user.id;

    // Current text in room
    await testStore.replaceText(room._id, "const live = true;");

    const targetSnap = await Snapshot.create({
      room: room._id,
      name: "Good Version",
      code: "function restored() { return 1; }",
      kind: "manual",
      createdBy: ownerId,
    });

    const res = await request(app)
      .post(`/rooms/${room._id}/snapshots/${targetSnap._id}/restore`)
      .set("Authorization", `Bearer ${editorUser.accessToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    // Verify DocStore text is now restored code
    const liveText = await testStore.getText(room._id);
    assert.equal(liveText, "function restored() { return 1; }");

    // Verify pre-restore snapshot was created
    const preRestore = await Snapshot.findOne({
      room: room._id,
      kind: "pre-restore",
    });
    assert.ok(preRestore);
    assert.equal(preRestore.code, "const live = true;");
  });

  it("rejects non-members with 404", async () => {
    const res = await request(app)
      .get(`/rooms/${room._id}/snapshots`)
      .set("Authorization", `Bearer ${nonMember.accessToken}`);

    assert.equal(res.status, 404);
  });
});
