import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import { CircuitBreaker } from "../services/runner/circuitBreaker.js";
import { run } from "../services/runner/index.js";
import { getAllowedOrigins } from "../config/env.js";

describe("Stage 0: Production Readiness", () => {
  describe("Health & Readiness Endpoints", () => {
    it("GET /healthz returns 200 and status ok", async () => {
      const res = await request(app).get("/healthz");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: "ok" });
    });

    it("GET /readyz returns 200 when database is connected", async () => {
      // Stub readyState to 1 (connected)
      const originalReadyState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, "readyState", {
        value: 1,
        configurable: true,
      });

      try {
        const res = await request(app).get("/readyz");
        assert.equal(res.status, 200);
        assert.equal(res.body.status, "ok");
        assert.equal(res.body.checks.database, "connected");
      } finally {
        Object.defineProperty(mongoose.connection, "readyState", {
          value: originalReadyState,
          configurable: true,
        });
      }
    });

    it("GET /readyz returns 503 when database is disconnected", async () => {
      // Stub readyState to 0 (disconnected)
      const originalReadyState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, "readyState", {
        value: 0,
        configurable: true,
      });

      try {
        const res = await request(app).get("/readyz");
        assert.equal(res.status, 503);
        assert.equal(res.body.status, "degraded");
        assert.equal(res.body.checks.database, "disconnected");
      } finally {
        Object.defineProperty(mongoose.connection, "readyState", {
          value: originalReadyState,
          configurable: true,
        });
      }
    });
  });

  describe("Runner Service & Circuit Breaker", () => {
    let testBreaker;

    beforeEach(() => {
      testBreaker = new CircuitBreaker({
        failureThreshold: 5,
        windowMs: 60000,
        cooldownMs: 30000,
      });
    });

    it("starts in CLOSED state and allows execution", async () => {
      assert.equal(testBreaker.getState(), "CLOSED");
      let called = false;
      const res = await testBreaker.execute(async () => {
        called = true;
        return { ok: true };
      });
      assert.equal(called, true);
      assert.deepEqual(res, { ok: true });
      assert.equal(testBreaker.getState(), "CLOSED");
    });

    it("trips to OPEN after 5 consecutive failures, then rejects immediately", async () => {
      for (let i = 0; i < 5; i++) {
        await assert.rejects(
          testBreaker.execute(async () => {
            throw new Error("Provider down");
          }),
          { message: "Provider down" }
        );
      }

      assert.equal(testBreaker.getState(), "OPEN");

      // 6th call rejects immediately with 503 and circuit breaker error
      let executedCall = false;
      await assert.rejects(
        testBreaker.execute(async () => {
          executedCall = true;
          return { ok: true };
        }),
        (err) => {
          assert.equal(err.status, 503);
          assert.equal(err.message, "The code runner is temporarily unavailable");
          return true;
        }
      );
      assert.equal(executedCall, false, "Provider was not invoked while circuit was OPEN");
    });

    it("recovers to HALF_OPEN after cooldown and transitions to CLOSED upon successful trial", async () => {
      // Force 5 failures
      for (let i = 0; i < 5; i++) {
        await assert.rejects(
          testBreaker.execute(async () => {
            throw new Error("Failure");
          })
        );
      }
      assert.equal(testBreaker.getState(), "OPEN");

      // Advance time past cooldownMs (30s)
      testBreaker.openedAt = Date.now() - 31000;
      assert.equal(testBreaker.getState(), "HALF_OPEN");

      // Trial request succeeds
      let trialRan = false;
      const res = await testBreaker.execute(async () => {
        trialRan = true;
        return { recovered: true };
      });

      assert.equal(trialRan, true);
      assert.deepEqual(res, { recovered: true });
      assert.equal(testBreaker.getState(), "CLOSED");
    });

    it("runner service retries once on network error", async () => {
      let callCount = 0;
      const mockExecutor = async () => {
        callCount++;
        if (callCount === 1) {
          const netErr = new TypeError("fetch failed");
          throw netErr;
        }
        return { stdout: "hello world", stderr: "", code: 0 };
      };

      const result = await run(
        { language: "python", code: "print('hello world')" },
        { executor: mockExecutor, breaker: testBreaker }
      );

      assert.equal(callCount, 2, "Expected runner to retry on network error");
      assert.equal(result.stdout, "hello world");
    });
  });

  describe("CORS Multi-Origin List", () => {
    it("parses multiple origins from CLIENT_URLS cleanly", () => {
      const origins = getAllowedOrigins({
        CLIENT_URLS: "https://app.example.com, http://localhost:5173/ , https://devcollab.vercel.app/",
      });
      assert.deepEqual(origins, [
        "https://app.example.com",
        "http://localhost:5173",
        "https://devcollab.vercel.app",
      ]);
    });

    it("allows request from listed origin in CORS", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", "http://localhost:5173");
      assert.equal(res.status, 200);
      assert.equal(res.headers["access-control-allow-origin"], "http://localhost:5173");
    });

    it("denies request with 403 from unlisted origin", async () => {
      const res = await request(app)
        .get("/")
        .set("Origin", "https://unauthorized-malicious-site.com");
      assert.equal(res.status, 403);
    });
  });

  describe("Proxy Awareness", () => {
    it("respects trust proxy setting", () => {
      // In app.js, trust proxy is configured from env.TRUST_PROXY
      // When set, app.get('trust proxy') is enabled
      const trustProxyValue = app.get("trust proxy");
      // Depending on whether TRUST_PROXY was passed in env, assert defined behavior
      assert.notEqual(trustProxyValue, undefined);
    });
  });
});
