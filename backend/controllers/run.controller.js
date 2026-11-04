import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { MAX_STDOUT_CHARS, MAX_STDERR_CHARS } from "../config/limits.js";

// Wandbox API: free public compiler without API key requirements
// https://wandbox.org/api/list.json
const WANDBOX_COMPILERS = {
  cpp: "gcc-head",
  python: "cpython-3.12.7",
  javascript: "nodejs-20.17.0",
  java: "openjdk-jdk-22+36",
};

export const runCode = asyncHandler(async (req, res) => {
  const { language, code, stdin } = req.body;

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

  let response;
  try {
    response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler,
        code: cleanCode,
        stdin: stdin || "",
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new ApiError(502, "Code execution timed out (15 second limit)");
    }
    logger.error({ err }, "Wandbox compile request failed");
    throw new ApiError(502, "Code execution service unavailable");
  }

  if (!response.ok) {
    logger.error({ status: response.status }, "Wandbox compile API error");
    throw new ApiError(502, "Code execution service unavailable");
  }

  const data = await response.json();

  let stdout = data.program_output || "";
  let stderr = [data.compiler_error, data.program_error].filter(Boolean).join("\n");

  // Output capping (100,000 characters each)
  if (stdout.length > MAX_STDOUT_CHARS) {
    stdout = stdout.slice(0, MAX_STDOUT_CHARS) + "\n[Output truncated: exceeded 100,000 characters]";
  }
  if (stderr.length > MAX_STDERR_CHARS) {
    stderr = stderr.slice(0, MAX_STDERR_CHARS) + "\n[Error output truncated: exceeded 100,000 characters]";
  }

  const exitCode = parseInt(data.status, 10) || (stderr && !stdout ? 1 : 0);

  res.json({
    stdout,
    stderr,
    code: exitCode,
  });
});
