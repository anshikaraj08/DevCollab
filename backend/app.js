import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import crypto from "crypto";
import env, { getAllowedOrigins } from "./config/env.js";
import logger from "./utils/logger.js";
import ApiError from "./utils/ApiError.js";
import healthRoutes from "./routes/health.routes.js";
import metricsRoutes from "./routes/metrics.routes.js";
import { initSentry } from "./config/sentry.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import roomRoutes from "./routes/room.routes.js";
import memberRoutes from "./routes/member.routes.js";
import roomInviteRoutes from "./routes/roomInvite.routes.js";
import inviteRoutes from "./routes/invite.routes.js";
import runRoutes from "./routes/run.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import snapshotRoutes from "./routes/snapshot.routes.js";
import testCaseRoutes from "./routes/testCase.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();

// Initialize Sentry error reporting if SENTRY_DSN is configured
initSentry();

// Reverse proxy configuration
if (env?.TRUST_PROXY !== undefined && env?.TRUST_PROXY !== "") {
  app.set("trust proxy", Number(env.TRUST_PROXY));
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Multi-origin CORS support from CLIENT_URLS list
const allowedOrigins = getAllowedOrigins(process.env);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const normalized = origin.trim().replace(/\/+$/, "");
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      return callback(new ApiError(403, `CORS origin denied: ${origin}`));
    },
    credentials: true,
  })
);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] || crypto.randomUUID(),
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  })
);

app.use(express.json());
const cookieSecret =
  process.env.COOKIE_SECRET || process.env.JWT_ACCESS_SECRET || "devcollab-cookie-secret-key-32chars";
app.use(cookieParser(cookieSecret));

// Health & Readiness probes (unauthenticated)
app.use(healthRoutes);
app.use(metricsRoutes);

// Debug Sentry endpoint (only available outside production)
if (process.env.NODE_ENV !== "production") {
  app.get("/debug-sentry", () => {
    throw new Error("DevCollab test error for Sentry verification");
  });
}

app.get("/", (req, res) => res.json({ message: "DevCollab API running" }));
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/rooms/:roomId/members", memberRoutes);
app.use("/rooms/:roomId/invites", roomInviteRoutes);
app.use("/rooms/:roomId/snapshots", snapshotRoutes);
app.use("/rooms/:roomId/tests", testCaseRoutes);
app.use("/rooms", roomRoutes);
app.use("/invites", inviteRoutes);
app.use("/run", runRoutes);
app.use("/comments", commentRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
