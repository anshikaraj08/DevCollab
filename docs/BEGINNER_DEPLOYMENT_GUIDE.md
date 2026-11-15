# DevCollab: First-Time Deployment Guide (Step by Step)

This guide takes you from "the code is on my laptop" to "anyone can open my app in their browser". It assumes you have never deployed anything before. Every click and every value is written out.

**Time needed:** about 1.5–2 hours the first time.
**Cost:** $0. Every service below has a free tier. You do not need a credit card or a domain.

> Commands in this guide are for **PowerShell** on Windows (the VS Code terminal uses it by default). Run them from the project folder `C:\All Projects\DevCollab` unless a step says otherwise.

---

## Table of contents

0. [How the pieces fit together](#part-0-how-the-pieces-fit-together)
1. [Before you start: accounts and a notes file](#part-1-before-you-start)
2. [Check the code and put it on GitHub](#part-2-check-the-code-and-put-it-on-github)
3. [Create the database (MongoDB Atlas)](#part-3-create-the-database-mongodb-atlas)
4. [Set up email sending (Brevo)](#part-4-set-up-email-sending-brevo)
5. [Deploy the backend (Render)](#part-5-deploy-the-backend-render)
6. [Deploy the frontend (Vercel)](#part-6-deploy-the-frontend-vercel)
7. [Connect the two halves](#part-7-connect-the-two-halves)
8. [Test everything](#part-8-test-everything)
9. [Optional: Google and GitHub sign-in](#part-9-optional-google-and-github-sign-in)
10. [Optional: AI code review](#part-10-optional-ai-code-review)
11. [Updating the app later](#part-11-updating-the-app-later)
12. [Troubleshooting](#part-12-troubleshooting)
13. [Limits of the free setup](#part-13-limits-of-the-free-setup)

---

## Part 0: How the pieces fit together

DevCollab is made of three parts. Each one lives on a different service:

```
   Visitor's browser
         │
         │ 1. loads the web pages (HTML, JS, CSS)
         ▼
 ┌───────────────────┐
 │  VERCEL           │  frontend  (React app, the "frontend/" folder)
 │  your-app.vercel.app
 └───────────────────┘
         │
         │ 2. the page then talks to the API + live socket
         ▼
 ┌───────────────────┐
 │  RENDER           │  backend  (Express API + Socket.IO, the "backend/" folder)
 │  your-api.onrender.com
 └───────────────────┘
         │
         │ 3. the backend stores everything here
         ▼
 ┌───────────────────┐
 │  MONGODB ATLAS    │  database (users, rooms, code, comments…)
 └───────────────────┘

 Brevo  → sends emails (verify email, reset password) for the backend
```

You will build it **bottom-up**: database first, then backend, then frontend. Then you connect the backend to the frontend's address.

**Two words you will see a lot:**
- **Environment variable ("env var"):** a named setting, like `MONGO_URI=...`, that you type into the hosting dashboard instead of into the code. Secrets (passwords, keys) must **only** go in env vars, never in code.
- **Deploy:** the hosting service downloads your code from GitHub, builds it and starts it.

---

## Part 1: Before you start

### 1.1 Create these accounts (all free)

| Service | What it's for | Sign up at | Tip |
|---|---|---|---|
| GitHub | Stores your code | github.com | You already have one: `anshikaraj08` |
| MongoDB Atlas | Database | mongodb.com/cloud/atlas/register | "Sign up with Google" is fastest |
| Brevo | Sends emails | brevo.com | Free plan: 300 emails/day |
| Render | Runs the backend | render.com | Click **Sign in with GitHub** |
| Vercel | Hosts the frontend | vercel.com | Click **Continue with GitHub** |

### 1.2 Make a private notes file

You will collect about ten values (passwords, URLs, keys) along the way. Create a file **outside the project folder**, for example `C:\Users\<you>\Documents\devcollab-deploy-notes.txt`, and paste this into it:

```
MONGO_URI          =
JWT_ACCESS_SECRET  =
COOKIE_SECRET      =
SMTP_URL           =
MAIL_FROM          =
BACKEND URL        = https://....onrender.com
FRONTEND URL       = https://....vercel.app
```

> ⚠️ Never save this file inside `C:\All Projects\DevCollab`. Never commit it to Git and never paste these values into chats or screenshots.

### 1.3 Generate two secrets now

Run this command **twice** in PowerShell. Each run prints a different random 96-character string:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the first result after `JWT_ACCESS_SECRET =` and the second after `COOKIE_SECRET =` in your notes.

- `JWT_ACCESS_SECRET` signs the login tokens. If someone learns it, they can impersonate any user.
- `COOKIE_SECRET` signs the temporary cookie used during Google/GitHub sign-in.

---

## Part 2: Check the code and put it on GitHub

Render and Vercel both deploy from GitHub, from the `main` branch. Your latest work is on the `phase-4` branch and is not committed yet.

### 2.1 Run the tests (optional, recommended)

```powershell
cd "C:\All Projects\DevCollab\backend"
npm install
npm test

cd "C:\All Projects\DevCollab\frontend"
npm install
npm test
npm run build

cd "C:\All Projects\DevCollab"
```

Expected: the backend reports `pass 133` and `fail 0`, the frontend reports `57 passed`, and the build finishes with `✓ built in ...`. If something fails, stop and fix it first.

### 2.2 Check that no secrets will be committed

```powershell
git status
```

Look through the list. You must **not** see `backend/.env` or `frontend/.env`; they are excluded by `.gitignore`. You **should** see the `.env.example` files. Those contain placeholders only and are safe to commit.

### 2.3 Commit and push `phase-4`

```powershell
git add -A
git commit -m "Production hardening: sessions, rate limiting, persistence, docs"
git push origin phase-4
```

If Git asks you to log in, choose **Sign in with your browser** and approve.

### 2.4 Move the work to `main`

```powershell
git checkout main
git pull origin main
git merge phase-4
git push origin main
git checkout phase-4
```

- If `git merge` opens a text editor for the merge message, save and close it.
- If it says **CONFLICT**, stop and ask for help. Don't guess.

Open `https://github.com/anshikaraj08/DevCollab` in your browser and switch the branch selector to `main`. You should see a recent commit time.

---

## Part 3: Create the database (MongoDB Atlas)

### 3.1 Create a free cluster

1. Log in to **cloud.mongodb.com**. If it asks you to create an organization or project, accept the defaults or name the project `DevCollab`.
2. Click **Create** (or **Build a Database** / **Create cluster**).
3. Choose **M0 / Free**.
4. **Provider:** AWS. **Region:** pick one, and **remember it**, because you will pick the closest Render region later. Good pairs:
   - Atlas `Frankfurt (eu-central-1)` ↔ Render `Frankfurt`
   - Atlas `N. Virginia (us-east-1)` ↔ Render `Virginia (US East)`
   - Atlas `Singapore (ap-southeast-1)` ↔ Render `Singapore`
5. Name: `Cluster0` is fine. Click **Create Deployment**. It takes 1–3 minutes.

### 3.2 Create a database user

A popup asks you to create a database user (or go to **Security → Database Access → Add New Database User**).

1. Username: `devcollab_app`
2. Password: click **Autogenerate Secure Password**, then **Copy**. Paste it into your notes right away.
   > Use letters and numbers only. Characters like `@ : / ? #` break the connection string unless you encode them. The autogenerated password is safe.
3. Role: **Read and write to any database** (the default "Atlas admin" also works, but read/write is enough).
4. Click **Create User**.

### 3.3 Allow Render to connect

Render's free tier has no fixed IP address, so Atlas must accept connections from anywhere. The password is what protects the database.

1. Go to **Security → Network Access → Add IP Address**.
2. Click **Allow Access from Anywhere**. This fills in `0.0.0.0/0`.
3. Click **Confirm**. Wait until the status shows **Active**.

### 3.4 Build your `MONGO_URI`

1. Go to **Database → Clusters**, click **Connect** on your cluster, then **Drivers**.
2. Copy the string. It looks like this:
   ```
   mongodb+srv://devcollab_app:<db_password>@cluster0.ab1cd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
3. Edit it in your note
   - Replace `<db_password>` (including the `< >`) with the password from 3.2.
   - Add the database name `devcollab` between `.net/` and `?`.

   Final result:
   ```
   mongodb+srv://devcollab_app:Xy7pQ2...@cluster0.ab1cd.mongodb.net/devcollab?retryWrites=true&w=majority&appName=Cluster0
   ```
4. Save it as `MONGO_URI` in your notes.

You don't need to create collections or indexes. The backend creates them the first time it starts.

---

## Part 4: Set up email sending (Brevo)

The app sends emails for **email verification**, **password reset**, "your password was changed" notices and **weekly digests**.

> **Why not Gmail?** Since September 2025, Render's free tier **blocks outgoing email on ports 25, 465 and 587**, the ports Gmail and most guides use. Emails would silently time out. Brevo also accepts port **2525**, which Render does not block.

### 4.1 Verify a sender address

1. Log in to **app.brevo.com**.
2. Go to **Senders, Domains & Dedicated IPs → Senders** (on older layouts, open the account menu top-right, then **Senders & IP**).
3. Click **Add a sender**:
   - From name: `DevCollab`
   - From email: your own email, for example a Gmail address
4. Brevo emails you a code or link. Confirm it.

### 4.2 Get the SMTP login and key

1. Go to **SMTP & API** (in settings, or at `app.brevo.com/settings/keys/smtp`).
2. On the **SMTP** tab you'll see:
   - **SMTP server:** `smtp-relay.brevo.com`
   - **Login:** something like `8a1b2c001@smtp-brevo.com`
3. Click **Generate a new SMTP key**, name it `devcollab-render`, and copy the key. It starts with `xsmtpsib-...`.
   > Use the **SMTP key**, not an "API key". They are different.

### 4.3 Build your `SMTP_URL`

The format is `smtp://LOGIN:KEY@smtp-relay.brevo.com:2525`.

**Important:** the login contains `@`, which must be written as `%40` inside a URL.

| Piece | Example |
|---|---|
| Login | `8a1b2c001@smtp-brevo.com` → **`8a1b2c001%40smtp-brevo.com`** |
| Key | `xsmtpsib-abc123...` |
| Final `SMTP_URL` | `smtp://8a1b2c001%40smtp-brevo.com:xsmtpsib-abc123...@smtp-relay.brevo.com:2525` |

Save it in your notes. Also save:
```
MAIL_FROM = DevCollab <the-email-you-verified-in-4.1@gmail.com>
```
The address in `MAIL_FROM` **must** be the sender you verified in 4.1, or Brevo rejects the email.

---

## Part 5: Deploy the backend (Render)

### 5.1 Create the web service

1. Log in to **dashboard.render.com**.
2. Click **+ New → Web Service**.
3. Choose **Git Provider → GitHub**. If you don't see your repository, click **Configure GitHub** and give Render access to `DevCollab`.
4. Select `anshikaraj08/DevCollab` and click **Connect**.

### 5.2 Fill in the settings

| Field | Value |
|---|---|
| **Name** | `devcollab-api`. This becomes part of the URL; if it's taken, try `devcollab-api-anshika` |
| **Language** | `Docker` |
| **Branch** | `main` |
| **Region** | Same area as your Atlas cluster (see 3.1) |
| **Root Directory** | *leave empty* |
| **Instance Type** | **Free** |

Scroll down and expand **Advanced**:

| Field | Value |
|---|---|
| **Dockerfile Path** | `./backend/Dockerfile` |
| **Docker Build Context Directory** | `./backend` |
| **Health Check Path** | `/readyz` |
| **Auto-Deploy** | `On Commit` (Yes) |

> `/readyz` answers "OK" only when the server is up **and** connected to MongoDB, so Render won't send visitors to a broken server.

### 5.3 Add the environment variables

In the **Environment Variables** section, click **+ Add Environment Variable** for each row. Type the key exactly as shown; keys are case-sensitive.

**Required:**

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Turns on production security settings |
| `PORT` | `5000` | Port the server listens on inside the container |
| `MONGO_URI` | *from your notes* | Part 3.4 |
| `JWT_ACCESS_SECRET` | *from your notes* | Part 1.3 |
| `COOKIE_SECRET` | *from your notes* | Part 1.3 |
| `TRUST_PROXY` | `1` | Render puts one proxy in front of your app. Without this, every visitor shares one rate limit and you would lock everyone out |
| `COOKIE_SAMESITE` | `none` | Lets the login cookie work between `vercel.app` and `onrender.com` |
| `CLIENT_URL` | `http://localhost:5173` | **Placeholder.** You replace it with the Vercel URL in Part 7 |
| `CLIENT_URLS` | `http://localhost:5173` | **Placeholder.** Same as above |
| `MAIL_TRANSPORT` | `smtp` | Actually send emails (otherwise they're only logged) |
| `SMTP_URL` | *from your notes* | Part 4.3 |
| `MAIL_FROM` | *from your notes* | Part 4.3 |

**Add later:**

| Key | When |
|---|---|
| `API_URL` | Part 5.5, once you know the backend URL |

**Do NOT add:**
- `REDIS_URL`. It's only needed when you run **more than one** backend server. One server without Redis is the simple, supported setup.
- `JWT_REFRESH_SECRET`. It's no longer used.
- Anything with a blank value. Leave unused settings out entirely.

### 5.4 Deploy

1. Click **Deploy Web Service**.
2. You'll see a log streaming. The first build takes **3–6 minutes**. Normal lines include `Step 1/…`, `npm ci`, `Pushing image`.
3. Success looks like:
   ```
   Server running on port 5000
   ==> Your service is live 🎉
   ```
   and the status badge at the top turns green: **Live**.

At the top left, under the service name, Render shows your URL, for example `https://devcollab-api.onrender.com`. Copy it into your notes as **BACKEND URL**, without a slash at the end.

### 5.5 Add `API_URL` and check the backend

1. In the left menu, click **Environment → + Add Environment Variable**:
   - `API_URL` = your backend URL, e.g. `https://devcollab-api.onrender.com`
2. Click **Save, rebuild, and deploy** (or **Save Changes**). Wait for **Live** again.
3. Open these two URLs in your browser:
   - `https://YOUR-BACKEND.onrender.com/healthz` should show `{"status":"ok"}`
   - `https://YOUR-BACKEND.onrender.com/readyz` should show `{"status":"ok","checks":{"database":"connected"}}`. `"degraded"` means the database connection failed

   If `/readyz` fails, see [Troubleshooting → database](#the-backend-wont-start-or-readyz-fails).

---

## Part 6: Deploy the frontend (Vercel)

### 6.1 Import the project

1. Log in to **vercel.com**.
2. Click **Add New… → Project**.
3. Find `DevCollab` in the list and click **Import**. If it's not listed, click **Adjust GitHub App Permissions** and give Vercel access to the repository.

### 6.2 Configure the build

| Field | Value |
|---|---|
| **Project Name** | `devcollab`. This becomes `devcollab.vercel.app` if it's free; otherwise Vercel adds a suffix |
| **Framework Preset** | `Vite` (usually auto-detected) |
| **Root Directory** | Click **Edit**, choose `frontend`, then **Continue** |
| **Build Command** | leave default (`npm run build`) |
| **Output Directory** | leave default (`dist`) |
| **Install Command** | leave default |

### 6.3 Add the environment variable

Expand **Environment Variables** and add:

| Key | Value |
|---|---|
| `VITE_API_URL` | your backend URL, e.g. `https://devcollab-api.onrender.com`, with **no** slash at the end |

> ⚠️ `VITE_` variables are baked into the website **when it's built**. If you change this value later, you must **redeploy** the frontend (Part 11.2) for the change to take effect.

### 6.4 Deploy

1. Click **Deploy**. The build takes 1–2 minutes.
2. When you see **Congratulations!**, click **Continue to Dashboard**.
3. Under **Domains** you'll see your URL, e.g. `https://devcollab.vercel.app`. Copy it into your notes as **FRONTEND URL**, without a slash at the end.

> Use the **short production domain** listed under "Domains". Vercel also creates long preview URLs like `devcollab-git-main-xyz.vercel.app`; don't use those for `CLIENT_URL`.

---

## Part 7: Connect the two halves

Right now the backend only trusts `http://localhost:5173`. Tell it to trust your Vercel site:

1. Go to Render → `devcollab-api` → **Environment**.
2. Edit these two variables:

   | Key | New value |
   |---|---|
   | `CLIENT_URL` | `https://devcollab.vercel.app` (your FRONTEND URL) |
   | `CLIENT_URLS` | `https://devcollab.vercel.app` (same value) |

   Rules: start with `https://`, **no** slash at the end, no spaces.
3. Click **Save, rebuild, and deploy**. Wait for **Live**.

**What each one does:**
- `CLIENT_URLS` is the list of websites allowed to call your API. Anything else gets "CORS origin denied".
- `CLIENT_URL` is used to build links inside emails and to redirect after Google/GitHub sign-in.

> If you later add a custom domain, put both in `CLIENT_URLS`, separated by a comma: `https://devcollab.vercel.app,https://www.mydomain.com`.

---

## Part 8: Test everything

### 8.1 Automated smoke test (from your laptop)

This script talks to the **live** backend. It registers a test user, creates a room, opens a live socket and joins the room.

```powershell
cd "C:\All Projects\DevCollab"
$env:API_URL = "https://devcollab-api.onrender.com"   # your BACKEND URL
node scripts/smoke.mjs
Remove-Item Env:API_URL
```

The last line should read `🎉 Smoke test passed completely! All core systems operational.` The test leaves a user with an email like `smoke_17...@devcollab.local` in your database; it's harmless.

> It needs `backend/node_modules`. If it says it can't find `socket.io-client`, run `npm install` inside `backend` first (Part 2.1).

### 8.2 Manual checklist in the browser

Use **Chrome, Edge or Firefox** for this first test. Safari has a known limitation, explained in [Part 13](#part-13-limits-of-the-free-setup).

| # | Do this | Expected |
|---|---|---|
| 1 | Open your Vercel URL | Landing page loads, with no red errors in DevTools (F12 → Console) |
| 2 | Register with your **real** email | You're logged in |
| 3 | Check your inbox (and **spam** folder) | A verification email arrives within a minute. Click the link: "email verified" |
| 4 | Create a new room | The editor opens and shows code highlighting |
| 5 | Type some code and wait 5 seconds, then **reload the page** | You're still logged in and the code is still there |
| 6 | Open the same room URL in a **private/incognito window of a different browser** (e.g. Firefox if you used Chrome), or send an invite link to a friend | After the other person signs up and joins, you each see the other's typing and cursor live |
| 7 | Add a comment on a line and click **Resolve** | The other window updates instantly |
| 8 | Click **Run** on a small program | Output appears in the console drawer |
| 9 | Log out, then click **Forgot password** | A reset email arrives; the link lets you set a new password |
| 10 | Render → **Logs** | No repeated red `error` lines |

If all 10 pass, **your app is live.** 🎉

---

## Part 9: Optional: Google and GitHub sign-in

Skip this whole part if email + password login is enough for you. The **Continue with Google/GitHub** buttons just show an error until it's set up.

Both providers need the exact **callback URL** of your backend:

```
Google:  https://YOUR-BACKEND.onrender.com/auth/google/callback
GitHub:  https://YOUR-BACKEND.onrender.com/auth/github/callback
```

They also need `API_URL` to be set on Render (Part 5.5). It must match the start of these URLs exactly.

### 9.1 GitHub (easier, about 3 minutes)

1. Go to GitHub → profile picture → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Fill in:
   - **Application name:** `DevCollab`
   - **Homepage URL:** your FRONTEND URL
   - **Authorization callback URL:** `https://YOUR-BACKEND.onrender.com/auth/github/callback`
3. Click **Register application**.
4. Copy the **Client ID**. Click **Generate a new client secret** and copy it. It's shown only once.
5. On Render, add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, then save and redeploy.

> DevCollab only accepts GitHub accounts with a **verified** email address. That's a security rule, not a bug.

### 9.2 Google (about 10 minutes)

1. Go to **console.cloud.google.com**. Click the project dropdown at the top, then **New Project**, name it `DevCollab` and click **Create**. Make sure it's selected.
2. Open the menu (☰) and go to **APIs & Services → OAuth consent screen**. Newer layouts call this **Google Auth Platform**; click **Get started**.
   - App name: `DevCollab`. User support email: yours.
   - Audience / User type: **External**.
   - Contact email: yours. Accept the policy and click **Create**.
3. Under **Audience**, the app starts in **Testing** mode. Only emails you add under **Test users** can sign in. Add your own email.
   - When you're ready for everyone, click **Publish app**. Apps that only ask for name, email and profile picture normally don't need Google's review.
4. Go to **Clients** (or **Credentials → Create Credentials → OAuth client ID**):
   - Application type: **Web application**. Name: `DevCollab web`.
   - **Authorized redirect URIs → Add URI:** `https://YOUR-BACKEND.onrender.com/auth/google/callback`
   - You can leave "Authorized JavaScript origins" empty.
   - Click **Create**.
5. Copy the **Client ID** and **Client secret**.
6. On Render, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then save and redeploy.

**Test:** on your site, click **Continue with Google**. You should come back logged in.

The most common error is `redirect_uri_mismatch`. It means the URL in step 4 doesn't **exactly** match `API_URL` + `/auth/google/callback`. Check for `http` vs `https`, a typo in the name, or a trailing slash.

---

## Part 10: Optional: AI code review

The **AI Review** button sends room code to an AI model. This **costs real money per request**: you pay the AI provider, not Render.

1. Create an account at **console.anthropic.com**, add billing credit, then go to **API Keys → Create Key** and copy it.
2. On Render, add:

   | Key | Value | Notes |
   |---|---|---|
   | `AI_PROVIDER` | `anthropic` | (`openai` also works with an OpenAI key) |
   | `AI_API_KEY` | your key | Secret. Never commit it |
   | `AI_DAILY_REQUEST_LIMIT` | `20` | A hard cap per day for the whole server, so a bug or abuse can't run up a big bill |
   | `AI_EFFORT` | `medium` | Optional. `high` (the default) gives more thorough reviews but uses more tokens; `low` is cheapest |

3. Save and redeploy.

The default model is `claude-opus-5-5`. You can set `AI_MODEL` to change it, but leave it unset unless you have a reason.

Set a monthly **spend limit** in the Anthropic console (**Settings → Limits**) as a second safety net.

---

## Part 11: Updating the app later

### 11.1 Normal workflow

```powershell
# make changes, then:
git add -A
git commit -m "Describe what you changed"
git push origin main
```

Render and Vercel both notice the push and redeploy automatically. The backend takes a few minutes and the frontend about 1 minute.

> While Render swaps servers, people in a room may see "reconnecting" for a few seconds. Unsaved edits are flushed to the database before the old server stops.

### 11.2 Changing settings

- **Render env var:** Environment → edit → **Save, rebuild, and deploy**.
- **Vercel env var:** Project → **Settings → Environment Variables** → edit. Then **Deployments** → the latest one → **⋯ → Redeploy**. This is required because `VITE_` values are built into the site.

### 11.3 Rolling back a bad deploy

- **Render:** **Events** (or **Deploys**) → find the last good deploy → **Rollback**.
- **Vercel:** **Deployments** → last good one → **⋯ → Promote to Production** (or **Instant Rollback**).

### 11.4 Backups

The free M0 cluster does **not** include automatic backups. Once real users depend on the app, you have two options:
- Upgrade the cluster (paid tiers include backups), or
- Export now and then with `mongodump` (MongoDB Database Tools):
  ```powershell
  mongodump --uri "YOUR_MONGO_URI" --out "C:\Backups\devcollab-2026-11-15"
  ```

---

## Part 12: Troubleshooting

**First step for any problem:** Render → `devcollab-api` → **Logs**, plus the browser's **F12 → Console** and **Network** tabs. The error message almost always names the cause.

### The backend won't start, or `/readyz` fails

| Log message | Cause | Fix |
|---|---|---|
| `Environment validation failed: - JWT_ACCESS_SECRET: ...at least 32 characters` | Secret missing or too short | Generate it again (Part 1.3) |
| `Environment validation failed: - MONGO_URI: ...` | Key misspelled or missing | It must be exactly `MONGO_URI` |
| `bad auth : authentication failed` | Wrong DB user or password in the URI | Recheck Part 3.4; reset the user's password in Atlas if unsure |
| `querySrv ENOTFOUND` / `ECONNREFUSED` | Typo in the cluster address | Copy the string from Atlas again |
| `Server selection timed out` / `IP ... not whitelisted` | Atlas network access | Part 3.3: `0.0.0.0/0` must be **Active** |
| Deploy fails at `Dockerfile not found` | Wrong paths | Dockerfile Path `./backend/Dockerfile`, context `./backend`, Root Directory empty |

### Browser console says "CORS" or "CORS origin denied"

`CLIENT_URLS` on Render doesn't match the address in the browser bar exactly.
- ✅ `https://devcollab.vercel.app`
- ❌ `https://devcollab.vercel.app/` (trailing slash)
- ❌ `http://devcollab.vercel.app` (not https)
- ❌ A Vercel *preview* URL instead of the production one

Fix the value, then **Save, rebuild, and deploy**.

### Requests go to `localhost:5000` or `undefined/users/login`

`VITE_API_URL` was missing when Vercel built the site. Add it (Part 6.3), then **redeploy** (Part 11.2).

### I log in, but I'm logged out again after reloading the page

1. Check that `COOKIE_SAMESITE=none` and `NODE_ENV=production` are set on Render.
2. Are you using **Safari**, or an **incognito** window? See [Part 13](#part-13-limits-of-the-free-setup).
3. Chrome: check that third-party cookies aren't blocked under **Settings → Privacy → Third-party cookies**.

### Emails never arrive

1. Check your **spam** folder first.
2. Render logs show `MAIL_TRANSPORT is not 'smtp' with SMTP_URL set`: one of the two is missing or blank.
3. Logs show `Invalid login` / `535 Authentication failed`: you used the API key instead of the SMTP key, or forgot `%40` in the login (Part 4.3).
4. Logs show `Connection timeout` / `ETIMEDOUT`: the port is not `2525`. Render's free tier blocks 25, 465 and 587.
5. Logs show `sender not valid`: `MAIL_FROM` isn't a verified Brevo sender (Part 4.1).
6. Brevo dashboard → **Transactional → Logs** shows whether Brevo received and delivered the email.

### Everyone gets "Too many requests" right away

`TRUST_PROXY` is missing on Render. Without it, every visitor appears to have the same IP address and shares one limit. Set `TRUST_PROXY=1` and redeploy.

### The site is slow, or the first request takes 30–60 seconds

That's the Render free tier waking up. See Part 13.

### The editor area is blank

Open F12 → Console. If you see `Refused to load the script ... cdn.jsdelivr.net`, the build didn't include the self-hosted editor files. Make sure `VITE_MONACO_BASE` is **not** set on Vercel, then redeploy.

### "Live collaboration" doesn't sync between two windows

- F12 → Network → **WS** tab: there should be a `socket.io` connection with status 101.
- If it shows a CORS or 403 error, it's the same fix as the CORS section above.
- If you're not logged in on both sides, check that the second account was actually invited to the room.

---

## Part 13: Limits of the free setup

You should know these before you invite real users.

| Limit | What happens | Fix when it matters |
|---|---|---|
| **Render sleeps after 15 min without traffic** | The first visitor afterwards waits 30–60 s while the server wakes up. Open rooms are saved before it sleeps, so no data is lost | Render **Starter** plan (~$7/month) stays on 24/7 |
| **Render free: 512 MB RAM, 0.1 CPU** | Fine for a few dozen people at once, not hundreds | Upgrade the instance type |
| **Safari and incognito windows** | Your frontend (`vercel.app`) and backend (`onrender.com`) are different websites, so the login cookie counts as a "third-party cookie". **Safari blocks these** (as do incognito windows in most browsers). Users can log in with email and password, but are **logged out when they reload the page or after 15 minutes**, and Google/GitHub sign-in fails | Buy a domain (~$10/year) and serve both from it, e.g. `app.mydomain.com` (Vercel) and `api.mydomain.com` (Render). Then the cookie is first-party. Steps: add both as custom domains in Vercel and Render, update `VITE_API_URL`, `API_URL`, `CLIENT_URL(S)` and the OAuth callback URLs, set `COOKIE_SAMESITE=lax`, and redeploy both |
| **Atlas M0: 512 MB storage, no backups** | Plenty for a small group; no point-in-time restore | Upgrade the cluster, or run `mongodump` regularly (Part 11.4) |
| **Brevo free: 300 emails/day** | Enough for sign-ups and resets of a small user base | Paid Brevo plan |
| **Code "Run" uses the public Wandbox service** | Users' code is sent to a third party; don't run code that contains secrets | — |
| **Update deploys sign nobody out, but *this* first deploy does** | Anyone who used an older version of the app has to log in once more | Nothing to fix |

### Final checklist

- [ ] Smoke test passes (Part 8.1)
- [ ] All 10 manual checks pass (Part 8.2)
- [ ] `TRUST_PROXY=1`, `MAIL_TRANSPORT=smtp`, `SMTP_URL`, `API_URL` and `COOKIE_SECRET` are set on Render
- [ ] Your notes file is **outside** the project and not committed
- [ ] (Optional) Google/GitHub sign-in works
- [ ] (Optional) AI review works and a spend limit is set at the provider

For the architecture and more advanced options (Docker Compose, Redis for multiple servers, monitoring), see [DEPLOYMENT.md](./DEPLOYMENT.md). For what each security setting does, see [SECURITY.md](./SECURITY.md).
