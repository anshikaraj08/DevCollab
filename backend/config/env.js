import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string({ required_error: "MONGO_URI is required" }).min(1, "MONGO_URI is required"),
  JWT_ACCESS_SECRET: z
    .string({ required_error: "JWT_ACCESS_SECRET is required" })
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  // Legacy: refresh tokens are now opaque server-side sessions (utils/sessions.js).
  // Still validated when present so old deployments keep booting unchanged.
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters").optional(),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  CLIENT_URLS: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SAMESITE: z.enum(["lax", "none", "strict"]).optional(),
  TRUST_PROXY: z.union([z.string(), z.number()]).optional(),
  APP_VERSION: z.string().default("1.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  API_URL: z.string().default("http://localhost:5000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  MAIL_TRANSPORT: z.enum(["smtp", "console"]).default("console"),
  COOKIE_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(["anthropic", "openai"]).optional(),
  AI_MODEL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
  AI_DAILY_REQUEST_LIMIT: z.coerce.number().default(100).optional(),
  REDIS_URL: z.string().optional(),
});

/**
 * Returns an array of sanitized allowed client origins.
 * Supports comma-separated CLIENT_URLS, falling back to CLIENT_URL.
 */
export function getAllowedOrigins(raw = process.env) {
  const source = raw.CLIENT_URLS || raw.CLIENT_URL || "http://localhost:5173";
  return source
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function validateEnv(raw = process.env) {
  // Treat blank values (e.g. `AI_PROVIDER=` in .env or an empty dashboard field) as unset,
  // so optional enums do not fail validation at boot.
  const present = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => !(typeof v === "string" && v.trim() === ""))
  );
  raw = present;
  const merged = {
    ...raw,
    MONGO_URI: raw.MONGO_URI || raw.MONGODB_URI,
    JWT_ACCESS_SECRET: raw.JWT_ACCESS_SECRET || raw.JWT_SECRET,
  };
  const result = envSchema.safeParse(merged);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return result.data;
}

let env;
try {
  env = validateEnv(process.env);
  // Synchronize process.env for backwards compatibility
  process.env.PORT = String(env.PORT);
  process.env.NODE_ENV = env.NODE_ENV;
  process.env.MONGO_URI = env.MONGO_URI;
  process.env.MONGODB_URI = env.MONGO_URI;
  process.env.JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET;
  process.env.JWT_SECRET = env.JWT_ACCESS_SECRET;
  if (env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
  process.env.CLIENT_URL = env.CLIENT_URL;
  if (env.CLIENT_URLS) process.env.CLIENT_URLS = env.CLIENT_URLS;
  if (env.TRUST_PROXY !== undefined) process.env.TRUST_PROXY = String(env.TRUST_PROXY);
  process.env.APP_VERSION = env.APP_VERSION;
} catch (err) {
  if (process.env.NODE_ENV !== "test") {
    console.error(err.message);
    process.exit(1);
  }
}

export { env };
export default env;
