import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { roomAccess } from "../middleware/roomAccess.middleware.js";
import { createRateLimiter } from "../middleware/rateLimit.middleware.js";
import { RATE_LIMITS } from "../config/limits.js";
import {
  createInvite,
  getActiveInvites,
  revokeInvite,
} from "../controllers/invite.controller.js";

const router = Router({ mergeParams: true });
router.use(authUser);

const inviteCreateLimiter = createRateLimiter({ ...RATE_LIMITS.inviteCreate, keyType: "user" });

router.post("/", roomAccess("invites.manage"), inviteCreateLimiter, createInvite);
router.get("/", roomAccess("invites.manage"), getActiveInvites);
router.delete("/:inviteId", roomAccess("invites.manage"), revokeInvite);

export default router;

