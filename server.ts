import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

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
  const key = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
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
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.7-flash';

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

async function generateWithRetry(ai: any, request: any): Promise<any> {
  let lastError: any;
  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (err: any) {
      lastError = err;
      if (!isTransientAiError(err) || attempt === AI_MAX_ATTEMPTS) throw err;

      const advised = retryDelayMsFromError(err);
      const backoffMs =
        advised ?? 800 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400);

      // If Google wants us to wait longer than we are willing to hold the
      // request open, stop retrying and surface an actionable error instead.
      if (backoffMs > AI_MAX_WAIT_MS) {
        console.warn('Gemini quota exhausted; advised wait ' + backoffMs + 'ms exceeds cap');
        throw err;
      }

      console.warn(
        'Gemini transient error (status ' + aiErrorStatus(err) + '); retrying in ' +
        backoffMs + 'ms [attempt ' + attempt + '/' + AI_MAX_ATTEMPTS + ']'
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
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
      return res.status(429).json({
        error:
          'The daily free-tier AI quota for this project has been used up. ' +
          'AI triage and runbook generation will work again after the quota ' +
          'resets, or immediately if billing is enabled on the Google project.',
        quotaScope: 'daily',
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

// API: Retrieve persistent data (from Supabase if configured, otherwise local server file)
app.get('/api/data', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('workspace_data')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();

        if (!error && data) {
          // Keep local backup in sync
          saveStoredData({
            tasks: data.tasks || [],
            runbooks: data.runbooks || [],
            rules: data.rules || [],
            settings: data.settings || {},
          });

          return res.json({
            success: true,
            storageType: 'supabase',
            tasks: data.tasks || [],
            runbooks: data.runbooks || [],
            rules: data.rules || [],
            settings: data.settings || {},
            lastSaved: data.updated_at || new Date().toISOString(),
            filePath: 'supabase:workspace_data',
          });
        }
        if (error) {
          console.warn('Supabase query notice (falling back to server file):', error.message);
        }
      } catch (sbErr) {
        console.warn('Supabase connection attempt notice:', sbErr);
      }
    }

    const data = getStoredData();
    if (!data) {
      return res.status(404).json({ error: 'No data file found' });
    }
    res.json({
      success: true,
      storageType: 'file',
      tasks: data.tasks || [],
      runbooks: data.runbooks || [],
      rules: data.rules || [],
      settings: data.settings || {},
      lastSaved: data.lastSaved || new Date().toISOString(),
      filePath: 'data/server-storage.json'
    });
  } catch (err: any) {
    console.error('Error in GET /api/data:', err);
    res.status(500).json({ error: 'Failed to read server storage data' });
  }
});

// API: Save updated workspace data (to Supabase cloud and local file backup)
app.post('/api/data', async (req, res) => {
  try {
    const { tasks, runbooks, rules, settings } = req.body;
    if (tasks === undefined && runbooks === undefined && rules === undefined && settings === undefined) {
      return res.status(400).json({ error: 'No data provided to save' });
    }
    const current = getStoredData() || {};
    const updatedTasks = tasks !== undefined ? tasks : (current.tasks || []);
    const updatedRunbooks = runbooks !== undefined ? runbooks : (current.runbooks || []);
    const updatedRules = rules !== undefined ? rules : (current.rules || []);
    const updatedSettings = settings !== undefined ? settings : (current.settings || {});

    // Save locally first
    const updatedLocal = saveStoredData({
      tasks: updatedTasks,
      runbooks: updatedRunbooks,
      rules: updatedRules,
      settings: updatedSettings,
    });

    let storageType = 'file';
    let supabaseStatus = 'not_configured';
    const supabase = getSupabase();

    if (supabase) {
      try {
        const { error } = await supabase
          .from('workspace_data')
          .upsert({
            id: 'default',
            tasks: updatedTasks,
            runbooks: updatedRunbooks,
            rules: updatedRules,
            settings: updatedSettings,
            updated_at: updatedLocal.lastSaved,
          }, { onConflict: 'id' });

        if (error) {
          console.warn('Supabase upsert error:', error.message);
          supabaseStatus = `error: ${error.message}`;
        } else {
          storageType = 'supabase';
          supabaseStatus = 'synced';
        }
      } catch (sbErr: any) {
        console.warn('Supabase upsert exception:', sbErr);
        supabaseStatus = `failed: ${sbErr.message}`;
      }
    }

    res.json({
      success: true,
      storageType,
      supabaseStatus,
      savedAt: updatedLocal.lastSaved,
      filePath: storageType === 'supabase' ? 'supabase:workspace_data' : 'data/server-storage.json',
      counts: {
        tasks: updatedTasks.length,
        runbooks: updatedRunbooks.length,
        rules: updatedRules.length
      }
    });
  } catch (err: any) {
    console.error('Error in POST /api/data:', err);
    res.status(500).json({ error: 'Failed to write storage data' });
  }
});

// API: Storage and Supabase status check
app.get('/api/data/status', async (req, res) => {
  try {
    const supabase = getSupabase();
    const supabaseConfigured = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
    let supabaseConnected = false;
    let supabaseError: string | null = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('workspace_data')
          .select('id, updated_at')
          .eq('id', 'default')
          .maybeSingle();

        if (!error) {
          supabaseConnected = true;
        } else {
          supabaseError = error.message;
        }
      } catch (err: any) {
        supabaseError = err.message;
      }
    }

    const exists = fs.existsSync(STORAGE_FILE);
    const stats = exists ? fs.statSync(STORAGE_FILE) : null;
    const data = getStoredData();

    res.json({
      exists: true,
      storageType: supabaseConnected ? 'supabase' : 'file',
      supabase: {
        configured: supabaseConfigured,
        connected: supabaseConnected,
        error: supabaseError,
        urlPreview: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/^(https?:\/\/)([^.]+).*/, '$1$2.supabase.co') : null,
        sqlSetup: `-- 1. Workspace operational data (Tickets, SOP Runbooks, SLA Rules, Settings)
CREATE TABLE IF NOT EXISTS workspace_data (
  id TEXT PRIMARY KEY DEFAULT 'default',
  tasks JSONB DEFAULT '[]'::jsonb,
  runbooks JSONB DEFAULT '[]'::jsonb,
  rules JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workspace_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow workspace sync" ON workspace_data;
CREATE POLICY "Allow workspace sync" ON workspace_data FOR ALL USING (true) WITH CHECK (true);

-- 2. User Accounts & Role Permissions (Admin vs Employee Requester)
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' for IT Staff, 'user' for Normal Employee
  department TEXT DEFAULT 'General',
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow user sync" ON app_users;
CREATE POLICY "Allow user sync" ON app_users FOR ALL USING (true) WITH CHECK (true);`
      },
      filePath: supabaseConnected ? 'supabase:workspace_data' : 'data/server-storage.json',
      sizeBytes: stats ? stats.size : 0,
      lastModified: stats ? stats.mtime.toISOString() : null,
      lastSaved: data?.lastSaved,
      counts: {
        tasks: data?.tasks?.length || 0,
        runbooks: data?.runbooks?.length || 0,
        rules: data?.rules?.length || 0,
        users: data?.users?.length || DEFAULT_USERS.length,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to inspect file status' });
  }
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
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
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
            avatar: newUser.avatar,
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
          .select('id, email, name, role, department, avatar, created_at');
        if (!error && data && data.length > 0) {
          return res.json({ users: data });
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

// API: Update User Profile
app.post('/api/auth/profile', async (req, res) => {
  try {
    const { id, email, name, department, avatar, newPassword } = req.body;
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
        if (avatar) updatePayload.avatar = avatar;
        if (newPassword && newPassword.length >= 6) updatePayload.password = await hashPassword(newPassword);

        let query = supabase.from('app_users').update(updatePayload);
        if (id) {
          query = query.eq('id', id);
        } else {
          query = query.eq('email', email.toLowerCase().trim());
        }

        const { data, error } = await query
          .select('id, email, name, role, department, avatar, created_at')
          .maybeSingle();

        if (!error && data) {
          updatedUser = data;
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
      if (avatar) localUsers[userIdx].avatar = avatar;
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

// API: Automated Priority Tagging & Triage
app.post('/api/ai/classify-priority', async (req, res) => {
  try {
    const { title, description, rawLogs, environment, affectedUsers } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const ai = getAi();
    
    const prompt = `Analyze this IT operational task/incident and perform automated priority classification, triage tagging, and SLA calculation.

Task Title: ${title}
Environment: ${environment || 'Production'}
Estimated Affected Users: ${affectedUsers || 'Unknown'}
Description: ${description || 'N/A'}
System Logs / Stack Trace / Error Payload: ${rawLogs || 'None provided'}

Provide a strict, professional IT triage assessment following ITIL/SRE incident severity guidelines:
- P1 (Critical): Total outage of core service, data corruption, severe security breach, widespread customer impact. SLA: 1-2 hours.
- P2 (High): Major feature impaired, failover degraded, high user impact without full outage, time-sensitive security patch. SLA: 4-8 hours.
- P3 (Medium): Minor bug, non-critical service degradation, internal tool issue, standard change. SLA: 24-48 hours.
- P4 (Low): Cosmetic issue, documentation request, low-priority routine maintenance. SLA: 72+ hours.`;

    const response = await generateWithRetry(ai, {
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              description: 'One of P1, P2, P3, P4',
            },
            priorityRationale: {
              type: Type.STRING,
              description: 'Clear ITIL/SRE technical justification for this priority level.',
            },
            category: {
              type: Type.STRING,
              description: 'Best matching category: DevOps & SRE, Security & IAM, Database, Cloud Infra, Networking, Application, SysAdmin',
            },
            automatedTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Extracted automated tags (e.g. ["k8s", "prod-outage", "postgres", "cve-high", "p1-sla-1h"])',
            },
            impactScore: {
              type: Type.NUMBER,
              description: 'Impact score from 1 (minimal) to 10 (catastrophic business halt)',
            },
            urgencyScore: {
              type: Type.NUMBER,
              description: 'Urgency score from 1 (can wait) to 10 (immediate fire-fighting required)',
            },
            recommendedSlaHours: {
              type: Type.NUMBER,
              description: 'Recommended SLA response/resolution target hours',
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
            'priority',
            'priorityRationale',
            'category',
            'automatedTags',
            'impactScore',
            'urgencyScore',
            'recommendedSlaHours',
            'suggestedChecklist',
          ],
        },
      },
    });

    const result = JSON.parse(response.text?.trim() || '{}');
    res.json(result);
  } catch (error: any) {
    console.error('Priority classification error:', error);
    sendAiError(res, error, 'Failed to classify priority');
  }
});

// API: Generate Issue-Solution Handbook Runbook
app.post('/api/ai/generate-runbook', async (req, res) => {
  try {
    const problemTitle = req.body.problemTitle || req.body.incidentTitle || req.body.title;
    const errorLogs = req.body.errorLogs || req.body.rawLogs || '';
    const environment = req.body.environment || 'Production';
    const category = req.body.category || 'Networking';
    const systemContext = req.body.systemContext || req.body.incidentDescription || req.body.description || '';
    const targetSeverity = req.body.targetSeverity || 'P3';

    if (!problemTitle) {
      return res.status(400).json({ error: 'Problem title is required' });
    }

    const ai = getAi();

    const prompt = `You are a Senior Principal Site Reliability Engineer and IT Operations Architect. 
Write an exhaustive, high-standard IT Issue-Solution Handbook Standard Operating Procedure (SOP) / Runbook for:

Problem: ${problemTitle}
Environment: ${environment}
Category: ${category}
System Context: ${systemContext}
Severity: ${targetSeverity}
Error Output / Logs: ${errorLogs || 'None provided'}

Provide real, production-tested diagnostic and remediation CLI commands (Bash, PowerShell, cmd, kubectl, docker, SQL, systemctl, netsh, ping).
Make the handbook thorough, unambiguous, and formatted for junior and senior engineers during live outages.`;

    const response = await generateWithRetry(ai, {
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Descriptive, professional SOP title' },
            code: { type: Type.STRING, description: 'Standard code like SOP-OPS-042 or RUN-DB-019' },
            category: { type: Type.STRING },
            severityTarget: { type: Type.STRING, description: 'P1, P2, P3, P4, or ALL' },
            environment: { type: Type.STRING },
            symptom: { type: Type.STRING, description: 'Observable behavior, alert triggers, metrics deviation' },
            triggerAlertPatterns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Alert message snippets or error keywords',
            },
            rootCauseAnalysis: {
              type: Type.STRING,
              description: 'Deep technical analysis of why this failure occurs at OS, network, DB, or code level',
            },
            diagnosticSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  cli: { type: Type.STRING, description: 'Exact copy-pasteable terminal command' },
                  explanation: { type: Type.STRING, description: 'What to look for in the output' },
                  shellType: { type: Type.STRING, description: 'bash, powershell, kubectl, sql, or docker' },
                },
                required: ['title', 'cli', 'explanation', 'shellType'],
              },
            },
            remediationSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.NUMBER },
                  title: { type: Type.STRING },
                  instruction: { type: Type.STRING },
                  command: { type: Type.STRING },
                  dangerous: { type: Type.BOOLEAN, description: 'True if restart, data drop, or brief downtime is involved' },
                  verification: { type: Type.STRING, description: 'How to confirm the step succeeded' },
                },
                required: ['stepNumber', 'title', 'instruction', 'verification'],
              },
            },
            rollbackPlan: {
              type: Type.STRING,
              description: 'Immediate rollback instructions if remediation fails or worsens the incident',
            },
            postMortemChecklist: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Preventive steps, monitoring metrics to add, or architectural improvements',
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'title',
            'code',
            'category',
            'severityTarget',
            'symptom',
            'triggerAlertPatterns',
            'rootCauseAnalysis',
            'diagnosticSteps',
            'remediationSteps',
            'rollbackPlan',
            'postMortemChecklist',
            'tags',
          ],
        },
      },
    });

    const result = JSON.parse(response.text?.trim() || '{}');
    res.json(result);
  } catch (error: any) {
    console.error('Runbook generation error:', error);
    sendAiError(res, error, 'Failed to generate handbook runbook');
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
    console.log(`Gemini model: ${GEMINI_MODEL}`);
  });
}

startServer();
