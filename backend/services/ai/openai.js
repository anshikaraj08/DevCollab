/**
 * OpenAI-compatible Chat Completions provider for DevCollab AI Code Review.
 * Used for OpenAI itself and for Groq, which exposes the same API at a different URL.
 */

export const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 60000;

export async function callOpenAI({
  apiKey,
  model = DEFAULT_OPENAI_MODEL,
  systemPrompt,
  userPrompt,
  messages = null,
  apiUrl = OPENAI_API_URL,
  label = "OpenAI",
}) {
  if (!apiKey) {
    throw new Error(`Missing ${label} API key`);
  }

  const promptMessages = messages || [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const payload = {
    model: model || DEFAULT_OPENAI_MODEL,
    messages: promptMessages,
    response_format: { type: "json_object" },
    max_tokens: 2048,
  };

  const executeRequest = async () => {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const error = new Error(`${label} API error (${res.status}): ${errorText}`);
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

  const rawText = data?.choices?.[0]?.message?.content || "";
  const usage = {
    inputTokens: data?.usage?.prompt_tokens || 0,
    outputTokens: data?.usage?.completion_tokens || 0,
  };

  return { rawText, usage };
}
