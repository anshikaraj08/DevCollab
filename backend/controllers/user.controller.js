import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import AuthToken from "../models/authToken.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { clearRefreshCookie, setRefreshCookie } from "../utils/cookies.js";
import {
  issueSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
} from "../utils/sessions.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotice,
} from "../services/mailer.js";
import { passwordSchema } from "../validators/user.validator.js";

// bcrypt hash of a random string, used to equalize login timing for unknown emails
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10);

export const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  emailVerified: Boolean(u.emailVerified),
  providers: (u.providers || []).map((p) => p.provider),
  hasPassword: Boolean(u.password),
  avatarUrl: u.avatarUrl || null,
  emailPrefs: u.emailPrefs || { digest: false },
});

const sendAuth = async (req, res, user, status = 200) => {
  await issueSession(res, user, req);
  res.status(status).json({
    user: publicUser(user),
    accessToken: user.generateAccessToken(),
  });
};

/**
 * Register a new user
 * POST /users/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || name.trim().length < 2) {
    throw new ApiError(400, "Name must be at least 2 characters");
  }
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  if (!password || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (await User.findOne({ email: normalizedEmail })) {
    throw new ApiError(409, "Email already registered");
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashed,
    emailVerified: false,
    tokenVersion: 0,
  });

  // Create email verification token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await AuthToken.create({
    user: user._id,
    type: "verify",
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  sendVerificationEmail({ to: user.email, name: user.name, token: rawToken }).catch((err) => {
    logger.error({ err: err.message, userId: user._id }, "Failed to send initial verification email");
  });

  logger.info({ userId: user._id }, "User registered");
  await sendAuth(req, res, user, 201);
});

/**
 * Log in an existing user
 * POST /users/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  // If user does not exist or has no password (OAuth-only), return identical 401.
  // Compare against a dummy hash so the response time does not reveal whether the email exists.
  const passwordOk = user?.password
    ? await user.isValidPassword(password)
    : (await bcrypt.compare(password, DUMMY_PASSWORD_HASH), false);
  if (!user || !passwordOk) {
    logger.warn({ email: normalizedEmail }, "Failed login attempt");
    throw new ApiError(401, "Invalid email or password");
  }

  await sendAuth(req, res, user);
});

/**
 * Silent session refresh. Rotates the refresh token on every call.
 * GET|POST /users/refresh
 */
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) throw new ApiError(401, "No refresh token");

  const result = await rotateSession(token, req);

  if (result.status === "invalid") {
    clearRefreshCookie(res);
    throw new ApiError(401, "Invalid or expired session token");
  }
  if (result.status === "reused") {
    logger.warn({ userId: result.userId }, "Refresh token reuse detected; all sessions revoked");
    clearRefreshCookie(res);
    throw new ApiError(401, "Session expired or revoked. Please sign in again.");
  }

  const user = await User.findById(result.userId).select("+password");
  if (!user) {
    clearRefreshCookie(res);
    throw new ApiError(401, "User not found");
  }

  // "grace": a concurrent request already rotated this token and the browser has
  // the new cookie, so only a fresh access token is returned here.
  if (result.status === "rotated") {
    setRefreshCookie(res, result.token);
  }

  res.json({
    user: publicUser(user),
    accessToken: user.generateAccessToken(),
  });
});

/**
 * Log out current session
 * POST /users/logout
 */
export const logout = asyncHandler(async (req, res) => {
  await revokeSession(req.cookies?.refreshToken);
  clearRefreshCookie(res);
  res.json({ message: "Logged out" });
});

/**
 * Invalidate all sessions across all devices
 * POST /users/logout-all
 */
export const logoutAll = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await revokeAllSessions(user._id);

  clearRefreshCookie(res);
  res.json({ message: "Logged out from all devices" });
});

/**
 * Request email verification link
 * POST /users/verify-email/request
 */
export const requestEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  if (user.emailVerified) {
    return res.json({ message: "Email is already verified" });
  }

  // Invalidate any existing unused verify tokens for this user
  await AuthToken.deleteMany({ user: user._id, type: "verify" });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await AuthToken.create({
    user: user._id,
    type: "verify",
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  try {
    await sendVerificationEmail({ to: user.email, name: user.name, token: rawToken });
  } catch (err) {
    // SMTP problems (bad credentials, blocked port, unverified sender) end up here.
    // Log the real reason for the operator; tell the user plainly instead of a generic 500.
    logger.error({ err: err.message, code: err.code, userId: user._id }, "Failed to send verification email");
    throw new ApiError(502, "We couldn't send the verification email right now. Please try again in a few minutes.");
  }
  res.json({ message: "Verification email sent. Please check your inbox." });
});

/**
 * Verify email with token
 * POST /users/verify-email
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    throw new ApiError(400, "Verification token is required");
  }

  const computedHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await AuthToken.findOne({
    type: "verify",
    tokenHash: computedHash,
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ApiError(400, "Invalid or expired verification token");
  }

  // Constant-time comparison for security
  if (!crypto.timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(computedHash))) {
    throw new ApiError(400, "Invalid verification token");
  }

  record.usedAt = new Date();
  await record.save();

  const user = await User.findById(record.user);
  if (user) {
    user.emailVerified = true;
    await user.save();
  }

  res.json({ message: "Email verified successfully" });
});

/**
 * Request password reset link (enumeration safe 202 response)
 * POST /users/forgot-password
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const genericMessage = "If an account with that email exists, a password reset link has been sent.";

  if (!email || typeof email !== "string") {
    return res.status(202).json({ message: genericMessage });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (user) {
    // Invalidate previous reset tokens
    await AuthToken.deleteMany({ user: user._id, type: "reset" });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await AuthToken.create({
      user: user._id,
      type: "reset",
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    sendPasswordResetEmail({ to: user.email, name: user.name, token: rawToken }).catch((err) => {
      logger.error({ err: err.message, userId: user._id }, "Failed to send reset email");
    });
  } else {
    // Artificial slight delay to prevent timing discrepancy
    await new Promise((r) => setTimeout(r, 50));
  }

  res.status(202).json({ message: genericMessage });
});

/**
 * Reset password using token
 * POST /users/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || typeof token !== "string") {
    throw new ApiError(400, "Reset token is required");
  }
  const pwParsed = passwordSchema.safeParse(password);
  if (!pwParsed.success) {
    throw new ApiError(400, pwParsed.error.issues[0]?.message || "Invalid password format");
  }

  const computedHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await AuthToken.findOne({
    type: "reset",
    tokenHash: computedHash,
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ApiError(400, "Invalid, expired, or previously used password reset link");
  }

  if (!crypto.timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(computedHash))) {
    throw new ApiError(400, "Invalid reset token");
  }

  record.usedAt = new Date();
  await record.save();

  const user = await User.findById(record.user).select("+password");
  if (!user) {
    throw new ApiError(400, "Associated user account no longer exists");
  }

  user.password = await bcrypt.hash(password, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await revokeAllSessions(user._id); // sign out every device

  clearRefreshCookie(res);

  sendPasswordChangedNotice({ to: user.email, name: user.name }).catch((err) => {
    logger.error({ err: err.message, userId: user._id }, "Failed to send password changed notice");
  });

  res.json({ message: "Password reset successful. Please sign in with your new password." });
});

/**
 * Get current profile
 * GET /users/me
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user: publicUser(user) });
});

/**
 * Update user profile or email preferences
 * PATCH /users/me
 */
export const updateMe = asyncHandler(async (req, res) => {
  const { name, emailPrefs } = req.body;

  if (name === undefined && emailPrefs === undefined) {
    throw new ApiError(400, "At least one field (name or emailPrefs) is required");
  }

  const user = await User.findById(req.user.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  if (name !== undefined) {
    if (!name || name.trim().length < 2) {
      throw new ApiError(400, "Name must be at least 2 characters");
    }
    user.name = name.trim();
  }

  if (emailPrefs && typeof emailPrefs === "object") {
    if (typeof emailPrefs.digest === "boolean") {
      if (emailPrefs.digest && !user.emailVerified) {
        throw new ApiError(400, "Email must be verified before enabling email digests");
      }
      user.emailPrefs = user.emailPrefs || {};
      user.emailPrefs.digest = emailPrefs.digest;
    }
  }

  await user.save();

  res.json({ user: publicUser(user), message: "Profile updated successfully" });
});

/**
 * Unsubscribe from email digests with one-click token
 * GET /users/unsubscribe-digest?token=... or POST /users/unsubscribe-digest
 */
export const unsubscribeDigest = asyncHandler(async (req, res) => {
  const token = req.query?.token || req.body?.token;
  if (!token || typeof token !== "string") {
    throw new ApiError(400, "Unsubscribe token is required");
  }

  const computedHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await AuthToken.findOne({
    type: "unsubscribe",
    tokenHash: computedHash,
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ApiError(400, "Invalid, expired, or previously used unsubscribe link");
  }

  if (!crypto.timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(computedHash))) {
    throw new ApiError(400, "Invalid unsubscribe token");
  }

  record.usedAt = new Date();
  await record.save();

  const user = await User.findById(record.user);
  if (user) {
    user.emailPrefs = user.emailPrefs || {};
    user.emailPrefs.digest = false;
    await user.save();
  }

  res.json({
    message: "You have been successfully unsubscribed from notification digests.",
    unsubscribed: true,
  });
});

/**
 * Change or set account password
 * PATCH /users/me/password
 */
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const pwParsed = passwordSchema.safeParse(newPassword);
  if (!pwParsed.success) {
    throw new ApiError(400, pwParsed.error.issues[0]?.message || "Invalid password format");
  }

  const user = await User.findById(req.user.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  // If user already has a password, currentPassword is required and must match
  if (user.password) {
    if (!currentPassword || !(await user.isValidPassword(currentPassword))) {
      throw new ApiError(400, "Current password is incorrect");
    }
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Sign out every other device, keep this one signed in with a fresh session
  await revokeAllSessions(user._id);
  await issueSession(res, user, req);

  sendPasswordChangedNotice({ to: user.email, name: user.name }).catch((err) => {
    logger.error({ err: err.message, userId: user._id }, "Failed to send password notice");
  });

  res.json({ message: "Password updated successfully", user: publicUser(user) });
});

/**
 * Unlink an OAuth provider from account
 * DELETE /users/me/providers/:provider
 */
export const unlinkProvider = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const user = await User.findById(req.user.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  // Keep at least one way to sign in rule: must have a password OR another linked provider
  const remainingProviders = (user.providers || []).filter((p) => p.provider !== provider);
  const totalRemainingMethods = (user.password ? 1 : 0) + remainingProviders.length;

  if (totalRemainingMethods === 0) {
    throw new ApiError(
      400,
      "Cannot disconnect your only sign-in method. Please set a password first."
    );
  }

  user.providers = remainingProviders;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  await revokeAllSessions(user._id);
  await issueSession(res, user, req);
  res.json({ user: publicUser(user), message: `${provider} unlinked successfully` });
});

// Backward compatibility alias for profile
export const profile = getMe;
