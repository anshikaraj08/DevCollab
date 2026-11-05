/**
 * Anthropic Claude Provider Implementation for DevCollab AI Code Review
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
const TIMEOUT_MS = 60000;

export async function callAnthropic({ apiKey, model = DEFAULT_ANTHROPIC_MODEL, systemPrompt, userPrompt, messages = null }) {
  if (!apiKey) {
    throw new Error("Missing Anthropic API key");
  }

  const payload = {
    model: model || DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages || [{ role: "user", content: userPrompt }],
  };

  const executeRequest = async () => {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
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

  const rawText = data?.content?.[0]?.text || "";
  const usage = {
    inputTokens: data?.usage?.input_tokens || 0,
    outputTokens: data?.usage?.output_tokens || 0,
  };

  return { rawText, usage };
}
