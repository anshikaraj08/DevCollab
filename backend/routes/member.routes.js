import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { roomAccess } from "../middleware/roomAccess.middleware.js";
import {
  getMembers,
  updateMemberRole,
  removeMember,
} from "../controllers/member.controller.js";

const router = Router({ mergeParams: true });
router.use(authUser);

router.get("/", roomAccess("members.read"), getMembers);
router.patch("/:userId", roomAccess("members.manage"), updateMemberRole);
router.delete("/:userId", roomAccess("room.read"), removeMember);

export default router;

