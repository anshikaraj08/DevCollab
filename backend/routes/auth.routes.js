import express from "express";
import { startOAuth, handleOAuthCallback } from "../controllers/oauth.controller.js";
import { oauthLimiter } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/:provider", oauthLimiter, startOAuth);
router.get("/:provider/callback", oauthLimiter, handleOAuthCallback);

export default router;

