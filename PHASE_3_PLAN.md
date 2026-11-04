# DevCollab Phase 3 Plan: Access Control, Version History, Undo, Run Input, Hardening

> **Audience:** an AI coding agent (Antigravity) working inside the `DevCollab` repository.
> **Prerequisite:** Phase 1 and Phase 2 are complete and committed. Phase 2 is described in `PROJECT_STATUS.md` and in the Phase 2 System Design and Implementation Guide.
> **Goal of Phase 3:** make DevCollab safe to share with people you do not fully trust (roles and invites), give rooms a memory (snapshots and diffs), fix the editing rough edges (undo, run input), and harden the project (rate limits, helmet, tests, CI).

---

## 0. How to work (rules for the agent)

1. **Read before writing.** Start by reading `PROJECT_STATUS.md`, `backend/sockets/*`, `backend/controllers/*`, `frontend/src/collab/*`, `frontend/src/screens/Room.jsx` and `frontend/src/index.css`. Confirm the repository matches section 1. If a file differs from this plan's assumptions, make the smallest change that satisfies the acceptance criteria, and record the deviation in `PROJECT_STATUS.md` under "Phase 3 deviations".
2. **Work one stage at a time**, in the order of section 4. Finish a stage completely (code, tests, acceptance checks) before starting the next. After each stage: run all tests, run `npm run build` in `frontend`, commit with the message given for that stage, then stop and report what changed, what was verified and anything left open.
3. **Do not rewrite working code.** Phase 1 and Phase 2 behaviour must keep working. Refactor only where a task says so.
4. **Follow the existing conventions:**
   - Backend: ES modules, Express 5, `asyncHandler` plus `ApiError` (no try/catch in controllers), Zod 4 schemas in `validators/` applied with `validate(schema)`, pino logging through `utils/logger.js`, `authUser` sets `req.user.id`.
   - Frontend: React 19, Tailwind 4 with the semantic tokens (`bg-canvas`, `bg-surface`, `text-muted`, `border-line`, and so on), the shared `PageContainer`, and the component kit in `components/ui`. Never add raw hex colors or doubled `dark:` classes outside the language badge colors.
   - Tests: backend uses Node's built-in test runner; frontend uses Vitest with Testing Library.
5. **Do not add `y-monaco` or the `monaco-editor` package.** The project has its own `MonacoBinding`. Do not add a component library.
6. **Every new endpoint needs:** authentication, a role check (section 3.1), Zod validation, a rate limit where listed, a test for the happy path, a test for each failure status, and an entry in the API table of `PROJECT_STATUS.md`.
7. **Permission checks happen on the server.** The frontend hides or disables things for clarity only. Never rely on it for security.
8. **Report honestly.** If something could not be tested (for example real Monaco behaviour in a browser), say so and list the manual check a human must do.

---

## 1. Starting state (verify, do not assume)

### 1.1 What Phase 2 left in place

| Area | Facts to preserve |
|---|---|
| Live editing | One Yjs document per room, in `backend/sockets/docStore.js` (`DocStore`: `acquire`, `release`, `peek`, `flush`, `flushAll`, `onSaved`). The document is the source of truth while a room has users. |
| Persistence | `Room.yState` (Buffer, `select: false`) holds the Yjs state. `Room.code` is a plain-text copy written on every save. Saves happen 2 s after the last edit (10 s max while typing), when the last user leaves, and on shutdown. |
| Socket server | `backend/sockets/createSocketServer.js` with dependency injection (`store`, `verifyToken`, `getUser`, `getRoomForMember`). Events: `room:join` (ack carries `{ ok, state, awareness, room }`), `room:leave`, `yjs:update`, `awareness:update`, `awareness:remove`, `room:saved`, `room:error`, `comment:created`, `comment:updated`, `comment:deleted`. Socket.IO rooms are named by `roomKey(roomId)`. |
| Client | `frontend/src/collab/CollabClient.js` (one person in one room), `monacoBinding.js` (our own editor binding), `anchors.js` (comment anchors as Yjs relative positions), hooks `useCollab`, `useComments`, `useCommentLines`, `useIsDark`. |
| Comments | `Comment` model, REST under `/rooms/:roomId/comments`, one level of replies, anchors follow the text. |
| UI | Tokens in `index.css`, `PageContainer`, `MarketingLayout`, `AppLayout`, `AuthLayout`, the component kit, the room workspace (toolbar, editor, console drawer, comments panel). |
| Auth | Access token (15 min) in memory, refresh token (7 days) in an HTTP-only cookie, `GET /users/refresh`. Socket handshake sends the token and the client refreshes on an `AUTH` error. |
| Runner | `POST /run` calls the Wandbox API. |

### 1.2 Known gaps that Phase 3 closes

1. **Anyone with a room link becomes a member.** `PUT /rooms/join/:roomId` adds any logged-in user. There are no roles.
2. **A removed member stays connected** until they reconnect, because sockets only check membership at join time.
3. **No version history.** `Room.code` is overwritten on every save.
4. **Undo and redo are unreliable** with collaborators, because Monaco's local history does not know about remote edits.
5. **The runner has no standard input** (`stdin`).
6. **No rate limits, no helmet, no tests for the project's own routes, no CI.**
7. The refresh cookie uses `sameSite: strict`, which breaks when frontend and backend are on different domains.

### 1.3 Non-goals (Phase 4 and later)

OAuth login, AI code review, Redis or multiple server processes, deployment, comment editing, email notifications, mobile layout polish beyond what exists, billing.

---

## 2. Decisions already made (do not ask, implement as written)

| Topic | Decision |
|---|---|
| Roles | `owner`, `editor`, `viewer`. The owner is always `Room.createdBy` and cannot be changed, removed or demoted. |
| Where roles are stored | Keep `Room.users` as the membership list (existing queries keep working). Add `Room.roles`, a Map of `userId` to `"editor"` or `"viewer"`. A member with no entry in `roles` is an `editor`. This makes every Phase 2 room valid with **no data migration**. |
| Viewers | Can read the code, see presence and cursors, read and write comments, view snapshots, and press Run. They cannot type into the document, save or restore versions, edit test cases, or manage people. |
| Joining a room | **Only by invite link** from now on. The open-join route is removed. |
| Invite links | Random 32-byte token, only its SHA-256 hash is stored, shown to the owner **once**. Default life 7 days, maximum 30 days. Optional use limit. Can be revoked. |
| Room size | At most 25 members per room. |
| Snapshots | At most 50 per room, code up to 200,000 characters, name up to 80 characters. The server reads the text from the live document, never from the client. Restoring first saves a backup snapshot of the current code. |
| Undo and redo | Yjs `UndoManager` that tracks only the local user's own edits. |
| Run input | `stdin` up to 10,000 characters. Test cases: up to 10 per room, each input up to 2,000 characters, shared by the room. |
| Rate limits | See section 3.4. |
| Tests | Backend: `node:test` with `supertest` and `mongodb-memory-server`. Frontend: Vitest and Testing Library. |

---

## 3. Shared specifications

### 3.1 Permission matrix

Create `backend/utils/roles.js` as the single source of truth, and mirror it in `frontend/src/lib/permissions.js` (same action names, same matrix, with a comment saying to keep them in sync). Both get a test that asserts the whole matrix.

| Action | owner | editor | viewer |
|---|:---:|:---:|:---:|
| `room.read` (open the room, see presence) | yes | yes | yes |
| `doc.edit` (send `yjs:update`) | yes | yes | no |
| `comment.write` (create, reply, resolve, reopen) | yes | yes | yes |
| `comment.delete` | own and any | own | own |
| `run` | yes | yes | yes |
| `snapshot.read` | yes | yes | yes |
| `snapshot.create`, `snapshot.restore` | yes | yes | no |
| `snapshot.delete` | any | own | no |
| `tests.read` | yes | yes | yes |
| `tests.write` | yes | yes | no |
| `members.read` | yes | yes | yes |
| `members.manage`, `invites.manage` | yes | no | no |
| `room.delete` | yes | no | no |

API: `roles.js` exports `ROLES`, `ACTIONS`, `getRole(room, userId)` (returns `"owner"`, `"editor"`, `"viewer"` or `null`) and `can(role, action)`.

### 3.2 Room access middleware

Create `backend/middleware/roomAccess.middleware.js` exporting `roomAccess(action)`. It validates `req.params.roomId` as an ObjectId, loads the room, computes the role, answers **404** when the user is not a member (so room existence is not leaked), **403** when the role cannot do the action, and otherwise sets `req.room` and `req.role`. Replace the duplicated `requireMember` helper in `comment.controller.js` with it.

### 3.3 Data models

**Room (changed)**
```js
roles: { type: Map, of: { type: String, enum: ["editor", "viewer"] }, default: {} },
testCases: [{ name: String, input: String, expected: String }],   // Stage 4
```

**Invite (new)** `backend/models/invite.model.js`
```js
{
  room: ObjectId ref Room (index),
  tokenHash: String (unique, index),     // SHA-256 of the token, never the token itself
  role: "editor" | "viewer",
  createdBy: ObjectId ref User,
  expiresAt: Date (TTL index, expireAfterSeconds: 0),
  maxUses: Number | null,
  uses: Number (default 0),
  revokedAt: Date | null,
  timestamps
}
```

**Snapshot (new)** `backend/models/snapshot.model.js`
```js
{ room: ObjectId (index), name: String, code: String, kind: "manual" | "pre-restore",
  createdBy: ObjectId ref User, timestamps }   // compound index { room: 1, createdAt: -1 }
```

### 3.4 Limits and rate limits

Put constants in `backend/config/limits.js`. Create `backend/middleware/rateLimit.middleware.js` with a small factory around `express-rate-limit` (check the installed major version's documentation for the correct IP key helper). A limited request answers **429** through the normal error handler with a clear message and a `Retry-After` header.

| Route | Limit | Key |
|---|---|---|
| `POST /users/login`, `POST /users/register` | 10 per 15 minutes | IP |
| `POST /run` | 30 per minute | user id |
| `POST /rooms/:roomId/comments` | 30 per minute | user id |
| `POST /invites/:token/accept`, `GET /invites/:token` | 20 per hour | IP |
| `POST /rooms/:roomId/invites` | 20 per hour | user id |
| `POST /rooms/:roomId/snapshots` and `/restore` | 20 per hour | user id |

### 3.5 Socket changes

| Event | Direction | Change |
|---|---|---|
| `room:join` ack | server to client | Now includes `role` inside `room`. |
| `yjs:update` | client to server | **Rejected for viewers** with `room:error { error: "READ_ONLY" }`, and not relayed. |
| `room:role` `{ roomId, role }` | server to client | New. Sent when a member's role changes while connected. |
| `room:removed` `{ roomId }` | server to client | New. Sent when a member is removed. The server also makes that user's sockets leave the room. |
| `room:members` `{ roomId }` | server to client | New hint to refetch the people list. |
| `room:restored` `{ roomId, snapshotId, name, by }` | server to client | New. Sent after a restore. Clients clear their undo history. |
| `snapshots:changed`, `tests:updated` `{ roomId }` | server to client | New hints to refetch. |
| `yjs:update` (server-originated) | server to client | New: changes made by the server itself (restore) must be broadcast to everyone in the room. |

Implementation notes:

- `getRoomForMember(roomId, userId)` returns `{ id, title, language, role }`. Store the role in `socket.data.roles[roomId]` at join.
- Add `io.syncRoomMembership(roomId)` (defined inside `createSocketServer`). It fetches the current room, and for every socket in the room either removes it (no longer a member) or updates its role and emits `room:role`. REST controllers call it through `req.app.get("io")` after any membership or role change.
- Add `DocStore.onServerUpdate` and `DocStore.replaceText(roomId, text)`. `replaceText` runs one Yjs transaction (delete all, insert new) with origin `"server"`. The `createSocketServer` code listens and emits `yjs:update` to `roomKey(roomId)` for updates whose origin is `"server"`.
- Add `DocStore.getText(roomId)`: the live text if the room is loaded, otherwise `Room.code` from the database.

---

## 4. Stages

Each stage lists **Tasks**, **Acceptance criteria** and **Tests**. A stage is done only when every acceptance criterion is demonstrably met.

### Stage 0: Foundations and security baseline (size S)

**Tasks**

1. Create a branch `phase-3`.
2. `backend/config/env.js`: validate environment variables with Zod at startup (`PORT`, `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `NODE_ENV`). Exit with a clear message when something is missing or too short (secrets at least 32 characters). Use it from `server.js` and wherever `process.env` is read.
3. Cookie settings from the environment: `sameSite` is `lax` in development and `none` with `secure: true` in production, in one helper used by login, register, refresh and logout.
4. Install `helmet` and add `app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }))` before the routes.
5. Install `express-rate-limit`. Create the rate-limit factory from section 3.4 and apply the **login and register** limits now. The other limits are applied in the stage that creates the route.
6. Create `backend/config/limits.js` with the constants from section 2.
7. Create `backend/utils/roles.js` (section 3.1) and `backend/middleware/roomAccess.middleware.js` (section 3.2). Refactor `comment.controller.js` to use it. Behaviour must not change.
8. Frontend: add `ToastProvider` and `useToast` (`components/ui/Toast.jsx`, bottom right, auto-dismiss after 4 s, `role="status"`), `ConfirmDialog.jsx` (built on `Modal`), and `ErrorBoundary.jsx` wrapping the routes with a friendly fallback and a reload button. Mount `ToastProvider` in `main.jsx`.
9. Frontend: `lib/permissions.js` mirroring the matrix. Move `defineThemes` out of `Room.jsx` into `lib/monacoThemes.js` (it will be reused by the diff view).
10. Test infrastructure: add `supertest` and `mongodb-memory-server` to the backend dev dependencies, a `test` script, and a shared helper that starts an in-memory MongoDB and the Express app, registers users, and returns access tokens. Add Vitest and Testing Library to the frontend with a `test` script. If `mongodb-memory-server` cannot run in the environment, support `MONGO_URI_TEST` pointing at a throwaway database instead.

**Acceptance criteria**

- The server refuses to start with a clear message when `JWT_ACCESS_SECRET` is missing.
- An 11th login attempt within 15 minutes from one IP returns 429 with a `Retry-After` header.
- Responses carry helmet's security headers.
- All Phase 2 behaviour is unchanged (comments still work for members, 404 for non-members).
- `npm test` passes in both packages. `npm run build` passes in `frontend`.

**Tests:** env validation (valid, missing, too short), rate-limit 429, the permission matrix (backend and frontend assert the same table), comment routes still behave after the middleware refactor, `useToast` and `ConfirmDialog`.

**Commit:** `chore: env validation, helmet, rate limits, permissions, test infrastructure`

---

## 5. Manual QA script (a human runs this at the end)

Use three browsers or profiles: **Owner**, **Editor**, **Viewer** (three different accounts).

1. Owner creates a room and an editor invite. Editor opens the link, logs in if asked, accepts, and lands in the room.
2. Owner creates a viewer invite. Viewer joins. Viewer cannot type. Viewer can comment and press Run.
3. All three open a room and see each other's avatars. Owner and Editor type together. All three see the same text and each other's cursors.
4. Owner changes Viewer to Editor. Viewer can now type without a reload. Owner changes back.
5. Owner removes Viewer. Viewer's page switches to the removed message.
6. A fourth account that is not a member opens the room URL. It sees no access.
7. Editor saves a version, edits, compares it with Current, and restores it. Everyone's editor changes. Restore the backup. Undo does nothing after a restore.
8. Two people type, one presses undo. Only that person's last change disappears.
9. Run a program with input. Add three test cases and run all.
10. Press login with a wrong password eleven times. The eleventh is blocked with a clear message.
11. Stop the backend with Ctrl+C, start it, reopen the room. Nothing typed is missing.
12. Dark and light themes, and a narrow window, on the dashboard and room page.

---

## 6. Risks and how to handle them

| Risk | Mitigation |
|---|---|
| Frontend and backend permission tables drift apart | Both have a test asserting the full matrix. The server is the authority. |
| Restore races with typing | `replaceText` is one Yjs transaction. Concurrent typing merges. A backup snapshot is always taken first. |
| Undo shortcuts do not override Monaco in some browsers | Manual check in Stage 3. Fall back to registering the keybindings with `editor.addAction` using high precedence. Record the result. |
| Invite token leaks | Only the hash is stored, links expire, can be revoked and limited, accept is rate limited, preview answers one generic 404. |
| Rate limits behind a proxy count the proxy's address | Set `app.set("trust proxy", 1)` only when deployed behind one proxy (Phase 4), and document it. |
| `mongodb-memory-server` cannot download a binary | Support `MONGO_URI_TEST` for a throwaway database. |
| Large documents make snapshots heavy | Hard limits in section 2, and the list endpoint never returns code. |
| A removed user's open tab keeps a stale document | `room:removed` makes the client clear its document and show the removed state. |

---

## 7. Definition of done for Phase 3

- All five feature stages meet their acceptance criteria and the manual QA script passes.
- All backend and frontend tests pass, CI is green, and the production build passes.
- No open-join path remains, and every route is covered by a role check on the server.
- `PROJECT_STATUS.md`, `README.md` and `docs/PERMISSIONS.md` describe the final state.
- Phase 4 backlog is written in `PROJECT_STATUS.md`: deployment, Redis and multiple servers, OAuth, AI review, comment editing, notifications.

