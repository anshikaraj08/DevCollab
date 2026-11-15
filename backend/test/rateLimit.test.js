import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { setupTestDb } from "./helpers/setupApp.js";

describe("Rate Limiter Middleware", () => {
  let db;

  before(async () => {
    db = await setupTestDb();
    // Production runs behind one trusted proxy hop (TRUST_PROXY=1 on Render).
    app.set("trust proxy", 1);
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

  test("rotating a spoofed X-Forwarded-For prefix does not bypass the limit", async () => {
    // The trusted proxy appends the real client address as the last hop.
    const realIp = "203.0.113.77";
    let limited = false;
    for (let i = 1; i <= 11; i++) {
      const res = await request(app)
        .post("/users/login")
        .set("X-Forwarded-For", `10.${i}.${i}.${i}, ${realIp}`)
        .send({ email: `spoof_${i}@example.com`, password: "wrongpassword" });
      if (res.status === 429) limited = true;
    }
    assert.equal(limited, true, "Spoofed leading X-Forwarded-For entries must not create new buckets");
  });
});
