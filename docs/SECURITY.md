# DevCollab — Security Model

> **Last reviewed:** November 15, 2026, against the code on branch `phase-4`.
> **Target environment:** Render (backend) + Vercel (frontend) + MongoDB Atlas, optionally Upstash Redis.
>
> This document describes what the code does today. Where a control has a known limit, the limit is stated next to it.

---

## 1. Authentication & Sessions

### Access tokens
* JWT signed with HMAC-SHA256 (`JWT_ACCESS_SECRET`), **15-minute** lifetime, payload `{ id, email }`.
* Sent as `Authorization: Bearer <token>` on HTTP requests and as `socket.handshake.auth.token` on Socket.IO.
* Kept in memory in the browser only (`frontend/src/config/axios.js`), never in `localStorage` / `sessionStorage`.
* **Limit:** access tokens are stateless. After logout, password change or "log out everywhere", an already-issued access token keeps working until it expires (at most 15 minutes).

### Refresh tokens (server-side sessions)
Implemented in `backend/utils/sessions.js` and `backend/models/session.model.js`.
* The refresh token is an **opaque random value** (32 bytes, hex). The database stores only its **SHA-256 hash**, one `Session` document per signed-in device, with a 7-day expiry (MongoDB TTL index).
* **Rotation:** every call to `/users/refresh` marks the presented session as replaced and issues a new token. Two refreshes with the same token within **30 seconds** (two tabs, or the HTTP client and the socket client racing) both succeed; only the first rotates.
* **Reuse detection:** presenting an already-replaced token after that grace window is treated as theft and **revokes every session of that user**.
* **Logout** deletes the current session. **Log out everywhere**, **password reset**, **password change** and **provider unlink** delete all sessions (password change and unlink then start a fresh session on the current device).
* `JWT_REFRESH_SECRET` is no longer used. It is still accepted (and must be ≥ 32 characters if set) so older deployments keep booting.

### Refresh cookie attributes
| Attribute | Value |
|---|---|
| `HttpOnly` | `true` |
| `Secure` | `true` when `NODE_ENV=production` |
| `SameSite` | `COOKIE_SAMESITE` if set; otherwise `none` in production (required for `*.vercel.app` → `*.onrender.com`), `lax` in development |
| `Path` | `/` |
| `Domain` | `COOKIE_DOMAIN` if set (production only) |

Tokens are never placed in URLs. OAuth redirects back to the frontend carry only `next` / `error` query parameters; the frontend then calls `/users/refresh` to obtain an access token.

---

## 2. Authorization (RBAC)

* Roles: `owner`, `editor`, `viewer` — matrix in [`PERMISSIONS.md`](./PERMISSIONS.md), single source in `backend/utils/roles.js` (mirrored in `frontend/src/lib/permissions.js`).
* HTTP: room-scoped routes use `authUser` + `roomAccess(action)` middleware. Comment routes addressed by comment id (`/comments/:commentId/...`) resolve the room from the comment and check the role in the controller.
* Non-members get **404 Room not found** for room-scoped routes, so room existence is not revealed.
* Sockets: the handshake verifies the access token; `room:join` re-checks membership in MongoDB; viewers sending `yjs:update` receive `{ error: "READ_ONLY" }`.
* **Live role changes:** when an owner changes a role or removes a member, `io.syncRoomMembership(roomId)` re-checks every connected socket in the room. With Redis configured, the request is fanned out to every instance (`serverSideEmit`) and each instance updates its *own* sockets, so a demoted or removed user loses write access on every server immediately.
* **Room deletion** disconnects all live sockets in the room on every instance, unloads the in-memory document, and deletes the room's invites, comments, snapshots, update log, AI reviews and notifications.

---

## 3. CORS

* Express and Socket.IO both check the `Origin` header against `CLIENT_URLS` (comma-separated; falls back to `CLIENT_URL`). Trailing slashes are ignored on both sides.
* `credentials: true` so the refresh cookie is sent.
* Requests **without** an `Origin` header (curl, server-to-server) are allowed; they cannot carry a victim's cookies from a browser context.
* A disallowed origin gets `403 CORS origin denied`.

---

## 4. Security Headers & Content Security Policy

**Backend API** — `helmet` defaults (including its default CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, HSTS) with `Cross-Origin-Resource-Policy: cross-origin` so the Vercel frontend can read responses.

**Frontend** — set by `frontend/vercel.json` (production) and `frontend/nginx.conf` (Docker):

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | |
| `script-src` | `'self'` | No inline scripts. The theme bootstrap lives in `public/theme-init.js`; Monaco is self-hosted under `/monaco` (production builds default to it). |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Monaco and Tailwind inject inline styles; Google Fonts stylesheet |
| `font-src` | `'self' data: https://fonts.gstatic.com` | Google Fonts files |
| `worker-src` | `'self' blob:` | Monaco web workers |
| `connect-src` | `'self' https: wss:` (Vercel) / adds `http: ws:` (local Docker) | API and WebSocket on a different origin chosen at deploy time |
| `img-src` | `'self' data: https:` | OAuth avatars |
| `frame-ancestors` | `'none'` | Clickjacking |

Also: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

---

## 5. Rate Limiting

Values are from `backend/config/limits.js` and `backend/middleware/rateLimit.middleware.js`.

| Operation | Limit | Keyed by |
|---|---|---|
| `POST /users/register` + `POST /users/login` | 10 / 15 min, one shared counter for both | client IP |
| `POST /users/forgot-password` | 5 / hour | client IP + email |
| `POST /users/reset-password` | 10 / hour | client IP |
| `POST /users/verify-email/request` | 5 / hour | user |
| `GET /auth/:provider`, `/auth/:provider/callback` | 30 / 15 min | client IP |
| `POST /run` | 30 / min | user |
| Snapshot create / restore | 20 / hour | user |
| Invite create | 20 / hour | user |
| Invite preview / accept | 20 / hour | client IP |
| Comment edit | 30 / min | user |
| `/notifications/*` | 120 / min | user |
| AI review | 5 / hour per user, 20 / day per room, plus `AI_DAILY_REQUEST_LIMIT` (default 100) per server per day | user / room |
| Socket events (`yjs:update`, `awareness:update`) | 120 / second per socket | socket |
| Concurrent sockets | 10 per user **per instance** | user |

* **Client IP** is `req.ip`, which Express derives using the `trust proxy` setting. Set `TRUST_PROXY=1` on Render (one proxy hop). The client-controlled part of `X-Forwarded-For` is ignored, so rotating that header does not create new buckets. IPv6 addresses are grouped by /56.
* If `TRUST_PROXY` is unset in production, every client appears to come from the proxy's IP and shares one bucket; the server logs a warning at startup.
* With `REDIS_URL` set, all HTTP rate-limit counters live in Redis and are shared across instances. Without Redis they are per process. The per-user socket cap is always per instance.
* There is **no global API rate limit** across all routes.

---

## 6. Input Validation

* Zod schemas validate request bodies for register, login, room create, code save, run, snapshots and test cases (`backend/validators/`). Other handlers validate fields explicitly in the controller.
* `req.body` defaults to `{}` when no JSON body is sent, so body-less requests get a 4xx, not a 500.
* Room ids are checked against `/^[a-f\d]{24}$/i` before querying; invalid ids get 404.
* Size limits: single Yjs update ≤ 512 KB; awareness update ≤ 4 KB; Socket.IO message ≤ 1 MB; code for `/run` ≤ 200,000 characters, stdin ≤ 10,000; code sent to AI review ≤ 20,000 characters; snapshot code ≤ 200,000 characters.
* Passwords for register / reset / change: 6–128 characters with upper, lower, digit and symbol. Hashed with **bcrypt, cost 10**.

---

## 7. Output Encoding & Injection

* Comments are stored and returned as plain text and rendered by React as text nodes (no `dangerouslySetInnerHTML`).
* Email bodies (verification, reset, password-changed, digest) HTML-escape every user-controlled value (names, room titles) via `backend/utils/escapeHtml.js`.
* AI review: code is redacted for common secret formats before it leaves the server (`backend/utils/secretRedactor.js`), wrapped in explicit delimiters, and the model output is parsed and validated against a schema before it is stored or shown.

---

## 8. OAuth (Google, GitHub)

* State and PKCE verifier are stored in a signed, `HttpOnly`, 10-minute cookie and compared in constant time on callback (library: `arctic`).
* Only provider identities with a **verified email** are accepted.
* Account matching rules (`backend/controllers/oauth.controller.js`):
  1. Provider identity already linked → sign in to that account.
  2. No account with that email → create a verified, password-less account.
  3. Account with that email exists and **is verified** → link the provider and sign in.
  4. Account with that email exists but **is not verified** → the OAuth user proves ownership of the email, so the existing password is **removed**, all sessions of that account are revoked, the email is marked verified, and the provider is linked. This defeats "pre-hijacking", where an attacker registers someone else's email with a password before the real owner signs in with Google/GitHub.
  5. Link requests while signed in: refused if the provider identity already belongs to another user.
* A user cannot unlink their last remaining sign-in method.

---

## 9. Account Enumeration

* `POST /users/login` returns the same `401 Invalid email or password` for unknown emails, OAuth-only accounts and wrong passwords, and runs a bcrypt comparison in every case so response time does not reveal which.
* `POST /users/forgot-password` always returns `202` with the same message.
* **Limit:** `POST /users/register` returns `409 Email already registered` for an existing email. This is a deliberate usability trade-off; registration is rate limited per IP.

---

## 10. Password Reset & Email Verification

* Tokens: `crypto.randomBytes(32)` (hex). Only the SHA-256 hash is stored (`AuthToken` collection, TTL index).
* Reset tokens expire after **1 hour**, verification tokens after **24 hours**; both are single-use and previous reset tokens are invalidated when a new one is requested.
* A successful reset revokes every session of the account and sends a "password changed" notice.
* **Email delivery requires** `MAIL_TRANSPORT=smtp` and `SMTP_URL`. Otherwise emails are only written to the log (and a warning is logged in production).

---

## 11. Secrets, Logging & Infrastructure

* No secrets are committed; `.env` files are git-ignored and excluded by `.dockerignore`.
* Pino redacts `authorization` / `cookie` headers, `set-cookie`, and `password`, `token`, `accessToken`, `refreshToken` and `code` fields. **Limit:** failed logins log the attempted email address.
* `/metrics` returns 404 unless `METRICS_TOKEN` is set, then requires `Authorization: Bearer <METRICS_TOKEN>`.
* The backend container runs as the non-root `node` user.

---

## 12. Dependencies

* `npm audit --omit=dev` reports **0 vulnerabilities** for both `backend` and `frontend` as of the review date.
* The frontend pins `dompurify@3.4.18` through an npm `overrides` entry because `monaco-editor@0.57.0` (latest) depends on an older, vulnerable release.
* CI runs `npm audit --omit=dev --audit-level=high` for both packages and fails the build on high or critical advisories.

---

## 13. Known Limitations

| Area | Limitation |
|---|---|
| Access tokens | Remain valid up to 15 minutes after logout or revocation |
| Refresh rotation | A refresh response lost in transit, followed by a retry with the old cookie more than 30 s later, is treated as token reuse and signs the user out everywhere |
| Registration | Reveals whether an email is registered (409) |
| Socket cap | 10 sockets per user is enforced per instance, not cluster-wide |
| Logs | Failed login attempts log the email address |
| Code execution | `/run` sends code to the public Wandbox service; do not run code containing secrets |
