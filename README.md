# DevCollab

A modern, minimalist collaborative code review and live compilation platform built with React 19, Tailwind CSS v4, Monaco Editor, Express 5, Socket.IO, Yjs CRDTs, MongoDB, and the Wandbox Compiler API.

---

## 🚀 Key Features

* **Real-Time Multiplayer Collaboration:** Conflict-free collaborative editing powered by Yjs CRDTs and Socket.IO with sub-second synchronization and remote peer presence cursors.
* **Granular Role-Based Access Control (RBAC):** `owner`, `editor`, and `viewer` roles with full permission enforcement on HTTP endpoints and WebSocket events. Viewers can inspect code, see live cursors, run code, and test cases, but cannot modify documents or settings.
* **Token-Based Invite Links:** Ephemeral and multi-use invite links (`/invite/:token`) with customizable expiration and roles, manageable via the workspace Share modal.
* **Version Snapshot History & Diff View:** Save named versions with a 50-snapshot cap, compare versions against current code side-by-side or inline via a Monaco DiffEditor overlay, and restore with automatic pre-restore backup checkpoints.
* **Collaborative Undo & Redo:** Isolated `Y.UndoManager` scopes keyboard shortcuts (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`) and toolbar buttons strictly to local changes without undoing collaborators' typing.
* **Multi-Language Runner with Stdin & Shared Tests:** Run C++, Python, JavaScript, and Java with stdin support (persisted locally per room), shared 10-test-case suites with sequential "Run all", expected vs. actual mismatch diffing, and 15s execution timeouts.
* **Production Security & Hardening:** Strict Zod environment validation, Helmet security headers, user-keyed rate limits (10 auth/15min, 30 runs/min, 20 snapshots/hr, 30 invites/hr), and max 10 concurrent sockets per user.

---

## 📖 Architecture & Documentation

- 📄 **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** — Comprehensive architecture, endpoint reference, socket events, release checklist, and implementation log.
- 🛡️ **[docs/PERMISSIONS.md](./docs/PERMISSIONS.md)** — Complete RBAC permission matrix and real-time socket enforcement details.

---

## 🛠️ Environment Variables

Copy `.env.example` to `backend/.env`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/devcollab
JWT_ACCESS_SECRET=your-secure-jwt-access-secret-at-least-32-chars-long
JWT_REFRESH_SECRET=your-secure-jwt-refresh-secret-at-least-32-chars-long
CLIENT_URL=http://localhost:5173
```

---

## 💻 Quick Start

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
```
Backend starts on `http://localhost:5000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend starts on `http://localhost:5173`.

---

## 🧪 Running Tests

### Backend Tests (Node test runner)
```bash
cd backend
npm test
```
Runs 8 test suites covering environment validation, auth routes, room access, role matrix, invites, comments, snapshots, and runner/tests.

### Frontend Tests (Vitest + React Testing Library)
```bash
cd frontend
npm test
```
Runs 9 test suites with 27 unit and integration tests covering permissions, auth flow, collaborative undo, console drawer & tests, snapshots & diff view, share dialog, home filters, landing navigation, and screen rendering.

### Production Build
```bash
cd frontend
npm run build
```
Generates optimized production bundle in `frontend/dist/`.
