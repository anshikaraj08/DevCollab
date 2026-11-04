import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { roomAccess } from "../middleware/roomAccess.middleware.js";
import {
  getComments,
  addComment,
  resolveComment,
  unresolveComment,
  addReply,
  deleteComment,
} from "../controllers/comment.controller.js";

const router = Router();
router.use(authUser);

router.get("/:roomId",                roomAccess("room.read"), getComments);
router.post("/:roomId",               roomAccess("comment.write"), addComment);
router.patch("/:commentId/resolve",   resolveComment);
router.patch("/:commentId/unresolve", unresolveComment);
router.post("/:commentId/reply",      addReply);
router.delete("/:commentId",          deleteComment);

export default router;
