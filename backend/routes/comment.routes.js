import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { roomAccess } from "../middleware/roomAccess.middleware.js";
import { commentEditLimiter } from "../middleware/rateLimit.middleware.js";
import {
  getComments,
  addComment,
  updateComment,
  resolveComment,
  unresolveComment,
  addReply,
  deleteComment,
} from "../controllers/comment.controller.js";

const router = Router({ mergeParams: true });
router.use(authUser);

// Handlers for /rooms/:roomId/comments
router.get("/", (req, res, next) => {
  if (req.params.roomId) return roomAccess("room.read")(req, res, next);
  next();
}, getComments);

router.post("/", (req, res, next) => {
  if (req.params.roomId) return roomAccess("comment.write")(req, res, next);
  next();
}, addComment);

// Direct comment endpoints
router.get("/:roomId", roomAccess("room.read"), getComments);
router.post("/:roomId", roomAccess("comment.write"), addComment);

// Specific two-segment routes must come before "/:roomId/:commentId",
// which would otherwise capture "resolve"/"unresolve" as a comment id.
router.patch("/:commentId/resolve", resolveComment);
router.patch("/:commentId/unresolve", unresolveComment);
router.patch("/:commentId", commentEditLimiter, updateComment);
router.patch("/:roomId/:commentId", roomAccess("comment.edit"), commentEditLimiter, updateComment);
router.post("/:commentId/reply", addReply);
router.delete("/:commentId", deleteComment);

export default router;
