/**
 * Scans code for sensitive credentials (API keys, private keys, tokens,
 * and .env-style secret assignments) and replaces them with a safe placeholder
 * before passing the code to external AI providers.
 */

const PATTERNS = [
  // 1. PEM-encoded private keys
  {
    regex: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9_-]*PRIVATE KEY-----/gi,
    placeholder: "[REDACTED_PRIVATE_KEY]",
  },
  // 2. AWS Access Key IDs
  {
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    placeholder: "[REDACTED_AWS_KEY]",
  },
  // 3. GitHub Personal Access & OAuth Tokens
  {
    regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,
    placeholder: "[REDACTED_GITHUB_TOKEN]",
  },
  // 4. Slack & Stripe API Keys
  {
    regex: /\b(?:xox[baprs]-[0-9a-zA-Z-]{10,}|(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{20,})\b/g,
    placeholder: "[REDACTED_API_KEY]",
  },
  // 5. Code variable assignments: key = "...", secret: "...", token: "..."
  {
    regex: /((?:api[_-]?key|secret|password|passwd|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["'])([^"'\r\n\t]{6,})(["'])/gi,
    replaceFn: (_, prefix, secret, suffix) => `${prefix}[REDACTED_SECRET]${suffix}`,
  },
  // 6. .env-style uppercase declarations: JWT_SECRET="...", DB_PASSWORD=...
  {
    regex: /^([ \t]*[A-Z0-9_]*(?:SECRET|KEY|PASSWORD|TOKEN|AUTH|CREDENTIALS)\s*=\s*["']?)([^"'\r\n\s]{6,})(["']?)/gm,
    replaceFn: (_, prefix, secret, suffix) => `${prefix}[REDACTED_SECRET]${suffix}`,
  },
];

/**
 * Redacts obvious secrets from code string.
 * @param {string} code - The input source code
 * @returns {{ code: string, redactedCount: number }}
 */
export function redactSecrets(code) {
  if (!code || typeof code !== "string") {
    return { code: "", redactedCount: 0 };
  }

  let redacted = code;
  let count = 0;

  for (const { regex, placeholder, replaceFn } of PATTERNS) {
    if (replaceFn) {
      redacted = redacted.replace(regex, (...args) => {
        count++;
        return replaceFn(...args);
      });
    } else {
      redacted = redacted.replace(regex, () => {
        count++;
        return placeholder;
      });
    }
  }

  return { code: redacted, redactedCount: count };
}
