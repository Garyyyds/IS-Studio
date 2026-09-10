-- 1. Workspace operational data (Tickets, SOP Runbooks, SLA Rules, Settings)
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
CREATE POLICY "Allow user sync" ON app_users FOR ALL USING (true) WITH CHECK (true);
