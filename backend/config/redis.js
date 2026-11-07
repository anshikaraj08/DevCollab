import Redis from "ioredis";
import crypto from "crypto";
import logger from "../utils/logger.js";

let redisClient = null;
let pubClient = null;
let subClient = null;
let instanceId = process.env.INSTANCE_ID || `inst_${crypto.randomUUID().slice(0, 8)}`;

/**
 * Initialize Redis clients if REDIS_URL is configured.
 * @param {string} [customUrl]
 * @returns {{ redisClient: Redis, pubClient: Redis, subClient: Redis, instanceId: string } | null}
 */
export function initRedis(customUrl = process.env.REDIS_URL) {
  const url = customUrl || process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  if (redisClient) {
    return { redisClient, pubClient, subClient, instanceId };
  }

  const options = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  };

  try {
    redisClient = new Redis(url, options);
    pubClient = new Redis(url, options);
    subClient = new Redis(url, options);

    redisClient.on("error", (err) => {
      logger.error({ err: err.message }, "[Redis] redisClient error");
    });
    pubClient.on("error", (err) => {
      logger.error({ err: err.message }, "[Redis] pubClient error");
    });
    subClient.on("error", (err) => {
      logger.error({ err: err.message }, "[Redis] subClient error");
    });

    redisClient.on("connect", () => {
      logger.info({ instanceId }, "[Redis] Connected successfully");
    });

    return { redisClient, pubClient, subClient, instanceId };
  } catch (err) {
    logger.error({ err: err.message }, "[Redis] Failed to initialize Redis clients");
    return null;
  }
}

/**
 * Returns the active Redis command client (or null if Redis is not configured).
 */
export function getRedisClient() {
  return redisClient;
}

/**
 * Returns all active Redis clients and instanceId.
 */
export function getRedisClients() {
  if (!redisClient) return null;
  return { redisClient, pubClient, subClient, instanceId };
}

/**
 * Set an instanceId (used in tests with multiple instances).
 */
export function setInstanceId(id) {
  instanceId = id;
}

export function getInstanceId() {
  return instanceId;
}

/**
 * Close and disconnect Redis clients.
 */
export async function closeRedis() {
  const clients = [redisClient, pubClient, subClient].filter(Boolean);
  await Promise.all(
    clients.map((c) =>
      c.quit().catch(() => {
        c.disconnect();
      })
    )
  );
  redisClient = null;
  pubClient = null;
  subClient = null;
}

