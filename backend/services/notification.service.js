import Notification from "../models/notification.model.js";
import Room from "../models/room.model.js";

/**
 * Checks if a user is currently a member or owner of the room.
 * @param {Object} room
 * @param {string} userId
 * @returns {boolean}
 */
export function isRoomMember(room, userId) {
  if (!room || !userId) return false;
  const uid = String(userId);
  const ownerId = String(room.createdBy?._id || room.createdBy);
  if (ownerId === uid) return true;
  return (room.users || []).some((u) => String(u?._id || u) === uid);
}

/**
 * Creates and delivers a single notification to a user.
 */
export async function createAndDeliverNotification({
  userId,
  actorId,
  type,
  roomId,
  commentId = null,
  io = null,
}) {
  if (!userId || !actorId || !roomId) return null;
  // Never notify yourself
  if (String(userId) === String(actorId)) return null;

  const room = await Room.findById(roomId);
  if (!room) return null;

  // Never notify a user who is no longer a member of the room
  if (!isRoomMember(room, userId)) return null;

  const notification = await Notification.create({
    user: userId,
    actor: actorId,
    type,
    room: roomId,
    comment: commentId,
  });

  await notification.populate([
    { path: "actor", select: "name email avatarUrl" },
    { path: "room", select: "title" },
  ]);

  if (io) {
    io.to(`user:${userId}`).emit("notification:new", { notification });
  }

  return notification;
}

/**
 * Creates notifications for all valid mentioned members in a comment or reply.
 */
export async function notifyMentions({
  mentions = [],
  actorId,
  roomId,
  commentId = null,
  io = null,
}) {
  if (!mentions || !Array.isArray(mentions) || mentions.length === 0) return [];

  const room = await Room.findById(roomId);
  if (!room) return [];

  // Filter valid room members, deduplicate, exclude self, cap at 10
  const uniqueMemberIds = Array.from(
    new Set(
      mentions
        .map(String)
        .filter((uid) => uid !== String(actorId) && isRoomMember(room, uid))
    )
  ).slice(0, 10);

  const created = [];
  for (const userId of uniqueMemberIds) {
    const n = await Notification.create({
      user: userId,
      actor: actorId,
      type: "mention",
      room: roomId,
      comment: commentId,
    });
    await n.populate([
      { path: "actor", select: "name email avatarUrl" },
      { path: "room", select: "title" },
    ]);
    if (io) {
      io.to(`user:${userId}`).emit("notification:new", { notification: n });
    }
    created.push(n);
  }

  return created;
}

/**
 * Creates notifications for thread replies:
 * (a) The thread author (if not yourself)
 * (b) Earlier repliers (if not yourself and not thread author, 1 per user)
 */
export async function notifyThreadReply({
  threadAuthorId,
  replies = [],
  actorId,
  roomId,
  commentId,
  io = null,
}) {
  const room = await Room.findById(roomId);
  if (!room) return [];

  const recipientIds = new Set();

  // 1. Thread author
  if (threadAuthorId && String(threadAuthorId) !== String(actorId)) {
    if (isRoomMember(room, threadAuthorId)) {
      recipientIds.add(String(threadAuthorId));
    }
  }

  // 2. Earlier repliers (excluding current reply)
  for (const r of replies) {
    const authorId = r.author?.id || r.author?._id;
    if (
      authorId &&
      String(authorId) !== String(actorId) &&
      isRoomMember(room, authorId)
    ) {
      recipientIds.add(String(authorId));
    }
  }

  const notifications = [];
  for (const userId of recipientIds) {
    const n = await Notification.create({
      user: userId,
      actor: actorId,
      type: "reply",
      room: roomId,
      comment: commentId,
    });
    await n.populate([
      { path: "actor", select: "name email avatarUrl" },
      { path: "room", select: "title" },
    ]);
    if (io) {
      io.to(`user:${userId}`).emit("notification:new", { notification: n });
    }
    notifications.push(n);
  }

  return notifications;
}

/**
 * Creates notification for inviter when an invite is accepted.
 */
export async function notifyInviteAccepted({ inviterId, acceptingUserId, roomId, io = null }) {
  return createAndDeliverNotification({
    userId: inviterId,
    actorId: acceptingUserId,
    type: "invite_accepted",
    roomId,
    io,
  });
}
