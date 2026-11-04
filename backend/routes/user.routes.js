import { Router } from "express";
import { register, login, refresh, logout, profile } from "../controllers/user.controller.js";
import { authUser } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { registerSchema, loginSchema } from "../validators/user.validator.js";
import { createRateLimiter } from "../middleware/rateLimit.middleware.js";
import { RATE_LIMITS } from "../config/limits.js";

const router = Router();
const authLimiter = createRateLimiter(RATE_LIMITS.auth);

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.route("/refresh").get(refresh).post(refresh);
router.post("/logout", logout);
router.get("/profile", authUser, profile);

export default router;
