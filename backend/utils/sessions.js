import crypto from "crypto";
import Session from "../models/session.model.js";
import { setRefreshCookie } from "./cookies.js";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Two tabs (or the HTTP client and the socket client) can refresh with the same
// cookie at the same moment. A replaced token stays usable this long so that
// race does not look like token theft.
export const ROTATION_GRACE_MS = 30 * 1000;

export const hashToken = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");

/** Create a session for the user and return the raw refresh token. */
export async function createSession(userId, req) {
  const raw = crypto.randomBytes(32).toString("hex");
  await Session.create({
    user: userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 256),
  });
  return raw;
}

/** Create a session and set it as the refresh cookie. */
export async function issueSession(res, user, req) {
  const raw = await createSession(user._id, req);
  setRefreshCookie(res, raw);
  return raw;
}

/** Look up an unexpired, unreplaced session by raw token. */
export async function findActiveSession(raw) {
  if (!raw || typeof raw !== "string") return null;
  const session = await Session.findOne({ tokenHash: hashToken(raw) });
  if (!session || session.expiresAt < new Date() || session.replacedAt) return null;
  return session;
}

/**
 * Rotate a refresh token.
 * @returns {Promise<
 *   | { status: "rotated", userId: string, token: string }
 *   | { status: "grace", userId: string }
 *   | { status: "reused", userId: string }
 *   | { status: "invalid" }
 * >}
 */
export async function rotateSession(raw, req) {
  if (!raw || typeof raw !== "string") return { status: "invalid" };
  const tokenHash = hashToken(raw);
  const now = new Date();

  // Atomically claim the session so two concurrent refreshes cannot both rotate it.
  const claimed = await Session.findOneAndUpdate(
    { tokenHash, replacedAt: null, expiresAt: { $gt: now } },
    { $set: { replacedAt: now } },
    { new: true }
  );

  if (claimed) {
    const token = await createSession(claimed.user, req);
    return { status: "rotated", userId: String(claimed.user), token };
  }

  const existing = await Session.findOne({ tokenHash });
  if (!existing || existing.expiresAt < now) return { status: "invalid" };

  if (existing.replacedAt && now - existing.replacedAt <= ROTATION_GRACE_MS) {
    return { status: "grace", userId: String(existing.user) };
  }

  // A token that was already rotated is being replayed: assume it was stolen.
  await revokeAllSessions(existing.user);
  return { status: "reused", userId: String(existing.user) };
}

export async function revokeSession(raw) {
  if (!raw || typeof raw !== "string") return;
  await Session.deleteOne({ tokenHash: hashToken(raw) });
}

export async function revokeAllSessions(userId) {
  await Session.deleteMany({ user: userId });
}
