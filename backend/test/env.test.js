import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateEnv } from "../config/env.js";

describe("Environment Validation", () => {
  const validConfig = {
    PORT: "5000",
    NODE_ENV: "development",
    MONGO_URI: "mongodb://localhost:27017/test",
    JWT_ACCESS_SECRET: "this-is-a-valid-access-secret-32-chars-long!",
    JWT_REFRESH_SECRET: "this-is-a-valid-refresh-secret-32-chars-long!",
    CLIENT_URL: "http://localhost:5173",
  };

  test("valid configuration succeeds", () => {
    const validated = validateEnv(validConfig);
    assert.equal(validated.PORT, 5000);
    assert.equal(validated.MONGO_URI, "mongodb://localhost:27017/test");
  });

  test("missing JWT_ACCESS_SECRET throws clear error", () => {
    const invalid = { ...validConfig };
    delete invalid.JWT_ACCESS_SECRET;
    delete invalid.JWT_SECRET;

    assert.throws(
      () => validateEnv(invalid),
      /JWT_ACCESS_SECRET/i
    );
  });

  test("too short JWT_ACCESS_SECRET throws error", () => {
    const invalid = { ...validConfig, JWT_ACCESS_SECRET: "short-key" };
    assert.throws(
      () => validateEnv(invalid),
      /JWT_ACCESS_SECRET must be at least 32 characters/i
    );
  });

  test("too short JWT_REFRESH_SECRET throws error", () => {
    const invalid = { ...validConfig, JWT_REFRESH_SECRET: "short-refresh-key" };
    assert.throws(
      () => validateEnv(invalid),
      /JWT_REFRESH_SECRET must be at least 32 characters/i
    );
  });

  test("missing MONGO_URI throws error", () => {
    const invalid = { ...validConfig };
    delete invalid.MONGO_URI;
    delete invalid.MONGODB_URI;

    assert.throws(
      () => validateEnv(invalid),
      /MONGO_URI/i
    );
  });
});
