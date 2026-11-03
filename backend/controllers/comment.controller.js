import Comment from "../models/comment.model.js";
import User from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
  if (!line || !text?.trim()) return res.status(400).json({ message: "line and text required" });
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
  const comment = await Comment.findByIdAndUpdate(
    req.params.commentId,
    { resolved: true },
    { new: true }
  );
  if (!comment) return res.status(404).json({ message: "Not found" });
  req.app.get("io")?.to(String(comment.roomId)).emit("comment:resolved", { commentId: comment._id, resolved: true });
  res.json({ comment });
});

/** PATCH /comments/:commentId/unresolve */
export const unresolveComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findByIdAndUpdate(
    req.params.commentId,
    { resolved: false },
    { new: true }
  );
  if (!comment) return res.status(404).json({ message: "Not found" });
  req.app.get("io")?.to(String(comment.roomId)).emit("comment:resolved", { commentId: comment._id, resolved: false });
  res.json({ comment });
});

/** POST /comments/:commentId/reply */
export const addReply = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: "text required" });
  const author = await getAuthor(req.user.id);
  const comment = await Comment.findByIdAndUpdate(
    req.params.commentId,
    { $push: { replies: { author, text: text.trim() } } },
    { new: true }
  );
  if (!comment) return res.status(404).json({ message: "Not found" });
  req.app.get("io")?.to(String(comment.roomId)).emit("comment:reply", { comment });
  res.json({ comment });
});

/** DELETE /comments/:commentId */
export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findByIdAndDelete(req.params.commentId);
  if (!comment) return res.status(404).json({ message: "Not found" });
  req.app.get("io")?.to(String(comment.roomId)).emit("comment:deleted", { commentId: comment._id });
  res.json({ ok: true });
});
