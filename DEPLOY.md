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

## Security

### 1. Password hashing — FIXED ✅

Passwords are now hashed with bcrypt (cost 10) on register, password reset and
profile update, and verified with `bcrypt.compare` on login. They were
previously written and compared as plain text in both Supabase and the local
JSON store.

**Existing accounts need no manual reset.** Any password still stored as
plaintext is detected on the owner's next successful login and transparently
re-stored as a hash. Their existing password keeps working.

Two accounts were still plaintext at the time of writing
(`kaixian.tan@qiu.edu.my`, `ongyeemun@gmail.com`); both convert automatically
the next time each person logs in. Until they do, those two rows remain
readable — see issue 2.

### 2. Row Level Security is enabled but wide open — STILL OPEN ⚠️

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

### 3. Seeded demo accounts — FIXED ✅

`DEFAULT_USERS` seeded `admin@company.com` / `admin123` plus two others. These
were never rows in Supabase — they were injected at runtime from the source
code, and because login falls back to local file storage when Supabase has no
matching user, they were a **working admin login on any deployment of this
code**. `DEFAULT_USERS` is now empty and the accounts were removed from
`data/server-storage.json`. Verified: that login now returns 404.

---

## AI quota limits

The Gemini free tier is tighter than it looks, and it shapes what this app can
do:

- **~5 requests per minute** per model
- **A daily cap** as well — reached during setup testing, which returns 429
  until it resets

The server now retries transient failures (429/503/500/504) with backoff and
honours the `retryDelay` Google returns, capped at 12s so a browser request is
never held open for a full quota window. Beyond that it returns an accurate
error: a per-minute throttle says how many seconds to wait, while daily
exhaustion says so plainly instead of implying a short retry will help.

If the team hits these limits in normal use, enabling billing on the Google
Cloud project raises them substantially.

### Switching model when a quota runs out

Quotas are counted **per model** (`GenerateRequestsPerDayPerProjectPerModel`),
so moving to a different model grants a fresh daily allowance straight away.
The model is not hardcoded — set `GEMINI_MODEL` in `.env` locally or as a Render
env var:

```
GEMINI_MODEL="gemini-3.6-flash"
```

Verified working on this key:

| Model | Notes |
| --- | --- |
| `gemini-3.7-flash` | default; daily quota exhausted during setup testing |
| `gemini-3.6-flash` | currently in use locally, quality equivalent |
| `gemini-3.5-flash` | available |
| `gemini-3.5-flash-lite` | fastest and cheapest, lower reasoning quality |

`gemini-2.5-flash` and `gemini-2.5-flash-lite` return 404 for this key — do not
use them. The model in use is printed at startup, so Render's log confirms which
one a deploy picked up.

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
