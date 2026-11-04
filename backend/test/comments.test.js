import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import Room from "../models/room.model.js";
import { setupTestDb, createTestUser } from "./helpers/setupApp.js";

describe("Comment Controller and Room Access", () => {
  let db;
  let owner;
  let member;
  let nonMember;
  let room;

  before(async () => {
    db = await setupTestDb();
    owner = await createTestUser(app, { name: "Owner User", email: "owner@example.com" });
    member = await createTestUser(app, { name: "Member User", email: "member@example.com" });
    nonMember = await createTestUser(app, { name: "Outsider User", email: "outsider@example.com" });

    // Create a room owned by owner with member in users
    room = await Room.create({
      title: "Test Room",
      language: "javascript",
      code: "console.log('hello');",
      createdBy: owner.user._id,
      users: [owner.user._id, member.user._id],
    });
  });

  after(async () => {
    await db.teardown();
  });

  test("member can list and post comments", async () => {
    // Post comment as owner
    const postRes = await request(app)
      .post(`/comments/${room._id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ line: 1, text: "Looks great!" });

    assert.equal(postRes.status, 201);
    assert.equal(postRes.body.comment.text, "Looks great!");

    // List comments as member
    const listRes = await request(app)
      .get(`/comments/${room._id}`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.comments.length, 1);
  });

  test("non-member cannot access comments (404 Not Found)", async () => {
    const listRes = await request(app)
      .get(`/comments/${room._id}`)
      .set("Authorization", `Bearer ${nonMember.accessToken}`);

    assert.equal(listRes.status, 404);

    const postRes = await request(app)
      .post(`/comments/${room._id}`)
      .set("Authorization", `Bearer ${nonMember.accessToken}`)
      .send({ line: 1, text: "Intruder comment" });

    assert.equal(postRes.status, 404);
  });

  test("editor can delete own comment, but cannot delete another's comment", async () => {
    // Member creates comment
    const postRes = await request(app)
      .post(`/comments/${room._id}`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ line: 2, text: "Member note" });
    const memberCommentId = postRes.body.comment._id;

    // Owner creates comment
    const ownerPost = await request(app)
      .post(`/comments/${room._id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ line: 3, text: "Owner note" });
    const ownerCommentId = ownerPost.body.comment._id;

    // Member tries to delete owner's comment -> 403 Forbidden
    const forbiddenDel = await request(app)
      .delete(`/comments/${ownerCommentId}`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    assert.equal(forbiddenDel.status, 403);

    // Member deletes own comment -> 200
    const memberDel = await request(app)
      .delete(`/comments/${memberCommentId}`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    assert.equal(memberDel.status, 200);

    // Owner deletes remaining comment -> 200
    const ownerDel = await request(app)
      .delete(`/comments/${ownerCommentId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    assert.equal(ownerDel.status, 200);
  });
});

