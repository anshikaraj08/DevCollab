import mongoose from "mongoose";

const findingSchema = new mongoose.Schema(
  {
    line: {
      type: Number,
      required: true,
      min: 1,
    },
    endLine: {
      type: Number,
      min: 1,
    },
    anchor: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "error"],
      required: true,
    },
    category: {
      type: String,
      enum: ["bug", "security", "performance", "readability", "style"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },
    suggestion: {
      type: String,
      maxlength: 800,
      trim: true,
    },
  },
  { _id: true }
);

const aiReviewSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    focus: {
      type: String,
      enum: ["all", "bugs", "security", "performance", "style"],
      default: "all",
    },
    status: {
      type: String,
      enum: ["ok", "failed"],
      required: true,
    },
    summary: {
      type: String,
      maxlength: 600,
      default: "",
    },
    findings: {
      type: [findingSchema],
      default: [],
    },
    codeChars: {
      type: Number,
      required: true,
      min: 0,
    },
    usage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

aiReviewSchema.index({ room: 1, createdAt: -1 });

export default mongoose.model("AiReview", aiReviewSchema);
