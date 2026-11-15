import mongoose from "mongoose";

/**
 * One signed-in device. The browser holds the raw refresh token in an HttpOnly
 * cookie; the database stores only its SHA-256 hash.
 *
 * Every refresh rotates the token: the old session is marked `replacedAt` and a
 * new one is created. Presenting a replaced token again after the short grace
 * window is treated as token theft and revokes all of the user's sessions.
 */
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    replacedAt: { type: Date, default: null },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

// MongoDB TTL index: purge sessions once they expire
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Session", sessionSchema);
