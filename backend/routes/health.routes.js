import { Router } from "express";
import mongoose from "mongoose";
import { getRedisClient } from "../config/redis.js";

const router = Router();

// Liveness probe: process is alive, always 200
router.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Readiness probe: 200 when MongoDB is connected (and optional Redis is ready)
router.get("/readyz", async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const checks = {
    database: isDbConnected ? "connected" : "disconnected",
  };

  const redis = req.app?.locals?.redis || getRedisClient();
  if (redis) {
    try {
      const pong = await redis.ping();
      checks.redis = pong === "PONG" ? "connected" : "disconnected";
    } catch {
      checks.redis = "disconnected";
    }
  }

  const isReady = Object.values(checks).every((state) => state === "connected");

  if (!isReady) {
    return res.status(503).json({
      status: "degraded",
      checks,
    });
  }

  res.status(200).json({
    status: "ok",
    checks,
  });
});

export default router;
