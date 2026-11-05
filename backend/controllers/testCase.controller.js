import { asyncHandler } from "../utils/asyncHandler.js";
import { roomKey } from "../sockets/roomKey.js";

/**
 * GET /rooms/:roomId/tests
 * Action: tests.read (owner, editor, viewer)
 */
export const getTestCases = asyncHandler(async (req, res) => {
  res.json({
    cases: req.room.testCases || [],
  });
});

/**
 * PUT /rooms/:roomId/tests
 * Action: tests.write (owner, editor)
 * Replaces the entire test cases array. Emits tests:updated.
 */
export const updateTestCases = asyncHandler(async (req, res) => {
  req.room.testCases = req.body.cases || [];
  await req.room.save();

  const io = req.app.get("io");
  if (io) {
    io.to(roomKey(req.room._id)).emit("tests:updated", { roomId: req.room._id });
  }

  res.json({
    cases: req.room.testCases,
  });
});

