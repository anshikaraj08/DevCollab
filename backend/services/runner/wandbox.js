import { MAX_STDOUT_CHARS, MAX_STDERR_CHARS } from "../../config/limits.js";

export const WANDBOX_COMPILERS = {
  cpp: "gcc-head",
  python: "cpython-3.12.7",
  javascript: "nodejs-20.17.0",
  java: "openjdk-jdk-22+36",
};

/**
 * Execute code via Wandbox compiler API.
 * @param {Object} options
 * @param {string} options.language - "cpp" | "python" | "javascript" | "java"
 * @param {string} options.code - source code string
 * @param {string} [options.stdin] - standard input
 * @param {number} [options.timeoutMs=15000] - execution timeout
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export async function executeWandbox({ language, code, stdin = "", timeoutMs = 15000 }) {
  const compiler = WANDBOX_COMPILERS[language.toLowerCase()];
  if (!compiler) {
    const error = new Error(`Unsupported language: ${language}`);
    error.status = 400;
    throw error;
  }

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
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const error = new Error(`Wandbox execution failed with status ${response.status}`);
    error.status = 502;
    throw error;
  }

  const data = await response.json();

  let stdout = data.program_output || "";
  let stderr = [data.compiler_error, data.program_error].filter(Boolean).join("\n");

  if (stdout.length > MAX_STDOUT_CHARS) {
    stdout = stdout.slice(0, MAX_STDOUT_CHARS) + "\n[Output truncated: exceeded 100,000 characters]";
  }
  if (stderr.length > MAX_STDERR_CHARS) {
    stderr = stderr.slice(0, MAX_STDERR_CHARS) + "\n[Error output truncated: exceeded 100,000 characters]";
  }

  const exitCode = parseInt(data.status, 10) || (stderr && !stdout ? 1 : 0);

  return {
    stdout,
    stderr,
    code: exitCode,
  };
}

