import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { createRateLimiter } from "../middleware/rateLimit.middleware.js";
import { RATE_LIMITS } from "../config/limits.js";
import {
  previewInvite,
  acceptInvite,
} from "../controllers/invite.controller.js";

const router = Router();
router.use(authUser);

const inviteAcceptLimiter = createRateLimiter(RATE_LIMITS.inviteAccept);

router.get("/:token", inviteAcceptLimiter, previewInvite);
router.post("/:token/accept", inviteAcceptLimiter, acceptInvite);

export default router;

