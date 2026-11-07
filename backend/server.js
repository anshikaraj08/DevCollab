import "./config/env.js";
import http from "http";
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./db/db.js";
import logger from "./utils/logger.js";
import env from "./config/env.js";
import { initSockets } from "./sockets/index.js";
import { initRedis, closeRedis } from "./config/redis.js";

const PORT = env?.PORT || process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Redis clients for scale-out if REDIS_URL is configured
const redisClients = initRedis();
if (redisClients) {
  app.locals.redis = redisClients.redisClient;
}

// Socket.IO shares the same HTTP server as Express
const { io, store } = initSockets(server, { redisClients });
app.set("io", io); // comment and room routes announce changes via socket
app.set("store", store);

connectDB().then(() => {
  server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
});

let isShuttingDown = false;

export const shutdown = async (signal = "SIGTERM") => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Starting graceful shutdown...");

  // Enforce 10-second hard exit timeout
  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown exceeded 10s deadline, forcing process exit");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref?.();

  try {
    // 1. Stop accepting new HTTP connections
    await new Promise((resolve) => server.close(resolve));
    logger.info("HTTP server closed to new connections");

    // 2. Announce shutdown to active socket clients
    io.emit("server:shutdown", { reason: "Server shutting down" });

    // 3. Flush all in-memory Yjs documents to MongoDB
    await store.flushAll();
    logger.info("All open room documents flushed to storage");

    // 4. Close Socket.IO server
    await new Promise((resolve) => io.close(resolve));
    logger.info("Socket.IO server closed");

    // 5. Close MongoDB database connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
      logger.info("MongoDB connection closed");
    }

    // 6. Close Redis connections if initialized
    if (redisClients) {
      await closeRedis();
      logger.info("Redis connections closed");
    }

    clearTimeout(forceExitTimer);
    logger.info("Graceful shutdown completed successfully");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error occurred during graceful shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// nodemon restarts with SIGUSR2
process.once("SIGUSR2", async () => {
  await store.flushAll();
  process.kill(process.pid, "SIGUSR2");
});
