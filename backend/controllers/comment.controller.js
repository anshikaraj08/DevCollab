import Comment from "../models/comment.model.js";
import User from "../models/user.model.js";
import Room from "../models/room.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRole, can } from "../utils/roles.js";

const getAuthor = async (userId) => {
  const u = await User.findById(userId).select("name");
  return { id: String(userId), name: u?.name ?? "Unknown" };
};

/** GET /comments/:roomId */
export const getComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ roomId: req.params.roomId }).sort({ line: 1, createdAt: 1 });
  res.json({ comments });
});

/** POST /comments/:roomId */
export const addComment = asyncHandler(async (req, res) => {
  const { line, text } = req.body;
  if (!line || !text?.trim()) throw new ApiError(400, "line and text required");
  const author = await getAuthor(req.user.id);
  const comment = await Comment.create({
    roomId: req.params.roomId,
    line,
    text: text.trim(),
    author,
  });
  req.app.get("io")?.to(req.params.roomId).emit("comment:new", { comment });
  res.status(201).json({ comment });
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

  req.app.get("io")?.to(String(comment.roomId)).emit("comment:resolved", { commentId: comment._id, resolved: true });
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

  req.app.get("io")?.to(String(comment.roomId)).emit("comment:resolved", { commentId: comment._id, resolved: false });
  res.json({ comment });
});

/** POST /comments/:commentId/reply */
export const addReply = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) throw new ApiError(400, "text required");

  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new ApiError(404, "Not found");

  const room = await Room.findById(comment.roomId);
  if (!room) throw new ApiError(404, "Not found");
  const role = getRole(room, req.user.id);
  if (!role) throw new ApiError(404, "Not found");
  if (!can(role, "comment.write")) throw new ApiError(403, "Forbidden");

  const author = await getAuthor(req.user.id);
  comment.replies.push({ author, text: text.trim() });
  await comment.save();

  req.app.get("io")?.to(String(comment.roomId)).emit("comment:reply", { comment });
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
  req.app.get("io")?.to(String(comment.roomId)).emit("comment:deleted", { commentId: comment._id });
  res.json({ ok: true });
});
