import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";
import { getCookieOptions, getRefreshCookieOptions } from "../utils/cookies.js";
import { scrubSentryEvent } from "../config/sentry.js";

describe("Stage 1: Containers, Deployment & Monitoring", () => {
  describe("Cookie Attributes Strategy", () => {
    it("returns development attributes for localhost", () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      delete process.env.COOKIE_DOMAIN;
      delete process.env.COOKIE_SAMESITE;

      try {
        const options = getCookieOptions();
        assert.equal(options.httpOnly, true);
        assert.equal(options.secure, false);
        assert.equal(options.sameSite, "lax");
        assert.equal(options.path, "/");
        assert.equal(options.domain, undefined);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it("returns cross-site attributes for free subdomains in production", () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      delete process.env.COOKIE_DOMAIN;
      process.env.COOKIE_SAMESITE = "none";

      try {
        const options = getCookieOptions();
        assert.equal(options.httpOnly, true);
        assert.equal(options.secure, true);
        assert.equal(options.sameSite, "none");
        assert.equal(options.path, "/");
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it("returns custom domain attributes when COOKIE_DOMAIN is set in production", () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      process.env.COOKIE_DOMAIN = ".devcollab.io";
      delete process.env.COOKIE_SAMESITE;

      try {
        const options = getCookieOptions();
        assert.equal(options.httpOnly, true);
        assert.equal(options.secure, true);
        assert.equal(options.sameSite, "lax");
        assert.equal(options.domain, ".devcollab.io");
        assert.equal(options.path, "/");
      } finally {
        process.env.NODE_ENV = origEnv;
        delete process.env.COOKIE_DOMAIN;
      }
    });

    it("sets 7-day maxAge for refresh token cookie", () => {
      const options = getRefreshCookieOptions();
      assert.equal(options.maxAge, 7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("Sentry Data Scrubbing (beforeSend)", () => {
    it("removes passwords, tokens, auth headers, cookies and code contents from Sentry events", () => {
      const mockEvent = {
        request: {
          url: "https://api.devcollab.io/rooms/123/code",
          headers: {
            authorization: "Bearer secret-jwt-token",
            cookie: "refreshToken=super-secret-refresh-cookie",
            "content-type": "application/json",
          },
          data: {
            code: "const apiKey = 'AKIA123456789';",
            password: "user-plain-password",
          },
        },
        user: {
          id: "usr_998877",
          email: "developer@example.com",
          name: "Dev User",
        },
        breadcrumbs: [
          {
            category: "fetch",
            data: {
              code: "console.log('internal code')",
              token: "raw-auth-token",
            },
          },
        ],
        extra: {
          code: "sensitive-source-code",
          token: "sensitive-token",
        },
      };

      const scrubbed = scrubSentryEvent(mockEvent);

      // Assert request headers scrubbed
      assert.equal(scrubbed.request.headers.authorization, undefined);
      assert.equal(scrubbed.request.headers.cookie, undefined);
      assert.equal(scrubbed.request.data, undefined);

      // Assert user scrubbed to only ID
      assert.deepEqual(scrubbed.user, { id: "usr_998877" });

      // Assert breadcrumbs & extra scrubbed
      assert.equal(scrubbed.breadcrumbs[0].data.code, undefined);
      assert.equal(scrubbed.breadcrumbs[0].data.token, undefined);
      assert.equal(scrubbed.extra.code, undefined);
      assert.equal(scrubbed.extra.token, undefined);
    });
  });

  describe("Prometheus Metrics Endpoint Authorization", () => {
    it("returns 404 when METRICS_TOKEN is not configured", async () => {
      const origToken = process.env.METRICS_TOKEN;
      delete process.env.METRICS_TOKEN;

      try {
        const res = await request(app).get("/metrics");
        assert.equal(res.status, 404);
      } finally {
        if (origToken) process.env.METRICS_TOKEN = origToken;
      }
    });

    it("returns 401 when METRICS_TOKEN is set but token is missing or invalid", async () => {
      const origToken = process.env.METRICS_TOKEN;
      process.env.METRICS_TOKEN = "secret-metrics-token-12345";

      try {
        const resNoAuth = await request(app).get("/metrics");
        assert.equal(resNoAuth.status, 401);

        const resBadAuth = await request(app)
          .get("/metrics")
          .set("Authorization", "Bearer wrong-token");
        assert.equal(resBadAuth.status, 401);
      } finally {
        if (origToken) process.env.METRICS_TOKEN = origToken;
        else delete process.env.METRICS_TOKEN;
      }
    });

    it("returns 200 with metrics when valid Bearer token provided", async () => {
      const origToken = process.env.METRICS_TOKEN;
      process.env.METRICS_TOKEN = "secret-metrics-token-12345";

      try {
        const res = await request(app)
          .get("/metrics")
          .set("Authorization", "Bearer secret-metrics-token-12345");
        assert.equal(res.status, 200);
        assert.match(res.text, /devcollab_active_sockets/);
      } finally {
        if (origToken) process.env.METRICS_TOKEN = origToken;
        else delete process.env.METRICS_TOKEN;
      }
    });
  });
});
