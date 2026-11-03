# DevCollab — Project Status & Phase 1 Implementation Summary

> **Document Purpose:** Complete technical reference and handover document for AI agent / developer continuation into **Phase 2 development**.  
> **Status:** Phase 1 Complete • Fully Functional • Build Passing (0 errors) • Wandbox Compiler Integrated  
> **Repository:** `DevCollab`  

---

## 1. Executive Summary

**DevCollab** is a modern, minimalist collaborative code review and execution platform. It allows developers to create dedicated workspace rooms, write and inspect code in Monaco Editor with custom neutral dark/light themes, compile code live in multiple languages (C++, Python, JavaScript, Java), and share rooms with collaborators.

### Phase 1 Milestone Accomplishments:
* **Full-Stack Authentication:** Secure JWT authentication using short-lived access tokens stored in memory and refresh tokens kept in HTTP-only cookies.
* **Workspace & Room Management:** Persistent room creation, listing, searching, filtering, and joining linked to MongoDB.
* **Multi-Language Compiler Engine:** Wandbox API integration providing zero-install, server-side compilation and execution for C++, Python, JavaScript, and Java with live stdout, stderr, and exit codes.
* **Refined Design System:** Built on Tailwind CSS v4 with a neutral LeetCode/VS Code dark mode (`#181818`, `#202020`, `#282828`), persistent theme switching, signature language color glows, and clean "div inside a div" card containers.
* **4 Core Application Screens:**
  1. **Home (`/`)**: Landing page with live interactive compiler playground.
  2. **Dashboard (`/dashboard`)**: Workspace manager with search, language filters, and room cards.
  3. **Editor Room (`/room/:roomId`)**: Monaco editor, Save action, Run action, and console output drawer.
  4. **Auth (`/login`, `/register`)**: Centered minimalist authentication cards.

---

## 2. Technology Stack & Dependencies

### Frontend (`/frontend`)
* **Framework:** React 19 + Vite 8
* **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`, `@custom-variant dark`)
* **Code Editor:** `@monaco-editor/react` (v4.7.0) with custom `"devcollab"` neutral dark/light theme
* **Routing:** `react-router-dom` (v7.3.0) with protected routes via `<UserAuth />`
* **HTTP Client:** `axios` (v1.8.2) with request token interceptor and automatic 401 refresh token handling
* **Icons & UI:** Custom inline SVG icons + native Tailwind components

### Backend (`/backend`)
* **Runtime:** Node.js (ES Modules, `"type": "module"`)
* **Web Framework:** Express 5 (`express@^5.3.0`)
* **Database & ODM:** MongoDB via Mongoose (`mongoose@^9.11.2`)
* **Authentication:** JSON Web Tokens (`jsonwebtoken@^9.0.3`) + `bcryptjs@^3.0.3`
* **Cookie Management:** `cookie-parser@^1.4.7`
* **Request Validation:** Zod (`zod@^4.6.7`)
* **Logging:** Pino & Pino-HTTP (`pino@^10.4.0`, `pino-http@^11.0.0`)
* **CORS:** `cors@^2.8.6` (configured with `credentials: true`)
* **Compiler Integration:** Public Wandbox API (`https://wandbox.org/api/compile.json`)

---

## 3. Project Directory Structure

```
DevCollab/
├── PROJECT_STATUS.md            # This handover document
├── README.md                    # Quick start overview
├── backend/
│   ├── .env                     # PORT, MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CLIENT_URL
│   ├── app.js                   # Express app setup, CORS, middleware, route mounting
│   ├── server.js                # HTTP server initialization and DB connection
│   ├── package.json             # Backend dependencies & scripts
│   ├── controllers/
│   │   ├── room.controller.js   # createRoom, getAllRooms, getRoom, joinRoom, saveCode, deleteRoom
│   │   ├── run.controller.js    # Wandbox code execution controller
│   │   └── user.controller.js   # register, login, logout, refresh, getMe
│   ├── db/
│   │   └── db.js                # MongoDB connection handler
│   ├── middleware/
│   │   ├── auth.middleware.js   # JWT verification middleware (authUser)
│   │   ├── error.middleware.js  # notFound and centralized errorHandler
│   │   └── validate.middleware.js # Zod schema validation middleware
│   ├── models/
│   │   ├── room.model.js        # Room Mongoose schema (title, language, code, createdBy, users)
│   │   └── user.model.js        # User Mongoose schema (name, email, password)
│   ├── routes/
│   │   ├── room.routes.js       # /rooms routes
│   │   ├── run.routes.js        # /run routes
│   │   └── user.routes.js       # /users routes
│   ├── utils/
│   │   ├── ApiError.js          # Custom error class with HTTP status codes
│   │   ├── asyncHandler.js      # Async express handler wrapper
│   │   └── logger.js            # Pino logger instance
│   └── validators/
│       ├── room.validator.js    # Zod schemas for room creation & code saving
│       └── user.validator.js    # Zod schemas for registration & login
│
└── frontend/
    ├── index.html               # HTML entry point with dark-mode script
    ├── vite.config.js           # Vite config with Tailwind CSS v4 plugin
    ├── package.json             # Frontend dependencies & build scripts
    ├── public/
    │   └── favicon.svg          # Favicon
    └── src/
        ├── main.jsx             # React DOM entry point wrapping App in UserProvider & ThemeProvider
        ├── index.css            # Tailwind v4 import & @custom-variant dark
        ├── auth/
        │   └── UserAuth.jsx     # Route wrapper redirecting unauthenticated users to /login
        ├── components/
        │   ├── AuthLayout.jsx   # Minimal centered card container for login and register
        │   ├── Logo.jsx         # DevCollab brand logo mark
        │   ├── Navbar.jsx       # Standard top navigation bar
        │   ├── PageLoader.jsx   # Loading state spinner
        │   └── ThemeToggle.jsx  # Light / Dark mode toggle button
        ├── config/
        │   ├── axios.js         # Axios instance, baseURL, accessToken storage & refresh logic
        │   ├── getErrorMessage.js # Safe API error response extractor
        │   └── languages.js     # Supported languages, compiler badges, and color style configs
        ├── context/
        │   ├── theme.context.jsx # ThemeContext: 'light' | 'dark', toggles documentElement .dark
        │   └── user.context.jsx  # UserContext: user object, initial token refresh, auth loading
        ├── routes/
        │   └── AppRoutes.jsx    # BrowserRouter with all application routes
        └── screens/
            ├── Landing.jsx      # Home screen (/) with hero, environment cards, live runner
            ├── Home.jsx         # Workspaces dashboard (/dashboard) with room creation & room cards
            ├── Login.jsx        # Login form (/login)
            ├── Register.jsx     # Signup form (/register)
            └── Room.jsx         # Code editor room (/room/:roomId) with Monaco & Wandbox output
```

---

## 4. Implemented Features & Architecture Details

### 4.1. Authentication & Security
* **Token Architecture:**
  * **Access Token:** Short-lived JWT (15 minutes). Kept in client-side memory via closure variable in `axios.js` (`let accessToken = null`), not in `localStorage` (protects against XSS).
  * **Refresh Token:** Long-lived JWT (7 days). Stored in an `httpOnly`, `secure`, `sameSite: strict` cookie.
  * **Silent Token Refresh:**
    * On app mount, `UserContext` automatically issues `GET /users/refresh`.
    * If an authenticated API call fails with `401 Unauthorized`, Axios interceptor automatically calls `/users/refresh`, updates the in-memory access token, and retries the original request seamlessly.
* **Passwords:** Hashed with `bcryptjs` with salt rounds = 10.
* **Protected Routes:** `UserAuth.jsx` blocks unauthorized navigation to `/dashboard` and `/room/:roomId`, showing `<PageLoader />` while auth state resolves.

### 4.2. Workspaces & Rooms Management
* **Room Creation:** Any logged-in user can create a workspace room by specifying:
  * Room Title (string, 1-100 characters).
  * Programming Language (`cpp`, `javascript`, `python`, `java`).
* **Room Model Fields:**
  ```javascript
  {
    title: { type: String, required: true },
    language: { type: String, default: "javascript" },
    code: { type: String, default: "" },
    createdBy: { type: ObjectId, ref: "User", required: true },
    users: [{ type: ObjectId, ref: "User" }],
    createdAt: Date,
    updatedAt: Date
  }
  ```
* **Dashboard Functionality (`Home.jsx`):**
  * Displays user initials and name.
  * Quick create room form with language dropdown.
  * Real-time search filter filtering room cards by title or language.
  * Category tabs (`All`, `C++`, `JavaScript`, `Python`, `Java`).
  * Empty states for when a user has no rooms or search yields zero results.
  * Responsive cards with language pill badge, updated date, and language-specific hover border/glow.

### 4.3. Code Execution Engine (Wandbox API)
* Located in `backend/controllers/run.controller.js`.
* Replaced legacy/rate-limited Piston with **Wandbox API** (`POST https://wandbox.org/api/compile.json`), which requires no API keys and has zero IP whitelisting restrictions.
* **Language to Compiler Mapping:**
  * `cpp` $\rightarrow$ `gcc-head` (GCC 10+)
  * `python` $\rightarrow$ `cpython-3.12.7`
  * `javascript` $\rightarrow$ `nodejs-20.17.0`
  * `java` $\rightarrow$ `openjdk-jdk-22+36`
* **Java Class Normalization:** Wandbox expects Java code in file `prog.java`. The controller automatically replaces `public class <Name>` with `class <Name>` before submission so users can write any class name without compiler mismatch errors.
* **Standardized Response:**
  ```json
  {
    "stdout": "program standard output string",
    "stderr": "compiler error or program runtime error string",
    "code": 0
  }
  ```

### 4.4. Code Editor Section (`Room.jsx`)
* **Monaco Editor Integration:**
  * Language set dynamically based on room (`cpp`, `javascript`, `python`, `java`).
  * Custom theme `"devcollab"`: neutral dark background (`#1e1e1e`), line highlight (`#282828`), and muted line numbers (`#6e7681`).
* **Actions:**
  * **Save Button:** Issues `PUT /rooms/:roomId/code` with `{ code }`. Displays inline "Saving..." and "Saved" status indicators.
  * **Run Button:** Issues `POST /run` with `{ language, code }`. Displays loading spinner.
* **Collapsible Console Drawer:**
  * Opens automatically when code is executed.
  * Displays prompt `$ run <language>`.
  * Renders stdout in clean monospace font.
  * Renders stderr in bright red font.
  * Displays status pill: `✓ Exited with code 0` or `✕ Exited with code 1`.
  * Manual close button (`✕`).

### 4.5. Design System & Theme
* **Palette:** Pure neutral LeetCode / VS Code aesthetic:
  * Dark Mode: Canvas `bg-[#181818]`, Cards `bg-[#202020]`, Borders `border-[#2f2f2f]`, Inputs `bg-[#191919] border-[#383838]`, Text `text-[#eff2f6]`. Strictly eliminates greenish tints.
  * Light Mode: Canvas `bg-[#f8faf8]`, Cards `bg-white`, Borders `border-neutral-200`, Text `text-neutral-900`.
* **Language Signature Colors & Hover States:**
  * **C++:** Sky Blue (`#0284c7`), badge `bg-sky-50 text-sky-700` / `dark:bg-sky-950/50 dark:text-sky-300`, hover border `hover:border-sky-400`.
  * **JavaScript:** Amber Gold (`#f59e0b`), badge `bg-amber-50 text-amber-700` / `dark:bg-amber-950/50 dark:text-amber-300`, hover border `hover:border-amber-400`.
  * **Python:** Emerald Green (`#10b981`), badge `bg-emerald-50 text-emerald-700` / `dark:bg-emerald-950/50 dark:text-emerald-300`, hover border `hover:border-emerald-400`.
  * **Java:** Coral Orange (`#f97316`), badge `bg-orange-50 text-orange-700` / `dark:bg-orange-950/50 dark:text-orange-300`, hover border `hover:border-orange-400`.

---

## 5. Backend API Endpoints Reference

| Method | Endpoint | Auth Required | Description | Request Body / Params |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/` | No | API Health Check | None |
| `POST` | `/users/register` | No | Register new user | `{ "name": "...", "email": "...", "password": "..." }` |
| `POST` | `/users/login` | No | Authenticate user & set cookie | `{ "email": "...", "password": "..." }` |
| `POST` | `/users/logout` | Yes | Clear refresh token cookie | None |
| `GET` | `/users/refresh` | Cookie | Generate fresh access token | None (cookie sent automatically) |
| `GET` | `/users/me` | Yes | Get authenticated user profile | None |
| `POST` | `/rooms/create` | Yes | Create a new workspace room | `{ "title": "...", "language": "cpp \| javascript \| python \| java" }` |
| `GET` | `/rooms/all` | Yes | List all rooms created/joined | None |
| `GET` | `/rooms/:roomId` | Yes | Fetch details of a single room | Param: `roomId` |
| `PUT` | `/rooms/join/:roomId` | Yes | Add user to room's members list | Param: `roomId` |
| `PUT` | `/rooms/:roomId/code` | Yes | Save code content to room | `{ "code": "..." }` |
| `DELETE`| `/rooms/:roomId` | Yes | Delete room (creator only) | Param: `roomId` |
| `POST` | `/run` | Yes | Compile and execute code | `{ "language": "cpp \| python \| ...", "code": "..." }` |

---

## 6. Frontend Routes Reference

| Route | Component | Access | Purpose |
| :--- | :--- | :---: | :--- |
| `/` | `Landing.jsx` | Public | Home landing page with live Wandbox playground |
| `/login` | `Login.jsx` | Public | Login screen |
| `/register`| `Register.jsx`| Public | Registration screen |
| `/dashboard` | `Home.jsx` | Protected | Workspaces list, room creation, language filtering |
| `/room/:roomId` | `Room.jsx` | Protected | Monaco code editor, Save, Run, Console output |
| `*` | Redirect | Public | Redirects invalid URLs to `/` |

---

## 7. Instructions & Scope for Phase 2 Development

When passing this project to an AI for Phase 2, prioritize the following features in order:

### Priority 1: Real-Time Live Synchronization (Socket.IO)
* **Goal:** Enable multiple developers in the same room to see each other's edits, cursors, and selections live without overwriting each other.
* **Suggested Implementation:**
  1. Attach Socket.IO to `http.createServer(app)` in `backend/server.js`.
  2. Implement room channels (`socket.join(roomId)`).
  3. Wire up operational transformation (or Yjs with `y-monaco` / `y-websocket`) for CRDT-based conflict-free collaborative editing.
  4. Broadcast cursor position and collaborator color tags.

### Priority 2: In-line Code Review & Threaded Comments
* **Goal:** Allow reviewers to highlight a line number in Monaco Editor and start a discussion thread.
* **Suggested Implementation:**
  1. Add a `Comment` model: `{ roomId, line, author, content, resolved, createdAt }`.
  2. Use Monaco's `glyphMargin` or `editor.deltaDecorations` to display comment indicator bubbles on annotated lines.
  3. Add a side drawer or popover to read and reply to comment threads.

### Priority 3: Version Snapshots & Git-Style Diffs
* **Goal:** Allow saving named versions/snapshots of the code and viewing changes side-by-side.
* **Suggested Implementation:**
  1. Add a `Snapshot` schema: `{ roomId, name, code, savedBy, createdAt }`.
  2. Use Monaco's built-in `<DiffEditor />` to render side-by-side diffs between current code and any saved snapshot.

### Priority 4: Room Access Controls & Shareable Links
* **Goal:** Facilitate inviting teammates with granular permissions.
* **Suggested Implementation:**
  1. Add role flags: `owner`, `editor`, `viewer` (read-only).
  2. Generate shareable invite links with token-based access.

### Priority 5: Test Cases & Custom Standard Input (stdin)
* **Goal:** Allow supplying custom `stdin` input to the Wandbox compiler runner and evaluating test case assertions.
* **Suggested Implementation:**
  1. Add an optional `stdin` field to `POST /run` and forward it to Wandbox `stdin` payload.
  2. Provide a tab in the editor for "Test Cases" / "Custom Input".

---

## 8. Local Setup & Environment Reference

### Backend `.env` Configuration
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/devcollab
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
CLIENT_URL=http://localhost:5173
```

### Starting the Project
* **Backend:**
  ```powershell
  cd backend
  npm install
  npm run dev    # Starts server on port 5000 with nodemon
  ```
* **Frontend:**
  ```powershell
  cd frontend
  npm install
  npm run dev    # Starts Vite dev server on http://localhost:5173
  ```
* **Verify Production Build:**
  ```powershell
  cd frontend
  npm run build  # Builds client bundle with 0 errors
  ```

