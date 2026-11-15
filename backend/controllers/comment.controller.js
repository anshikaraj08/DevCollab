import Comment from "../models/comment.model.js";
import User from "../models/user.model.js";
import Room from "../models/room.model.js";
import { roomKey } from "../sockets/roomKey.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRole, can } from "../utils/roles.js";
import {
  notifyMentions,
  notifyThreadReply,
  isRoomMember,
} from "../services/notification.service.js";

const getAuthor = async (userId) => {
  const u = await User.findById(userId).select("name");
  return { id: String(userId), name: u?.name ?? "Unknown" };
};

/**
 * Filter valid room members for mentions:
 * Keeps only userIds that are members of the room, de-duplicates, excludes author, caps at 10.
 */
function sanitizeMentions(mentions, room, authorId) {
  if (!mentions || !Array.isArray(mentions)) return [];
  const valid = new Set();
  for (const uid of mentions) {
    const idStr = String(uid);
    if (idStr !== String(authorId) && isRoomMember(room, idStr)) {
      valid.add(idStr);
      if (valid.size >= 10) break;
    }
  }
  return Array.from(valid);
}

/** GET /comments/:roomId or GET /rooms/:roomId/comments */
export const getComments = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const comments = await Comment.find({ roomId })
    .populate("mentions", "name email avatarUrl")
    .populate("replies.mentions", "name email avatarUrl")
    .sort({ line: 1, createdAt: 1 });
  res.json({ comments });
});

/** POST /comments/:roomId or POST /rooms/:roomId/comments */
export const addComment = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  const { line, text, content, mentions = [] } = req.body;
  const commentText = (content || text || "").trim();

  if (!line || !commentText) {
    throw new ApiError(400, "line and content required");
  }

  const room = req.room || (await Room.findById(roomId));
  if (!room) throw new ApiError(404, "Room not found");

  const author = await getAuthor(req.user.id);
  const validMentions = sanitizeMentions(mentions, room, req.user.id);

  const comment = await Comment.create({
    roomId,
    line,
    text: commentText,
    author,
    mentions: validMentions,
  });

  await comment.populate("mentions", "name email avatarUrl");

  const io = req.app.get("io");
  io?.to(roomKey(roomId)).emit("comment:new", { comment });

  // Deliver notifications to mentioned room members
  if (validMentions.length > 0) {
    await notifyMentions({
      mentions: validMentions,
      actorId: req.user.id,
      roomId,
      commentId: comment._id,
      io,
    }).catch(() => {});
  }

  res.status(201).json({ comment });
});

/**
 * PATCH /rooms/:roomId/comments/:commentId or PATCH /comments/:commentId
 * Edit a comment (author only, sets editedAt, emits comment:updated)
 */
export const updateComment = asyncHandler(async (req, res) => {
  const commentId = req.params.commentId || req.params.id;
  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment not found");

  const room = req.room || (await Room.findById(comment.roomId));
  if (!room) throw new ApiError(404, "Room not found");

  const role = req.role || getRole(room, req.user.id);
  if (!role) throw new ApiError(404, "Room not found");
  if (!can(role, "comment.edit")) {
    throw new ApiError(403, "Forbidden");
  }

  // Only the original author can edit their own comment
  if (String(comment.author?.id) !== String(req.user.id)) {
    throw new ApiError(403, "You can only edit your own comments");
  }

  const { content, text, mentions = [] } = req.body;
  const newText = (content || text || "").trim();
  if (!newText) {
    throw new ApiError(400, "content is required");
  }

  const validMentions = sanitizeMentions(mentions, room, req.user.id);

  // Identify newly mentioned users who haven't been notified yet
  const previousMentions = new Set((comment.mentions || []).map(String));
  const newMentionsToNotify = validMentions.filter((m) => !previousMentions.has(String(m)));

  comment.text = newText;
  comment.editedAt = new Date();
  comment.mentions = validMentions;
  await comment.save();

  await comment.populate("mentions", "name email avatarUrl");

  const io = req.app.get("io");
  io?.to(roomKey(comment.roomId)).emit("comment:updated", { comment });

  if (newMentionsToNotify.length > 0) {
    await notifyMentions({
      mentions: newMentionsToNotify,
      actorId: req.user.id,
      roomId: comment.roomId,
      commentId: comment._id,
      io,
    }).catch(() => {});
  }

  res.json({ comment });
});

/** PATCH /comments/:commentId/resolve */
export const resolveComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new ApiError(404, "Not found");

  const room = await Room.findById(comment.roomId);
  if (!room) throw new ApiError(404, "Not found");
  const role = getRole(room, req.user.id);
  if (!role) throw new ApiError(404, "Not found");
  if (!can(role, "comment.write")) throw new ApiError(403, "Forbidden");

  comment.resolved = true;
  await comment.save();

  req.app.get("io")?.to(roomKey(comment.roomId)).emit("comment:resolved", { commentId: comment._id, resolved: true });
  res.json({ comment });
});

/** PATCH /comments/:commentId/unresolve */
export const unresolveComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new ApiError(404, "Not found");

  const room = await Room.findById(comment.roomId);
  if (!room) throw new ApiError(404, "Not found");
  const role = getRole(room, req.user.id);
  if (!role) throw new ApiError(404, "Not found");
  if (!can(role, "comment.write")) throw new ApiError(403, "Forbidden");

  comment.resolved = false;
  await comment.save();

  req.app.get("io")?.to(roomKey(comment.roomId)).emit("comment:resolved", { commentId: comment._id, resolved: false });
  res.json({ comment });
});

/** POST /comments/:commentId/reply or POST /rooms/:roomId/comments/:commentId/reply */
export const addReply = asyncHandler(async (req, res) => {
  const { text, content, mentions = [] } = req.body;
  const replyText = (content || text || "").trim();
  if (!replyText) throw new ApiError(400, "text required");

  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new ApiError(404, "Not found");

  const room = await Room.findById(comment.roomId);
  if (!room) throw new ApiError(404, "Not found");
  const role = getRole(room, req.user.id);
  if (!role) throw new ApiError(404, "Not found");
  if (!can(role, "comment.write")) throw new ApiError(403, "Forbidden");

  const author = await getAuthor(req.user.id);
  const validMentions = sanitizeMentions(mentions, room, req.user.id);

  const priorReplies = [...comment.replies];
  comment.replies.push({
    author,
    text: replyText,
    mentions: validMentions,
  });
  await comment.save();

  const io = req.app.get("io");
  io?.to(roomKey(comment.roomId)).emit("comment:reply", { comment });

  // 1. Notify mentioned users in reply
  if (validMentions.length > 0) {
    await notifyMentions({
      mentions: validMentions,
      actorId: req.user.id,
      roomId: comment.roomId,
      commentId: comment._id,
      io,
    }).catch(() => {});
  }

  // 2. Notify thread author and earlier repliers
  await notifyThreadReply({
    threadAuthorId: comment.author?.id,
    replies: priorReplies,
    actorId: req.user.id,
    roomId: comment.roomId,
    commentId: comment._id,
    io,
  }).catch(() => {});

  res.json({ comment });
});

/** DELETE /comments/:commentId */
export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new ApiError(404, "Not found");

  const room = await Room.findById(comment.roomId);
  if (!room) throw new ApiError(404, "Not found");
  const role = getRole(room, req.user.id);
  if (!role) throw new ApiError(404, "Not found");
  if (!can(role, "comment.delete")) throw new ApiError(403, "Forbidden");

  // Owner can delete any comment; others can only delete their own
  if (role !== "owner" && String(comment.author?.id) !== String(req.user.id)) {
    throw new ApiError(403, "You can only delete your own comments");
  }

  await Comment.findByIdAndDelete(req.params.commentId);
  req.app.get("io")?.to(roomKey(comment.roomId)).emit("comment:deleted", { commentId: comment._id });
  res.json({ ok: true });
});
