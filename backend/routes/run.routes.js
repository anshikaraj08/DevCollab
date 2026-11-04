import { Router } from "express";
import { authUser } from "../middleware/auth.middleware.js";
import { runCode } from "../controllers/run.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { runCodeSchema } from "../validators/run.validator.js";
import { createRateLimiter } from "../middleware/rateLimit.middleware.js";
import { RATE_LIMITS } from "../config/limits.js";

const runRateLimiter = createRateLimiter({
  ...RATE_LIMITS.run,
  keyGenerator: (req) => req.user?.id || req.ip,
});

const router = Router();
router.use(authUser);

router.post("/", runRateLimiter, validate(runCodeSchema), runCode);

export default router;
