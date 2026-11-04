import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string({ required_error: "MONGO_URI is required" }).min(1, "MONGO_URI is required"),
  JWT_ACCESS_SECRET: z
    .string({ required_error: "JWT_ACCESS_SECRET is required" })
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string({ required_error: "JWT_REFRESH_SECRET is required" })
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
});

export function validateEnv(raw = process.env) {
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
  process.env.JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
  process.env.CLIENT_URL = env.CLIENT_URL;
} catch (err) {
  if (process.env.NODE_ENV !== "test") {
    console.error(err.message);
    process.exit(1);
  }
}

export { env };
export default env;

