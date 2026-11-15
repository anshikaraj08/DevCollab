import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import { issueSession, findActiveSession, revokeAllSessions } from "../utils/sessions.js";
import { getOAuthProvider } from "../services/oauth/index.js";
import env from "../config/env.js";

const clientUrl = (env?.CLIENT_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

/**
 * Initiates OAuth authorization flow
 * GET /auth/:provider(?link=1&next=...)
 */
export const startOAuth = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { link, next } = req.query;

  const providerService = getOAuthProvider(provider);
  if (!providerService) {
    throw new ApiError(404, `Unsupported OAuth provider: ${provider}`);
  }

  // If link=1 requested, verify logged-in user via Authorization header or refresh cookie
  let linkUserId = null;
  if (link === "1" || link === "true") {
    let authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(
          authHeader.split(" ")[1],
          process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
        );
        linkUserId = decoded.id;
      } catch {}
    }
    if (!linkUserId && req.cookies?.refreshToken) {
      const session = await findActiveSession(req.cookies.refreshToken);
      if (session) linkUserId = String(session.user);
    }
    if (!linkUserId) {
      throw new ApiError(401, "You must be signed in to link an OAuth account");
    }
  }

  const { url, state, codeVerifier } = await providerService.createAuthorizationURL();

  // Store state and verifier in signed 10-minute HTTP-only cookie
  const statePayload = JSON.stringify({
    state,
    codeVerifier: codeVerifier || null,
    next: next && next.startsWith("/") && !next.startsWith("//") ? next : null,
    isLink: Boolean(linkUserId),
    linkUserId,
  });

  res.cookie("oauth_state", statePayload, {
    httpOnly: true,
    signed: true,
    maxAge: 10 * 60 * 1000,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  res.redirect(url);
});

/**
 * OAuth provider callback
 * GET /auth/:provider/callback
 */
export const handleOAuthCallback = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { code, state, error: providerError, error_description } = req.query;

  if (providerError) {
    logger.warn({ provider, error: providerError, error_description }, "OAuth provider reported error");
    return res.redirect(
      `${clientUrl}/auth/callback?error=${encodeURIComponent(error_description || providerError)}`
    );
  }

  const providerService = getOAuthProvider(provider);
  if (!providerService) {
    throw new ApiError(404, `Unsupported OAuth provider: ${provider}`);
  }

  const signedCookie = req.signedCookies?.oauth_state;
  if (!signedCookie) {
    return res.redirect(
      `${clientUrl}/auth/callback?error=${encodeURIComponent("Missing or expired OAuth state. Please try again.")}`
    );
  }

  let storedStateData;
  try {
    storedStateData = JSON.parse(signedCookie);
  } catch {
    return res.redirect(
      `${clientUrl}/auth/callback?error=${encodeURIComponent("Corrupt OAuth state. Please try again.")}`
    );
  }

  // Clear state cookie
  res.clearCookie("oauth_state", { httpOnly: true, sameSite: "lax", path: "/" });

  // Constant-time compare state
  const storedState = storedStateData.state || "";
  const queryState = String(state || "");
  const stateBufferA = Buffer.from(storedState);
  const stateBufferB = Buffer.from(queryState);

  if (
    !storedState ||
    !queryState ||
    stateBufferA.length !== stateBufferB.length ||
    !crypto.timingSafeEqual(stateBufferA, stateBufferB)
  ) {
    logger.warn({ provider }, "OAuth state mismatch or tampering detected");
    return res.redirect(
      `${clientUrl}/auth/callback?error=${encodeURIComponent("Invalid OAuth state verification. Please try again.")}`
    );
  }

  if (!code) {
    return res.redirect(
      `${clientUrl}/auth/callback?error=${encodeURIComponent("No authorization code received from provider.")}`
    );
  }

  // Exchange code & fetch profile
  let tokens;
  let profile;
  try {
    tokens = await providerService.exchangeCode(code, storedStateData.codeVerifier);
    profile = await providerService.fetchProfile(tokens);
  } catch (err) {
    logger.error({ err: err.message, provider }, "OAuth code exchange or profile fetch failed");
    return res.redirect(
      `${clientUrl}/auth/callback?error=${encodeURIComponent("Failed to retrieve profile from " + provider)}`
    );
  }

  // Rule 5: Provider gives no verified email -> Refuse with a clear message
  if (!profile.email || !profile.emailVerified) {
    return res.redirect(
      `${clientUrl}/auth/callback?error=${encodeURIComponent(
        "No verified email provided by " + provider + ". Please verify your email on " + provider + " first."
      )}`
    );
  }

  const email = profile.email.toLowerCase();
  const nextTarget = storedStateData.next || "/dashboard";

  // Case: Linking an account from Settings
  if (storedStateData.isLink && storedStateData.linkUserId) {
    const currentUser = await User.findById(storedStateData.linkUserId);
    if (!currentUser) {
      return res.redirect(
        `${clientUrl}/auth/callback?error=${encodeURIComponent("Active user session not found")}`
      );
    }

    // Check if this provider identity is already linked to ANOTHER user
    const existingOtherUser = await User.findOne({
      "providers.provider": provider,
      "providers.providerId": profile.providerId,
    });

    if (existingOtherUser) {
      if (String(existingOtherUser._id) === String(currentUser._id)) {
        // Already linked to this user
        await issueSession(res, currentUser, req);
        return res.redirect(`${clientUrl}/auth/callback?next=/settings`);
      }
      // Rule 6: Link request while logged in, identity linked to another account -> Refuse
      return res.redirect(
        `${clientUrl}/auth/callback?error=${encodeURIComponent(
          "This " + provider + " account is already linked to another DevCollab user. Please unlink it there first."
        )}`
      );
    }

    // Link provider to current user
    currentUser.providers.push({ provider, providerId: profile.providerId });
    if (!currentUser.avatarUrl && profile.avatarUrl) {
      currentUser.avatarUrl = profile.avatarUrl;
    }
    await currentUser.save();
    await issueSession(res, currentUser, req);
    return res.redirect(`${clientUrl}/auth/callback?next=/settings`);
  }

  // Normal Sign-in / Sign-up flow:
  // Rule 1: Provider identity already linked -> Sign in to that account
  let user = await User.findOne({
    "providers.provider": provider,
    "providers.providerId": profile.providerId,
  });

  if (user) {
    await issueSession(res, user, req);
    return res.redirect(`${clientUrl}/auth/callback?next=${encodeURIComponent(nextTarget)}`);
  }

  // Identity not yet linked: check by email
  const existingEmailUser = await User.findOne({ email });

  if (!existingEmailUser) {
    // Rule 2: No account with this verified email -> Create verified account with no password & sign in
    user = await User.create({
      name: profile.name || email.split("@")[0],
      email,
      emailVerified: true,
      providers: [{ provider, providerId: profile.providerId }],
      avatarUrl: profile.avatarUrl,
      tokenVersion: 0,
    });
    await issueSession(res, user, req);
    return res.redirect(`${clientUrl}/auth/callback?next=${encodeURIComponent(nextTarget)}`);
  }

  if (existingEmailUser.emailVerified) {
    // Rule 3: Account with this email exists and is verified -> Link the provider and sign in
    existingEmailUser.providers.push({ provider, providerId: profile.providerId });
    if (!existingEmailUser.avatarUrl && profile.avatarUrl) {
      existingEmailUser.avatarUrl = profile.avatarUrl;
    }
    await existingEmailUser.save();
    await issueSession(res, existingEmailUser, req);
    return res.redirect(`${clientUrl}/auth/callback?next=${encodeURIComponent(nextTarget)}`);
  }

  // Rule 4: Account with this email exists and is unverified ->
  // Take over: remove the password, bump tokenVersion, mark verified, link, sign in
  existingEmailUser.password = undefined;
  existingEmailUser.tokenVersion = (existingEmailUser.tokenVersion || 0) + 1;
  existingEmailUser.emailVerified = true;
  // Sign out whoever registered this unverified email with a password
  await revokeAllSessions(existingEmailUser._id);
  existingEmailUser.providers.push({ provider, providerId: profile.providerId });
  if (!existingEmailUser.avatarUrl && profile.avatarUrl) {
    existingEmailUser.avatarUrl = profile.avatarUrl;
  }
  await existingEmailUser.save();
  await issueSession(res, existingEmailUser, req);
  return res.redirect(`${clientUrl}/auth/callback?next=${encodeURIComponent(nextTarget)}`);
});

