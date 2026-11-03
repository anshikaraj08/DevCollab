import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

// Wandbox API: free public compiler without API key requirements
// https://wandbox.org/api/list.json
const WANDBOX_COMPILERS = {
  cpp:        "gcc-head",
  python:     "cpython-3.12.7",
  javascript: "nodejs-20.17.0",
  java:       "openjdk-jdk-22+36",
};

export const runCode = asyncHandler(async (req, res) => {
  const { language, code, stdin } = req.body;

  if (!language || typeof code !== "string") {
    throw new ApiError(400, "language and code are required");
  }

  const compiler = WANDBOX_COMPILERS[language.toLowerCase()];
  if (!compiler) {
    throw new ApiError(400, `Unsupported language: ${language}`);
  }

  // Pre-process code if necessary:
  // In Java, Wandbox compiles `prog.java`. A `public class MyClass` throws an error if not named `prog`.
  // Removing `public ` allows any class name to compile seamlessly.
  let cleanCode = code;
  if (language.toLowerCase() === "java") {
    cleanCode = cleanCode.replace(/\bpublic\s+class\b/, "class");
  }

  const response = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compiler,
      code: cleanCode,
      stdin: stdin || "",
    }),
  });

  if (!response.ok) {
    logger.error({ status: response.status }, "Wandbox compile API error");
    throw new ApiError(502, "Code execution service unavailable");
  }

  const data = await response.json();

  const stdout = data.program_output || "";
  const stderr = [data.compiler_error, data.program_error].filter(Boolean).join("\n");
  const exitCode = parseInt(data.status, 10) || (stderr && !stdout ? 1 : 0);

  res.json({
    stdout,
    stderr,
    code: exitCode,
  });
});
