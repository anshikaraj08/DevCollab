import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { setupTestDb, createTestUser } from "./helpers/setupApp.js";
import Room from "../models/room.model.js";

describe("Stage 4: Run with Input and Shared Test Cases", () => {
  let dbHelper;
  let owner, editorUser, viewerUser, nonMember;
  let room;

  before(async () => {
    dbHelper = await setupTestDb();
    owner = await createTestUser(app, { name: "Owner Dave", email: "dave_stage4@example.com" });
    editorUser = await createTestUser(app, { name: "Editor Eve", email: "eve_stage4@example.com" });
    viewerUser = await createTestUser(app, { name: "Viewer Frank", email: "frank_stage4@example.com" });
    nonMember = await createTestUser(app, { name: "Outsider Grace", email: "grace_stage4@example.com" });
  });

  after(async () => {
    await dbHelper.teardown();
  });

  beforeEach(async () => {
    await Room.deleteMany({});

    const ownerId = owner.user._id || owner.user.id;
    const editorId = editorUser.user._id || editorUser.user.id;
    const viewerId = viewerUser.user._id || viewerUser.user.id;

    room = await Room.create({
      title: "Test Cases Suite Room",
      language: "python",
      code: "print('hello')",
      createdBy: ownerId,
      users: [ownerId, editorId, viewerId],
      roles: new Map([
        [String(editorId), "editor"],
        [String(viewerId), "viewer"],
      ]),
      testCases: [
        { name: "Initial Case", input: "10", expected: "20" },
      ],
    });
  });

  it("POST /run rejects unsupported languages and oversized input", async () => {
    // Unsupported language
    const resBadLang = await request(app)
      .post("/run")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ language: "rust", code: "fn main() {}" });

    assert.equal(resBadLang.status, 400);

    // Oversized stdin > 10,000 characters
    const resHugeStdin = await request(app)
      .post("/run")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ language: "python", code: "print(1)", stdin: "x".repeat(10001) });

    assert.equal(resHugeStdin.status, 400);
  });

  it("GET /rooms/:roomId/tests allows room members (including viewers) to view test cases", async () => {
    const resViewer = await request(app)
      .get(`/rooms/${room._id}/tests`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`);

    assert.equal(resViewer.status, 200);
    assert.equal(resViewer.body.cases.length, 1);
    assert.equal(resViewer.body.cases[0].name, "Initial Case");
    assert.equal(resViewer.body.cases[0].input, "10");
  });

  it("GET /rooms/:roomId/tests returns 404 for non-members", async () => {
    const res = await request(app)
      .get(`/rooms/${room._id}/tests`)
      .set("Authorization", `Bearer ${nonMember.accessToken}`);

    assert.equal(res.status, 404);
  });

  it("PUT /rooms/:roomId/tests allows editor and owner to update test cases", async () => {
    const updatedCases = [
      { name: "Case 1", input: "5", expected: "10" },
      { name: "Case 2", input: "7", expected: "14" },
    ];

    const res = await request(app)
      .put(`/rooms/${room._id}/tests`)
      .set("Authorization", `Bearer ${editorUser.accessToken}`)
      .send({ cases: updatedCases });

    assert.equal(res.status, 200);
    assert.equal(res.body.cases.length, 2);
    assert.equal(res.body.cases[0].name, "Case 1");
    assert.equal(res.body.cases[1].expected, "14");

    // Verify persisted in database
    const saved = await Room.findById(room._id);
    assert.equal(saved.testCases.length, 2);
    assert.equal(saved.testCases[1].name, "Case 2");
  });

  it("PUT /rooms/:roomId/tests forbids viewers from editing test cases", async () => {
    const res = await request(app)
      .put(`/rooms/${room._id}/tests`)
      .set("Authorization", `Bearer ${viewerUser.accessToken}`)
      .send({ cases: [{ name: "Hacked", input: "0", expected: "0" }] });

    assert.equal(res.status, 403);
  });

  it("PUT /rooms/:roomId/tests validates max 10 cases", async () => {
    const elevenCases = Array.from({ length: 11 }, (_, i) => ({
      name: `Case ${i + 1}`,
      input: `${i}`,
      expected: `${i}`,
    }));

    const res = await request(app)
      .put(`/rooms/${room._id}/tests`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ cases: elevenCases });

    assert.equal(res.status, 400);
  });
});

