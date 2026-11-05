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
| **Backend API & WebSockets** | **Render** | 512 MB RAM, 0.1 CPU, spins down after 15 minutes of inactivity | **Cold Starts:** When inactive, the first request wakes the service in ~30–50s. DevCollab's frontend includes automatic retry with exponential backoff on both Axios and Socket.IO handshakes.<br>**WebSockets:** Render natively supports HTTP/1.1 WebSocket upgrades with persistent connections during active sessions. |
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
   | `JWT_ACCESS_SECRET` | *(Random 32+ characters)* | Token signing |
   | `JWT_REFRESH_SECRET` | *(Random 32+ characters)* | Refresh token signing |
   | `CLIENT_URL` | `https://<your-project>.vercel.app` (from Step C) | Primary frontend URL |
   | `CLIENT_URLS` | `https://<your-project>.vercel.app` | Allowed CORS origins |
   | `COOKIE_SAMESITE` | `none` | Required for cross-site cookies |
   | `TRUST_PROXY` | `1` | Reads real client IPs behind Render |
   | `APP_VERSION` | `1.0.0` | Sentry & release version |
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
   | `VITE_MONACO_BASE` | `/monaco` (self-hosted assets) |
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
* **CORS Errors (`403 CORS origin denied`):** Ensure `CLIENT_URLS` in Render exactly matches the frontend URL (e.g. `https://your-project.vercel.app`, without trailing slashes).
* **Login Fails on Refresh (Missing Cookies):** Verify `COOKIE_SAMESITE=none` is set in Render environment variables. Cross-site cookies between `.onrender.com` and `.vercel.app` require `SameSite=None; Secure`.
* **Render Cold Start Delay:** When accessing after 15 minutes of inactivity, wait 30 seconds for the container to wake up. Check `https://<backend>.onrender.com/readyz` in your browser to confirm readiness.
