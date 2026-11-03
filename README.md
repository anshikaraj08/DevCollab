# DevCollab

A modern, minimalist collaborative code review and live compilation platform built with React 19, Tailwind CSS v4, Monaco Editor, Express 5, MongoDB, and the Wandbox Compiler API.

---

## 📖 Phase 1 Documentation & Handover

For complete architecture details, API endpoint reference, database schemas, and the Phase 2 development roadmap, please see:

👉 **[PROJECT_STATUS.md](./PROJECT_STATUS.md)**

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd backend
npm install
# Ensure .env is configured with PORT, MONGO_URI, JWT secrets, and CLIENT_URL
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ✨ Features Implemented (Phase 1)
* **Secure Authentication:** JWT access tokens in memory + refresh tokens in HTTP-only cookies.
* **Workspace Management:** Create, search, filter, and join code rooms.
* **Multi-Language Execution:** Instant compilation for C++, Python, JavaScript, and Java powered by Wandbox API.
* **Monaco Code Editor:** Clean neutral dark and light themes, syntax highlighting, and auto-indent.
* **Output Console:** Real-time stdout, stderr, and exit code display.
* **Tailwind CSS v4 Design:** Neutral grey/black palette without green tints, with signature language color accents.

