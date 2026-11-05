import { z } from "zod";

export const findingCategoryEnum = z.enum([
  "bug",
  "security",
  "performance",
  "readability",
  "style",
]);

export const findingSeverityEnum = z.enum(["info", "warning", "error"]);

export const aiFindingSchema = z.object({
  line: z.number().int().min(1),
  endLine: z.number().int().min(1).optional(),
  severity: findingSeverityEnum,
  category: findingCategoryEnum,
  message: z.string().min(1).max(500),
  suggestion: z.string().max(800).optional().default(""),
});

export const aiReviewResponseSchema = z.object({
  summary: z.string().max(600).default("Review completed."),
  findings: z.array(aiFindingSchema).default([]),
});

/**
 * Strips HTML tags from string to ensure plain-text display.
 */
function sanitizePlainText(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "");
}

/**
 * Extracts and parses JSON from raw LLM output, handling markdown code fences if any.
 * @param {string} raw
 * @returns {any}
 */
export function extractJsonFromText(raw) {
  if (typeof raw !== "string") {
    throw new Error("Empty or non-string model response");
  }

  let text = raw.trim();

  // Strip markdown code fences if the model enclosed its response in ``` or ```json
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // Find the outermost balanced JSON object
  const startIdx = text.indexOf("{");
  const endIdx = text.lastIndexOf("}");

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("No JSON object found in response");
  }

  const jsonSubstring = text.slice(startIdx, endIdx + 1);
  return JSON.parse(jsonSubstring);
}

/**
 * Validates, filters, and sanitizes LLM code review output.
 * @param {string|object} raw - Raw output string or parsed object
 * @param {number} totalLines - Document line count
 * @returns {{ valid: boolean, data?: object, error?: string }}
 */
export function validateAndSanitizeOutput(raw, totalLines = Infinity) {
  let parsed;
  try {
    parsed = typeof raw === "string" ? extractJsonFromText(raw) : raw;
  } catch (err) {
    return { valid: false, error: `Invalid JSON: ${err.message}` };
  }

  const result = aiReviewResponseSchema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    return { valid: false, error: `Schema validation failed: ${errorDetails}` };
  }

  const data = result.data;

  // Filter findings: line must be within document lines (line <= totalLines)
  const validFindings = data.findings
    .filter((f) => f.line <= totalLines)
    .slice(0, 20)
    .map((f) => ({
      line: f.line,
      endLine: f.endLine && f.endLine >= f.line && f.endLine <= totalLines ? f.endLine : f.line,
      severity: f.severity,
      category: f.category,
      message: sanitizePlainText(f.message),
      suggestion: sanitizePlainText(f.suggestion || ""),
    }));

  return {
    valid: true,
    data: {
      summary: sanitizePlainText(data.summary),
      findings: validFindings,
    },
  };
}
