import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  requestEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  updatePassword,
  unlinkProvider,
  profile,
} from "../controllers/user.controller.js";
import { authUser } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { registerSchema, loginSchema } from "../validators/user.validator.js";
import {
  createRateLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  verifyEmailRequestLimiter,
} from "../middleware/rateLimit.middleware.js";
import { RATE_LIMITS } from "../config/limits.js";

const router = Router();
const authLimiter = createRateLimiter(RATE_LIMITS.auth);

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.route("/refresh").get(refresh).post(refresh);
router.post("/logout", logout);
router.post("/logout-all", authUser, logoutAll);

// Email verification
router.post("/verify-email/request", authUser, verifyEmailRequestLimiter, requestEmailVerification);
router.post("/verify-email", verifyEmail);

// Password recovery
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);

// Account & Profile settings
router.get("/me", authUser, getMe);
router.patch("/me", authUser, updateMe);
router.patch("/me/password", authUser, updatePassword);
router.delete("/me/providers/:provider", authUser, unlinkProvider);

// Legacy alias
router.get("/profile", authUser, profile);

export default router;
