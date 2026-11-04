import rateLimit from "express-rate-limit";
import ApiError from "../utils/ApiError.js";

/**
 * Rate limit middleware factory.
 * @param {Object} config
 * @param {number} config.windowMs
 * @param {number} config.max
 * @param {string} config.message
 * @param {"ip" | "user"} [config.keyType="ip"]
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
      if (forwarded) {
        return typeof forwarded === "string" ? forwarded.split(",")[0].trim() : forwarded[0];
      }
      return req.ip || req.socket?.remoteAddress || "127.0.0.1";
    },
    handler: (req, res, next, options) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      next(new ApiError(429, options.message || "Too many requests, please try again later"));
    },
  });
}
