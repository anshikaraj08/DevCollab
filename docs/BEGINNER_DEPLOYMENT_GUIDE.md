# DevCollab — Complete Beginner's Step-by-Step Deployment Guide

> **Welcome!** If this is your first time deploying a web application, this guide is written specifically for you.  
> We will walk through every step from pushing your code to GitHub to having your live app accessible to anyone in the world — completely **free of cost**, without buying any domains.

---

## 📋 What We Are Deploying & Where

DevCollab has three parts:
1. **Frontend (The User Interface):** React + Monaco Editor. We will host this on **Vercel** (Free).
2. **Backend (The API & WebSockets):** Express + Socket.IO + Yjs CRDTs. We will host this on **Render** (Free Docker Web Service).
3. **Database (Persistent Storage):** MongoDB Atlas (Free M0 Cluster).
4. *(Optional)* **Redis (Multi-Instance Scaling):** Upstash (Free Serverless Redis).

---

## Part 1: Push Your Code to GitHub

Before deploying to the cloud, your code must be on GitHub so Render and Vercel can pull it.

### Step 1.1: Create a Repository on GitHub
1. Open your browser and go to [github.com](https://github.com). Log in (or create an account if you don't have one).
2. Click the **+** (plus icon) in the top-right corner and select **New repository**.
3. Choose a name, for example: `devcollab`.
4. Choose **Public** or **Private** (either works fine; Private keeps your code confidential).
5. **Do NOT** check "Add a README file" or ".gitignore" (we already have them in our project).
6. Click **Create repository**.
7. GitHub will show you a page with your repository URL. It looks like:
   `https://github.com/<YOUR_GITHUB_USERNAME>/devcollab.git`
   Keep this tab open!

### Step 1.2: Push Local Code from Your Computer
Open your terminal in `C:\All Projects\DevCollab` (or use PowerShell / VS Code terminal).

Run these commands one by one:

```bash
# 1. Check your current branch
git branch
```
*(You will see `* phase-4`)*

```bash
# 2. Switch to the main branch (or create it if it doesn't exist yet)
git checkout -b main

# 3. Merge all Phase 4 work into main
git merge phase-4

# 4. Link your local project to your new GitHub repository
# Replace <YOUR_GITHUB_USERNAME> with your actual GitHub username!
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/devcollab.git

# If git says "remote origin already exists", update it instead:
# git remote set-url origin https://github.com/<YOUR_GITHUB_USERNAME>/devcollab.git

# 5. Push your code to GitHub!
git push -u origin main
```

*(If Git asks you to sign in, click "Sign in with your browser" and authorize GitHub.)*

Once complete, refresh your GitHub repository page. You will see all your project files!

---

## Part 2: Set Up MongoDB Atlas (Free Cloud Database)

MongoDB Atlas stores your users, rooms, comments, version snapshots, and code updates.

### Step 2.1: Create Your Free Cluster
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.
2. After logging in, click **Create** (or **Deploy Database**).
3. Under Deployment Options, select the **M0 Free** tier.
4. Choose a Cloud Provider & Region (e.g., **AWS** in a region close to you, like `N. Virginia (us-east-1)` or `Frankfurt (eu-central-1)`).
5. Name your cluster (e.g., `Cluster0`) and click **Create Deployment**.

### Step 2.2: Create Database Credentials
1. In the "Quickstart" security setup:
   - **Username:** `devcollab_admin` (or any username you choose).
   - **Password:** Click "Autogenerate Secure Password" or type a strong password.  
     ⚠️ **Important:** Copy this password and paste it into a safe text document. You will need it in a moment.
   - Click **Create User**.

### Step 2.3: Whitelist Network Access
Render cloud servers need permission to connect to your database:
1. In the same security screen (or go to **Network Access** in the left sidebar):
2. Click **Add IP Address**.
3. Click the button **Allow Access from Anywhere** (this enters `0.0.0.0/0`).
4. Click **Confirm**.

### Step 2.4: Get Your Connection String
1. Go to **Databases** in the left sidebar.
2. Click the **Connect** button next to your cluster.
3. Select **Drivers** (Node.js).
4. You will see a connection string that looks like this:
   ```text
   mongodb+srv://devcollab_admin:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
5. Copy this string. Replace `<db_password>` with the password you saved in Step 2.2.
6. Right before the `?retryWrites=true`, add the database name `/devcollab`. Your final string should look like:
   ```text
   mongodb+srv://devcollab_admin:YourSecretPassword123@cluster0.abcde.mongodb.net/devcollab?retryWrites=true&w=majority&appName=Cluster0
   ```
   Save this — this is your `MONGO_URI`.

---

## Part 3: (Optional) Set Up Upstash Redis for Multi-Instance Scale-Out

DevCollab runs with full functionality on a single instance without Redis. If you want multi-server pub/sub scaling, you can grab a free Redis database in 1 minute:

1. Go to [upstash.com](https://upstash.com/) and sign up with GitHub.
2. Click **Create Database**.
3. Choose a Name (e.g. `devcollab-redis`) and select your nearest region.
4. Select the **Free Tier**.
5. Once created, scroll down to the **Connect** section and select **ioredis** or **Redis URL**.
6. Copy the connection URL starting with `rediss://...`.
7. Save this — this is your `REDIS_URL`.

---

## Part 4: Deploy the Backend on Render (Free Web Service)

Render will run your Node.js Docker container for the Express API and Socket.IO real-time server.

### Step 4.1: Create Web Service
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click the blue **New +** button in the top right → select **Web Service**.
3. Choose **Build and deploy from a Git repository** → Click **Next**.
4. Find your `devcollab` repository and click **Connect**.

### Step 4.2: Configure Web Service Settings
Fill in these fields on the settings page:
- **Name:** `devcollab-api` (or any unique name).
- **Region:** Choose the region closest to your MongoDB Atlas cluster.
- **Branch:** `main`
- **Language/Runtime:** Select **Docker** from the dropdown.
- **Dockerfile Path:** `backend/Dockerfile`
- **Docker Build Context Directory:** `backend`
- **Instance Type:** Select **Free** (512 MB RAM / 0.1 CPU).

### Step 4.3: Health Check
Scroll down and click **Advanced**:
- **Health Check Path:** type `/readyz`

### Step 4.4: Add Environment Variables
Under the **Environment Variables** section on the same page, click **Add Environment Variable** for each of the following:

| Key | Example Value | Explanation |
|---|---|---|
| `PORT` | `5000` | The internal port the server listens on |
| `NODE_ENV` | `production` | Tells Node and Express to run in production mode |
| `MONGO_URI` | `mongodb+srv://...` | The MongoDB string you created in Part 2 |
| `JWT_ACCESS_SECRET` | `generate-a-random-string-at-least-32-chars-long-123456` | Secret key used to encrypt login access tokens |
| `JWT_REFRESH_SECRET` | `generate-another-random-string-at-least-32-chars-long-abcdef` | Secret key used to encrypt refresh tokens |
| `COOKIE_SAMESITE` | `none` | **Crucial:** Allows login cookies to work across Vercel and Render free subdomains |
| `TRUST_PROXY` | `1` | Tells Express it is running behind Render's HTTPS reverse proxy |
| `APP_VERSION` | `1.0.0` | Version label |
| `CLIENT_URL` | `http://localhost:5173` | *(Temporary placeholder — we will update this to your Vercel URL in Part 6)* |
| `CLIENT_URLS` | `http://localhost:5173` | *(Temporary placeholder — we will update this to your Vercel URL in Part 6)* |
| `REDIS_URL` | `rediss://...` *(Optional)* | Only add if you created an Upstash Redis database in Part 3 |

> 💡 **Tip for Secrets:** You can generate a secure 32-character string in any terminal by running:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Step 4.5: Deploy Backend
1. Click **Create Web Service** at the bottom.
2. Render will start downloading and building your Docker container. This takes about 2 to 3 minutes.
3. Once the logs say `Server listening on port 5000` and the status badge turns **Live**, copy your backend URL at the top left of the screen:
   Example: `https://devcollab-api.onrender.com`

---

## Part 5: Deploy the Frontend on Vercel (Free CDN Hosting)

Vercel will compile and host your React 19 single-page application.

### Step 5.1: Import Project in Vercel
1. Go to [vercel.com](https://vercel.com/) and sign in with GitHub.
2. On your Vercel Dashboard, click **Add New…** → **Project**.
3. Find your `devcollab` repository and click **Import**.

### Step 5.2: Configure Build Settings
On the "Configure Project" screen:
1. **Framework Preset:** Select **Vite**.
2. **Root Directory:** Click **Edit** next to Root Directory, select the `frontend` folder, and click **Continue**.
3. **Build Command:** Leave as default (`npm run build`).
4. **Output Directory:** Leave as default (`dist`).

### Step 5.3: Add Environment Variables
Expand the **Environment Variables** section:
Add one environment variable:
- **Key:** `VITE_API_URL`
- **Value:** `https://devcollab-api.onrender.com` *(use your actual Render URL from Step 4.5, without a trailing slash)*

### Step 5.4: Deploy Frontend
1. Click **Deploy**.
2. Vercel will install dependencies and run the Vite build in under 1 minute.
3. When finished, you will see confetti and a screenshot preview of your app!
4. Click on the domain link to copy your frontend URL. It will look like:
   `https://devcollab-seven.vercel.app`

---

## Part 6: Connect Backend to Frontend (The Handshake)

Now that you have your live Vercel URL, you need to tell your Render backend to accept logins and socket connections from this URL!

1. Go back to your [Render Dashboard](https://dashboard.render.com/).
2. Click on your `devcollab-api` service.
3. Click **Environment** in the left sidebar.
4. Find the two variables you set as placeholders earlier and edit them:
   - `CLIENT_URL` ➡️ `https://your-app-name.vercel.app`
   - `CLIENT_URLS` ➡️ `https://your-app-name.vercel.app`
   *(Replace with your actual Vercel URL, with no trailing slash `/`)*
5. Click **Save Changes**.
6. Render will automatically redeploy with the new settings in ~30 seconds.

---

## Part 7: Final Verification & Smoke Test

### Step 7.1: Synchronize Database Indexes
On your local computer, run this command in your terminal so MongoDB Atlas creates all optimized search indexes:
```bash
# In your terminal:
node backend/scripts/ensure-indexes.js
```
*(Make sure your local `backend/.env` has your `MONGO_URI` set to your Atlas connection string, or pass it inline like `MONGO_URI="mongodb+srv://..." node backend/scripts/ensure-indexes.js`)*

### Step 7.2: Run the Automated Smoke Test
You can run our automated smoke test right from your computer against your live cloud deployment:
```bash
API_URL="https://devcollab-api.onrender.com" node scripts/smoke.mjs
```
*(Replace with your actual Render URL)*

This script tests:
1. Cloud health check `/readyz`
2. User account creation & JWT cookie generation
3. Workspace room creation
4. Real-time WebSocket connection and collaborative CRDT room joining
5. Graceful socket disconnect

When it outputs:
```text
🎉 Smoke test passed! Backend deployment is 100% healthy.
```
Your deployment is verified!

---

## Part 8: Open and Enjoy Your App!

1. Open your browser and navigate to your Vercel URL: `https://your-app-name.vercel.app`.
2. Click **Register** and create an account.
3. Click **New Workspace** to open a live editor room.
4. Copy the URL and open it in an Incognito window (or send it to a friend).
5. Watch your keystrokes, remote cursors, comments, and AI reviews synchronize live in real time!

---

## 💡 Beginner Troubleshooting & FAQ

### Q: Why does the app feel slow the first time I visit after a few hours?
**A:** Render's free tier has an **inactivity sleep** feature: if no one visits the site for 15 minutes, Render pauses the server to save resources. When someone visits, it takes about **30 to 45 seconds** to "wake up" (a cold start). DevCollab has automatic retry logic built in, so once it wakes up, it stays fast and responsive.

### Q: I get a CORS error in my browser console when logging in.
**A:** Check your Render environment variables. Ensure `CLIENT_URL` and `CLIENT_URLS` in Render exactly match your Vercel URL:
- ✅ Correct: `https://my-app.vercel.app`
- ❌ Incorrect: `https://my-app.vercel.app/` (no trailing slash)
- ❌ Incorrect: `http://my-app.vercel.app` (must be `https`)

### Q: How do I update my app in the future when I make changes?
**A:** Whenever you make new code changes, just run:
```bash
git add .
git commit -m "Describe your changes"
git push origin main
```
Both Render and Vercel will automatically detect the push and redeploy your latest changes with zero manual intervention!
