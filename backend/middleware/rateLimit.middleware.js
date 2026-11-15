import rateLimit, { MemoryStore, ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import ApiError from "../utils/ApiError.js";
import { getRedisClient } from "../config/redis.js";

/**
 * A store that decides on first use whether to use Redis or process memory.
 *
 * Limiters are created when route modules are imported, which happens before
 * server.js connects to Redis. Choosing the backing store lazily means the
 * limiters share counters across replicas whenever REDIS_URL is configured.
 */
class LazyStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.options = null;
    this.inner = null;
  }

  init(options) {
    this.options = options;
  }

  _store() {
    if (this.inner) return this.inner;
    const redis = getRedisClient();
    this.inner = redis
      ? new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: this.prefix })
      : new MemoryStore();
    this.inner.init?.(this.options);
    return this.inner;
  }

  get localKeys() {
    return !getRedisClient();
  }

  increment(key) {
    return this._store().increment(key);
  }

  decrement(key) {
    return this._store().decrement(key);
  }

  resetKey(key) {
    return this._store().resetKey(key);
  }

  get(key) {
    return this._store().get?.(key);
  }

  shutdown() {
    return this.inner?.shutdown?.();
  }
}

let limiterCount = 0;

/**
 * The client IP as Express resolves it. With `trust proxy` set (TRUST_PROXY=1 on
 * Render), Express takes the address the trusted proxy appended, so a client
 * cannot pick its own rate-limit bucket by sending an X-Forwarded-For header.
 * IPv6 addresses are grouped by /56 subnet so one host cannot rotate addresses.
 */
export function clientIp(req) {
  return ipKeyGenerator(req.ip || req.socket?.remoteAddress || "127.0.0.1");
}

/**
 * Rate limit middleware factory.
 * @param {Object} config
 * @param {number} config.windowMs
 * @param {number} config.max
 * @param {string} config.message
 * @param {"ip" | "user" | "ip-email" | "user-ai" | "room-ai"} [config.keyType="ip"]
 */
export function createRateLimiter({ windowMs, max, message, keyType = "ip" }) {
  limiterCount += 1;
  const limiterConfig = {
    windowMs,
    max,
    message,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: false,
    // Each limiter gets its own key prefix so separate limits never share counters.
    store: new LazyStore(`rl:${limiterCount}:`),
    keyGenerator: (req) => {
      if (keyType === "user" && req.user?.id) {
        return `user:${req.user.id}`;
      }
      if (keyType === "user-ai" && req.user?.id) {
        return `ai-user:${req.user.id}`;
      }
      if (keyType === "room-ai") {
        return `ai-room:${req.params?.roomId || "unknown"}`;
      }
      const ip = clientIp(req);
      if (keyType === "ip-email") {
        const email = (req.body?.email || "").toLowerCase().trim();
        return `forgot:${ip}:${email}`;
      }
      return ip;
    },
    handler: (req, res, next, options) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      next(new ApiError(429, options.message || "Too many requests, please try again later"));
    },
  };

  return rateLimit(limiterConfig);
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

export const aiUserReviewLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: "Too many AI review requests. Limit is 5 per hour per user.",
  keyType: "user-ai",
});

export const aiRoomReviewLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20,
  message: "This room has reached the daily limit of 20 AI code reviews.",
  keyType: "room-ai",
});

export const commentEditLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: "Too many comment edits. Limit is 30 per minute.",
  keyType: "user",
});

export const notificationsLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: "Too many notification requests. Please slow down.",
  keyType: "user",
});
