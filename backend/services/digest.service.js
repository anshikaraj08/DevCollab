import crypto from "crypto";
import { escapeHtml } from "../utils/escapeHtml.js";
import Lease from "../models/lease.model.js";
import User from "../models/user.model.js";
import Room from "../models/room.model.js";
import Notification from "../models/notification.model.js";
import AuthToken from "../models/authToken.model.js";
import { sendMail } from "./mailer.js";
import { isRoomMember } from "./notification.service.js";
import logger from "../utils/logger.js";
import env from "../config/env.js";

const clientUrl = (env?.CLIENT_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

let injectedMailer = null;

export function setDigestMailer(customMailer) {
  injectedMailer = customMailer;
}

export function resetDigestMailer() {
  injectedMailer = null;
}

/**
 * Acquire a distributed Mongo-based lease lock
 */
export async function acquireLease(key, holder, durationMs = 60000, currentTime = new Date()) {
  const expiresAt = new Date(currentTime.getTime() + durationMs);

  try {
    const doc = await Lease.findOneAndUpdate(
      {
        key,
        $or: [{ expiresAt: { $lt: currentTime } }, { holder }],
      },
      {
        $set: { holder, expiresAt },
      },
      { upsert: true, returnDocument: "after" }
    );
    return Boolean(doc);
  } catch (err) {
    // If conflict on unique key insert
    return false;
  }
}

/**
 * Release the lease lock
 */
export async function releaseLease(key, holder) {
  try {
    await Lease.deleteOne({ key, holder });
  } catch (err) {
    // Ignore error on release
  }
}

/**
 * Format and send the digest email
 */
export async function sendDigestEmail({ to, name, notifications, unsubscribeToken }) {
  const mailer = injectedMailer || sendMail;
  const count = notifications.length;
  const subject = `DevCollab: You have ${count} unread notification${count === 1 ? "" : "s"}`;
  const unsubscribeUrl = `${clientUrl}/unsubscribe-digest?token=${unsubscribeToken}`;

  const itemsText = notifications
    .map((n) => {
      const actorName = n.actor?.name || "A team member";
      const roomTitle = n.room?.title || "a room";
      const actionDesc =
        n.type === "mention"
          ? "mentioned you in a comment"
          : n.type === "reply"
          ? "replied to your comment thread"
          : "accepted your room invite";
      return `* ${actorName} ${actionDesc} in "${roomTitle}"`;
    })
    .join("\n");

  const text = `Hi ${name || "there"},\n\nYou have ${count} unread notification${
    count === 1 ? "" : "s"
  } on DevCollab:\n\n${itemsText}\n\nVisit your DevCollab rooms to reply: ${clientUrl}\n\n---\nTo stop receiving notification digests, unsubscribe with one click: ${unsubscribeUrl}\n`;

  const itemsHtml = notifications
    .map((n) => {
      const actorName = n.actor?.name || "A team member";
      const roomTitle = n.room?.title || "a room";
      const actionDesc =
        n.type === "mention"
          ? "mentioned you in a comment"
          : n.type === "reply"
          ? "replied to your comment thread"
          : "accepted your room invite";
      return `<li style="margin-bottom: 8px;"><strong>${escapeHtml(actorName)}</strong> ${escapeHtml(actionDesc)} in <em>${escapeHtml(roomTitle)}</em></li>`;
    })
    .join("");

  const html = `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #1e293b;">
    <h2 style="color: #0f172a;">DevCollab Notification Digest</h2>
    <p>Hi ${escapeHtml(name || "there")},</p>
    <p>You have ${count} unread notification${count === 1 ? "" : "s"} waiting for you:</p>
    <ul style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 24px;">
      ${itemsHtml}
    </ul>
    <p style="margin-top: 20px;">
      <a href="${clientUrl}" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Go to DevCollab
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 16px 0;" />
    <p style="font-size: 12px; color: #64748b;">
      You received this because you enabled notification digests in your account settings.
      <br />
      <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">
        Unsubscribe from digests with one click
      </a>
    </p>
  </div>`;

  return mailer({ to, subject, text, html });
}

/**
 * Runs one digest cycle
 * @param {Object} [options]
 * @param {Date} [options.now]
 * @param {string} [options.workerId]
 * @returns {Promise<{ sent: number, skipped: boolean, reason?: string }>}
 */
export async function runDigestCycle(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const workerId = options.workerId || `worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;

  // 1. Acquire leased lock
  const locked = await acquireLease("email-digest-cycle", workerId, 60000, now);
  if (!locked) {
    return { sent: 0, skipped: true, reason: "lease_locked" };
  }

  let sentCount = 0;

  try {
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // 2. Find eligible users: emailVerified: true, emailPrefs.digest: true, not digested in last 15 min
    const eligibleUsers = await User.find({
      emailVerified: true,
      "emailPrefs.digest": true,
      $or: [
        { "emailPrefs.lastDigestAt": null },
        { "emailPrefs.lastDigestAt": { $exists: false } },
        { "emailPrefs.lastDigestAt": { $lte: fifteenMinutesAgo } },
      ],
    });

    for (const user of eligibleUsers) {
      // Find unread notifications >= 10 mins old that haven't been digested
      const pendingNotifications = await Notification.find({
        user: user._id,
        readAt: null,
        digestedAt: null,
        createdAt: { $lte: tenMinutesAgo },
      })
        .populate("actor", "name email avatarUrl")
        .populate("room", "title createdBy users")
        .sort({ createdAt: -1 });

      if (!pendingNotifications || pendingNotifications.length === 0) {
        continue;
      }

      // Filter to notifications where user is still a member of the room
      const validNotifications = pendingNotifications.filter((n) => {
        if (!n.room) return false;
        return isRoomMember(n.room, user._id);
      });

      if (validNotifications.length === 0) {
        continue;
      }

      // Create one-click unsubscribe token (valid for 30 days)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await AuthToken.create({
        user: user._id,
        type: "unsubscribe",
        tokenHash,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      // Send email
      await sendDigestEmail({
        to: user.email,
        name: user.name,
        notifications: validNotifications,
        unsubscribeToken: rawToken,
      });

      // Mark notifications as digested
      const notifIds = validNotifications.map((n) => n._id);
      await Notification.updateMany({ _id: { $in: notifIds } }, { $set: { digestedAt: now } });

      // Update user lastDigestAt
      user.emailPrefs = user.emailPrefs || {};
      user.emailPrefs.lastDigestAt = now;
      await user.save();

      sentCount++;
    }
  } catch (err) {
    logger.error({ err: err.message }, "Error during digest cycle execution");
  } finally {
    await releaseLease("email-digest-cycle", workerId);
  }

  return { sent: sentCount, skipped: false };
}

let digestIntervalId = null;

export function startDigestScheduler(intervalMs = 60000) {
  if (digestIntervalId) return;
  digestIntervalId = setInterval(() => {
    runDigestCycle().catch((err) => {
      logger.error({ err: err.message }, "Digest scheduler cycle error");
    });
  }, intervalMs);
}

export function stopDigestScheduler() {
  if (digestIntervalId) {
    clearInterval(digestIntervalId);
    digestIntervalId = null;
  }
}
