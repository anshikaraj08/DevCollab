import { executeWandbox } from "./wandbox.js";
import { runnerBreaker } from "./circuitBreaker.js";
import logger from "../../utils/logger.js";

function isNetworkError(err) {
  if (!err) return false;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  if (err.name === "TypeError" && err.message?.includes("fetch failed")) return true;
  const netCodes = ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"];
  if (netCodes.includes(err.code) || netCodes.includes(err.cause?.code)) return true;
  return false;
}

/**
 * Universal code runner service with circuit breaking, timeout, and single retry on network failure.
 *
 * @param {Object} params
 * @param {string} params.language
 * @param {string} params.code
 * @param {string} [params.stdin=""]
 * @param {Object} [deps] - Optional test injection overrides
 * @param {(opts: any) => Promise<{ stdout: string, stderr: string, code: number }>} [deps.executor]
 * @param {import("./circuitBreaker.js").CircuitBreaker} [deps.breaker]
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export async function run({ language, code, stdin = "" }, deps = {}) {
  const executor = deps.executor || executeWandbox;
  const breaker = deps.breaker || runnerBreaker;

  return breaker.execute(async () => {
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        return await executor({ language, code, stdin, timeoutMs: 15000 });
      } catch (err) {
        // If it's a client error (e.g. 400 Unsupported language), rethrow immediately
        if (err.status === 400) {
          throw err;
        }

        // Retry once only on network/timeout errors
        if (attempts === 1 && isNetworkError(err)) {
          logger.warn({ err: err.message, attempt: 1 }, "Network error during code run, retrying once...");
          continue;
        }

        if (err.name === "TimeoutError" || err.name === "AbortError") {
          const timeoutErr = new Error("Code execution timed out (15 second limit)");
          timeoutErr.status = 502;
          throw timeoutErr;
        }

        if (!err.status) {
          err.status = 502;
          err.message = "Code execution service unavailable";
        }
        throw err;
      }
    }
  });
}

export { runnerBreaker, executeWandbox };
export default { run, runnerBreaker, executeWandbox };
