import nodemailer from "nodemailer";
import logger from "../utils/logger.js";
import env from "../config/env.js";

const clientUrl = (env?.CLIENT_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
const mailFrom = process.env.MAIL_FROM || "DevCollab <noreply@devcollab.io>";
const isProd = process.env.NODE_ENV === "production";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const transportType = process.env.MAIL_TRANSPORT || "console";
  const smtpUrl = process.env.SMTP_URL;

  if (transportType === "smtp" && smtpUrl) {
    transporter = nodemailer.createTransport(smtpUrl);
  } else {
    // Console transport (development & testing)
    transporter = {
      sendMail: async (mailOptions) => {
        if (!isProd) {
          logger.info(
            { to: mailOptions.to, subject: mailOptions.subject, preview: mailOptions.text?.slice(0, 160) },
            "[Mailer:Console] Outgoing email"
          );
        } else {
          logger.info({ to: mailOptions.to, subject: mailOptions.subject }, "[Mailer:Console] Outgoing email");
        }
        return { messageId: `mock_${Date.now()}` };
      },
    };
  }
  return transporter;
}

/**
 * Universal mailer interface
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.text
 * @param {string} [options.html]
 */
export async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  return t.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
    html: html || text,
  });
}

/**
 * Sends an email verification link
 */
export async function sendVerificationEmail({ to, name, token }) {
  const verifyUrl = `${clientUrl}/verify-email/${token}`;
  const subject = "Verify your DevCollab account";
  const text = `Hi ${name || "there"},\n\nPlease verify your email address for DevCollab by visiting the following link:\n${verifyUrl}\n\nThis link will expire in 24 hours.\n\nBest,\nThe DevCollab Team`;
  const html = `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
    <h2>Verify your DevCollab account</h2>
    <p>Hi ${name || "there"},</p>
    <p>Please click the button below to verify your email address:</p>
    <p><a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email Address</a></p>
    <p>Or copy and paste this URL into your browser:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p style="color: #64748b; font-size: 12px; margin-top: 30px;">This link will expire in 24 hours. If you did not create a DevCollab account, you can safely ignore this email.</p>
  </div>`;

  return sendMail({ to, subject, text, html });
}

/**
 * Sends a password reset link
 */
export async function sendPasswordResetEmail({ to, name, token }) {
  const resetUrl = `${clientUrl}/reset-password/${token}`;
  const subject = "Reset your DevCollab password";
  const text = `Hi ${name || "there"},\n\nWe received a request to reset your DevCollab password. Visit the link below to set a new password:\n${resetUrl}\n\nThis link will expire in 1 hour and can only be used once.\n\nBest,\nThe DevCollab Team`;
  const html = `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
    <h2>Reset your password</h2>
    <p>Hi ${name || "there"},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a></p>
    <p>Or copy and paste this URL into your browser:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p style="color: #64748b; font-size: 12px; margin-top: 30px;">This link will expire in 1 hour. If you did not request a password reset, your account is safe and you can ignore this email.</p>
  </div>`;

  return sendMail({ to, subject, text, html });
}

/**
 * Sends security notice when password is changed
 */
export async function sendPasswordChangedNotice({ to, name }) {
  const subject = "Security notice: Your DevCollab password was changed";
  const text = `Hi ${name || "there"},\n\nThis is a confirmation that your password for DevCollab has been changed.\n\nAll your previous active sessions have been signed out. If you did not make this change, please reset your password immediately.\n\nBest,\nThe DevCollab Team`;
  const html = `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
    <h2>Password Changed</h2>
    <p>Hi ${name || "there"},</p>
    <p>This is a confirmation that your password for DevCollab has been changed.</p>
    <p>All your previous sessions have been signed out. If you did not make this change, please reset your password immediately.</p>
  </div>`;

  return sendMail({ to, subject, text, html });
}

export default {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotice,
};

