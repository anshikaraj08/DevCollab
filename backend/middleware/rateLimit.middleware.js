import rateLimit from "express-rate-limit";
import ApiError from "../utils/ApiError.js";

/**
 * Rate limit middleware factory.
 * @param {Object} config
 * @param {number} config.windowMs
 * @param {number} config.max
 * @param {string} config.message
 * @param {"ip" | "user" | "ip-email"} [config.keyType="ip"]
 */
export function createRateLimiter({ windowMs, max, message, keyType = "ip" }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) => {
      if (keyType === "user" && req.user?.id) {
        return `user:${req.user.id}`;
      }
      const forwarded = req.headers["x-forwarded-for"];
      const clientIp = forwarded
        ? typeof forwarded === "string"
          ? forwarded.split(",")[0].trim()
          : forwarded[0]
        : req.ip || req.socket?.remoteAddress || "127.0.0.1";

      if (keyType === "ip-email") {
        const email = (req.body?.email || "").toLowerCase().trim();
        return `forgot:${clientIp}:${email}`;
      }

      return clientIp;
    },
    handler: (req, res, next, options) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      next(new ApiError(429, options.message || "Too many requests, please try again later"));
    },
  });
}

export const forgotPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many password reset requests for this email. Please try again in an hour.",
  keyType: "ip-email",
});

export const resetPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many reset attempts from this IP. Please try again in an hour.",
  keyType: "ip",
});

export const verifyEmailRequestLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many verification requests. Please try again in an hour.",
  keyType: "user",
});

export const oauthLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many OAuth sign-in attempts. Please try again shortly.",
  keyType: "ip",
});
