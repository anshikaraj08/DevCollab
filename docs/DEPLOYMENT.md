# DevCollab — Production Deployment Guide

> **Target Architecture:** Free-Tier Cloud Deployment  
> **Backend Service:** Render Free Web Service (Docker)  
> **Frontend Host:** Vercel Free Hobby Tier (Vite / React)  
> **Database:** MongoDB Atlas (M0 Free Shared Cluster)  
> **Domain Policy:** Free cloud subdomains (`*.vercel.app` and `*.onrender.com`) without custom domain purchase.

---

## 1. Architecture & Free-Tier Characteristics

### Free-Tier Hosting Specifications
| Component | Provider | Free Tier Limits | Production Behaviors & Mitigations |
|---|---|---|---|
| **Backend API & WebSockets** | **Render** | 512 MB RAM, 0.1 CPU, spins down after 15 minutes of inactivity | **Cold Starts:** When inactive, the first request wakes the service in ~30–50s. Socket.IO reconnects automatically once the service is up; the first HTTP request may time out and need a page refresh. A paid instance avoids sleeping.<br>**WebSockets:** Render natively supports HTTP/1.1 WebSocket upgrades with persistent connections during active sessions. |
| **Frontend Static SPA** | **Vercel** | 100 GB bandwidth / month, global CDN edge network | Instant load times, automatic Brotli/gzip compression, and global edge caching for `/assets/` and self-hosted `/monaco/`. |
| **Primary Database** | **MongoDB Atlas** | M0 Cluster (512 MB storage, shared RAM, replica set) | Fully managed TLS encryption in transit and rest. Adequate for hundreds of workspaces and thousands of version snapshots. |

### Cookie & Security Architecture on Free Subdomains
Because the frontend runs on `https://<your-project>.vercel.app` and the backend runs on `https://<your-service>.onrender.com`, modern browsers (Chrome Privacy Sandbox, Safari ITP, Firefox ETP) treat these origins as **cross-site**.
* **SameSite Setting:** In `backend/.env` (and Render dashboard), set `COOKIE_SAMESITE=none`.
* **Secure Flag:** `secure: true` is strictly enforced over HTTPS on both Render and Vercel.
* **Credentials:** Express CORS and Socket.IO have `credentials: true` enabled and validate the incoming origin against `CLIENT_URLS`.

---

## 2. Step-by-Step Deployment Instructions

### Step A: Setup MongoDB Atlas (Database)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. Click **Create Deployment** → Select **M0 (Free)**.
3. Choose your nearest cloud region (e.g. AWS / us-east-1 or eu-west-1).
4. Under **Security Quickstart**:
   * Create a Database User with username (e.g. `devcollab_admin`) and a strong password. Note these down.
   * Under **Network Access** (IP Access List), click **Add IP Address** → Select **Allow Access From Anywhere (`0.0.0.0/0`)** so Render can connect dynamically.
5. Go to **Database** → Click **Connect** → Choose **Drivers (Node.js)**.
6. Copy the connection string. It will look like:
   ```env
   mongodb+srv://devcollab_admin:<password>@cluster0.abcde.mongodb.net/devcollab?retryWrites=true&w=majority
   ```

---

### Step B: Deploy Backend to Render (Docker Web Service)
1. Go to [Render Dashboard](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** → Select **Web Service**.
3. Choose **Build and deploy from a Git repository** and connect your `DevCollab` repository.
4. Fill in the service configuration:
   * **Name:** `devcollab-api` (or a name of your choice)
   * **Region:** Choose the region closest to your MongoDB Atlas cluster.
   * **Branch:** `phase-4` (or `main`)
   * **Runtime:** Select **Docker**
   * **Dockerfile Path:** `backend/Dockerfile`
   * **Docker Context:** `backend`
   * **Instance Type:** Select **Free**
5. Under **Advanced Settings**:
   * **Health Check Path:** `/readyz`
6. Add the following **Environment Variables** in Render:
   | Key | Value | Purpose |
   |---|---|---|
   | `PORT` | `5000` | Internal server port |
   | `NODE_ENV` | `production` | Production mode |
   | `MONGO_URI` | `mongodb+srv://...` (from Step A) | Atlas connection string |
   | `JWT_ACCESS_SECRET` | *(Random 32+ characters)* | Access-token signing |
   | `COOKIE_SECRET` | *(Random 32+ characters)* | Signs the OAuth state cookie |
   | `CLIENT_URL` | `https://<your-project>.vercel.app` (from Step C) | Frontend URL used in emails, invites and OAuth redirects |
   | `CLIENT_URLS` | `https://<your-project>.vercel.app` | Allowed CORS origins |
   | `API_URL` | `https://devcollab-api.onrender.com` | This backend's public URL (OAuth callbacks) |
   | `COOKIE_SAMESITE` | `none` | Required for cross-site cookies |
   | `TRUST_PROXY` | `1` | **Required.** Without it every user shares one rate-limit bucket |
   | `MAIL_TRANSPORT` | `smtp` | **Required for email.** Otherwise verification/reset emails are only logged |
   | `SMTP_URL` | `smtp://user:pass@smtp-relay.brevo.com:2525` | Your SMTP provider (e.g. Brevo, Mailgun, SendGrid). **Render's free tier blocks ports 25, 465 and 587**; use port 2525 there. URL-encode `@` in the login as `%40` |
   | `MAIL_FROM` | `DevCollab <noreply@yourdomain>` | Sender address your SMTP provider allows |
   | `APP_VERSION` | `1.0.0` | Sentry & release version |

   Optional:
   | Key | Value | Purpose |
   |---|---|---|
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud Console | Google sign-in. Authorized redirect URI: `<API_URL>/auth/google/callback` |
   | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | from GitHub OAuth Apps | GitHub sign-in. Callback URL: `<API_URL>/auth/github/callback` |
   | `AI_PROVIDER` / `AI_API_KEY` | `groq`, `anthropic` or `openai` + key | Enables AI review (default models `llama-3.3-70b-versatile` / `claude-opus-5-5` / `gpt-4o-mini`; override with `AI_MODEL`). Groq has a free tier |
   | `SENTRY_DSN` | Sentry project DSN | Error reporting |
   | `METRICS_TOKEN` | random string | Enables `/metrics` behind `Authorization: Bearer <token>` |

   `JWT_REFRESH_SECRET` is no longer needed (refresh tokens are server-side sessions); an existing value is harmless.

   The repository's `render.yaml` blueprint lists the same variables and can create the service for you.
7. Click **Create Web Service**. Render will build the Docker container and start the service.
8. Once built, copy your backend URL: `https://devcollab-api.onrender.com`.

---

### Step C: Deploy Frontend to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/) and sign in with GitHub.
2. Click **Add New...** → **Project** → Import your `DevCollab` repository.
3. Configure the project:
   * **Framework Preset:** Vite
   * **Root Directory:** Click Edit and select `frontend`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
4. Under **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://devcollab-api.onrender.com` (your Render URL from Step B) |
   | `VITE_MONACO_BASE` | `/monaco` (optional — production builds default to the self-hosted copy) |
5. Click **Deploy**. Vercel will build and assign you a free URL: `https://your-project.vercel.app`.
6. *(Important)* Copy this Vercel URL, go back to Render, and set `CLIENT_URL` and `CLIENT_URLS` to this exact URL.

---

## 3. Post-Deployment Verification & Maintenance

### Run Database Index Synchronization
After the database is connected, sync compound and unique indexes:
```bash
MONGO_URI="mongodb+srv://..." node backend/scripts/ensure-indexes.js
```

### Run the Smoke Test
Verify the deployment with our automated smoke test:
```bash
API_URL="https://devcollab-api.onrender.com" node scripts/smoke.mjs
```
The script will assert:
1. `GET /readyz` health and database connectivity.
2. Account registration and JWT cookie issuance.
3. Workspace room creation.
4. Socket.IO connection and real-time CRDT room join.
5. Graceful socket leave.

---

## 4. Rollback and Troubleshooting

### Rollback Process
* **Render:** In the Render dashboard, navigate to **Deploys** → Find the previous healthy commit → Click the three dots `...` → Select **Rollback to this deploy**.
* **Vercel:** In the Vercel dashboard, go to **Deployments** → Select the previous successful deployment → Click **Promote to Production**.

### Common Troubleshooting
* **Emails never arrive:** check the logs for "MAIL_TRANSPORT is not 'smtp'" and set `MAIL_TRANSPORT=smtp` plus `SMTP_URL`.
* **Users signed out after deploying this version:** expected once — refresh tokens moved from JWTs to server-side sessions, so old cookies are rejected and users sign in again.
* **CORS Errors (`403 CORS origin denied`):** Ensure `CLIENT_URLS` in Render exactly matches the frontend URL (e.g. `https://your-project.vercel.app`, without trailing slashes).
* **Login Fails on Refresh (Missing Cookies):** Verify `COOKIE_SAMESITE=none` is set in Render environment variables. Cross-site cookies between `.onrender.com` and `.vercel.app` require `SameSite=None; Secure`.
* **Render Cold Start Delay:** When accessing after 15 minutes of inactivity, wait 30 seconds for the container to wake up. Check `https://<backend>.onrender.com/readyz` in your browser to confirm readiness.

---

## 5. Multi-Instance Scale-Out with Redis (Stage 5)

DevCollab supports horizontal multi-instance scale-out across multiple backend containers while maintaining full single-process backwards compatibility when Redis is absent.

### Architecture Overview
1. **Socket.IO Redis Adapter (`@socket.io/redis-adapter`):** Broadcasts room events, cursor awareness, and notifications across all server replicas.
2. **Append-Only Update Log (`YUpdate` in MongoDB):** Each instance buffers collaborative edits and commits merged update batches every 500ms.
3. **Replica Updates Pub/Sub (`devcollab:replica:updates`):** Live CRDT edits are published across instances and applied in memory with origin `"redis"`.
4. **30-Second Resync Poll:** Each loaded document polls `persistence.loadSince(roomId, lastSeenId)` every 30 seconds as an automated safety net against dropped pub/sub packets.
5. **Compaction Lease (`compact:<roomId>`):** Distributed Redis mutex with a 30s TTL prevents duplicate compaction runs across replicas.
6. **Sticky sessions:** document convergence does not need them, because any instance can load any document from the durable log. The frontend connects over WebSocket first, which works without sticky sessions; only the long-polling fallback (used when WebSockets are blocked) needs them.
7. **Shared state:** HTTP rate limits are stored in Redis and shared by all instances. Role changes, member removals and room deletions are applied on every instance. The 10-sockets-per-user cap is per instance.

### Running Two Replicas Locally with Docker Compose
To run MongoDB, Redis, and two backend replicas alongside the frontend:
```bash
docker compose --profile scale-out up --build
```
- Primary Backend Replica 1: `http://localhost:5000`
- Secondary Backend Replica 2: `http://localhost:5001`
- Redis Container: `localhost:6379`
- Frontend: `http://localhost`

### Free-Tier Cloud Redis Deployment (Upstash)
1. Create a free database on [Upstash Redis](https://upstash.com/).
2. Copy the `rediss://...` connection URI.
3. Add `REDIS_URL` to your backend environment variables in Render (or replica containers).
4. The backend automatically activates Redis pub/sub, the Socket.IO Redis adapter, and Redis-backed rate limiting.
5. Upstash's free tier allows 10,000 commands/day, which an active deployment exceeds quickly (every edit is published). Use a paid plan for real traffic.


