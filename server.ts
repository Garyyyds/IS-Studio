import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import {
  CHAT_KNOWLEDGE_MAX_CHARS,
  CHARS_PER_TOKEN,
  type ChatKnowledgeMode,
  isActiveRunbook,
  knowledgeBaseText,
  selectScopedRunbooks,
} from './src/utils/knowledgeBase';
import { checkGeneratedSop, type GeneratedSop } from './src/utils/sopDraft';
import { IT_CATEGORIES } from './src/types';
import { RepositoryError, WorkspaceRepository } from './db/repository';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'server-storage.json');

// Lazy Supabase client initialization
let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  // Prefer the service-role/secret key. It is server-only and bypasses RLS,
  // which lets the anon key's access be revoked without breaking the server.
  // Deliberately checked first so that adding it takes effect immediately,
  // even if an older SUPABASE_ANON_KEY is still configured alongside it.
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) {
    return null;
  }
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return supabaseClient;
}

const BCRYPT_ROUNDS = 10;

// A bcrypt digest is always 60 chars and starts with a $2a$/$2b$/$2y$ version
// tag. Anything else in the password column is a legacy plaintext value from
// before hashing was introduced.
function isHashed(value: string): boolean {
  if (typeof value !== 'string' || value.length !== 60) return false;
  return value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$');
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(String(plain).trim(), BCRYPT_ROUNDS);
}

// Returns { ok, needsUpgrade }. needsUpgrade is true when the stored value was
// still plaintext and matched, so the caller can transparently re-store it as a
// hash without forcing existing users to reset their password.
async function verifyPassword(
  plain: string,
  stored: string
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  const candidate = String(plain).trim();
  if (!stored) return { ok: false, needsUpgrade: false };
  if (isHashed(stored)) {
    return { ok: await bcrypt.compare(candidate, stored), needsUpgrade: false };
  }
  const matches = stored === candidate;
  return { ok: matches, needsUpgrade: matches };
}

// Re-store a legacy plaintext password as a bcrypt hash. Best-effort: a failure
// here must never block an otherwise valid login.
async function upgradeStoredPassword(email: string, plain: string) {
  try {
    const hashed = await hashPassword(plain);
    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('app_users').update({ password: hashed }).ilike('email', email);
    }
    const stored = getStoredData() || {};
    const users = stored.users || [];
    const idx = users.findIndex((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (idx >= 0) {
      users[idx].password = hashed;
      saveStoredData({ ...stored, users });
    }
    console.log('Upgraded plaintext password to bcrypt for', email);
  } catch (err) {
    console.warn('Password upgrade skipped for', email, err);
  }
}

// Intentionally empty. This previously held demo accounts with hardcoded
// passwords (admin@company.com / admin123 and two others). Because login falls
// back to local file storage when Supabase has no matching user, those seeded
// credentials were a working admin login on any deployment of this code.
// Real accounts live in Supabase (app_users) and are created via /api/auth/register.
const DEFAULT_USERS: any[] = [];

// Ensure data directory and file exist
function getStoredData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
        parsed.users = DEFAULT_USERS;
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading server-storage.json:', err);
  }
  return null;
}

function saveStoredData(data: any) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const current = getStoredData() || {};
  const payload = {
    tasks: data.tasks !== undefined ? data.tasks : (current.tasks || []),
    runbooks: data.runbooks !== undefined ? data.runbooks : (current.runbooks || []),
    rules: data.rules !== undefined ? data.rules : (current.rules || []),
    settings: data.settings !== undefined ? data.settings : (current.settings || {}),
    users: data.users !== undefined ? data.users : (current.users || DEFAULT_USERS),
    lastSaved: new Date().toISOString(),
    version: 1
  };
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  return payload;
}

// Gemini's free tier returns 503 (capacity) and 429 (per-minute rate limit)
// regularly. Both are transient, so retry with exponential backoff rather than
// surfacing a 500 that looks to the user like an application bug.
// Free-tier request quotas are counted per model, so switching models gives a
// fresh allowance. Overridable via env so the model can be changed on Render
// without a code change or redeploy of new source.
// GEMINI_MODEL accepts either one model or a comma-separated fallback chain,
// e.g. "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash". Free-tier quotas
// are counted per model, so when one model's daily allowance is spent the next
// in the chain still has its own. Tried strictly in order.
const GEMINI_MODELS: string[] = (process.env.GEMINI_MODEL || 'gemini-3.7-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

// Kept for logging and anything that wants a single representative name.
const GEMINI_MODEL = GEMINI_MODELS[0];

const AI_MAX_ATTEMPTS = 4;
// Longest we will hold a request open waiting out a quota window. The free tier
// caps generate_content at 5 requests/minute, so a burst can be told to wait
// ~30-60s; blocking a browser request that long is worse than failing clearly.
const AI_MAX_WAIT_MS = 12000;

function aiErrorStatus(err: any): number | undefined {
  return err?.status ?? err?.code;
}

function isTransientAiError(err: any): boolean {
  const status = aiErrorStatus(err);
  return status === 429 || status === 500 || status === 503 || status === 504;
}

// Google returns the exact wait in a RetryInfo detail ("37s"). Honour it when
// present -- exponential backoff alone cannot clear a per-minute quota window.
function retryDelayMsFromError(err: any): number | null {
  const raw = typeof err?.message === 'string' ? err.message : '';
  const match = raw.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!match) return null;
  return Math.ceil(parseFloat(match[1]) * 1000);
}

// True when this model's allowance is gone for the rest of the day. Waiting
// cannot help, but a different model has its own separate quota.
function isDailyQuotaError(err: any): boolean {
  if (aiErrorStatus(err) !== 429) return false;
  const raw = typeof err?.message === 'string' ? err.message : '';
  return raw.includes('PerDayPerProject');
}

// Retry one model through transient failures. Throws so the caller can decide
// whether to move on to the next model in the chain.
async function generateWithModel(ai: any, request: any, model: string): Promise<any> {
  let lastError: any;
  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent({ ...request, model });
    } catch (err: any) {
      lastError = err;

      // A spent daily quota is permanent for today -- fail out immediately so
      // the caller can fall through to the next model rather than sleeping.
      if (isDailyQuotaError(err)) throw err;
      if (!isTransientAiError(err) || attempt === AI_MAX_ATTEMPTS) throw err;

      const advised = retryDelayMsFromError(err);
      const backoffMs =
        advised ?? 800 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400);

      // If Google wants us to wait longer than we are willing to hold the
      // request open, stop retrying and surface an actionable error instead.
      if (backoffMs > AI_MAX_WAIT_MS) {
        console.warn(
          'Gemini quota wait ' + backoffMs + 'ms exceeds cap on ' + model
        );
        throw err;
      }

      console.warn(
        'Gemini transient error on ' + model + ' (status ' + aiErrorStatus(err) +
        '); retrying in ' + backoffMs + 'ms [attempt ' + attempt + '/' + AI_MAX_ATTEMPTS + ']'
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}

// Walk the configured model chain. Moves to the next model when the current
// one is out of daily quota or is not available to this key (404), so a spent
// allowance degrades to a working model instead of a user-visible failure.
async function generateWithRetry(ai: any, request: any): Promise<any> {
  let lastError: any;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    try {
      const response = await generateWithModel(ai, request, model);
      if (i > 0) console.log('Gemini served by fallback model ' + model);
      return response;
    } catch (err: any) {
      lastError = err;
      // 503 means the model is overloaded; its own retries are already spent by
      // the time we get here, so another model is the best chance of an answer.
      const canFallBack = isDailyQuotaError(err) || aiErrorStatus(err) === 404 || aiErrorStatus(err) === 503;
      const nextModel = GEMINI_MODELS[i + 1];

      if (!canFallBack || !nextModel) throw err;

      console.warn(
        'Gemini model ' + model + ' unavailable (' +
        (isDailyQuotaError(err)
          ? 'daily quota spent'
          : aiErrorStatus(err) === 503
            ? 'overloaded'
            : 'not available for this key') +
        '); falling back to ' + nextModel
      );
    }
  }

  throw lastError;
}

// Turn a Gemini failure into a response the UI can show verbatim, so a quota
// pause does not read to the user as a broken app.
function sendAiError(res: any, error: any, fallbackMessage: string) {
  const status = aiErrorStatus(error);
  if (status === 429) {
    const raw = typeof error?.message === 'string' ? error.message : '';
    // Per-day and per-minute exhaustion need very different advice: one clears
    // in under a minute, the other not until the daily quota resets.
    const isDailyQuota = raw.includes('PerDayPerProject');
    if (isDailyQuota) {
      const tried = GEMINI_MODELS.length;
      return res.status(429).json({
        error:
          'The daily free-tier AI quota is used up on ' +
          (tried > 1 ? 'all ' + tried + ' configured models' : 'this model') +
          '. AI triage and runbook generation will work again after the quota ' +
          'resets' +
          (tried > 1
            ? ', or sooner if another model is added to GEMINI_MODEL.'
            : ', or sooner if more models are added to GEMINI_MODEL.'),
        quotaScope: 'daily',
        modelsTried: GEMINI_MODELS,
      });
    }
    const waitSeconds = Math.ceil((retryDelayMsFromError(error) ?? 60000) / 1000);
    return res.status(429).json({
      error:
        'AI rate limit reached (free tier allows a few requests per minute). ' +
        'Please try again in about ' + waitSeconds + ' seconds.',
      retryAfterSeconds: waitSeconds,
      quotaScope: 'minute',
    });
  }
  if (status === 503 || status === 504) {
    return res.status(503).json({
      error: 'The AI service is temporarily busy. Please try again in a moment.',
    });
  }
  return res.status(500).json({ error: error?.message || fallbackMessage });
}

// Initialize Google GenAI on server
const getAi = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Workspace data: tickets, IT Handbook, settings and forms ---
// Stored in the normalised tables from db/schema.sql (see db/repository.ts).
// Each change saves only the record it touches, so browsers no longer re-post
// the whole workspace and overwrite each other. workspace_data is no longer
// read or written; it stays in Supabase untouched until it is retired.
const WORKSPACE_COMPANY_CODE = (process.env.WORKSPACE_COMPANY_CODE || process.env.MIGRATION_COMPANY_CODE || 'EDGC').trim();

let repository: WorkspaceRepository | null = null;
function getRepository(): WorkspaceRepository {
  const supabase = getSupabase();
  if (!supabase) {
    throw new RepositoryError(503, 'Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (!repository) repository = new WorkspaceRepository(supabase, WORKSPACE_COMPANY_CODE);
  return repository;
}

// The signed-in account, sent by the browser, for the ticket status history.
const actorId = (req: express.Request) => {
  const id = req.get('x-user-id');
  return id && id.length <= 64 ? id : undefined;
};

function sendDataError(res: express.Response, err: unknown, action: string, fallback: string) {
  if (err instanceof RepositoryError) return res.status(err.status).json({ error: err.message });
  console.error(`Error in ${action}:`, err);
  res.status(500).json({ error: fallback });
}

app.get('/api/data', async (req, res) => {
  try {
    const workspace = await getRepository().loadWorkspace();
    res.json({ success: true, storageType: 'supabase', filePath: 'supabase:tables', ...workspace });
  } catch (err) {
    sendDataError(res, err, 'GET /api/data', 'Could not load the workspace.');
  }
});

// The old whole-workspace save. Refused so an out-of-date browser tab cannot
// write; reloading the page picks up the per-record saves.
app.post('/api/data', (req, res) => {
  res.status(410).json({ error: 'This version of the page is out of date. Reload the page to keep working.' });
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const task = req.body?.task;
    if (!task || typeof task !== 'object' || task.id !== req.params.id) {
      return res.status(400).json({ error: 'The ticket to save is missing.' });
    }
    const baseUpdatedAt = typeof req.body.baseUpdatedAt === 'string' ? req.body.baseUpdatedAt : undefined;
    const result = await getRepository().saveTicket(task, { actorId: actorId(req), baseUpdatedAt });
    if ('conflict' in result) {
      return res.status(409).json({
        error: `${result.conflict.ticketNumber} was changed by someone else while you had it open. Their version is now shown; make your change again.`,
        task: result.conflict,
      });
    }
    res.json({ task: result.task });
  } catch (err) {
    sendDataError(res, err, 'PUT /api/tickets/:id', 'Could not save the ticket.');
  }
});

app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const removed = await getRepository().deleteTickets([req.params.id]);
    res.json({ success: true, removed });
  } catch (err) {
    sendDataError(res, err, 'DELETE /api/tickets/:id', 'Could not delete the ticket.');
  }
});

app.post('/api/tickets/delete', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === 'string') : [];
    const removed = await getRepository().deleteTickets(ids);
    res.json({ success: true, removed });
  } catch (err) {
    sendDataError(res, err, 'POST /api/tickets/delete', 'Could not delete the tickets.');
  }
});

app.put('/api/runbooks/:id', async (req, res) => {
  try {
    const runbook = req.body?.runbook;
    if (!runbook || typeof runbook !== 'object' || runbook.id !== req.params.id) {
      return res.status(400).json({ error: 'The guide to save is missing.' });
    }
    res.json({ runbook: await getRepository().saveRunbook(runbook) });
  } catch (err) {
    sendDataError(res, err, 'PUT /api/runbooks/:id', 'Could not save the guide.');
  }
});

app.delete('/api/runbooks/:id', async (req, res) => {
  try {
    const removed = await getRepository().deleteRunbook(req.params.id);
    res.json({ success: true, removed });
  } catch (err) {
    sendDataError(res, err, 'DELETE /api/runbooks/:id', 'Could not delete the guide.');
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const settings = req.body?.settings;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'No settings to save.' });
    res.json({ settings: await getRepository().saveSettings(settings) });
  } catch (err) {
    sendDataError(res, err, 'PUT /api/settings', 'Could not save the settings.');
  }
});

// Settings > Data: restore an exported backup. Adds or updates; deletes nothing.
app.post('/api/workspace/import', async (req, res) => {
  try {
    const counts = await getRepository().importWorkspace(req.body || {});
    res.json({ success: true, ...counts, ...(await getRepository().loadWorkspace()) });
  } catch (err) {
    sendDataError(res, err, 'POST /api/workspace/import', 'Could not import the backup.');
  }
});

// Settings > Data: delete every ticket and guide and load the sample data sent.
app.post('/api/workspace/reset', async (req, res) => {
  try {
    const body = req.body || {};
    await getRepository().resetWorkspace({
      tasks: Array.isArray(body.tasks) ? body.tasks : [],
      runbooks: Array.isArray(body.runbooks) ? body.runbooks : [],
      settings: body.settings && typeof body.settings === 'object' ? body.settings : {},
    });
    res.json({ success: true, ...(await getRepository().loadWorkspace()) });
  } catch (err) {
    sendDataError(res, err, 'POST /api/workspace/reset', 'Could not reset the workspace.');
  }
});

// --- Form Inbox: forms employees submit to IT ---
const FORM_TYPES = ['user-id', 'requisition', 'disposal', 'allocation'];
const FORM_MAX_BYTES = 200 * 1024;

app.get('/api/forms', async (req, res) => {
  try {
    // ?email= narrows the list to one employee's own forms for the portal.
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    const submissions = await getRepository().listForms(email || undefined);
    res.json({ submissions, storageType: 'supabase' });
  } catch (err) {
    sendDataError(res, err, 'GET /api/forms', 'Could not load submitted forms.');
  }
});

app.post('/api/forms', async (req, res) => {
  try {
    const { type, data, attachments, submittedBy } = req.body || {};
    if (!FORM_TYPES.includes(type)) return res.status(400).json({ error: 'Unknown form type.' });
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'The form is empty.' });
    if (!submittedBy?.email) return res.status(400).json({ error: 'Sign in again before submitting.' });
    if (JSON.stringify(data).length > FORM_MAX_BYTES) {
      return res.status(413).json({ error: 'The form is too large to submit.' });
    }
    const submission = await getRepository().createForm({
      type,
      data,
      attachments: Array.isArray(attachments) ? attachments : [],
      submittedBy: { id: submittedBy.id ? String(submittedBy.id) : undefined, email: String(submittedBy.email) },
    });
    res.json({ submission });
  } catch (err) {
    sendDataError(res, err, 'POST /api/forms', 'Could not submit the form. Please try again.');
  }
});

// Marks a form as opened, so it stops showing as new.
app.post('/api/forms/:id/viewed', async (req, res) => {
  try {
    res.json({ submission: await getRepository().markFormViewed(req.params.id) });
  } catch (err) {
    sendDataError(res, err, 'POST /api/forms/:id/viewed', 'Could not update the form.');
  }
});

// Marks a form Done: it leaves the inbox for Form History, and the employee sees
// it as Completed. Marking it again keeps the original completion.
app.post('/api/forms/:id/complete', async (req, res) => {
  try {
    // Recorded by the signed-in account; a name alone is not trusted, since people can share one.
    res.json({ submission: await getRepository().completeForm(req.params.id, { id: actorId(req) }) });
  } catch (err) {
    sendDataError(res, err, 'POST /api/forms/:id/complete', 'Could not mark the form as done.');
  }
});

// Rejects a requisition with a reason the employee will see. Only the IT
// Hardware, Software & Peripherals Requisition can be rejected, and only while
// it is still open.
const FORM_REJECTION_MAX_CHARS = 1000;
app.post('/api/forms/:id/reject', async (req, res) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) return res.status(400).json({ error: 'Write the reason for rejecting this request.' });
    if (reason.length > FORM_REJECTION_MAX_CHARS) {
      return res.status(400).json({ error: `Keep the reason under ${FORM_REJECTION_MAX_CHARS} characters.` });
    }
    res.json({ submission: await getRepository().rejectForm(req.params.id, reason, { id: actorId(req) }) });
  } catch (err) {
    sendDataError(res, err, 'POST /api/forms/:id/reject', 'Could not reject the form.');
  }
});

app.delete('/api/forms/:id', async (req, res) => {
  try {
    if (!(await getRepository().deleteForm(req.params.id))) return res.status(404).json({ error: 'Form not found.' });
    res.json({ success: true });
  } catch (err) {
    sendDataError(res, err, 'DELETE /api/forms/:id', 'Could not delete the form.');
  }
});

// API: Storage and Supabase status check. lastSaved is the newest change to any
// ticket, guide or setting, which other open browsers poll to notice updates.
app.get('/api/data/status', async (req, res) => {
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
  let supabaseConnected = false;
  let supabaseError: string | null = null;
  let lastSaved: string | null = null;
  const counts = { tasks: 0, runbooks: 0, forms: 0, users: 0 };

  try {
    const repo = getRepository();
    const companyId = await repo.companyId();
    lastSaved = await repo.lastChanged();
    const supabase = getSupabase()!;
    const count = async (table: string, byCompany: boolean) => {
      let q = supabase.from(table).select('id', { count: 'exact', head: true });
      if (byCompany) q = q.eq('company_id', companyId);
      const { count: n } = await q;
      return n || 0;
    };
    [counts.tasks, counts.runbooks, counts.forms, counts.users] = await Promise.all([
      count('tickets', true),
      count('runbooks', false),
      count('form_submissions', true),
      count('app_users', false),
    ]);
    supabaseConnected = true;
  } catch (err: any) {
    supabaseError = err?.message || String(err);
  }

  res.json({
    exists: true,
    storageType: supabaseConnected ? 'supabase' : 'file',
    supabase: {
      configured: supabaseConfigured,
      connected: supabaseConnected,
      error: supabaseError,
      urlPreview: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/^(https?:\/\/)([^.]+).*/, '$1$2.supabase.co') : null,
      sqlSetup:
        '-- The workspace tables are created by db/schema.sql in the project.\n' +
        '-- Run it in the Supabase SQL Editor, then any files in db/patches/.\n' +
        '-- Existing data is copied in with: npx tsx db/migrate.ts, then checked with: npx tsx db/verify.ts',
    },
    filePath: 'supabase:tables',
    sizeBytes: 0,
    lastModified: lastSaved,
    lastSaved,
    counts,
  });
});

// API: User Authentication - Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const supabase = getSupabase();
    let userFound = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (!error && data) {
          const check = await verifyPassword(password, data.password);
          if (check.ok) {
            userFound = data;
            if (check.needsUpgrade) await upgradeStoredPassword(cleanEmail, password);
          } else {
            return res.status(401).json({ error: 'Invalid password. Please try again.' });
          }
        }
      } catch (sbErr) {
        console.warn('Supabase app_users login check notice:', sbErr);
      }
    }

    // Fallback to local storage users
    if (!userFound) {
      const stored = getStoredData() || {};
      const users = stored.users || DEFAULT_USERS;
      const matched = users.find((u: any) => u.email.toLowerCase() === cleanEmail);
      if (matched) {
        const check = await verifyPassword(password, matched.password);
        if (check.ok) {
          userFound = matched;
          if (check.needsUpgrade) await upgradeStoredPassword(cleanEmail, password);
        } else {
          return res.status(401).json({ error: 'Invalid password. Please try again.' });
        }
      }
    }

    if (!userFound) {
      return res.status(404).json({
        error: 'No account found for this email. Please check your email or register a new account.'
      });
    }

    const { password: _, ...safeUser } = userFound;
    return res.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error('Error in /api/auth/login:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Store active password reset verification codes
// Map of email -> { code: string; expiresAt: number; verified: boolean }
const activeResetCodes = new Map<string, { code: string; expiresAt: number; verified: boolean }>();

// API: User Authentication - Send Reset Verification Code to Email
app.post('/api/auth/send-reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Check if user exists in local storage or Supabase
    const stored = getStoredData() || {};
    const localUsers = stored.users || [...DEFAULT_USERS];
    let userExists = localUsers.some((u: any) => u.email.toLowerCase() === cleanEmail);

    if (!userExists) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data } = await supabase
            .from('app_users')
            .select('email')
            .eq('email', cleanEmail)
            .limit(1);
          if (data && data.length > 0) {
            userExists = true;
          }
        } catch (sbErr) {
          console.warn('Supabase check user notice:', sbErr);
        }
      }
    }

    if (!userExists) {
      return res.status(404).json({
        error: 'No registered workspace account found with this email address.'
      });
    }

    // Generate secure 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    activeResetCodes.set(cleanEmail, {
      code,
      expiresAt,
      verified: false
    });

    console.log(`[AUTH] Verification code generated for ${cleanEmail}: ${code}`);

    return res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}.`,
      previewCode: code,
      expiresInMinutes: 10
    });
  } catch (err: any) {
    console.error('Error in /api/auth/send-reset-code:', err);
    res.status(500).json({ error: 'Failed to generate verification code' });
  }
});

// API: User Authentication - Verify Reset Code
app.post('/api/auth/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();
    const record = activeResetCodes.get(cleanEmail);

    if (!record) {
      return res.status(400).json({
        error: 'No verification code requested or session expired. Please request a new code.'
      });
    }

    if (Date.now() > record.expiresAt) {
      activeResetCodes.delete(cleanEmail);
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    if (record.code !== cleanCode) {
      return res.status(400).json({
        error: 'Invalid verification code. Please check and try again.'
      });
    }

    // Mark as verified
    record.verified = true;
    activeResetCodes.set(cleanEmail, record);

    return res.json({
      success: true,
      verified: true,
      message: 'Identity verified successfully! You may now set your new password.'
    });
  } catch (err: any) {
    console.error('Error in /api/auth/verify-reset-code:', err);
    res.status(500).json({ error: 'Failed to verify reset code' });
  }
});

// API: User Authentication - Reset Password (Requires Verified Code)
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    if (String(newPassword).trim().length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const record = activeResetCodes.get(cleanEmail);

    // Verify code authorization
    const cleanCode = code ? String(code).trim() : '';
    const isAuthorized = record && (record.verified || record.code === cleanCode) && Date.now() <= record.expiresAt;

    if (!isAuthorized) {
      return res.status(401).json({
        error: 'Email verification required. Please verify the code sent to your email first.'
      });
    }

    let userUpdated = false;
    const hashedNewPassword = await hashPassword(newPassword);

    // Check & update local storage users
    const stored = getStoredData() || {};
    const localUsers = stored.users || [...DEFAULT_USERS];
    const userIndex = localUsers.findIndex((u: any) => u.email.toLowerCase() === cleanEmail);

    if (userIndex !== -1) {
      localUsers[userIndex].password = hashedNewPassword;
      saveStoredData({ ...stored, users: localUsers });
      userUpdated = true;
    }

    // Check & update Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .update({ password: hashedNewPassword })
          .eq('email', cleanEmail)
          .select();

        if (!error && data && data.length > 0) {
          userUpdated = true;
        }
      } catch (sbErr) {
        console.warn('Supabase reset-password notice:', sbErr);
      }
    }

    if (!userUpdated) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    // Consume the reset code so it cannot be reused
    activeResetCodes.delete(cleanEmail);

    return res.json({
      success: true,
      message: 'Password successfully updated! You can now log in with your new password.'
    });
  } catch (err: any) {
    console.error('Error in /api/auth/reset-password:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// API: User Authentication - Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanRole = role === 'admin' ? 'admin' : 'user';
    const newUser = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      password: await hashPassword(password),
      name: String(name).trim(),
      role: cleanRole,
      department: department?.trim() || (cleanRole === 'admin' ? 'IT Operations & SRE' : 'General Staff'),
      created_at: new Date().toISOString()
    };

    // Check if user already exists locally
    const stored = getStoredData() || {};
    const localUsers = stored.users || [...DEFAULT_USERS];
    const exists = localUsers.some((u: any) => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // Save locally
    localUsers.push(newUser);
    saveStoredData({ ...stored, users: localUsers });

    // Save to Supabase if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('app_users')
          .insert({
            id: newUser.id,
            email: newUser.email,
            password: newUser.password,
            name: newUser.name,
            role: newUser.role,
            department: newUser.department,
            created_at: newUser.created_at
          });
        if (error) {
          console.warn('Notice: Supabase app_users table not yet created or insert error (saved locally):', error.message);
        }
      } catch (sbErr) {
        console.warn('Supabase app_users insert notice:', sbErr);
      }
    }

    const { password: _, ...safeUser } = newUser;
    return res.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error('Error in /api/auth/register:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// API: List Available Users
app.get('/api/auth/users', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('*');
        if (!error && data && data.length > 0) {
          return res.json({ users: data.map(({ password, ...safe }: any) => safe) });
        }
      } catch (err) {
        // fallback to local
      }
    }

    const stored = getStoredData() || {};
    const users = (stored.users || DEFAULT_USERS).map(({ password, ...safe }: any) => safe);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// API: Current account details
// The browser keeps the signed-in user in localStorage, so fields IT changes on
// the account (role, department) would otherwise only appear after
// signing out and back in. The app calls this on load to pick them up.
app.post('/api/auth/me', async (req, res) => {
  try {
    const { id, email } = req.body || {};
    if (!id && !email) {
      return res.status(400).json({ error: 'User identifier required' });
    }

    const supabase = getSupabase();
    if (supabase) {
      let query = supabase.from('app_users').select('*');
      query = id ? query.eq('id', id) : query.ilike('email', String(email).trim());
      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        const { password: _, ...safe } = data;
        return res.json({ user: safe });
      }
    }

    const stored = getStoredData() || {};
    const users = stored.users || DEFAULT_USERS;
    const match = users.find(
      (u: any) => (id && u.id === id) || (email && u.email?.toLowerCase() === String(email).trim().toLowerCase())
    );
    if (!match) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const { password: _, ...safe } = match;
    res.json({ user: safe });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    res.status(500).json({ error: 'Failed to load account' });
  }
});

// API: Update User Profile
app.post('/api/auth/profile', async (req, res) => {
  try {
    const { id, email, name, department, newPassword } = req.body;
    if (!email && !id) {
      return res.status(400).json({ error: 'User identifier required' });
    }

    const supabase = getSupabase();
    let updatedUser: any = null;

    if (supabase) {
      try {
        const updatePayload: any = {};
        if (name) updatePayload.name = name.trim();
        if (department !== undefined) updatePayload.department = department.trim();
        if (newPassword && newPassword.length >= 6) updatePayload.password = await hashPassword(newPassword);

        let query = supabase.from('app_users').update(updatePayload);
        if (id) {
          query = query.eq('id', id);
        } else {
          query = query.eq('email', email.toLowerCase().trim());
        }

        const { data, error } = await query.select('*').maybeSingle();

        if (!error && data) {
          const { password: _, ...safe } = data;
          updatedUser = safe;
        }
      } catch (e) {
        console.warn('Supabase profile update fallback to local:', e);
      }
    }

    // Also update in local storage backup
    const stored = getStoredData() || {};
    const localUsers = stored.users || [...DEFAULT_USERS];
    const userIdx = localUsers.findIndex(
      (u: any) => (id && u.id === id) || (email && u.email?.toLowerCase() === email.toLowerCase().trim())
    );

    if (userIdx >= 0) {
      if (name) localUsers[userIdx].name = name.trim();
      if (department !== undefined) localUsers[userIdx].department = department.trim();
      if (newPassword && newPassword.length >= 6) localUsers[userIdx].password = await hashPassword(newPassword);
      stored.users = localUsers;
      saveStoredData(stored);
      if (!updatedUser) {
        const { password: _, ...safe } = localUsers[userIdx];
        updatedUser = safe;
      }
    }

    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    console.error('Error in /api/auth/profile:', err);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// API: Automated tagging & triage
app.post('/api/ai/classify-priority', async (req, res) => {
  try {
    const { title, description, rawLogs } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const ai = getAi();
    
    const prompt = `Analyze this IT operational task/incident and perform automated categorisation and triage tagging.

Task Title: ${title}
Description: ${description || 'N/A'}
System Logs / Stack Trace / Error Payload: ${rawLogs || 'None provided'}

Provide a strict, professional IT triage assessment: pick the best-fitting category,
extract useful operational tags, and suggest a short remediation checklist.`;

    const response = await generateWithRetry(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: 'Best matching category, exactly one of: E-mail, FTP, NAV, File Server, Internet, Advance Retails System, Network, HRIS, Ebuilder, Printer, Database, Others',
            },
            automatedTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Extracted automated tags (e.g. ["k8s", "prod-outage", "postgres", "cve-high", "critical"])',
            },
            suggestedChecklist: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  command: { type: Type.STRING, description: 'Optional CLI diagnostic or remediation command' },
                },
                required: ['text'],
              },
              description: 'Key immediate action items for the on-call engineer',
            },
            potentialRootCauseHint: {
              type: Type.STRING,
              description: 'Initial hypothesis of what might be failing based on error signatures or logs',
            },
          },
          required: [
            'category',
            'automatedTags',
            'suggestedChecklist',
          ],
        },
      },
    });

    const result = JSON.parse(response.text?.trim() || '{}');
    res.json(result);
  } catch (error: any) {
    console.error('Triage classification error:', error);
    sendAiError(res, error, 'Failed to classify the ticket');
  }
});

// API: Generate Issue-Solution Handbook Runbook
// --- SOP writer: rough notes in, finished handbook SOPs out ---
const SOP_NOTES_MAX_CHARS = 20000;

const SOP_WRITER_RULES = `You write Standard Operating Procedures for Eadeco's IT handbook. You are given
rough notes; you return finished SOPs in the structure below, ready to import into
IS Studio's Runbook model. Return them as JSON matching the response schema: each
field is one part of the SOP.

=== SOP STRUCTURE ===

Header: code SOP-<AREA>-<NNN>, v1.0.0, and a title naming the failure or task, with
the system named in brackets if useful. Owner only if the notes name one.

1. SYMPTOMS & TRIGGER SIGNATURES ("symptom", "triggerAlertPatterns")
   One short paragraph: what the user sees and what stops working.
   Matched Alert Patterns: the LITERAL error text, verbatim, including error codes.
   These are what users paste, so they are the highest-value matching signal.

2. ROOT CAUSE ANALYSIS ("rootCauseAnalysis")
   One paragraph: why it happens. Name the secondary cause too when there is one.

3. DIAGNOSTIC WORKFLOW & TRIAGE CLI ("diagnosticSteps")
   3-5 numbered checks. Each: a short title, one or two sentences of explanation,
   a command, and a shell type: general, powershell, bash, sql, kubectl or docker.
   Checks only: nothing here may change system state.

4. STEP-BY-STEP REMEDIATION PROCEDURES ("remediationSteps")
   Each step: an imperative title; the instruction as numbered sub-steps for GUI
   actions, one per line; an optional command; and a verification stating the
   observable proof the step worked. Every step needs one.

5. ROLLBACK & DISASTER SAFEGUARD PROTOCOL ("rollbackPlan")
   How to undo it, or plainly state it cannot be undone and what to do instead.

6. POST-INCIDENT PREVENTATIVE ACTION ITEMS ("postMortemChecklist")
   What would stop this recurring.

TAGS ("tags"): 8-15 of them, in the words STAFF actually use, not IT vocabulary.
"cannot print", "no printout", "printer code", not "job handling". This is what
the chatbot matches against, so it matters more than any other field.

=== RULES ===

- NEVER put a real credential in the output. Use a named placeholder such as
  <DOMAIN_ADMIN_PASSWORD> and list it under "placeholders". The handbook is
  readable by every employee and is fed to the AI assistant.
- Category must be one of: E-mail, FTP, NAV, File Server, Internet,
  Advance Retails System, Network, HRIS, Ebuilder, Printer, Database, Others.
- Write for an employee, not an engineer. No destructive commands, no registry
  edits, no admin actions in the user-facing steps; if it needs IT, say so. Set
  "dangerous" true on any step that still changes system state.
- Cross-reference sibling SOPs by code where relevant (e.g. "see SOP-NET-003"),
  using only codes from the existing handbook listed below.
- Use only what the notes contain. Where something is missing, write the section
  with a clear placeholder and list every gap under "needsConfirming". Do not
  invent screen labels, policy values, timings or IP addresses.
- One SOP per topic. If the notes cover several, return one SOP per topic and
  explain the split in "splitNote"; otherwise leave "splitNote" empty.`;

const SOP_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    splitNote: { type: Type.STRING, description: 'Why the notes were split into several SOPs; empty when there is one' },
    sops: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          code: { type: Type.STRING, description: 'SOP-<AREA>-<NNN>' },
          category: { type: Type.STRING },
          owner: { type: Type.STRING, description: 'Author / owner, only if the notes name one; otherwise empty' },
          symptom: { type: Type.STRING },
          triggerAlertPatterns: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Literal error text, verbatim' },
          rootCauseAnalysis: { type: Type.STRING },
          diagnosticSteps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                explanation: { type: Type.STRING },
                cli: { type: Type.STRING },
                shellType: { type: Type.STRING, description: 'general, powershell, bash, sql, kubectl or docker' },
              },
              required: ['title', 'explanation', 'cli', 'shellType'],
            },
          },
          remediationSteps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                instruction: { type: Type.STRING, description: 'Numbered sub-steps, one per line' },
                command: { type: Type.STRING },
                dangerous: { type: Type.BOOLEAN },
                verification: { type: Type.STRING },
              },
              required: ['title', 'instruction', 'verification'],
            },
          },
          rollbackPlan: { type: Type.STRING },
          postMortemChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          placeholders: { type: Type.ARRAY, items: { type: Type.STRING } },
          needsConfirming: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'title', 'code', 'category', 'symptom', 'triggerAlertPatterns', 'rootCauseAnalysis',
          'diagnosticSteps', 'remediationSteps', 'rollbackPlan', 'postMortemChecklist', 'tags',
          'placeholders', 'needsConfirming',
        ],
      },
    },
  },
  required: ['sops'],
};

app.post('/api/ai/generate-runbook', async (req, res) => {
  try {
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    const categoryHint = typeof req.body.categoryHint === 'string' ? req.body.categoryHint.trim() : '';
    const owner = typeof req.body.owner === 'string' && req.body.owner.trim() ? req.body.owner.trim() : 'IT Department';

    if (!notes) return res.status(400).json({ error: 'Paste your notes first.' });
    if (notes.length > SOP_NOTES_MAX_CHARS) {
      return res.status(400).json({ error: `Notes are too long. Keep them under ${SOP_NOTES_MAX_CHARS.toLocaleString()} characters.` });
    }

    // The existing handbook, read on the server, gives the writer real codes to
    // cross-reference and lets every new SOP get a code not already in use.
    const { runbooks } = await readChatWorkspace();
    const handbookIndex = runbooks.length
      ? runbooks.map((rb: any) => `- ${rb.code}: ${rb.title} (${rb.category})`).join('\n')
      : '(The handbook is empty.)';

    const prompt = `${SOP_WRITER_RULES}

=== EXISTING HANDBOOK (codes already in use) ===
${handbookIndex}

${(IT_CATEGORIES as readonly string[]).includes(categoryHint) ? `The admin expects the category to be ${categoryHint}, unless the notes clearly say otherwise.\n` : ''}
=== NOTES ===
${notes}`;

    const response = await generateWithRetry(getAi(), {
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: SOP_RESPONSE_SCHEMA },
    });

    let parsed: any;
    try {
      parsed = JSON.parse(response.text?.trim() || '{}');
    } catch {
      return res.status(502).json({ error: 'The SOP writer returned an unreadable reply. Please try again.' });
    }
    const drafts = Array.isArray(parsed.sops) ? parsed.sops : [];
    if (!drafts.length) {
      return res.status(502).json({ error: 'The SOP writer did not return an SOP. Add more detail to the notes and try again.' });
    }

    const usedCodes = new Set<string>(runbooks.map((rb: any) => String(rb.code || '').toUpperCase()).filter(Boolean));
    const today = new Date().toISOString().slice(0, 10);
    const stamp = Date.now();
    const sops = drafts.map((draft: GeneratedSop, i: number) =>
      checkGeneratedSop(draft, { usedCodes, owner, today, idSuffix: `${stamp}-${i}` })
    );

    res.json({ sops, splitNote: typeof parsed.splitNote === 'string' ? parsed.splitNote.trim() : '' });
  } catch (error: any) {
    console.error('Runbook generation error:', error);
    sendAiError(res, error, 'Failed to write the SOP');
  }
});


// API: Employee support chat assistant
// --- IT Assistant: knowledge base first, then the web, then a ticket ---
// Every new question starts at attempt 1, which answers only from the IT
// Handbook guides (and the employee's own open tickets). If the guides do not
// cover it, or the employee says the answer did not help, attempt 2 searches
// the web. If that still does not solve it, the client points them at an IT
// Support Request. The client decides which attempt a message belongs to; this
// route just answers in the mode it is asked for.
const CHAT_MAX_HISTORY = 12;
const CHAT_MAX_MESSAGE_CHARS = 2000;

// Usage window: an employee's first question opens a session of
// CHAT_SESSION_SECONDS; when it ends, the assistant is locked for
// CHAT_COOLDOWN_SECONDS before a new session can start. Enforced here, not in
// the browser, so reloading the page or opening another tab does not reset it.
// Kept in memory, so restarting the server clears every window.
const CHAT_SESSION_MS = (Number(process.env.CHAT_SESSION_SECONDS) || 30 * 60) * 1000;
const CHAT_COOLDOWN_MS = (Number(process.env.CHAT_COOLDOWN_SECONDS) || 30 * 60) * 1000;
const chatSessionStarts = new Map<string, number>();

type ChatSessionState =
  | { status: 'new'; sessionMs: number; cooldownMs: number }
  | { status: 'active'; endsInMs: number; cooldownMs: number }
  | { status: 'ended'; retryInMs: number };

/**
 * Puts each numbered step on its own line. Models sometimes run a list
 * together ("1. Do this. 2. Do that."), especially inside JSON replies. Steps
 * are split only in order (2 after 1, 3 after 2...), so a number inside a step
 * such as "Windows 10. " is left alone. A closing "If..." or "Contact..."
 * sentence after the last step also gets its own line.
 */
function formatChatSteps(text: string): string {
  let out = text.trim();
  let stepStart = out.search(/(^|\s)1\.\s/);
  if (stepStart === -1) return out;
  for (let n = 2; n <= 12; n++) {
    const match = new RegExp(`\\s+${n}\\.\\s`).exec(out.slice(stepStart));
    if (!match) break;
    const at = stepStart + match.index;
    const spaceLength = match[0].length - match[0].trimStart().length;
    out = out.slice(0, at) + '\n' + out.slice(at + spaceLength);
    stepStart = at + 1;
  }
  const lastStep = out.slice(stepStart).replace(/([.!])[ \t]+(If |Contact |Please contact )/, '$1\n$2');
  return out.slice(0, stepStart) + lastStep;
}

function chatSessionKey(req: any, user: any): string {
  return String(user?.id || user?.email || req.ip || 'anonymous').toLowerCase();
}

function chatSessionState(key: string, now: number): ChatSessionState {
  // Forget windows that have fully expired so the map cannot grow forever.
  for (const [k, started] of chatSessionStarts) {
    if (now - started >= CHAT_SESSION_MS + CHAT_COOLDOWN_MS) chatSessionStarts.delete(k);
  }
  const started = chatSessionStarts.get(key);
  if (started === undefined) return { status: 'new', sessionMs: CHAT_SESSION_MS, cooldownMs: CHAT_COOLDOWN_MS };
  if (now - started < CHAT_SESSION_MS) {
    return { status: 'active', endsInMs: started + CHAT_SESSION_MS - now, cooldownMs: CHAT_COOLDOWN_MS };
  }
  return { status: 'ended', retryInMs: started + CHAT_SESSION_MS + CHAT_COOLDOWN_MS - now };
}

function chatSessionEndedMessage(retryInMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryInMs / 60000));
  return `Session ended. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
// Guides and the workspace settings are read on the server, from storage, in
// one query. Guides are never taken from the browser (the full steps are needed
// and the browser copy may be stale), and neither is the knowledge mode: the
// employee portal calls /api/ai/chat, and an employee must not be able to
// switch the workspace to full mode and spend the daily AI quota.
async function readChatWorkspace(): Promise<{ runbooks: any[]; settings: any }> {
  try {
    const repo = getRepository();
    const [runbooks, settings] = await Promise.all([repo.loadRunbooks(), repo.loadSettings()]);
    return { runbooks, settings };
  } catch (err) {
    console.warn('Chat knowledge base: could not read the handbook:', err);
    return { runbooks: [], settings: {} };
  }
}

/**
 * Builds the attempt-1 knowledge base without any AI call. Scoped (the default,
 * and what settings saved before the option existed get) sends only the guides
 * relevant to the question; full sends every active guide.
 */
function buildChatKnowledge(
  runbooks: any[],
  settings: any,
  input: { category?: string; originalQuestion: string; latestMessage: string }
): string {
  const mode: ChatKnowledgeMode = settings?.chatKnowledgeMode === 'full' ? 'full' : 'scoped';

  if (mode === 'full') {
    const active = runbooks.filter(isActiveRunbook);
    const text = knowledgeBaseText(active);
    if (text.length > CHAT_KNOWLEDGE_MAX_CHARS) {
      console.warn(
        `Chat knowledge base (full mode): ${text.length} characters across ${active.length} guides is over ` +
          `${CHAT_KNOWLEDGE_MAX_CHARS}. Nothing is trimmed in full mode, but every question sends all of it.`
      );
    }
    console.log(
      `[chat kb] mode=full category=- considered=${active.length} sent=${active.length} chars=${text.length} ` +
        `(~${Math.round(text.length / CHARS_PER_TOKEN)} tokens)`
    );
    return text;
  }

  const selection = selectScopedRunbooks(runbooks, input);
  if (selection.trimmedByCap > 0) {
    console.warn(
      `Chat knowledge base (scoped mode): character cap of ${CHAT_KNOWLEDGE_MAX_CHARS} reached; ` +
        `${selection.trimmedByCap} relevant guide(s) excluded, least relevant first.`
    );
  }
  console.log(
    `[chat kb] mode=scoped category=${input.category || '-'} considered=${selection.considered} ` +
      `sent=${selection.selected.length} chars=${selection.text.length} ` +
      `(~${Math.round(selection.text.length / CHARS_PER_TOKEN)} tokens)`
  );
  return selection.text;
}

const EMPLOYEE_SAFETY_RULES = `- You are talking to an employee, not an IT engineer. They cannot run
  administrative commands and do not have server access.
- Give only safe self-service steps: restart, reconnect, sign out and back in,
  check a cable, clear a browser cache, change a setting they can reach.
- Never give destructive actions, admin or root commands, registry edits,
  database queries, or anything needing elevated privileges. If the fix needs
  IT, say so.
- Never invent a ticket number, a policy, a deadline, or a person's name.
- Reply with the instructions only: a numbered list of at most 6 short steps,
  one action per step, each step on its own line (separate steps with a line
  break, never put two steps on one line). If the fix needs IT, add one final
  line saying so.
- No greeting, no apology, no restating the question, no sympathy, no sign-off,
  no "I hope this helps" or offers of further help. Start with step 1.
- A ticket-status answer is one line, e.g. "REQ-0003 is In Progress."
- Plain text only. No markdown headings, no code fences, no asterisks.`;

// Lets the panel show the countdown or the lock as soon as it opens.
app.post('/api/ai/chat/session', (req, res) => {
  res.json(chatSessionState(chatSessionKey(req, req.body?.user), Date.now()));
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, question, history, user, tickets } = req.body;
    const mode: 'knowledge' | 'web' = req.body.mode === 'web' ? 'web' : 'knowledge';

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > CHAT_MAX_MESSAGE_CHARS) {
      return res.status(400).json({
        error: 'Message is too long. Please keep it under ' + CHAT_MAX_MESSAGE_CHARS + ' characters.',
      });
    }

    const sessionKey = chatSessionKey(req, user);
    const now = Date.now();
    const session = chatSessionState(sessionKey, now);
    if (session.status === 'ended') {
      return res.status(429).json({ error: chatSessionEndedMessage(session.retryInMs), sessionEnded: true, retryInMs: session.retryInMs });
    }
    if (session.status === 'new') chatSessionStarts.set(sessionKey, now);
    const sessionEndsInMs = session.status === 'active' ? session.endsInMs : CHAT_SESSION_MS;
    const sessionInfo = { sessionEndsInMs, cooldownMs: CHAT_COOLDOWN_MS };

    const ai = getAi();

    const ticketLines = Array.isArray(tickets) && tickets.length
      ? tickets
          .slice(0, 15)
          .map((t: any) => '- ' + t.ticketNumber + ': "' + t.title + '" | status ' + t.status)
          .join('\n')
      : 'None open.';

    // Only the last few turns are sent: enough for follow-ups like "what about
    // the second one?" without growing the prompt without bound.
    const priorTurns = Array.isArray(history)
      ? history
          .slice(-CHAT_MAX_HISTORY)
          .map((m: any) => (m.role === 'assistant' ? 'Assistant: ' : 'Employee: ') + m.content)
          .join('\n')
      : '';

    const originalQuestion = typeof question === 'string' && question.trim() ? question.trim() : message.trim();
    const who = `${user?.name || 'Employee'}${user?.department ? ' (' + user.department + ')' : ''}`;

    // ---- Attempt 1: company knowledge base only ----
    if (mode === 'knowledge') {
      // The category chip the employee picked, if any. Only narrows which guides
      // are searched; "Not sure" sends nothing and every guide is considered.
      const category =
        typeof req.body.category === 'string' && req.body.category.trim() && req.body.category.length <= 60
          ? req.body.category.trim()
          : undefined;
      const { runbooks, settings } = await readChatWorkspace();
      const knowledge = buildChatKnowledge(runbooks, settings, {
        category,
        originalQuestion,
        latestMessage: message.trim(),
      });

      const prompt = `You are the IT Assistant in a company's employee IT portal. This is ATTEMPT 1:
you may answer ONLY from the company IT knowledge base and the employee's ticket
list below. Do not use outside or general knowledge.

Employee: ${who}

Their open tickets:
${ticketLines}

COMPANY IT KNOWLEDGE BASE:
${knowledge || '(The knowledge base is empty.)'}

${priorTurns ? 'Conversation so far:\n' + priorTurns + '\n' : ''}
The employee's issue: ${originalQuestion}
${message.trim() !== originalQuestion ? 'Their latest message: ' + message.trim() : ''}

Rules:
- Set "found" to true only if the knowledge base (or, for a question about their
  tickets, the ticket list) genuinely covers this issue. A guide about a
  different problem does not count.
- If found, answer using only that material.
- If not found, set "found" to false and set "reply"
  to "Not covered in the IT guides." with nothing else.
${EMPLOYEE_SAFETY_RULES}`;

      const response = await generateWithRetry(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              found: { type: Type.BOOLEAN, description: 'Whether the knowledge base covers the issue' },
              reply: { type: Type.STRING, description: 'Plain-text reply to the employee' },
            },
            required: ['found', 'reply'],
          },
        },
      });

      let parsed: any;
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch {
        return res.status(502).json({ error: 'The assistant returned an unreadable reply. Please try again.' });
      }
      const reply = formatChatSteps(String(parsed.reply || ''));
      if (!reply) {
        return res.status(502).json({ error: 'The assistant returned an empty reply. Please try again.' });
      }

      return res.json({ mode, found: Boolean(parsed.found), reply, ...sessionInfo });
    }

    // ---- Attempt 2: search the web ----
    const webPrompt = `You are the IT Assistant in a company's employee IT portal. This is ATTEMPT 2:
the company's own IT guides did not solve this, so research the issue on the web
and give the most reliable, widely recommended fix.

Employee: ${who}

${priorTurns ? 'Conversation so far:\n' + priorTurns + '\n' : ''}
The employee's issue: ${originalQuestion}
${message.trim() !== originalQuestion ? 'Their latest message: ' + message.trim() : ''}

Rules:
- Prefer official vendor documentation (Microsoft, Google, Apple, the software
  maker) over forums.
- If the steps would need an administrator, say so plainly instead.
${EMPLOYEE_SAFETY_RULES}`;

    let response: any;
    let webSearchUsed = true;
    try {
      response = await generateWithRetry(ai, { contents: webPrompt, config: { tools: [{ googleSearch: {} }] } });
    } catch (searchError: any) {
      // Web search is not available on every key or model. Rather than failing
      // the attempt, answer from general knowledge and say so in the UI.
      console.warn('Chat web search unavailable, answering without it:', searchError?.message || searchError);
      webSearchUsed = false;
      response = await generateWithRetry(ai, { contents: webPrompt });
    }

    const reply = formatChatSteps(response.text || '');
    if (!reply) {
      return res.status(502).json({ error: 'The assistant returned an empty reply. Please try again.' });
    }

    // Search counts as used only when the answer is actually grounded in pages.
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const grounded = chunks.some((c: any) => c?.web?.uri);

    res.json({ mode, found: true, reply, webSearchUsed: webSearchUsed && grounded, ...sessionInfo });
  } catch (error: any) {
    console.error('Support chat error:', error);
    sendAiError(res, error, 'Failed to reach the IT assistant');
  }
});

// --- Ticket attachments ---
// File bytes never go into workspace_data: every save re-posts the whole
// workspace, so a few uploads would make each sync megabytes large. Files go to
// a private Supabase Storage bucket and the ticket keeps only their metadata.
// Without Supabase they are written under data/attachments, which only the
// machine that received them can serve.
const ATTACHMENT_BUCKET = 'ticket-attachments';
const ATTACHMENT_DIR = path.join(DATA_DIR, 'attachments');
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
// Generated keys only ever contain these characters, which also rules out any
// path traversal through the download route.
const ATTACHMENT_KEY = /^[A-Za-z0-9._-]{1,200}$/;

// Types a browser may render in place. Anything else - HTML and SVG above all,
// which could run script on this origin - is only ever offered as a download.
const INLINE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
};

let attachmentBucketReady: Promise<boolean> | null = null;

function ensureAttachmentBucket(supabase: SupabaseClient): Promise<boolean> {
  if (!attachmentBucketReady) {
    attachmentBucketReady = (async () => {
      const { data, error } = await supabase.storage.getBucket(ATTACHMENT_BUCKET);
      if (data && !error) return true;

      const { error: createError } = await supabase.storage.createBucket(ATTACHMENT_BUCKET, {
        public: false,
        fileSizeLimit: MAX_ATTACHMENT_BYTES,
      });
      if (createError && !/already exists/i.test(createError.message)) {
        console.warn('Attachment bucket unavailable, using local storage:', createError.message);
        return false;
      }
      return true;
    })().catch((err) => {
      console.warn('Attachment bucket check failed, using local storage:', err?.message || err);
      return false;
    });

    // A failed check is retried on the next upload rather than cached forever.
    attachmentBucketReady.then((ok) => {
      if (!ok) attachmentBucketReady = null;
    });
  }
  return attachmentBucketReady;
}

app.post(
  '/api/attachments',
  express.raw({ type: 'application/octet-stream', limit: MAX_ATTACHMENT_BYTES }),
  async (req, res) => {
    try {
      const body = req.body;
      const originalName = String(req.query.name || '').trim();
      const type = String(req.query.type || 'application/octet-stream').slice(0, 120);

      if (!Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({ error: 'The file is empty.' });
      }
      if (!originalName) {
        return res.status(400).json({ error: 'A file name is required.' });
      }

      const safeName = originalName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';
      const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safeName}`;

      let storage: 'supabase' | 'local' = 'local';
      const supabase = getSupabase();

      if (supabase && (await ensureAttachmentBucket(supabase))) {
        const { error } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .upload(key, body, { contentType: type, upsert: false });
        if (error) {
          console.warn('Attachment upload to Supabase failed, using local storage:', error.message);
        } else {
          storage = 'supabase';
        }
      }

      if (storage === 'local') {
        await fs.promises.mkdir(ATTACHMENT_DIR, { recursive: true });
        await fs.promises.writeFile(path.join(ATTACHMENT_DIR, key), body);
      }

      res.json({
        id: key,
        name: originalName.slice(0, 255),
        size: body.length,
        type,
        storage,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Attachment upload error:', err);
      res.status(500).json({ error: 'Could not store the attachment.' });
    }
  }
);

app.get('/api/attachments/:key', async (req, res) => {
  const key = String(req.params.key || '');
  if (!ATTACHMENT_KEY.test(key) || key.includes('..')) {
    return res.status(400).json({ error: 'Invalid attachment reference.' });
  }

  const downloadName = String(req.query.name || key).replace(/[\r\n"]/g, '').slice(0, 255);
  const ext = (downloadName.split('.').pop() || '').toLowerCase();
  const inlineType = INLINE_TYPES[ext];

  const send = (bytes: Buffer) => {
    res.setHeader('Content-Type', inlineType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${inlineType ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Belt and braces: even a mislabelled file cannot run script if opened.
    res.setHeader('Content-Security-Policy', 'sandbox');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(bytes);
  };

  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).download(key);
      if (data && !error) {
        return send(Buffer.from(await data.arrayBuffer()));
      }
    }

    const localPath = path.join(ATTACHMENT_DIR, key);
    if (fs.existsSync(localPath)) {
      return send(await fs.promises.readFile(localPath));
    }

    res.status(404).json({ error: 'Attachment not found on this server.' });
  } catch (err: any) {
    console.error('Attachment download error:', err);
    res.status(500).json({ error: 'Could not read the attachment.' });
  }
});

// Setup Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'public');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IT TaskFlow server running at http://0.0.0.0:${PORT}`);
    console.log(`Gemini models (in order): ${GEMINI_MODELS.join(' -> ')}`);
  });
}

startServer();
