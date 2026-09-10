# Deploying to Render

Status: the repo is committed, the build is verified, and Supabase is **already
live and connected**. Three steps remain, all in a browser.

## 1. Supabase — DONE ✅

Project `rfeekheavantjnfszmmx` is provisioned, both tables (`workspace_data`,
`app_users`) exist and already hold real data. Verified end to end: the server
reports `storageType: "supabase"`, `connected: true`.

You do **not** need to run [`supabase-setup.sql`](./supabase-setup.sql) — it is
kept only as a reference for rebuilding the schema from scratch.

Credentials are in your local `.env` (gitignored, never committed). You will
paste the same two values into Render in step 3.

## 2. Get a Gemini API key — still needed

<https://aistudio.google.com/apikey> → **Create API key**. This is `GEMINI_API_KEY`.
Without it, AI triage and runbook generation return a 500; everything else works.

## 3. Push the code to GitHub

```bash
# Create an EMPTY repo at https://github.com/new  — choose PRIVATE.
# Do NOT add a README or .gitignore there — this repo already has commits.

git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Private matters here: `server.ts` contains seeded demo credentials (see the
security section below).

## 4. Create the Render service

1. <https://dashboard.render.com> → **New** → **Web Service**.
2. Connect GitHub, pick the repo.
3. Render reads [`render.yaml`](./render.yaml) and fills in build/start commands.
   If it does not, set them by hand:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Runtime:** Node
4. Under **Environment**, add these variables:

   | Key | Value |
   | --- | --- |
   | `GEMINI_API_KEY` | from step 2 |
   | `SUPABASE_URL` | `https://rfeekheavantjnfszmmx.supabase.co` |
   | `SUPABASE_ANON_KEY` | the anon key in your local `.env` |
   | `APP_URL` | not used by the code — safe to skip |

   `NODE_ENV=production` and `NODE_VERSION=22` come from `render.yaml`.

   `APP_URL` is **not referenced anywhere in the code** — it is leftover from
   the AI Studio template this project came from. Setting it is harmless but
   has no effect.

   Only the two Supabase values are load-bearing. Without them the app falls
   back to file storage on Render's ephemeral disk and loses every ticket on
   each restart or redeploy — silently, which is what makes it dangerous.

5. **Create Web Service**, then watch the log for
   `IT TaskFlow server running at http://0.0.0.0:<port>`.

## 5. Verify

- `https://<your-app>.onrender.com/api/health` → `{"status":"ok",...}`
- `https://<your-app>.onrender.com/api/data/status` → `"storageType"` must read
  `"supabase"` and `supabase.connected` must be `true`. If it says `"file"`,
  the env vars did not take.

---

## Security — read before the URL is reachable by anyone else

Three real issues, in priority order. None of these block deployment, but all
three are live right now in the existing Supabase project.

### 1. Passwords are stored in plain text

`app_users.password` holds real, unhashed passwords for real accounts — I
confirmed this against the live database. `server.ts` compares them with
`data.password === password`. There is no hashing anywhere in the auth path.

Anyone who can read that table can read every user's actual password, and
people reuse passwords across services. Fixing this means hashing with
bcrypt/argon2 on register and comparing hashes on login, plus a forced reset of
every existing account. It is a code change, not a deploy setting.

### 2. Row Level Security is enabled but wide open

Both tables use `FOR ALL USING (true) WITH CHECK (true)` — RLS is on, but the
policy permits everything. Combined with issue 1, **anyone holding the anon key
can read and write every account row, including passwords**.

The anon key is designed to be publicly distributable, so it must never be the
only thing standing between the internet and a password column. In this app's
architecture the key is at least server-side only — it is not in the frontend
bundle (verified) — but it should still be treated as compromised if it has
ever been pasted into a chat, ticket, or email. Rotate it in
**Supabase → Project Settings → API**, then update `.env` and the Render env var.

A tighter policy would deny anon access to `app_users` entirely and let only the
service-role key touch it.

### 3. Seeded demo accounts with published passwords

`DEFAULT_USERS` in `server.ts` seeds `admin@company.com` / `admin123` and
`sarah.chen@company.com` / `user123`. These are in the source, so anyone with
repo access — or anyone who guesses — gets an admin login. Register your own
admin account, then delete the seeded rows from `app_users`.

---

## Free-tier note

Render free web services sleep after ~15 minutes idle; the first request after
that takes 30–60s to wake. A paid instance removes this.

## Running locally

```bash
npm install
npm run dev             # http://localhost:3000
```

`.env` is already populated with the Supabase credentials. Add `GEMINI_API_KEY`
to enable the AI features.
