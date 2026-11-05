import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    emailVerified: { type: Boolean, default: false },
    providers: [
      {
        provider: { type: String, enum: ["google", "github"], required: true },
        providerId: { type: String, required: true },
      },
    ],
    tokenVersion: { type: Number, default: 0 },
    emailPrefs: {
      digest: { type: Boolean, default: false },
    },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

// Compound sparse unique index so providers link reliably
userSchema.index({ "providers.provider": 1, "providers.providerId": 1 }, { unique: true, sparse: true });

userSchema.methods.isValidPassword = function (plain) {
  if (!this.password) return false;
  return bcrypt.compare(plain, this.password);
};

// Short-lived token, sent in the Authorization header
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
    },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    }
  );
};

// Long-lived token, stored in an HTTP-only cookie, used only to get new access tokens
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      tokenVersion: this.tokenVersion ?? 0,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

export default mongoose.model("User", userSchema);
