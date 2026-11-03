import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
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

router.get("/:roomId",                    getComments);
router.post("/:roomId",                   addComment);
router.patch("/:commentId/resolve",       resolveComment);
router.patch("/:commentId/unresolve",     unresolveComment);
router.post("/:commentId/reply",          addReply);
router.delete("/:commentId",              deleteComment);

export default router;
