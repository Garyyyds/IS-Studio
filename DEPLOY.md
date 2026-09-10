# Deploying to Render

The repo is already committed and deploy-ready. Four steps remain, all in a browser.

## 1. Create the Supabase database

Render's free tier wipes the disk on every restart, so the app's local
`data/server-storage.json` cannot be trusted in production. Supabase holds the
real data.

1. Go to <https://supabase.com> → **New project**. Any region near you; free tier.
2. Wait for it to finish provisioning (~2 min).
3. Open **SQL Editor** → **New query**, paste the whole of
   [`supabase-setup.sql`](./supabase-setup.sql), and hit **Run**.
   This creates the `workspace_data` and `app_users` tables.
4. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `SUPABASE_URL`
   - **anon / public** key → this is `SUPABASE_ANON_KEY`

## 2. Get a Gemini API key

<https://aistudio.google.com/apikey> → **Create API key**. This is `GEMINI_API_KEY`.
Without it the AI triage and runbook-generation features return a 500; the rest
of the app still works.

## 3. Push the code to GitHub

```bash
# Create an EMPTY repo at https://github.com/new  (Private is recommended)
# Do NOT add a README or .gitignore there — this repo already has commits.

git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 4. Create the Render service

1. Go to <https://dashboard.render.com> → **New** → **Web Service**.
2. Connect your GitHub account and pick the repo you just pushed.
3. Render reads [`render.yaml`](./render.yaml) and fills in the build and start
   commands automatically. If it does not, set them by hand:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Runtime:** Node
4. Under **Environment**, add these four variables:

   | Key | Value |
   | --- | --- |
   | `GEMINI_API_KEY` | from step 2 |
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_ANON_KEY` | from step 1 |
   | `APP_URL` | your Render URL, e.g. `https://is-studio.onrender.com` |

   `NODE_ENV=production` and `NODE_VERSION=22` come from `render.yaml`.
   You will only know `APP_URL` after the first deploy — deploy once, copy the
   URL Render gives you, then set it and let it redeploy.

5. Click **Create Web Service** and watch the log until it prints
   `IT TaskFlow server running at http://0.0.0.0:<port>`.

## 5. Verify

- `https://<your-app>.onrender.com/api/health` → `{"status":"ok",...}`
- `https://<your-app>.onrender.com/api/data/status` → check that
  `"storageType"` reads `"supabase"` and `supabase.connected` is `true`.
  If it says `"file"`, your Supabase env vars are wrong or the SQL did not run.

## Security: do this before sharing the URL

The app ships seeded demo accounts with weak, publicly-known passwords —
`admin@company.com` / `admin123` and `sarah.chen@company.com` / `user123`
(see `DEFAULT_USERS` in `server.ts`). Anyone who finds your URL can sign in as
an admin.

Passwords are also stored and compared in **plain text**, in both the JSON file
and the `app_users` table. There is no hashing anywhere in the auth path.

Before this is reachable by anyone else:

1. Register your own admin account, then delete the seeded rows from the
   `app_users` table in Supabase.
2. Treat every stored password as readable by anyone with database access.
   If this handles real staff accounts, the auth layer needs bcrypt/argon2
   hashing before it goes live — that is a code change, not a deploy setting.

## Free-tier note

Render's free web services sleep after ~15 minutes of inactivity. The first
request after that takes 30–60 seconds to wake. A paid instance removes this.

## Running locally

```bash
npm install
cp .env.example .env    # then fill in the keys
npm run dev             # http://localhost:3000
```
