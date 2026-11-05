import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { roomAccess } from "../middleware/roomAccess.middleware.js";
import {
  aiUserReviewLimiter,
  aiRoomReviewLimiter,
} from "../middleware/rateLimit.middleware.js";
import {
  requestReview,
  listReviews,
  getAiStatus,
  deleteReview,
} from "../controllers/ai.controller.js";

const router = Router({ mergeParams: true });

router.use(authUser);

// Review execution (requires ai.review permission + rate limits)
router.post(
  "/",
  roomAccess("ai.review"),
  aiUserReviewLimiter,
  aiRoomReviewLimiter,
  requestReview
);

// Review listing & status (requires ai.read permission)
router.get("/", roomAccess("ai.read"), listReviews);
router.get("/status", roomAccess("ai.read"), getAiStatus);

// Review deletion (requires ai.read + owner or requester authorization)
router.delete("/:id", roomAccess("ai.read"), deleteReview);

export default router;
