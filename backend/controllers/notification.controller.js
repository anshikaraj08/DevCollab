import Notification from "../models/notification.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * GET /notifications?limit=30&before=<id>&unread=true
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const { limit = 30, before, unread } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);

  const query = { user: req.user.id };

  if (unread === "true" || unread === true) {
    query.readAt = null;
  }

  if (before) {
    query._id = { $lt: before };
  }

  const notifications = await Notification.find(query)
    .populate("actor", "name email avatarUrl")
    .populate("room", "title")
    .populate("comment", "text line resolved")
    .sort({ createdAt: -1, _id: -1 })
    .limit(parsedLimit);

  res.json({ notifications });
});

/**
 * GET /notifications/unread-count
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    user: req.user.id,
    readAt: null,
  });

  res.json({ count });
});

/**
 * POST /notifications/read
 * Body: { ids: [...] } or { all: true }
 */
export const markRead = asyncHandler(async (req, res) => {
  const { ids, all } = req.body;

  if (!all && (!ids || !Array.isArray(ids) || ids.length === 0)) {
    throw new ApiError(400, "Either 'all: true' or a list of notification 'ids' is required");
  }

  const query = { user: req.user.id, readAt: null };
  if (!all) {
    query._id = { $in: ids };
  }

  const now = new Date();
  const result = await Notification.updateMany(query, { $set: { readAt: now } });

  res.json({
    message: "Notifications marked as read",
    count: result.modifiedCount,
  });
});
