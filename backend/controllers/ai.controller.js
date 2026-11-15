import AiReview from "../models/aiReview.model.js";
import { reviewCode, isAiConfigured, getAiConfig } from "../services/ai/index.js";
import { redactSecrets } from "../utils/secretRedactor.js";
import { roomKey } from "../sockets/roomKey.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const MAX_CODE_CHARS = 20000;
const VALID_FOCUS = ["all", "bugs", "security", "performance", "style"];

/**
 * Request an automated AI code review for the workspace document.
 * POST /rooms/:roomId/ai-review (or POST /rooms/:roomId/ai-reviews)
 */
export const requestReview = asyncHandler(async (req, res) => {
  if (!isAiConfigured()) {
    throw new ApiError(503, "AI review is not configured on this server");
  }

  const { focus = "all" } = req.body || {};
  const selectedFocus = VALID_FOCUS.includes(focus) ? focus : "all";

  // Check global daily request limit
  const dailyLimit = Number(process.env.AI_DAILY_REQUEST_LIMIT) || 100;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyCount = await AiReview.countDocuments({ createdAt: { $gte: oneDayAgo } });
  if (dailyCount >= dailyLimit) {
    throw new ApiError(429, "Daily server quota for AI reviews has been reached. Please try again tomorrow.");
  }

  // Retrieve current code from live memory docStore or database
  const docStore = req.app.get("docStore");
  const code = docStore
    ? await docStore.getText(req.room._id)
    : req.room.code || "";

  if (!code || !code.trim()) {
    throw new ApiError(400, "Workspace code is empty");
  }

  if (code.length > MAX_CODE_CHARS) {
    throw new ApiError(
      413,
      `Code exceeds maximum supported length of ${MAX_CODE_CHARS.toLocaleString()} characters for AI review`
    );
  }

  // Redact secrets before sending to AI provider
  const { code: sanitizedCode, redactedCount } = redactSecrets(code);

  // Invoke AI provider
  const result = await reviewCode({
    language: req.room.language || "javascript",
    code: sanitizedCode,
    focus: selectedFocus,
  });

  // Calculate Yjs relative position anchors for findings
  const findingsWithAnchors = [];
  for (const finding of result.findings || []) {
    let anchor = null;
    if (docStore && typeof docStore.createAnchorForLine === "function") {
      try {
        anchor = await docStore.createAnchorForLine(req.room._id, finding.line);
      } catch {
        anchor = null;
      }
    }
    findingsWithAnchors.push({
      ...finding,
      anchor,
    });
  }

  // Persist AiReview document (stores length, never the raw code)
  const review = await AiReview.create({
    room: req.room._id,
    requestedBy: req.user.id,
    provider: result.provider,
    model: result.model,
    focus: selectedFocus,
    status: result.status,
    summary: result.summary,
    findings: findingsWithAnchors,
    codeChars: code.length,
    usage: result.usage,
    error: result.error || null,
  });

  await review.populate("requestedBy", "name email avatarUrl");

  // Broadcast ai:changed socket notification
  const io = req.app.get("io");
  io?.to(roomKey(req.room._id)).emit("ai:changed", { reviewId: review._id });

  res.status(201).json({ review });
});

/**
 * List the most recent 10 AI reviews for the workspace.
 * GET /rooms/:roomId/ai-reviews
 */
export const listReviews = asyncHandler(async (req, res) => {
  if (!isAiConfigured()) {
    throw new ApiError(503, "AI review is not configured on this server");
  }

  const reviews = await AiReview.find({ room: req.room._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("requestedBy", "name email avatarUrl");

  res.status(200).json({
    reviews,
    configured: true,
  });
});

/**
 * Check AI configuration status for workspace.
 * GET /rooms/:roomId/ai-status
 */
export const getAiStatus = asyncHandler(async (req, res) => {
  const config = getAiConfig();
  res.status(200).json({
    configured: config.configured,
    provider: config.provider,
    model: config.model,
  });
});

/**
 * Delete an AI review (requester or room owner only).
 * DELETE /rooms/:roomId/ai-reviews/:id
 */
export const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await AiReview.findOne({ _id: id, room: req.room._id });
  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  const isOwner = String(req.room.createdBy?._id || req.room.createdBy) === String(req.user.id);
  const isRequester = String(review.requestedBy) === String(req.user.id);

  if (!isOwner && !isRequester) {
    throw new ApiError(403, "Only the requester or room owner can delete this review");
  }

  await review.deleteOne();

  const io = req.app.get("io");
  io?.to(roomKey(req.room._id)).emit("ai:changed", { deletedId: id });

  res.status(200).json({ message: "Review deleted successfully" });
});
