import { setupTestDb } from "./helpers/setupApp.js";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import crypto from "crypto";
import app from "../app.js";
import User from "../models/user.model.js";
import AuthToken from "../models/authToken.model.js";
import { setOAuthProvider } from "../services/oauth/index.js";
import {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotice,
} from "../services/mailer.js";

describe("Stage 2: Accounts, OAuth, Email & Password Reset", () => {
  let dbHelper;

  before(async () => {
    dbHelper = await setupTestDb();
  });

  after(async () => {
    if (dbHelper) await dbHelper.teardown();
  });

  beforeEach(async () => {
    if (dbHelper) await dbHelper.clear();
  });

  describe("Mailer Service", () => {
    test("sends mail using console transport without errors", async () => {
      const res = await sendMail({
        to: "test@example.com",
        subject: "Welcome",
        text: "Plain text body",
      });
      assert.ok(res.messageId);

      const vRes = await sendVerificationEmail({
        to: "verify@example.com",
        name: "Alice",
        token: "sampletoken123",
      });
      assert.ok(vRes.messageId);

      const rRes = await sendPasswordResetEmail({
        to: "reset@example.com",
        name: "Alice",
        token: "resettoken123",
      });
      assert.ok(rRes.messageId);

      const nRes = await sendPasswordChangedNotice({
        to: "notice@example.com",
        name: "Alice",
      });
      assert.ok(nRes.messageId);
    });
  });

  describe("Email Verification Lifecycle", () => {
    test("registration creates unverified account and verify-email validates token", async () => {
      const regRes = await request(app)
        .post("/users/register")
        .send({ name: "Bob Builder", email: "bob@example.com", password: "Password123!" });
      assert.equal(regRes.status, 201);
      assert.equal(regRes.body.user.emailVerified, false);

      const tokenDoc = await AuthToken.findOne({ type: "verify" });
      assert.ok(tokenDoc);
      assert.equal(tokenDoc.usedAt, null);

      // Invalidate with wrong token
      const failRes = await request(app)
        .post("/users/verify-email")
        .send({ token: "wrongtoken" });
      assert.equal(failRes.status, 400);

      // Request resend email (authenticated)
      const reqRes = await request(app)
        .post("/users/verify-email/request")
        .set("Authorization", `Bearer ${regRes.body.accessToken}`);
      assert.equal(reqRes.status, 200);

      // Verify with the newly generated token
      const newTokenDoc = await AuthToken.findOne({ type: "verify" }).sort({ createdAt: -1 });
      assert.ok(newTokenDoc);

      const raw = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      newTokenDoc.tokenHash = hash;
      await newTokenDoc.save();

      const verifyRes = await request(app)
        .post("/users/verify-email")
        .send({ token: raw });
      assert.equal(verifyRes.status, 200);

      const user = await User.findById(regRes.body.user._id);
      assert.equal(user.emailVerified, true);

      // Cannot reuse token
      const reuseRes = await request(app)
        .post("/users/verify-email")
        .send({ token: raw });
      assert.equal(reuseRes.status, 400);
    });
  });

  describe("Password Reset & Enumeration Safety", () => {
    test("forgot-password is enumeration-safe and reset-password revokes sessions", async () => {
      // Register initial user
      const regRes = await request(app)
        .post("/users/register")
        .send({ name: "Charlie Chaplin", email: "charlie@example.com", password: "OldPassword123!" });
      assert.equal(regRes.status, 201);
      const initialCookie = regRes.headers["set-cookie"];

      // 1. Forgot password with non-existing email -> 202
      const fakeRes = await request(app)
        .post("/users/forgot-password")
        .send({ email: "doesnotexist@example.com" });
      assert.equal(fakeRes.status, 202);
      assert.equal(
        fakeRes.body.message,
        "If an account with that email exists, a password reset link has been sent."
      );

      // 2. Forgot password with existing email -> exact same 202 response
      const realRes = await request(app)
        .post("/users/forgot-password")
        .send({ email: "charlie@example.com" });
      assert.equal(realRes.status, 202);
      assert.equal(realRes.body.message, fakeRes.body.message);

      // 3. Inspect reset token
      const rawReset = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
      const resetHash = crypto.createHash("sha256").update(rawReset).digest("hex");
      const tokenDoc = await AuthToken.findOne({ type: "reset" });
      assert.ok(tokenDoc);
      tokenDoc.tokenHash = resetHash;
      await tokenDoc.save();

      // 4. Reset password
      const resetRes = await request(app)
        .post("/users/reset-password")
        .send({ token: rawReset, password: "NewPassword456!" });
      assert.equal(resetRes.status, 200);

      // 5. Old refresh token no longer works because tokenVersion was bumped!
      const refreshOld = await request(app)
        .get("/users/refresh")
        .set("Cookie", initialCookie);
      assert.equal(refreshOld.status, 401);

      // 6. Cannot reuse reset token
      const reuseReset = await request(app)
        .post("/users/reset-password")
        .send({ token: rawReset, password: "AnotherPassword123!" });
      assert.equal(reuseReset.status, 400);

      // 7. Can log in with new password
      const loginRes = await request(app)
        .post("/users/login")
        .send({ email: "charlie@example.com", password: "NewPassword456!" });
      assert.equal(loginRes.status, 200);
    });
  });

  describe("Log Out Everywhere & tokenVersion", () => {
    test("logout-all invalidates other active refresh sessions", async () => {
      const regRes = await request(app)
        .post("/users/register")
        .send({ name: "Diana Prince", email: "diana@example.com", password: "Password123!" });
      const cookie = regRes.headers["set-cookie"];
      const token = regRes.body.accessToken;

      // Active refresh works
      const ref1 = await request(app).get("/users/refresh").set("Cookie", cookie);
      assert.equal(ref1.status, 200);

      // Log out everywhere
      const logoutRes = await request(app)
        .post("/users/logout-all")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(logoutRes.status, 200);

      // Subsequent refresh with previous token fails
      const ref2 = await request(app).get("/users/refresh").set("Cookie", cookie);
      assert.equal(ref2.status, 401);
    });
  });

  describe("Profile, Password Update & Provider Unlinking", () => {
    test("manages profile, changes password, and enforces keep-one-sign-in rule", async () => {
      const reg = await request(app)
        .post("/users/register")
        .send({ name: "Edward Norton", email: "edward@example.com", password: "Password123!" });
      const token = reg.body.accessToken;

      // GET /users/me
      const meRes = await request(app).get("/users/me").set("Authorization", `Bearer ${token}`);
      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.user.name, "Edward Norton");
      assert.equal(meRes.body.user.hasPassword, true);

      // PATCH /users/me
      const updateRes = await request(app)
        .patch("/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Edward Updated" });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.user.name, "Edward Updated");

      // PATCH /users/me/password
      const badPw = await request(app)
        .patch("/users/me/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "wrong", newPassword: "NewPassword999!" });
      assert.equal(badPw.status, 400);

      const goodPw = await request(app)
        .patch("/users/me/password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "Password123!", newPassword: "NewPassword999!" });
      assert.equal(goodPw.status, 200);

      // Add a provider to test unlinking
      const user = await User.findById(reg.body.user._id);
      user.providers.push({ provider: "google", providerId: "goog_123" });
      await user.save();

      // Unlink google -> succeeds because user has a password
      const unlinkRes = await request(app)
        .delete("/users/me/providers/google")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(unlinkRes.status, 200);
      assert.equal(unlinkRes.body.user.providers.length, 0);

      // Create an OAuth-only user (no password)
      const oauthOnly = await User.create({
        name: "OAuth Only",
        email: "oauth@example.com",
        emailVerified: true,
        providers: [{ provider: "github", providerId: "gh_123" }],
      });
      const oauthToken = oauthOnly.generateAccessToken();

      // Attempt to unlink github -> refused because no password or other provider
      const refusedUnlink = await request(app)
        .delete("/users/me/providers/github")
        .set("Authorization", `Bearer ${oauthToken}`);
      assert.equal(refusedUnlink.status, 400);
      assert.match(refusedUnlink.body.message, /Cannot disconnect your only sign-in method/);
    });
  });

  describe("OAuth Linking Rules Table", () => {
    const fakeState = "mock_state_123";
    const fakeVerifier = "mock_verifier_123";

    const mockProvider = (profileData) => ({
      createAuthorizationURL: async () => ({
        url: "https://auth.example.com",
        state: fakeState,
        codeVerifier: fakeVerifier,
      }),
      exchangeCode: async () => ({ accessToken: () => "mock_token" }),
      fetchProfile: async () => profileData,
    });

    test("Row 1: Provider identity already linked -> signs into that account", async () => {
      const u = await User.create({
        name: "Existing Google User",
        email: "exist@example.com",
        emailVerified: true,
        providers: [{ provider: "google", providerId: "goog_already_linked" }],
      });

      setOAuthProvider(
        "google",
        mockProvider({
          provider: "google",
          providerId: "goog_already_linked",
          email: "exist@example.com",
          emailVerified: true,
          name: "Existing Google User",
        })
      );

      // Start oauth to seed signed cookie
      const startRes = await request(app).get("/auth/google");
      const signedCookie = startRes.headers["set-cookie"];

      const cbRes = await request(app)
        .get(`/auth/google/callback?code=mock_code&state=${fakeState}`)
        .set("Cookie", signedCookie);

      assert.equal(cbRes.status, 302);
      assert.ok(cbRes.headers.location.includes("/auth/callback"));
      const setCookie = cbRes.headers["set-cookie"];
      assert.ok(setCookie.some((c) => c.includes("refreshToken")));
    });

    test("Row 2: No account with verified email -> creates verified account with no password", async () => {
      setOAuthProvider(
        "github",
        mockProvider({
          provider: "github",
          providerId: "gh_new_user",
          email: "fresh@example.com",
          emailVerified: true,
          name: "Fresh GitHubber",
        })
      );

      const startRes = await request(app).get("/auth/github");
      const signedCookie = startRes.headers["set-cookie"];

      const cbRes = await request(app)
        .get(`/auth/github/callback?code=mock_code&state=${fakeState}`)
        .set("Cookie", signedCookie);

      assert.equal(cbRes.status, 302);
      const created = await User.findOne({ email: "fresh@example.com" }).select("+password");
      assert.ok(created);
      assert.equal(created.emailVerified, true);
      assert.equal(created.password, undefined);
      assert.equal(created.providers[0].provider, "github");
    });

    test("Row 3: Account with email exists and is verified -> links provider and signs in", async () => {
      await User.create({
        name: "Verified Email User",
        email: "verified@example.com",
        password: "hashedpassword",
        emailVerified: true,
      });

      setOAuthProvider(
        "google",
        mockProvider({
          provider: "google",
          providerId: "goog_verified_match",
          email: "verified@example.com",
          emailVerified: true,
          name: "Verified Google",
        })
      );

      const startRes = await request(app).get("/auth/google");
      const signedCookie = startRes.headers["set-cookie"];

      const cbRes = await request(app)
        .get(`/auth/google/callback?code=mock_code&state=${fakeState}`)
        .set("Cookie", signedCookie);

      assert.equal(cbRes.status, 302);
      const user = await User.findOne({ email: "verified@example.com" }).select("+password");
      assert.ok(user.password); // password preserved
      assert.equal(user.providers.length, 1);
      assert.equal(user.providers[0].providerId, "goog_verified_match");
    });

    test("Row 4: Account with email exists and is unverified -> takes over, clears password, bumps tokenVersion, links, signs in", async () => {
      const unverified = await User.create({
        name: "Unverified User",
        email: "unverified@example.com",
        password: "oldpassword",
        emailVerified: false,
        tokenVersion: 0,
      });

      setOAuthProvider(
        "google",
        mockProvider({
          provider: "google",
          providerId: "goog_takeover",
          email: "unverified@example.com",
          emailVerified: true,
          name: "OAuth Verified",
        })
      );

      const startRes = await request(app).get("/auth/google");
      const signedCookie = startRes.headers["set-cookie"];

      const cbRes = await request(app)
        .get(`/auth/google/callback?code=mock_code&state=${fakeState}`)
        .set("Cookie", signedCookie);

      assert.equal(cbRes.status, 302);
      const updated = await User.findOne({ email: "unverified@example.com" }).select("+password");
      assert.equal(updated.emailVerified, true);
      assert.equal(updated.password, undefined); // password removed
      assert.equal(updated.tokenVersion, 1); // tokenVersion bumped
      assert.equal(updated.providers[0].providerId, "goog_takeover");
    });

    test("Row 5: Provider gives no verified email -> refuses with clear message", async () => {
      setOAuthProvider(
        "github",
        mockProvider({
          provider: "github",
          providerId: "gh_no_email",
          email: null,
          emailVerified: false,
        })
      );

      const startRes = await request(app).get("/auth/github");
      const signedCookie = startRes.headers["set-cookie"];

      const cbRes = await request(app)
        .get(`/auth/github/callback?code=mock_code&state=${fakeState}`)
        .set("Cookie", signedCookie);

      assert.equal(cbRes.status, 302);
      assert.match(cbRes.headers.location, /No%20verified%20email/);
    });

    test("Row 6: Link request while logged in, identity linked to another account -> refuses", async () => {
      // User 1 already has this provider linked
      await User.create({
        name: "User 1",
        email: "user1@example.com",
        emailVerified: true,
        providers: [{ provider: "google", providerId: "goog_owned_by_1" }],
      });

      // User 2 tries to link it
      const user2 = await User.create({
        name: "User 2",
        email: "user2@example.com",
        emailVerified: true,
      });

      setOAuthProvider(
        "google",
        mockProvider({
          provider: "google",
          providerId: "goog_owned_by_1",
          email: "user2_diff_email@example.com",
          emailVerified: true,
        })
      );

      const linkToken = user2.generateAccessToken();
      const startRes = await request(app)
        .get("/auth/google?link=1")
        .set("Authorization", `Bearer ${linkToken}`);
      const signedCookie = startRes.headers["set-cookie"];

      const cbRes = await request(app)
        .get(`/auth/google/callback?code=mock_code&state=${fakeState}`)
        .set("Cookie", signedCookie);

      assert.equal(cbRes.status, 302);
      assert.match(cbRes.headers.location, /already%20linked%20to%20another/);
    });

    test("Tampered or missing state is refused", async () => {
      setOAuthProvider(
        "google",
        mockProvider({
          provider: "google",
          providerId: "goog_123",
          email: "test@example.com",
          emailVerified: true,
        })
      );

      const startRes = await request(app).get("/auth/google");
      const signedCookie = startRes.headers["set-cookie"];

      const cbRes = await request(app)
        .get(`/auth/google/callback?code=mock_code&state=tampered_state`)
        .set("Cookie", signedCookie);

      assert.equal(cbRes.status, 302);
      assert.match(cbRes.headers.location, /Invalid%20OAuth%20state/);
    });
  });
});
