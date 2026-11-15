# DevCollab

A high-performance, real-time collaborative code editor and review platform built with **React 19**, **Monaco Editor**, **Express 5**, **Socket.IO v4**, **Yjs CRDTs**, **MongoDB Atlas**, and **Redis**.

DevCollab enables developers to write, review, and execute code together in real time with conflict-free synchronization, AI-powered line inspections, threaded comments with @mentions, and horizontal multi-instance scale-out.

---

## 🚀 Key Features

* **Real-Time Multiplayer Collaboration:** Conflict-free document editing powered by Yjs CRDTs and Socket.IO with sub-10ms synchronization, remote peer presence cursors, and local undo/redo isolation.
* **Optional Multi-Instance Scale-Out:** `@socket.io/redis-adapter` plus an append-only MongoDB update log. Edits converge across server instances, with 30-second resync polling, a Redis compaction lease, and cluster-wide enforcement of role changes. A single instance without Redis is the recommended starting point.
* **Granular Role-Based Access Control (RBAC):** Formal `owner`, `editor`, and `viewer` roles with 19 distinct permissions enforced across HTTP routes and real-time WebSocket channels. Viewers can inspect code, see live cursors, run code, and test cases, but cannot alter documents or settings.
* **AI Code Review:** AI code inspections via **Anthropic Claude** (default model `claude-opus-5-5`) or **OpenAI**. Generates line-anchored recommendations categorized by severity (`error`, `warning`, `info`) with Monaco gutter glyphs and one-click conversion to persistent comment threads.
* **Comments v2 & Live Notifications:** In-place comment editing with `(edited)` indicators, interactive `@mention` autocomplete picker for room members, real-time notification bell with unread badges, and optional periodic email digests with one-click unsubscribe links.
* **Version Snapshot History & Diff View:** Save named versions with a 50-snapshot cap, compare past versions against live code side-by-side or inline via a Monaco `DiffEditor` overlay, and restore past versions with automatic pre-restore backup checkpoints.
* **OAuth 2.0 & Secure Authentication:** Google and GitHub single-sign-on using state tokens and PKCE, token-based password reset, email verification, and account linking/unlinking guards.
* **Multi-Language Runner with Stdin & Shared Tests:** Run C++, Python, JavaScript, and Java with stdin support (persisted locally per room), shared 10-test-case suites with sequential "Run all", expected vs. actual mismatch diffing, and 15s execution timeouts.
* **Production Observability & Security:** Token-protected Prometheus metrics at `/metrics`, Sentry error monitoring with source-code redaction, health probes (`/healthz`, `/readyz`), rotating server-side refresh sessions, Helmet and CSP headers, proxy-aware rate limiting, and Docker multi-stage container builds.

---

## 🖥️ User Interface Overview

* **Workspace Header:** Displays the workspace title, active collaborator presence avatars with color-coded cursors, real-time notification bell with unread badge counter, user role pill (`Owner`, `Editor`, or `Viewer`), and quick actions for Version Snapshots, AI Review, Console, and Room Sharing.
* **Monaco Collaborative Editor:** Full-featured code editor with syntax highlighting, live multi-cursor presence with collaborator name tags, visual gutter glyphs for AI review findings, line-anchored comment callouts, and local-only undo/redo stacks (`Ctrl/Cmd+Z`).
* **Comments Panel:** Tabbed right sidebar displaying threaded discussions anchored to specific lines. Features in-place comment editing, interactive `@member` autocomplete picker, resolve/reopen controls, and real-time live reply updates.
* **Version History & Diff Viewer:** Side panel listing past snapshots with author avatars and timestamps. Clicking "Compare" launches a non-destructive Monaco DiffEditor overlay comparing the snapshot directly against the live collaborative document.
* **AI Code Review Panel:** Trigger full or focus-specific reviews. Findings appear categorized by severity (`error`, `warning`, `info`) with line indicators and an "Add as Comment" action that creates an anchored discussion thread.
* **Bottom Console Drawer:** Resizable multi-tab drawer providing standard output (`stdout`), standard input (`stdin`), and a shared 10-case test runner with pass/fail badges and detailed expected vs. actual mismatch diffing.
* **Notification Center:** Interactive dropdown listing mentions, replies, and role updates with unread filters, mark-all-as-read controls, and deep links that open the workspace and scroll directly to the discussion thread.
* **Account Settings:** User profile screen showing linked authentication methods (Email, Google, GitHub) with one-click linking/unlinking and notification preferences.

---

## 🛠️ Architecture & Documentation

- 📄 **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** — Architecture reference, endpoint catalog, socket events, release checklist, and implementation history.
- 🚀 **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** — Step-by-step production deployment guide for free-tier cloud hosting (Render + Vercel + MongoDB Atlas + Upstash Redis).
- 🛡️ **[docs/SECURITY.md](./docs/SECURITY.md)** — Security model: sessions, RBAC, CORS, CSP, rate limits, validation, OAuth rules, and known limitations.
- ⚡ **[docs/PERFORMANCE.md](./docs/PERFORMANCE.md)** — Measured load test benchmarks, event latencies, and resource utilization across single and multi-instance modes.
- 🔐 **[docs/PERMISSIONS.md](./docs/PERMISSIONS.md)** — Comprehensive RBAC permission matrix for owners, editors, and viewers.

---

## 💻 Quick Start

### Prerequisites
- Node.js 20+ (Node.js 22 recommended)
- MongoDB instance (local or MongoDB Atlas M0 free cluster)
- *(Optional)* Redis server (for multi-instance clustering)

### 1. Environment Configuration

Copy the example files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Key environment variables:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/devcollab
JWT_ACCESS_SECRET=your-secure-jwt-access-secret-at-least-32-chars-long
CLIENT_URL=http://localhost:5173
```

In production also set `TRUST_PROXY=1` (behind Render's proxy), `MAIL_TRANSPORT=smtp` with `SMTP_URL` (otherwise verification and reset emails are only logged), `API_URL` (for OAuth) and `COOKIE_SECRET`. The full list is in [PROJECT_STATUS.md §5](./PROJECT_STATUS.md#5-environment-variables-reference).

### 2. Run Locally

**Backend:**
```bash
cd backend
npm install
npm run dev
```
*Backend runs on `http://localhost:5000` with `/healthz`, `/readyz`, and `/metrics`.*

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 🐳 Docker & Scale-Out Deployment

### Single-Instance Mode (Docker Compose)
To run DevCollab with MongoDB and a single backend process:
```bash
docker compose up --build
```

### Multi-Instance Scale-Out Mode (Docker Compose)
To run DevCollab with MongoDB, Redis, two backend replicas, and real-time cross-instance pub/sub synchronization:
```bash
docker compose --profile scale-out up --build
```
- **Backend Replica 1:** `http://localhost:5000`
- **Backend Replica 2:** `http://localhost:5001`
- **Redis Server:** `localhost:6379`
- **Frontend App:** `http://localhost`

---

## 🧪 Testing & Verification

### Backend Test Suite (18 files, 133 tests)
```bash
npm --prefix backend test
```

### Frontend Test Suite (12 files, 57 tests) and Lint
```bash
npm --prefix frontend test
npm --prefix frontend run lint
```

### Production Build
```bash
npm --prefix frontend run build
```

### End-to-End Smoke Test
```bash
API_URL="http://localhost:5000" node scripts/smoke.mjs
```

### Multi-Room Load Test Benchmark
```bash
npm --prefix backend run loadtest
```

### Environment Consistency Check
```bash
node scripts/check-env-example.js
```
