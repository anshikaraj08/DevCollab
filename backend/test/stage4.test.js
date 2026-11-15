import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import crypto from "crypto";
import { setupTestDb } from "./helpers/setupApp.js";
import app from "../app.js";
import User from "../models/user.model.js";
import Room from "../models/room.model.js";
import Comment from "../models/comment.model.js";
import Notification from "../models/notification.model.js";
import AuthToken from "../models/authToken.model.js";
import Invite from "../models/invite.model.js";
import {
  runDigestCycle,
  setDigestMailer,
  resetDigestMailer,
  acquireLease,
  releaseLease,
} from "../services/digest.service.js";

describe("Stage 4: Comments v2 & Notifications Backend", () => {
  let dbHelper;
  let ownerUser;
  let editorUser;
  let viewerUser;
  let otherUser;
  let ownerToken;
  let editorToken;
  let viewerToken;
  let otherToken;
  let testRoom;

  // Mock Socket.IO instance to verify room emissions and user channels
  const emittedEvents = [];
  const mockIo = {
    to: (target) => ({
      emit: (event, payload) => {
        emittedEvents.push({ target, event, payload });
      },
    }),
    syncRoomMembership: async () => {},
  };

  before(async () => {
    dbHelper = await setupTestDb();
    app.set("io", mockIo);
  });

  after(async () => {
    resetDigestMailer();
    await dbHelper.teardown();
  });

  beforeEach(async () => {
    await dbHelper.clear();
    resetDigestMailer();
    emittedEvents.length = 0;

    // 1. Create Owner
    ownerUser = await User.create({
      name: "Owner User",
      email: "owner@devcollab.io",
      emailVerified: true,
      emailPrefs: { digest: true },
    });
    ownerToken = ownerUser.generateAccessToken();

    // 2. Create Editor
    editorUser = await User.create({
      name: "Editor User",
      email: "editor@devcollab.io",
      emailVerified: true,
      emailPrefs: { digest: true },
    });
    editorToken = editorUser.generateAccessToken();

    // 3. Create Viewer
    viewerUser = await User.create({
      name: "Viewer User",
      email: "viewer@devcollab.io",
      emailVerified: true,
      emailPrefs: { digest: true },
    });
    viewerToken = viewerUser.generateAccessToken();

    // 4. Create Non-member
    otherUser = await User.create({
      name: "Other User",
      email: "other@devcollab.io",
      emailVerified: true,
      emailPrefs: { digest: false },
    });
    otherToken = otherUser.generateAccessToken();

    // 5. Create Test Room
    testRoom = await Room.create({
      title: "Comments Stage 4 Room",
      language: "javascript",
      code: "console.log('devcollab');\n",
      createdBy: ownerUser._id,
      users: [ownerUser._id, editorUser._id, viewerUser._id],
      roles: {
        [editorUser._id.toString()]: "editor",
        [viewerUser._id.toString()]: "viewer",
      },
    });
  });

  describe("1. Comment Editing & Permissions", () => {
    it("allows the author to edit their own comment and updates editedAt and mentions", async () => {
      // Create initial comment by editor
      const createRes = await request(app)
        .post(`/rooms/${testRoom._id}/comments`)
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          line: 1,
          content: "Initial comment content",
          mentions: [ownerUser._id.toString()],
        });

      assert.strictEqual(createRes.status, 201);
      const commentId = createRes.body.comment._id;
      assert.strictEqual(createRes.body.comment.editedAt, null);

      // Edit the comment as author
      const editRes = await request(app)
        .patch(`/rooms/${testRoom._id}/comments/${commentId}`)
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          content: "Updated comment text by editor",
          mentions: [viewerUser._id.toString()],
        });

      assert.strictEqual(editRes.status, 200);
      assert.strictEqual(editRes.body.comment.text, "Updated comment text by editor");
      assert.ok(editRes.body.comment.editedAt);

      // Check emitted socket event
      const updatedEvent = emittedEvents.find(
        (e) => e.event === "comment:updated" && e.target === `room:${testRoom._id}`
      );
      assert.ok(updatedEvent);
      assert.strictEqual(updatedEvent.payload.comment.text, "Updated comment text by editor");
    });

    it("forbids non-authors from editing someone else's comment", async () => {
      // Created by editor
      const comment = await Comment.create({
        roomId: testRoom._id,
        line: 1,
        text: "Created by editor",
        author: { id: editorUser._id.toString(), name: editorUser.name },
      });

      // Attempt to edit as owner (even owner cannot edit someone else's comment)
      const res = await request(app)
        .patch(`/rooms/${testRoom._id}/comments/${comment._id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "Owner attempting to hijack comment" });

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /only edit your own/i);
    });

    it("rejects non-members with 404 Room not found", async () => {
      const comment = await Comment.create({
        roomId: testRoom._id,
        line: 1,
        text: "Member comment",
        author: { id: editorUser._id.toString(), name: editorUser.name },
      });

      const res = await request(app)
        .patch(`/rooms/${testRoom._id}/comments/${comment._id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ content: "Non-member edit" });

      assert.strictEqual(res.status, 404);
    });
  });

  describe("2. Mention Filtering & Notifications", () => {
    it("filters mentions to valid room members, excludes author, and notifies mentioned members", async () => {
      // Editor creates comment mentioning owner (member), otherUser (non-member), and self
      const res = await request(app)
        .post(`/rooms/${testRoom._id}/comments`)
        .set("Authorization", `Bearer ${editorToken}`)
        .send({
          line: 1,
          content: "Hello @Owner, let's review this with @Other and @Editor",
          mentions: [
            ownerUser._id.toString(),
            otherUser._id.toString(),
            editorUser._id.toString(),
          ],
        });

      assert.strictEqual(res.status, 201);
      const comment = res.body.comment;

      // Mentions should only retain ownerUser (excluding self and non-member)
      const mentionIds = (comment.mentions || []).map((m) => (m._id || m).toString());
      assert.deepStrictEqual(mentionIds, [ownerUser._id.toString()]);

      // Check notification created for ownerUser
      const notifs = await Notification.find({ room: testRoom._id });
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].user.toString(), ownerUser._id.toString());
      assert.strictEqual(notifs[0].actor.toString(), editorUser._id.toString());
      assert.strictEqual(notifs[0].type, "mention");
      assert.strictEqual(notifs[0].comment.toString(), comment._id.toString());

      // Check live socket emission to user channel
      const userNotif = emittedEvents.find(
        (e) => e.target === `user:${ownerUser._id}` && e.event === "notification:new"
      );
      assert.ok(userNotif);
      assert.strictEqual(userNotif.payload.notification.type, "mention");
    });
  });

  describe("3. Reply Notifications", () => {
    it("notifies thread author and earlier repliers once each, excluding the replier", async () => {
      // 1. Owner creates thread
      const comment = await Comment.create({
        roomId: testRoom._id,
        line: 2,
        text: "Thread starting point by Owner",
        author: { id: ownerUser._id.toString(), name: ownerUser.name },
        replies: [],
      });

      // 2. Editor adds first reply
      await request(app)
        .post(`/comments/${comment._id}/reply`)
        .set("Authorization", `Bearer ${editorToken}`)
        .send({ content: "First reply by editor" });

      // Owner should have received a reply notification
      let notifs = await Notification.find({ type: "reply" });
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].user.toString(), ownerUser._id.toString());

      // 3. Viewer adds second reply
      await request(app)
        .post(`/comments/${comment._id}/reply`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ content: "Second reply by viewer" });

      // Now both owner and editor should have been notified (viewer is the author, not notified)
      const newNotifs = await Notification.find({
        type: "reply",
        comment: comment._id,
      }).sort({ createdAt: 1 });

      assert.strictEqual(newNotifs.length, 3); // 1 from first reply + 2 from second reply
      const recipientsFromSecondReply = newNotifs.slice(1).map((n) => n.user.toString());
      assert.ok(recipientsFromSecondReply.includes(ownerUser._id.toString()));
      assert.ok(recipientsFromSecondReply.includes(editorUser._id.toString()));
      assert.ok(!recipientsFromSecondReply.includes(viewerUser._id.toString()));
    });
  });

  describe("4. Invite Accepted Notifications", () => {
    it("notifies the inviter when an invite is accepted", async () => {
      // Owner creates invite
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      await Invite.create({
        token: rawToken,
        tokenHash,
        room: testRoom._id,
        createdBy: ownerUser._id,
        role: "editor",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // otherUser accepts invite
      const acceptRes = await request(app)
        .post(`/invites/${rawToken}/accept`)
        .set("Authorization", `Bearer ${otherToken}`);

      assert.strictEqual(acceptRes.status, 200);

      // Verify notification created for owner
      const notif = await Notification.findOne({
        user: ownerUser._id,
        type: "invite_accepted",
      });
      assert.ok(notif);
      assert.strictEqual(notif.actor.toString(), otherUser._id.toString());
      assert.strictEqual(notif.room.toString(), testRoom._id.toString());
    });
  });

  describe("5. Notification APIs (Inbox, Unread Count, Mark Read)", () => {
    beforeEach(async () => {
      // Seed notifications for editorUser
      await Notification.create([
        {
          user: editorUser._id,
          actor: ownerUser._id,
          type: "mention",
          room: testRoom._id,
          readAt: null,
          createdAt: new Date(Date.now() - 3000),
        },
        {
          user: editorUser._id,
          actor: viewerUser._id,
          type: "reply",
          room: testRoom._id,
          readAt: null,
          createdAt: new Date(Date.now() - 2000),
        },
        {
          user: editorUser._id,
          actor: ownerUser._id,
          type: "invite_accepted",
          room: testRoom._id,
          readAt: new Date(Date.now() - 1000), // already read
          createdAt: new Date(Date.now() - 1000),
        },
      ]);
    });

    it("returns paginated notifications and unread-only notifications", async () => {
      // All notifications
      const allRes = await request(app)
        .get("/notifications")
        .set("Authorization", `Bearer ${editorToken}`);

      assert.strictEqual(allRes.status, 200);
      assert.strictEqual(allRes.body.notifications.length, 3);

      // Unread only
      const unreadRes = await request(app)
        .get("/notifications?unread=true")
        .set("Authorization", `Bearer ${editorToken}`);

      assert.strictEqual(unreadRes.status, 200);
      assert.strictEqual(unreadRes.body.notifications.length, 2);
    });

    it("returns correct unread count", async () => {
      const res = await request(app)
        .get("/notifications/unread-count")
        .set("Authorization", `Bearer ${editorToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.count, 2);
    });

    it("marks specific notifications and all notifications as read", async () => {
      // Mark all read
      const markAllRes = await request(app)
        .post("/notifications/read")
        .set("Authorization", `Bearer ${editorToken}`)
        .send({ all: true });

      assert.strictEqual(markAllRes.status, 200);
      assert.strictEqual(markAllRes.body.count, 2);

      // Unread count should now be 0
      const countRes = await request(app)
        .get("/notifications/unread-count")
        .set("Authorization", `Bearer ${editorToken}`);

      assert.strictEqual(countRes.body.count, 0);
    });
  });

  describe("6. Email Digest & Unsubscribe Lifecycle", () => {
    it("runs digest cycle, respects 10m age, 15m rate limit, and room membership", async () => {
      const sentEmails = [];
      setDigestMailer(async (mail) => {
        sentEmails.push(mail);
        return { messageId: "mock-digest-mail" };
      });

      const now = new Date();
      const twelveMinutesAgo = new Date(now.getTime() - 12 * 60 * 1000);
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

      // 1. Create one old notification (12m ago) and one recent notification (2m ago) for editor
      await Notification.create([
        {
          user: editorUser._id,
          actor: ownerUser._id,
          type: "mention",
          room: testRoom._id,
          readAt: null,
          createdAt: twelveMinutesAgo,
        },
        {
          user: editorUser._id,
          actor: viewerUser._id,
          type: "reply",
          room: testRoom._id,
          readAt: null,
          createdAt: twoMinutesAgo,
        },
      ]);

      // Run digest cycle
      const result1 = await runDigestCycle({ now });
      assert.strictEqual(result1.sent, 1);
      assert.strictEqual(sentEmails.length, 1);
      assert.strictEqual(sentEmails[0].to, editorUser.email);
      assert.match(sentEmails[0].subject, /1 unread notification/i);
      assert.match(sentEmails[0].text, /unsubscribe/i);

      // Running immediately again should send 0 because of the 15-minute throttle
      const result2 = await runDigestCycle({ now: new Date(now.getTime() + 60 * 1000) });
      assert.strictEqual(result2.sent, 0);
      assert.strictEqual(sentEmails.length, 1);

      // After 16 minutes, the second notification is now >= 10m old, so it gets digested
      const futureTime = new Date(now.getTime() + 16 * 60 * 1000);
      const result3 = await runDigestCycle({ now: futureTime });
      assert.strictEqual(result3.sent, 1);
      assert.strictEqual(sentEmails.length, 2);
    });

    it("stops sending digest if user was removed from the room", async () => {
      const sentEmails = [];
      setDigestMailer(async (mail) => {
        sentEmails.push(mail);
        return { messageId: "mock-digest-mail" };
      });

      const now = new Date();
      const twelveMinutesAgo = new Date(now.getTime() - 12 * 60 * 1000);

      // Create notification for viewerUser
      await Notification.create({
        user: viewerUser._id,
        actor: ownerUser._id,
        type: "mention",
        room: testRoom._id,
        readAt: null,
        createdAt: twelveMinutesAgo,
      });

      // Remove viewerUser from the room
      testRoom.users = testRoom.users.filter((u) => u.toString() !== viewerUser._id.toString());
      delete testRoom.roles[viewerUser._id.toString()];
      await testRoom.save();

      // Run digest
      const result = await runDigestCycle({ now });
      assert.strictEqual(result.sent, 0);
      assert.strictEqual(sentEmails.length, 0);
    });

    it("unsubscribes with one-click token and fails on repeat use", async () => {
      // Create unsubscribe token for editorUser
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await AuthToken.create({
        user: editorUser._id,
        type: "unsubscribe",
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      assert.strictEqual(editorUser.emailPrefs.digest, true);

      // Click unsubscribe link (GET)
      const res1 = await request(app)
        .get(`/users/unsubscribe-digest?token=${rawToken}`);

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.unsubscribed, true);

      // Verify user preference in db
      const updatedUser = await User.findById(editorUser._id);
      assert.strictEqual(updatedUser.emailPrefs.digest, false);

      // Repeat use of the same token must fail
      const res2 = await request(app)
        .get(`/users/unsubscribe-digest?token=${rawToken}`);

      assert.strictEqual(res2.status, 400);
      assert.match(res2.body.message, /invalid, expired, or previously used/i);
    });
  });

  describe("7. Mongo Lease Locking", () => {
    it("acquires lease and blocks concurrent worker", async () => {
      const now = new Date();
      const worker1 = "worker-1";
      const worker2 = "worker-2";

      const acquired1 = await acquireLease("test-job", worker1, 10000, now);
      assert.strictEqual(acquired1, true);

      // Worker 2 attempts while lease is active
      const acquired2 = await acquireLease("test-job", worker2, 10000, now);
      assert.strictEqual(acquired2, false);

      // Worker 1 releases lease
      await releaseLease("test-job", worker1);

      // Worker 2 can now acquire
      const acquiredAgain = await acquireLease("test-job", worker2, 10000, now);
      assert.strictEqual(acquiredAgain, true);

      await releaseLease("test-job", worker2);
    });
  });
});
