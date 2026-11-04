import fs from "node:fs";
import mongoose from "mongoose";
import request from "supertest";

// Initialize test environment variables immediately
process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT || "5000";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test_dummy";
process.env.MONGODB_URI = process.env.MONGO_URI;
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-secret-at-least-32-characters-long-key";
process.env.JWT_SECRET = process.env.JWT_ACCESS_SECRET;
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret-at-least-32-characters-long";
process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

let mongod = null;

export async function setupTestDb() {
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-characters-long-key";
  process.env.JWT_SECRET = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-32-characters-long";
  process.env.CLIENT_URL = "http://localhost:5173";

  if (!process.env.MONGOMS_SYSTEM_BINARY) {
    const candidate = "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe";
    if (fs.existsSync(candidate)) {
      process.env.MONGOMS_SYSTEM_BINARY = candidate;
    }
  }

  let uri = process.env.MONGO_URI_TEST;
  if (!uri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }

  process.env.MONGO_URI = uri;
  process.env.MONGODB_URI = uri;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  return {
    async teardown() {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      if (mongod) {
        await mongod.stop();
        mongod = null;
      }
    },
    async clear() {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    },
  };
}

export async function createTestUser(app, { name = "Test User", email, password = "Password123!" } = {}) {
  const userEmail = email || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@example.com`;
  const res = await request(app)
    .post("/users/register")
    .send({ name, email: userEmail, password });

  return {
    user: res.body.user,
    accessToken: res.body.accessToken,
    cookie: res.headers["set-cookie"],
  };
}
