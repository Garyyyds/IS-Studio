# Deployment SOP — IT TaskFlow

Standard operating procedure to take this app from the local machine to a live
Render URL, and to harden the Supabase credentials afterwards.

| | |
| --- | --- |
| **Estimated time** | ~15 minutes |
| **Cost** | £0 / $0 — every service used here is free tier |
| **Prerequisites** | A GitHub account, a web browser, this repo on your machine |

**Do the parts in order.** Part 2 cannot start until Part 1 is finished, because
Render deploys *from* a GitHub repository.

---

## Before you start — what is already done

Do not redo these. They are committed and verified:

- Node 24 installed; dependencies installed
- `PORT` reads from the environment (Render assigns it)
- Frontend builds to `dist/public`, so the backend bundle is not publicly served
- Passwords hashed with bcrypt; legacy plaintext upgrades automatically on login
- Seeded `admin@company.com` / `admin123` backdoor removed
- Gemini calls retry on 429/503 and return accurate errors
- `GEMINI_MODEL` accepts a fallback chain; a model out of daily quota hands off
  to the next automatically
- Supabase connected and verified (`storageType: "supabase"`)
- Git repo initialised with all work committed

### Where the secret values live

Every credential you need is in your local **`.env`** file. Open it and keep it
to hand — you will paste from it in Part 2.

`.env` is gitignored and must stay that way. **Never** paste real keys into
`DEPLOY.md`, `render.yaml`, or any other committed file.

---

## Part 1 — Push to GitHub

**Purpose.** Render has no folder upload; its pipeline is *clone repo → build →
start*, so the repository is the delivery mechanism. It also gives you automatic
redeploys on every push, and one-click rollback to any earlier commit.

### 1.1 Create an empty repository

1. Go to <https://github.com/new>
2. **Repository name:** `is-studio` (or your preference)
3. **Visibility:** select **Private**
4. **Do not tick** "Add a README file", "Add .gitignore", or "Choose a license"
5. Click **Create repository**

> **Why private.** Git history still contains the old plaintext-password code
> and the seeded `admin123` account. Later commits do not erase history.

> **Why no README.** Those options create an initial commit on GitHub. This repo
> already has commits, so the two histories collide and the push is rejected.

### 1.2 Push

In the project folder, run:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If GitHub prompts for a password, it wants a **Personal Access Token**, not your
account password. Create one at <https://github.com/settings/tokens> with the
`repo` scope, and paste that as the password.

### 1.3 Verify

Refresh the GitHub page. You should see the project files and a commit count
above 8. Confirm **`.env` is NOT listed** — if it appears, stop and fix that
before continuing, because your keys are now published.

---

## Part 2 — Deploy on Render

**Purpose.** This is the actual hosting. Render installs dependencies, builds
the frontend and backend, then keeps the Node process running behind a public
HTTPS URL.

### 2.1 Create the account

1. Go to <https://dashboard.render.com>
2. Sign up — **choose "Sign up with GitHub"**, which handles Part 2.2 at the
   same time
3. Verify your email if prompted

No credit card is required for the free tier.

### 2.2 Connect the repository

If you did not sign up with GitHub, connect it now: **Dashboard → New → Web
Service → Connect GitHub**. This installs Render's GitHub App. Grant access
either to all repositories or just the one from Part 1.

### 2.3 Create the web service

1. **New** → **Web Service**
2. Select your repository
3. Render reads [`render.yaml`](./render.yaml) and fills in the settings. If it
   does not, set them manually:

   | Field | Value |
   | --- | --- |
   | Runtime | `Node` |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | `Free` |

### 2.4 Add environment variables

Still on the creation page, open **Environment** / **Advanced** and add four
variables. **Copy each value from your local `.env` file.**

| Key | Where to get the value |
| --- | --- |
| `GEMINI_API_KEY` | `.env` — starts with `AQ.` |
| `SUPABASE_URL` | `.env` — the `https://….supabase.co` URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` — the `sb_secret_…` key |
| `GEMINI_MODEL` | `gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash` |

Notes:

- `NODE_ENV=production` and `NODE_VERSION=22` come from `render.yaml` — do not
  add them by hand.
- **Do not set `APP_URL`.** It is unused by the code (leftover template config).
- `GEMINI_MODEL` takes a comma-separated chain, tried in order. The default
  `gemini-3.7-flash` had its daily quota exhausted during setup testing. Quotas
  are counted per model, so the next model in the chain still has its own
  allowance and the app fails over to it without intervention.

### 2.5 Deploy

Click **Create Web Service**. The first build takes 3–5 minutes.

Watch the log until you see both lines:

```
IT TaskFlow server running at http://0.0.0.0:10000
Gemini models (in order): gemini-3.7-flash -> gemini-3.6-flash -> gemini-3.5-flash
```

### 2.6 Verify — do not skip this

Replace `<your-app>` with your Render URL.

| Check | Expected |
| --- | --- |
| `https://<your-app>.onrender.com/` | The app loads |
| `…/api/health` | `{"status":"ok",…}` |
| `…/api/data/status` | `"storageType":"supabase"` and `"connected":true` |

**The third check is the important one.** If `storageType` reads `"file"`, the
Supabase variables did not take effect. The app will appear to work and then
lose every ticket on the next restart. Fix the env vars and redeploy before
letting anyone use it.

Then log in with a real account and confirm your existing tickets appear.

---

## Part 3 — Harden the Supabase credentials

**Purpose.** The current anon key has been shared in plain text, and the
database's row-level security policy permits everything, so that key grants full
read *and write* access to every table — including the password column.

Do this **after** Part 2 is working, so you are not debugging two things at once.

### 3.1 Switch to a secret key — DONE ✅

Legacy `anon`/`service_role` JWT keys **can no longer be rotated** in Supabase;
they are being retired entirely. The replacement is the new key pair:

| Legacy | Replacement |
| --- | --- |
| `anon` | `sb_publishable_…` — browser-safe, respects RLS |
| `service_role` | `sb_secret_…` — server-only, bypasses RLS, independently revocable |

This server runs server-side only, so it uses a **secret key**, set as
`SUPABASE_SERVICE_ROLE_KEY`. `SUPABASE_ANON_KEY` has been removed from both
Render and `.env`. Verified live: the app runs with the secret key alone.

`getSupabase()` deliberately reads `SUPABASE_SERVICE_ROLE_KEY` **before**
`SUPABASE_ANON_KEY`, so adding the secret key takes effect immediately even if
an old anon key is still configured. Switching keys is additive and cannot
break login through ordering.

### 3.2 Deactivate the legacy anon key — STILL TO DO ⚠️

The old anon key still exists and still works. Until it is deactivated, anyone
holding a copy has full read/write on every table.

1. Supabase → **Settings** → **API Keys**
2. Find the legacy `anon` key → **Deactivate**

This is **reversible** — it can be reactivated if anything unexpected breaks.
Nothing in this app uses it any more, so nothing should.

### 3.3 Let both users log in — STILL TO DO ⚠️

Passwords stored as plaintext convert to bcrypt automatically on each user's
next successful login. Both accounts were still plaintext at the time of
writing. Ask both to log in once at the Render URL. Their existing passwords
keep working — nothing changes for them.

### 3.4 Close the underlying hole

The policy created with the original schema permits everything:

```sql
CREATE POLICY "Allow user sync" ON app_users FOR ALL USING (true) WITH CHECK (true);
```

`USING (true)` means any holder of a *publishable/anon* key can read every row
of `app_users`. Now that the server authenticates with a secret key — which
bypasses RLS entirely — that policy can be dropped without affecting the app.

Supabase → **SQL Editor** → run:

```sql
-- The server uses a secret key and bypasses RLS, so it keeps working.
-- Anon/publishable keys lose all access to user accounts.
DROP POLICY IF EXISTS "Allow user sync" ON app_users;
```

Then re-run the Part 2.6 checks and log in once to confirm.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Push rejected, "fetch first" | GitHub repo was created with a README | `git push -u origin main --force`, or delete the repo and redo 1.1 |
| Build fails, `vite: not found` | Build command wrong | Must be `npm install && npm run build` |
| Build fails, `Cannot find module 'bcryptjs'` | Install did not run from `package-lock.json` | Confirm build command; `bun.lock` was removed deliberately |
| `storageType` is `"file"` | Supabase env vars missing or misspelled | Re-check both in Render; names are case-sensitive |
| Login fails for everyone | Supabase key missing or wrong | Confirm `SUPABASE_SERVICE_ROLE_KEY` is set on Render |
| AI returns 429 | Every model in the chain is out of quota | Add another model to the `GEMINI_MODEL` chain; quotas are per model |
| First load takes 30–60s | Render free tier sleeps after 15 min idle | Expected. $7/month removes it |
| App broken after a quiet week | Supabase free project paused | Restore from the Supabase dashboard; see below |

---

## After deployment — the one thing that will bite you later

**A free Supabase project is paused after 7 days without database activity**, and
a paused project is unreachable until manually restored from the dashboard.
Supabase emails a warning roughly a week beforehand.

This is the most likely way this deployment fails months from now: a quiet week
or a holiday, and the app breaks with the cause long forgotten. A few queries a
day prevents it.

**This is handled.** [`.github/workflows/keep-alive.yml`](./.github/workflows/keep-alive.yml)
runs every third day, calls `/api/data/status`, and that endpoint performs a
real Supabase query — resetting the pause timer. It needs no secrets, since the
URL is public and the response contains nothing sensitive.

Two things to know about it:

- GitHub disables scheduled workflows in repositories with **no activity for 60
  days**. If the repo goes untouched that long, re-enable it under the Actions
  tab.
- It can be run on demand: **Actions → Keep alive → Run workflow**.

The original description, for reference: the standard free fix is a GitHub
Actions cron in this repo that pings Supabase
on a schedule. Ask and it can be added — it needs no new paid service.

---

## Reference

### Local development

```bash
npm install
npm run dev     # http://localhost:3000
```

`.env` is already populated.

### Gemini free-tier limits

- ~5 requests per minute, per model
- A separate daily cap, per model

Verified working on this key: `gemini-3.7-flash`, `gemini-3.6-flash`,
`gemini-3.5-flash`, `gemini-3.5-flash-lite` (fastest, weakest reasoning).
`gemini-2.5-flash` and `gemini-2.5-flash-lite` return 404 — do not use them.

The model in use is printed at startup, so Render's log confirms which one a
deploy picked up.

### Free-tier costs

| Service | Free tier | Paid upgrade |
| --- | --- | --- |
| GitHub | Unlimited private repos | — |
| Render | 750 instance hrs/month, sleeps after 15 min | $7/mo always-on |
| Supabase | 500MB DB, pauses after 7 days idle | $25/mo Pro, no pausing |
| Gemini | ~5 req/min, daily cap | Enable Google Cloud billing |

If this becomes something the team depends on daily, **Supabase Pro is the first
thing worth paying for** — a slow first load is an annoyance, a silently paused
database is an outage.
