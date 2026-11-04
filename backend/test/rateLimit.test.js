import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { setupTestDb } from "./helpers/setupApp.js";

describe("Rate Limiter Middleware", () => {
  let db;

  before(async () => {
    db = await setupTestDb();
  });

  after(async () => {
    await db.teardown();
  });

  test("11th login attempt returns 429 with Retry-After header", async () => {
    const testIp = "192.168.1.100";

    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post("/users/login")
        .set("X-Forwarded-For", testIp)
        .send({ email: `nonexistent_${i}@example.com`, password: "wrongpassword" });
      
      assert.notEqual(res.status, 429, `Attempt ${i} should not be rate limited`);
    }

    // 11th attempt must be 429
    const limitedRes = await request(app)
      .post("/users/login")
      .set("X-Forwarded-For", testIp)
      .send({ email: "attempt11@example.com", password: "wrongpassword" });

    assert.equal(limitedRes.status, 429);
    assert.ok(limitedRes.headers["retry-after"], "Response must have Retry-After header");
    assert.ok(
      limitedRes.body.message.toLowerCase().includes("too many") ||
      limitedRes.body.message.toLowerCase().includes("rate limit"),
      "Response message should mention rate limit"
    );
  });
});

