import { callAnthropic } from "./anthropic.js";
import { callOpenAI } from "./openai.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildCorrectionPrompt,
} from "./prompt.js";
import { validateAndSanitizeOutput } from "./schema.js";
import logger from "../../utils/logger.js";
import ApiError from "../../utils/ApiError.js";

let testProviderOverride = null;

/**
 * Set an in-memory mock provider for testing.
 * @param {Function|null} mock - async function({ language, code, focus, systemPrompt, userPrompt })
 */
export function setAiProvider(mock) {
  testProviderOverride = mock;
}

export function resetAiProvider() {
  testProviderOverride = null;
}

/**
 * Checks whether AI review is configured with valid provider and credentials.
 */
export function getAiConfig() {
  const provider = (process.env.AI_PROVIDER || "").toLowerCase().trim();
  const model = (process.env.AI_MODEL || "").trim();
  const apiKey = (process.env.AI_API_KEY || "").trim();

  const isConfigured = Boolean(
    testProviderOverride ||
      (provider && apiKey && (provider === "anthropic" || provider === "openai"))
  );

  return {
    configured: isConfigured,
    provider: provider || (testProviderOverride ? "mock" : null),
    model:
      model ||
      (provider === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20241022"),
    apiKey,
  };
}

export function isAiConfigured() {
  return getAiConfig().configured;
}

/**
 * Conducts an automated code review using the configured AI provider.
 *
 * @param {Object} options
 * @param {string} options.language - Programming language
 * @param {string} options.code - Redacted source code
 * @param {string} [options.focus="all"] - Focus area ("all", "bugs", "security", "performance", "style")
 * @returns {Promise<{ status: "ok" | "failed", summary: string, findings: Array, usage: Object, provider: string, model: string, durationMs: number, error?: string }>}
 */
export async function reviewCode({ language = "javascript", code = "", focus = "all" }) {
  const config = getAiConfig();

  if (!config.configured) {
    throw new ApiError(503, "AI review is not configured on this server");
  }

  const startTime = Date.now();
  const totalLines = (code.match(/\n/g) || []).length + 1;
  const systemPrompt = buildSystemPrompt(focus);
  const userPrompt = buildUserPrompt({ language, code });

  let rawText = "";
  let usage = { inputTokens: 0, outputTokens: 0 };
  const providerName = config.provider;
  const modelName = config.model;

  // 1. First execution attempt
  try {
    if (testProviderOverride) {
      const mockResult = await testProviderOverride({
        language,
        code,
        focus,
        systemPrompt,
        userPrompt,
      });
      rawText = typeof mockResult === "string" ? mockResult : JSON.stringify(mockResult);
      if (mockResult?.usage) usage = mockResult.usage;
    } else if (providerName === "anthropic") {
      const result = await callAnthropic({
        apiKey: config.apiKey,
        model: modelName,
        systemPrompt,
        userPrompt,
      });
      rawText = result.rawText;
      usage = result.usage;
    } else if (providerName === "openai") {
      const result = await callOpenAI({
        apiKey: config.apiKey,
        model: modelName,
        systemPrompt,
        userPrompt,
      });
      rawText = result.rawText;
      usage = result.usage;
    } else {
      throw new ApiError(500, `Unsupported AI provider: ${providerName}`);
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logger.error(
      { provider: providerName, model: modelName, durationMs, err: err.message },
      "AI review provider request failed"
    );
    return {
      status: "failed",
      summary: "AI review failed to generate a response.",
      findings: [],
      usage,
      provider: providerName,
      model: modelName,
      durationMs,
      error: err.message,
    };
  }

  // 2. Validate first response
  let validation = validateAndSanitizeOutput(rawText, totalLines);

  // 3. Retry ONCE if invalid JSON or failed schema
  if (!validation.valid) {
    logger.warn(
      { provider: providerName, model: modelName, error: validation.error },
      "AI review output invalid on first attempt, retrying with corrective prompt"
    );

    const correctivePrompt = buildCorrectionPrompt(validation.error);

    try {
      if (testProviderOverride) {
        const retryResult = await testProviderOverride({
          language,
          code,
          focus,
          systemPrompt,
          userPrompt: correctivePrompt,
          isRetry: true,
        });
        rawText = typeof retryResult === "string" ? retryResult : JSON.stringify(retryResult);
      } else if (providerName === "anthropic") {
        const result = await callAnthropic({
          apiKey: config.apiKey,
          model: modelName,
          systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
            { role: "assistant", content: rawText },
            { role: "user", content: correctivePrompt },
          ],
        });
        rawText = result.rawText;
        usage.inputTokens += result.usage.inputTokens;
        usage.outputTokens += result.usage.outputTokens;
      } else if (providerName === "openai") {
        const result = await callOpenAI({
          apiKey: config.apiKey,
          model: modelName,
          systemPrompt,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
            { role: "assistant", content: rawText },
            { role: "user", content: correctivePrompt },
          ],
        });
        rawText = result.rawText;
        usage.inputTokens += result.usage.inputTokens;
        usage.outputTokens += result.usage.outputTokens;
      }

      validation = validateAndSanitizeOutput(rawText, totalLines);
    } catch (retryErr) {
      logger.error(
        { provider: providerName, err: retryErr.message },
        "AI review retry attempt failed"
      );
    }
  }

  const durationMs = Date.now() - startTime;

  // 4. If still invalid after retry, report clean failure
  if (!validation.valid) {
    logger.error(
      { provider: providerName, model: modelName, durationMs, error: validation.error },
      "AI review output failed validation after retry"
    );
    return {
      status: "failed",
      summary: "AI review output could not be parsed into valid structured findings.",
      findings: [],
      usage,
      provider: providerName,
      model: modelName,
      durationMs,
      error: validation.error,
    };
  }

  // 5. Successful review
  logger.info(
    {
      provider: providerName,
      model: modelName,
      durationMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      findingsCount: validation.data.findings.length,
    },
    "AI code review completed successfully"
  );

  return {
    status: "ok",
    summary: validation.data.summary,
    findings: validation.data.findings,
    usage,
    provider: providerName,
    model: modelName,
    durationMs,
  };
}
