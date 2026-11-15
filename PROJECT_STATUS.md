# DevCollab — Project Status & Phase 4 Technical Handover

> **Project:** DevCollab
> **Status:** Phase 4 feature-complete, plus the production-readiness fixes from the November 15, 2026 review (see §8).
> **Tests:** backend 18 files / 133 tests passing; frontend 12 files / 57 tests passing; frontend lint 0 errors; production build green.
> **Repository branch:** `phase-4`

---

## 1. Executive Summary

DevCollab combines real-time multiplayer code editing (Yjs CRDTs + Monaco Editor + Socket.IO) with optional horizontal scale-out (Redis adapter + MongoDB update log), AI code review with line-anchored findings, threaded comments with @mentions and live notifications, Google/GitHub OAuth with PKCE, password reset and email verification, Prometheus metrics, Sentry error tracking, Docker images, and free-tier deployment guides (Render + Vercel + MongoDB Atlas + optional Upstash Redis).

**Recommended production topology today:** one backend instance without Redis. Multi-instance mode is functional and tested, but has had less real-world use.

---

## 2. Phase 4 Stages

### Stage 0: Production Readiness & Observability
- `@sentry/node` and `@sentry/react` with a `beforeSend` hook that strips source code from events.
- `prom-client` metrics at `/metrics` (disabled unless `METRICS_TOKEN` is set; then requires `Authorization: Bearer <token>`).
- `/healthz` (liveness) and `/readyz` (MongoDB connected and, if configured, Redis `PING`).
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop accepting connections, notify sockets, flush Yjs buffers, close Socket.IO, MongoDB and Redis, 10-second hard deadline.
- `TRUST_PROXY` configures Express `trust proxy` (hop count, `true`/`false`, or a preset such as `loopback`).
- Zod validation of environment variables in `backend/config/env.js` (blank values are treated as unset).

### Stage 1: Deployment
- Multi-stage `backend/Dockerfile` running as non-root `node`, with a health check.
- `docker-compose.yml` with single-instance and `--profile scale-out` (two backends + Redis) topologies.
- `docs/DEPLOYMENT.md` and `docs/BEGINNER_DEPLOYMENT_GUIDE.md`; `render.yaml` blueprint.
- `scripts/smoke.mjs` end-to-end smoke test and `backend/scripts/ensure-indexes.js`.

### Stage 2: Accounts, OAuth, Email & Password Reset
- Google and GitHub OAuth via `arctic` (state + PKCE in a signed cookie). Settings screen: `frontend/src/screens/Settings.jsx`.
- Server-side refresh sessions with rotation and reuse detection (`backend/utils/sessions.js`).
- Password reset (1-hour single-use token) and email verification (24-hour token); both stored as SHA-256 hashes.
- Mailer: `backend/services/mailer.js` (Nodemailer SMTP when `MAIL_TRANSPORT=smtp` + `SMTP_URL`, otherwise log-only).

### Stage 3: AI Code Review
- `backend/services/ai/` with Anthropic (`claude-opus-5-5` by default) and OpenAI (`gpt-4o-mini` by default) providers, selected by `AI_PROVIDER` + `AI_API_KEY` (+ optional `AI_MODEL`, `AI_EFFORT`).
- When no provider is configured, the review endpoint answers `503 AI review is not configured`; the UI shows the feature as unavailable. (A mock provider exists only for tests.)
- Secret redaction before sending code, schema-validated JSON output with one corrective retry, findings anchored to Yjs positions so they move with edits.
- Limits: 5 reviews/hour per user, 20/day per room, `AI_DAILY_REQUEST_LIMIT` per server per day (default 100), 20,000 characters of code.

### Stage 4: Comments v2 & Notifications
- Author-only comment editing with `(edited)` marker, @mention picker, live updates over Socket.IO.
- Notification bell with unread count, pagination and deep links (`?thread=<commentId>`).
- Email digests: a background scheduler (started in `server.js`, guarded by a MongoDB lease so only one instance sends) emails unread notifications to users who opted in; one-click unsubscribe page at `/unsubscribe-digest`.

### Stage 5: Scale-out with Redis & Update Log Persistence
- `MongoPersistence` (`backend/sockets/persistence.js`): edits are buffered and written to the `yupdates` collection every 500 ms as merged updates; failed writes are re-queued and retried.
- Compaction folds the log into `Room.yState` and deletes exactly the entries it folded in; an optimistic `Room.stateVersion` check prevents two compactions from overwriting each other. Correctness never depends on ObjectId ordering across machines.
- With `REDIS_URL`: `@socket.io/redis-adapter` for broadcasts, a `devcollab:replica:updates` channel for live document updates, a Redis compaction lease, Redis-backed HTTP rate limits, and cluster-wide membership sync/room close via `serverSideEmit`.
- Every loaded document re-reads the log every 30 seconds (with a 2-minute overlap window) as a safety net for dropped pub/sub messages.

### Stage 6: Load Test, Security Review, Accessibility & Documentation
- `loadtest/run-loadtest.mjs`; results in `docs/PERFORMANCE.md` (measured before the November 15 fixes).
- Security model in `docs/SECURITY.md`; RBAC matrix in `docs/PERMISSIONS.md`.
- ARIA attributes, focus handling and Escape handling on dialogs and widgets.

---

## 3. API Endpoints Reference

All paths are relative to the backend origin (no `/api` prefix).

### Accounts (`/users`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/users/register` | Public | Register; sets refresh cookie, returns access token |
| `POST` | `/users/login` | Public | Sign in; sets refresh cookie, returns access token |
| `GET`/`POST` | `/users/refresh` | Refresh cookie | Rotate the refresh session and return a new access token |
| `POST` | `/users/logout` | Refresh cookie | Revoke the current session and clear the cookie |
| `POST` | `/users/logout-all` | Authenticated | Revoke every session of the user |
| `GET` | `/users/me` (alias `/users/profile`) | Authenticated | Current user, linked providers, email preferences |
| `PATCH` | `/users/me` | Authenticated | Update `name` and/or `emailPrefs.digest` |
| `PATCH` | `/users/me/password` | Authenticated | Set or change password (revokes other sessions) |
| `DELETE` | `/users/me/providers/:provider` | Authenticated | Unlink Google/GitHub (refused for the last sign-in method) |
| `POST` | `/users/verify-email/request` | Authenticated | Send a new verification email |
| `POST` | `/users/verify-email` | Public (token) | Confirm email with `{ token }` |
| `POST` | `/users/forgot-password` | Public | Request a reset email (always `202`) |
| `POST` | `/users/reset-password` | Public (token) | Reset password with `{ token, password }` |
| `GET`/`POST` | `/users/unsubscribe-digest` | Public (token) | Turn off email digests |

### OAuth (`/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/auth/:provider` (`google`, `github`) | Start sign-in; `?link=1` links to the signed-in account, `?next=/path` sets the return page |
| `GET` | `/auth/:provider/callback` | Provider callback; redirects to `${CLIENT_URL}/auth/callback` |

### Workspaces (`/rooms`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/rooms/create` | Authenticated | Create room |
| `GET` | `/rooms/all` | Authenticated | Rooms the user belongs to |
| `GET` | `/rooms/:roomId` | `room.read` | Room metadata, code and caller's role |
| `PUT` | `/rooms/:roomId/code` | `doc.edit` | Save code (legacy; live edits go through Yjs) |
| `DELETE` | `/rooms/:roomId` | `room.delete` | Delete room and all its data; disconnects live sockets |

### Invites & Membership
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/rooms/:roomId/invites` | `invites.manage` | Create invite link (`role`, `expiresInHours`, `maxUses`) |
| `GET` | `/rooms/:roomId/invites` | `invites.manage` | List active invites |
| `DELETE` | `/rooms/:roomId/invites/:inviteId` | `invites.manage` | Revoke invite |
| `GET` | `/invites/:token` | Authenticated | Preview invite |
| `POST` | `/invites/:token/accept` | Authenticated | Join room (max 25 members) |
| `GET` | `/rooms/:roomId/members` | `members.read` | Members and roles |
| `PATCH` | `/rooms/:roomId/members/:userId` | `members.manage` | Set role `editor`/`viewer` |
| `DELETE` | `/rooms/:roomId/members/:userId` | Owner, or the member themself | Remove member / leave room |

### Snapshots (`/rooms/:roomId/snapshots`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/rooms/:roomId/snapshots` | `snapshot.read` | List (max 50 per room) |
| `POST` | `/rooms/:roomId/snapshots` | `snapshot.create` | Save named snapshot |
| `GET` | `/rooms/:roomId/snapshots/:snapshotId` | `snapshot.read` | Snapshot with code |
| `POST` | `/rooms/:roomId/snapshots/:snapshotId/restore` | `snapshot.restore` | Back up current code, then restore |
| `DELETE` | `/rooms/:roomId/snapshots/:snapshotId` | `snapshot.delete` (owner: any; editor: own) | Delete snapshot |

### Comments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/rooms/:roomId/comments` or `/comments/:roomId` | `room.read` | List comments with replies and mentions |
| `POST` | `/rooms/:roomId/comments` or `/comments/:roomId` | `comment.write` | Add comment (`line`, `content`/`text`, `mentions`) |
| `PATCH` | `/comments/:commentId` or `/rooms/:roomId/comments/:commentId` | Author | Edit comment |
| `POST` | `/comments/:commentId/reply` | `comment.write` | Reply |
| `PATCH` | `/comments/:commentId/resolve` | `comment.write` | Resolve |
| `PATCH` | `/comments/:commentId/unresolve` | `comment.write` | Reopen |
| `DELETE` | `/comments/:commentId` | Owner: any; others: own | Delete thread |

### Notifications (`/notifications`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/notifications` | List (`limit`, `before`, `unread` query parameters) |
| `GET` | `/notifications/unread-count` | Unread count |
| `POST` | `/notifications/read` | Mark read: `{ ids: [...] }` or `{ all: true }` |

### AI Code Review
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/rooms/:roomId/ai-review` | `ai.review` | Request a review (`focus`: all, bugs, security, performance, style) |
| `GET` | `/rooms/:roomId/ai-reviews` | `ai.read` | Past reviews and findings |
| `GET` | `/rooms/:roomId/ai-reviews/status` | `ai.read` | Whether a provider is configured |
| `DELETE` | `/rooms/:roomId/ai-reviews/:id` | Owner or the requester | Delete a review |

### Test Cases & Runner
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/rooms/:roomId/tests` | `tests.read` | Shared test cases (max 10) |
| `PUT` | `/rooms/:roomId/tests` | `tests.write` | Replace test cases |
| `POST` | `/run` | Authenticated | Run C++, Python, JavaScript or Java via Wandbox (15 s timeout) |

### Monitoring
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Liveness, always 200 |
| `GET` | `/readyz` | 200 when MongoDB (and Redis, if configured) are reachable, else 503 |
| `GET` | `/metrics` | Prometheus; 404 unless `METRICS_TOKEN` is set, then bearer-token protected |

---

## 4. Socket Events Reference

Clients join the per-room channel `room:<roomId>` via `room:join` and are always in their private `user:<userId>` channel.

| Event | Direction | Payload | Description |
|---|---|---|---|
| `room:join` | Client → Server (ack) | `{ roomId }` | Join; ack carries Yjs state, peer awareness, room and role |
| `room:leave` | Client → Server | `{ roomId }` | Leave room |
| `yjs:update` | Both | `{ roomId, update, sentAt? }` | Document update (viewers get `room:error` `READ_ONLY`) |
| `awareness:update` | Both | `{ roomId, clientId, update, sentAt? }` | Cursor/selection presence |
| `awareness:remove` | Server → Client | `{ roomId, clientId }` | Peer left |
| `room:error` | Server → Client | `{ roomId?, error }` | `READ_ONLY`, `BAD_UPDATE`, `RATE_LIMIT` |
| `room:role` | Server → Client | `{ roomId, role }` | Caller's role changed |
| `room:removed` | Server → Client | `{ roomId }` | Caller removed, or room deleted |
| `room:members` | Server → Client | `{ roomId }` | Membership changed; refetch members |
| `room:restored` | Server → Client | `{ roomId, name, by }` | Snapshot restored; clears undo history |
| `room:saved` | Server → Client | `{ roomId, at }` | Debounced "saved" indicator |
| `snapshots:changed` | Server → Client | `{ roomId }` | Refetch snapshots |
| `tests:updated` | Server → Client | `{ roomId }` | Refetch test cases |
| `comment:new` / `comment:updated` / `comment:reply` | Server → Client | `{ comment }` | Live comment changes |
| `comment:resolved` | Server → Client | `{ commentId, resolved }` | Resolve state changed |
| `comment:deleted` | Server → Client | `{ commentId }` | Comment deleted |
| `ai:changed` | Server → Client | `{ reviewId }` or `{ deletedId }` | Refetch AI reviews |
| `notification:new` | Server → Client (`user:<id>`) | `{ notification }` | New notification |
| `server:shutdown` | Server → Client | `{ reason }` | Instance is shutting down |

---

## 5. Environment Variables Reference

### Backend
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | | `5000` | HTTP port |
| `NODE_ENV` | | `development` | `development`, `production` or `test` |
| `MONGO_URI` | **Yes** | — | MongoDB connection string |
| `JWT_ACCESS_SECRET` | **Yes** | — | Access-token signing key (≥ 32 chars) |
| `JWT_REFRESH_SECRET` | | — | Legacy, unused; validated (≥ 32 chars) only if set |
| `COOKIE_SECRET` | Recommended | `JWT_ACCESS_SECRET` | Signs the OAuth state cookie |
| `CLIENT_URL` | Production | `http://localhost:5173` | Frontend URL (email links, OAuth redirects, invite links) |
| `CLIENT_URLS` | | `CLIENT_URL` | Comma-separated allowed CORS origins |
| `API_URL` | With OAuth | `http://localhost:5000` | Public backend URL; OAuth redirect URIs are built from it |
| `COOKIE_SAMESITE` | | `none` in production, `lax` otherwise | Refresh cookie `SameSite` |
| `COOKIE_DOMAIN` | | — | Refresh cookie domain (custom-domain setups) |
| `TRUST_PROXY` | Production | — | Proxy hops to trust; `1` on Render. Required for correct rate limiting |
| `APP_VERSION` | | `1.0.0` | Release tag for logs/Sentry |
| `LOG_LEVEL` | | `info` (prod) / `debug` | Pino log level |
| `MAIL_TRANSPORT` | Production | `console` | `smtp` to actually send email |
| `SMTP_URL` | With smtp | — | e.g. `smtps://user:pass@smtp.example.com:465` |
| `MAIL_FROM` | | `DevCollab <noreply@devcollab.io>` | Sender address |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | | — | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | | — | GitHub OAuth |
| `AI_PROVIDER` | | — | `anthropic` or `openai`; unset disables AI review |
| `AI_API_KEY` | With AI | — | Provider API key |
| `AI_MODEL` | | `claude-opus-5-5` / `gpt-4o-mini` | Model override |
| `AI_EFFORT` | | `high` | Anthropic effort: `low`, `medium`, `high`, `xhigh`, `max` |
| `AI_DAILY_REQUEST_LIMIT` | | `100` | AI reviews per server per day |
| `SENTRY_DSN` | | — | Backend error reporting |
| `METRICS_TOKEN` | | — | Enables `/metrics` behind a bearer token |
| `REDIS_URL` | | — | Enables multi-instance mode |

### Frontend (build time)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | — | Backend URL |
| `VITE_SENTRY_DSN` | — | Frontend error reporting |
| `VITE_MONACO_BASE` | `/monaco` in production builds, CDN in dev | Where Monaco is loaded from (must be same-origin under the production CSP) |

---

## 6. Tests & Checks

### Backend (Node test runner) — `npm --prefix backend test`
18 files, 133 tests:

| File | Covers |
|---|---|
| `env.test.js` | Environment validation |
| `roles.test.js` | Permission matrix |
| `authAndRooms.test.js` | Register, login, logout, room CRUD |
| `sessions.test.js` | Refresh rotation, grace window, reuse detection, logout revocation |
| `rateLimit.test.js` | Login limit, spoofed `X-Forwarded-For` |
| `invitesAndMembers.test.js` | Invites, roles, leaving |
| `comments.test.js` | Comments and replies |
| `commentBroadcast.test.js` | Every comment event goes to the `room:<id>` channel; resolve routes reachable |
| `snapshots.test.js` | Snapshots, cap, restore backups |
| `runAndTests.test.js` | Runner and shared test cases |
| `roomDelete.test.js` | Room deletion cleanup and socket close |
| `persistence.test.js` | Out-of-order ObjectIds, write retry, concurrent compaction, eviction |
| `stage0.test.js` | Health and readiness probes, runner circuit breaker, CORS origin list, trust proxy |
| `stage1.test.js` | Cookie attributes, Sentry scrubbing, metrics token |
| `stage2.test.js` | OAuth rules, password reset, verification, sessions |
| `stage3.test.js` | AI review service and endpoints |
| `stage4.test.js` | Comment editing, mentions, notifications, digests |
| `stage5.test.js` | Update log, compaction, multi-instance sync incl. cross-instance demotion |

### Frontend (Vitest) — `npm --prefix frontend test`
12 files, 57 tests: `permissions`, `authNext`, `stage2Auth`, `collabUndo`, `consoleAndTests`, `snapshotsAndDiff`, `ShareDialog`, `HomeFilters`, `landingAndNav`, `screensRender`, `stage4Comments`, `aiReview`.

### Other checks
```bash
npm --prefix frontend run lint            # 0 errors (warnings: see eslint.config.js)
npm --prefix frontend run build
node scripts/check-env-example.js
API_URL="http://localhost:5000" node scripts/smoke.mjs
npm --prefix backend run loadtest
```
CI (`.github/workflows/ci.yml`) runs the env check, `npm ci`, backend tests, frontend lint, frontend tests, `npm audit --omit=dev --audit-level=high`, and the frontend build.

---

## 7. Design Notes

1. **Free subdomains, no custom domain.** Frontend on `*.vercel.app`, backend on `*.onrender.com`; the refresh cookie therefore uses `SameSite=None; Secure`.
2. **Redis is optional.** Without `REDIS_URL` everything runs in one process with durable MongoDB persistence.
3. **Pluggable AI.** Anthropic or OpenAI behind one prompt/validation pipeline.

---

## 8. Production-Readiness Fixes (November 15, 2026)

| Area | Fix |
|---|---|
| Live comments | Comment and AI-review events were sent to the wrong socket channel; now `room:<id>` |
| Comment resolve | `PATCH /comments/:id/resolve` and `/unresolve` were shadowed by another route; reordered |
| Rate limiting | Keys use `req.ip` (trusted proxy) instead of the client-controlled `X-Forwarded-For`; Redis store chosen lazily so limits are shared across instances; run/snapshot limits keyed per user as intended |
| Sessions | Opaque, hashed, rotating refresh sessions with reuse detection; logout revokes server-side |
| Email | Startup warning when production would only log emails; HTML-escaped names; digest scheduler now actually starts; unsubscribe page added |
| AI | Default Anthropic model updated from the retired `claude-3-5-sonnet-20241022` to `claude-opus-5-5`; response parsing handles thinking blocks, refusals and truncation |
| Multi-instance | Role changes/removals enforced on every instance; room deletion closes sockets everywhere |
| Persistence | Order-independent load/compaction, optimistic compaction guard, failed writes retried, resync overlap window |
| Room deletion | Also deletes update log, AI reviews and notifications |
| Robustness | Body-less requests no longer 500; blank env values no longer crash boot; invite uses not consumed when room is full; login timing equalized |
| Frontend | No inline scripts (CSP `script-src 'self'`), Google Fonts allowed by CSP, Monaco self-hosted by default in production, Room/Settings code-split (initial JS 670 KB → 477 KB), ESLint 266 errors → 0 |
| Dependencies | `mongoose` upgraded; `dompurify` pinned to 3.4.18; production audit clean |

---

## 9. Release Checklist

- [x] Backend tests green (`npm --prefix backend test`, 133/133).
- [x] Frontend tests green (`npm --prefix frontend test`, 57/57).
- [x] Frontend lint 0 errors; production build green.
- [x] `npm audit --omit=dev` clean for backend and frontend.
- [x] Environment variables documented (`node scripts/check-env-example.js`).
- [ ] Load test re-run after the November 15 persistence changes (`docs/PERFORMANCE.md` predates them).
- [ ] Production env set: `TRUST_PROXY=1`, `MAIL_TRANSPORT=smtp` + `SMTP_URL`, `API_URL`, `COOKIE_SECRET`.
- [ ] Smoke test against the deployed backend.

---

## 10. Phase 5 Backlog

1. Organizations & teams.
2. Self-hosted, sandboxed code runner replacing Wandbox.
3. Comment reactions & pinning.
4. Offline-first editing (IndexedDB).
5. Public read-only links.
6. Audit logs & analytics.
