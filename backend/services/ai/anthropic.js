/**
 * Anthropic Claude Provider Implementation for DevCollab AI Code Review
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";
// Thinking is always on for current models, so give room for reasoning plus the JSON answer.
const MAX_TOKENS = 16000;
// Code review is quality-sensitive; claude-opus-5-5 defaults to "medium" effort.
const EFFORT = process.env.AI_EFFORT || "high";
const TIMEOUT_MS = 120000;

export async function callAnthropic({ apiKey, model = DEFAULT_ANTHROPIC_MODEL, systemPrompt, userPrompt, messages = null }) {
  if (!apiKey) {
    throw new Error("Missing Anthropic API key");
  }

  const payload = {
    model: model || DEFAULT_ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: messages || [{ role: "user", content: userPrompt }],
    output_config: { effort: EFFORT },
    // If a safety classifier declines, re-run on a suitable fallback model in the same call.
    fallbacks: "default",
  };

  const executeRequest = async () => {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const error = new Error(`Anthropic API error (${res.status}): ${errorText}`);
      error.status = res.status;
      throw error;
    }

    return res.json();
  };

  // Perform request with one retry on 429 or 5xx
  let data;
  try {
    data = await executeRequest();
  } catch (err) {
    if (err.status === 429 || (err.status >= 500 && err.status <= 599)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      data = await executeRequest();
    } else {
      throw err;
    }
  }

  if (data?.stop_reason === "refusal") {
    const category = data?.stop_details?.category || "unspecified";
    throw new Error(`Anthropic declined to review this code (category: ${category})`);
  }
  if (data?.stop_reason === "max_tokens") {
    throw new Error("Anthropic response was cut off at the token limit");
  }

  // The response may start with thinking blocks; the answer is in the text blocks.
  const rawText = (data?.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const usage = {
    inputTokens: data?.usage?.input_tokens || 0,
    outputTokens: data?.usage?.output_tokens || 0,
  };

  return { rawText, usage };
}
