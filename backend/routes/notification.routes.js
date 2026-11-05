import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { notificationsLimiter } from "../middleware/rateLimit.middleware.js";
import {
  getNotifications,
  getUnreadCount,
  markRead,
} from "../controllers/notification.controller.js";

const router = Router();
router.use(authUser);
router.use(notificationsLimiter);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/read", markRead);

export default router;
