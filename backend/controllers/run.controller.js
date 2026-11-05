import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { run } from "../services/runner/index.js";

export const runCode = asyncHandler(async (req, res) => {
  const { language, code, stdin } = req.body;

  try {
    const result = await run({ language, code, stdin });
    res.json(result);
  } catch (err) {
    if (err.status) {
      throw new ApiError(err.status, err.message);
    }
    throw new ApiError(502, "Code execution service unavailable");
  }
});
