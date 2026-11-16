import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { reviewCode, getAiConfig, resetAiProvider } from "../services/ai/index.js";

// The Groq provider is exercised with a stubbed fetch: no network calls, no API key needed.
describe("AI review via Groq", () => {
  const saved = {};
  let realFetch;
  let calls;

  beforeEach(() => {
    for (const k of ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL"]) saved[k] = process.env[k];
    process.env.AI_PROVIDER = "groq";
    process.env.AI_API_KEY = "gsk_test_key";
    delete process.env.AI_MODEL;
    resetAiProvider();
    realFetch = globalThis.fetch;
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function stubFetch(contents) {
    let i = 0;
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      const content = contents[Math.min(i++, contents.length - 1)];
      return new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };
  }

  const validOutput = JSON.stringify({
    summary: "Off-by-one in the loop.",
    findings: [{ line: 2, severity: "error", category: "bug", message: "Loop reads past the end", suggestion: "Use i < n" }],
  });

  it("is reported as configured with the Groq default model", () => {
    const config = getAiConfig();
    assert.equal(config.configured, true);
    assert.equal(config.provider, "groq");
    assert.equal(config.model, "llama-3.3-70b-versatile");
  });

  it("calls Groq's OpenAI-compatible endpoint in JSON mode and parses findings", async () => {
    stubFetch([validOutput]);
    const result = await reviewCode({ language: "cpp", code: "int main(){\nfor(int i=0;i<=n;i++){}\n}" });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(calls[0].init.headers.Authorization, "Bearer gsk_test_key");
    assert.equal(calls[0].body.model, "llama-3.3-70b-versatile");
    assert.deepEqual(calls[0].body.response_format, { type: "json_object" });
    assert.equal(calls[0].body.messages[0].role, "system");

    assert.equal(result.status, "ok");
    assert.equal(result.provider, "groq");
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].line, 2);
  });

  it("retries once with the system prompt kept first when the output is invalid", async () => {
    stubFetch(["not json", validOutput]);
    const result = await reviewCode({ language: "cpp", code: "int main(){\nreturn 0;\n}" });

    assert.equal(calls.length, 2);
    const retryMessages = calls[1].body.messages;
    assert.deepEqual(
      retryMessages.map((m) => m.role),
      ["system", "user", "assistant", "user"]
    );
    assert.equal(retryMessages[2].content, "not json");
    assert.equal(result.status, "ok");
  });

  it("honours AI_MODEL", async () => {
    process.env.AI_MODEL = "openai/gpt-oss-120b";
    stubFetch([validOutput]);
    await reviewCode({ language: "cpp", code: "a\nb\nc" });
    assert.equal(calls[0].body.model, "openai/gpt-oss-120b");
  });
});
