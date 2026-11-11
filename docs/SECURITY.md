# DevCollab — Security Review & Threat Model Audit

> **Review Date:** November 7, 2026  
> **Status:** Passed across all 14 security criteria  
> **Target Environment:** Free-tier multi-subdomain cloud deployment (Render + Vercel + MongoDB Atlas + Upstash Redis)

---

## 1. Authentication & Authorization

### Session & Token Architecture
* **Access Tokens:** Signed with HMAC-SHA256 (`JWT_ACCESS_SECRET`), 15-minute lifespan. Transmitted via `Authorization: Bearer <token>` in HTTP headers and `socket.handshake.auth.token` in WebSockets. Never stored in `localStorage` or `sessionStorage`.
* **Refresh Tokens:** Cryptographically random (64 hex characters), 7-day lifespan. Stored as SHA-256 hashes in MongoDB (`User.refreshTokens.tokenHash`). Delivered exclusively via `HttpOnly`, `SameSite=None` (or `Lax`), `Secure` cookies scoped to path `/api/v1/users`.
* **Token Rotation & Invalidation:** Every refresh generates a new refresh token and deletes the old one. Logging out revokes the specific token from the database. Password resets revoke all active refresh tokens for the user.

### Role-Based Access Control (RBAC)
* **HTTP Route Enforcement:**
  * Workspace routes (`/rooms/:id/*`, `/comments/*`, `/snapshots/*`, `/ai/*`, `/tests/*`) pass through `protect` and `roomAccess` middleware.
  * Roles (`owner`, `editor`, `viewer`) are validated strictly per operation (see [`docs/PERMISSIONS.md`](file:///c:/All%20Projects/DevCollab/docs/PERMISSIONS.md)).
  * Non-members receive `404 Not Found` (preventing workspace existence enumeration).
* **Socket.IO Event Enforcement:**
  * Sockets authenticate in the connection handshake via `verifyToken`.
  * `room:join` verifies membership in MongoDB before admitting the socket.
  * Sockets with role `viewer` sending `yjs:update` are blocked and receive `{ error: "READ_ONLY" }`.
  * Sockets are limited to a maximum of 10 concurrent connections per user.

---

## 2. Token Handling & Cookie Attributes

| Attribute | Value | Security Justification |
|---|---|---|
| `HttpOnly` | `true` | Prevents JavaScript and XSS extraction of refresh tokens. |
| `Secure` | `true` in production | Transmitted strictly over encrypted TLS connections (Render and Vercel HTTPS). |
| `SameSite` | `none` (cross-site) or `lax` (same-origin) | Configurable via `COOKIE_SAMESITE`. `none` is strictly required for cross-domain free subdomains (`*.vercel.app` calling `*.onrender.com`). |
| `Path` | `/api/v1/users` | Minimizes cookie transmission surface to auth-related endpoints only. |
| URL Tokens | None | Tokens are never placed in URL query parameters, preventing leakage through browser history, referer headers, and proxy logs. |

---

## 3. Cross-Origin Resource Sharing (CORS)

* **Origin Whitelisting:** Express CORS middleware dynamically inspects incoming `Origin` headers against `CLIENT_URLS` (comma-separated list, e.g. `https://devcollab.vercel.app`).
* **Trailing Slash Normalization:** Both incoming origins and allowed origins are trimmed and stripped of trailing slashes before comparison.
* **Credentials:** `credentials: true` is strictly enforced to allow cookie-based refresh and authentication handshakes. Untrusted origins receive `403 CORS origin denied`.

---

## 4. Content Security Policy (CSP) & Security Headers

Configured via `helmet`:
* `default-src 'self'`: Restricts resource loading to origin by default.
* `script-src 'self'`: Script execution restricted to own origin; Monaco editor workers loaded via dedicated blob/web worker protocols.
* `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`: Permits Monaco's dynamic syntax token coloring and Inter/JetBrains Mono web fonts.
* `font-src 'self' https://fonts.gstatic.com`: Loads Google Fonts securely.
* `connect-src 'self' https://* wss://*`: Permits API calls, Sentry error telemetry, and WebSocket transports.
* `worker-src 'self' blob:`: Required for Monaco Editor background syntax validation web workers.
* Additional Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

---

## 5. Rate Limiting & Abuse Prevention

| Endpoint / Operation | Rate Limit | Storage Backend | Action on Violation |
|---|---|---|---|
| Global API (`/api/v1/*`) | 100 req / 15 min | Redis / In-Memory | `429 Too Many Requests` |
| Login (`/users/login`) | 5 req / min | Redis / In-Memory | `429 Too Many Requests` |
| Registration (`/users/register`) | 3 req / hour | Redis / In-Memory | `429 Too Many Requests` |
| Password Reset Request | 3 req / hour | Redis / In-Memory | `429 Too Many Requests` |
| Code Execution (`/run`) | 10 req / min | Redis / In-Memory | `429 Too Many Requests` |
| AI Code Review (`/ai/review`) | 10 req / hour (user)<br>5 req / day (room) | Redis / In-Memory | `429 Too Many Requests` |
| Socket Inbound Events | 120 events / sec | Socket.IO local window | `{ error: "RATE_LIMIT" }` |

When `REDIS_URL` is configured, rate limit counters are shared across all backend replicas using `rate-limit-redis`.

---

## 6. Input Validation & Defense-in-Depth

* **Zod Schemas:** Every incoming JSON request body is validated against strict Zod schemas before reaching business logic (e.g. `registerSchema`, `loginSchema`, `commentSchema`, `createRoomSchema`).
* **ID Format Validation:** MongoDB ObjectIds are strictly regex-validated (`/^[a-f\d]{24}$/i`). Invalid IDs reject with `400 Bad Request` or `404 Not Found` without reaching Mongoose casting errors.
* **Socket Payload Limits:** Maximum allowed size for a single Yjs collaborative update is **512 KB** (`MAX_UPDATE_BYTES = 524288`). Oversized payloads are immediately rejected.
* **Code Size Limits:** Code submitted for execution or AI review is bounded to **20,000 characters**.

---

## 7. Output Encoding & Injection Protections

* **Comments & Mentions:** User comments are stored and returned as plain text. The frontend React component renders comments through safe text nodes and highlighted mention pills with zero raw `dangerouslySetInnerHTML`.
* **AI Code Review Prompt Injection Defense:**
  * User code is treated strictly as data, wrapped in unambiguous delimiters (`--- BEGIN CODE ---` and `--- END CODE ---`).
  * System instructions explicitly instruct Gemini to output structured JSON findings and never execute tool calls or interpret code as instructions.
  * Secret scanning regex (`AI_SECRET_PATTERNS`) automatically scrubs API keys (e.g. `AIza...`, `ghp_...`, `sk-...`, AWS keys) before code is transmitted to external AI providers.

---

## 8. Secrets Handling & Infrastructure Hardening

* **No Hardcoded Secrets:** Zero API keys, database credentials, or signing secrets exist in the git repository.
* **Docker Security:** `.dockerignore` excludes all `.env*` files, git metadata, and local development logs. Docker images run under non-root users where supported.
* **CI Secrets:** GitHub Actions CI builds consume secrets strictly through GitHub Repository Secrets.
* **Logging Redaction:** Pino HTTP logger (`backend/utils/logger.js`) automatically redacts sensitive headers and payload fields:
  * `req.headers.authorization`
  * `req.headers.cookie`
  * `password`
  * `newPassword`
  * `token`

---

## 9. Dependency Vulnerability Audit (`npm audit`)

### Backend Audit Status
* **Production Dependencies:** **0 vulnerabilities** (`npm audit` clean on production dependencies).
* **Development Dependencies:** 1 moderate advisory in `minimatch` (via `nodemon` dev dependency for glob matching). Non-exploitable in production runtime as dev dependencies are excluded from production container builds.

### Frontend Audit Status
* **Production Dependencies:**
  * `monaco-editor@0.57.0` bundles internal `dompurify` for editor tooltip markdown formatting. DevCollab disables HTML rendering in Monaco hover providers (`allowHtml: false`), mitigating DOM XSS risks.
* **Development Dependencies:** 1 moderate advisory in `minimatch` (via `eslint` dev dependency). Excluded from production static build output.

---

## 10. OAuth State, PKCE & Account Takeover Prevention

* **Arctic Library Integration:** OAuth 2.0 flows for Google and GitHub utilize cryptographic state tokens and PKCE code verifiers stored in temporary `HttpOnly` cookies.
* **Unverified Account Takeover Protection:** When an OAuth login returns an email that matches an existing local account, DevCollab **never** links automatically unless the existing account's email is already verified. Unverified accounts reject with an explicit verification requirement to prevent pre-hijacking attacks.

---

## 11. Password Reset & Verification Security

* **Cryptographic Entropy:** Reset tokens are generated using Node.js `crypto.randomBytes(32).toString("hex")`.
* **Storage Hashing:** The database stores only the SHA-256 hash of the reset token, preventing compromised database dumps from being used to reset passwords.
* **Time Expiration:** Reset tokens expire after **1 hour**; email verification tokens expire after **24 hours**.
* **Single-Use Invalidation:** Upon successful password reset, the reset token fields are cleared, the user's password is encrypted with `bcrypt` (12 salt rounds), and all active refresh tokens are revoked.

---

## 12. Account Enumeration Protection

* **Timing-Safe Responses:**
  * `POST /users/login`: Returns generic `401 Unauthorized` ("Invalid email or password") for both non-existent users and incorrect passwords.
  * `POST /users/forgot-password`: Always returns `200 OK` ("If an account with that email exists, a reset link has been sent") regardless of whether the email is registered.

---

## 13. Summary Compliance Table

| Security Check | Implementation | Status |
|---|---|:---:|
| Authentication on all endpoints & sockets | JWT Access (15m) + Cookie Refresh (7d) | Passed |
| RBAC on all routes & actions | Owner / Editor / Viewer matrix enforced | Passed |
| Token security | In-memory access, HttpOnly refresh | Passed |
| Cross-site cookie compatibility | `SameSite=None; Secure=true` | Passed |
| Dynamic CORS origin whitelist | Matches `CLIENT_URLS` without trailing slashes | Passed |
| Helmet Content Security Policy | Strict source policies, Monaco worker support | Passed |
| Tiered Rate Limiting | Route-specific + socket 120/s burst limiter | Passed |
| Input validation | Zod schemas + ObjectId regex validation | Passed |
| Output encoding | Plaintext React rendering, no raw HTML | Passed |
| AI Prompt Injection & Data Privacy | Code as data, automated secret scrubbing | Passed |
| Docker & CI secrets isolation | `.dockerignore`, zero committed secrets | Passed |
| OAuth PKCE & Account Takeover Defense | Arctic PKCE, verified-only linking | Passed |
| Password reset single-use & hashing | SHA-256 token hash, bcrypt-12 passwords | Passed |
| Sensitive log redaction | Pino header & payload redaction rules | Passed |

