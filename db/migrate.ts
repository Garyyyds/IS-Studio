/**
 * Stage 2: copy the single-row JSONB workspace into the normalised tables.
 *
 *   npx tsx db/migrate.ts             write to the new tables
 *   npx tsx db/migrate.ts --dry-run   read and report only; writes nothing
 *
 * Reads workspace_data (rows 'default' and 'form-submissions') and app_users.
 * Writes ONLY the tables created by db/schema.sql, plus the four columns that
 * schema adds to app_users (company_id is filled in; nothing else on a user
 * changes). workspace_data is never modified or deleted.
 *
 * Idempotent: parents are upserted on their legacy id, child rows are replaced
 * for the parents being migrated, and sequences only ever move up. Running it
 * twice leaves the same rows as running it once.
 *
 * Deliberately does NOT guess:
 *  - users are matched by email (case-insensitive); no match leaves the
 *    reference empty and lists the name in the report;
 *  - locations are matched to existing sites by name; no site is ever created;
 *  - numbers that do not parse are left empty and listed, never written as 0.
 *
 * Environment: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from .env), plus
 *   MIGRATION_COMPANY_CODE  default EDGC
 *   MIGRATION_COMPANY_NAME  used only when the company is first created; defaults to the code
 */
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const COMPANY_CODE = (process.env.MIGRATION_COMPANY_CODE || 'EDGC').trim().toUpperCase();
const COMPANY_NAME = (process.env.MIGRATION_COMPANY_NAME || COMPANY_CODE).trim();
const BATCH = 500;
const TICKET_STATUSES = ['backlog', 'investigating', 'in_progress', 'blocked', 'testing', 'done'];
const SHELL_TYPES = ['general', 'powershell', 'bash', 'sql', 'kubectl', 'docker'];

// Upserts in Supabase run as INSERT ... ON CONFLICT (SQL Server: MERGE).

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const report = {
  read: {} as Record<string, number>,
  written: {} as Record<string, number>,
  unmatchedUsers: new Map<string, string[]>(),
  unmappedLocations: new Map<string, string[]>(),
  unknownCategories: new Map<string, string[]>(),
  unparseableNumbers: [] as string[],
  unparseableDates: [] as string[],
  unresolvedReferences: [] as string[],
  sequences: [] as string[],
  notMigrated: [] as string[],
};

const note = (map: Map<string, string[]>, key: string, where: string) => {
  const list = map.get(key) || [];
  if (!list.includes(where)) list.push(where);
  map.set(key, list);
};
const countRead = (what: string, n: number) => (report.read[what] = (report.read[what] || 0) + n);
const countWritten = (table: string, n: number) => (report.written[table] = (report.written[table] || 0) + n);

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
/** Trimmed text, or null when empty. */
const text = (v: unknown, max?: number): string | null => {
  const s = str(v).trim();
  if (!s) return null;
  return max && s.length > max ? s.slice(0, max) : s;
};
const key = (v: unknown) => str(v).trim().toLowerCase();

/**
 * Money or quantity typed as text ("1,200", "RM 45.50") to a number.
 * Empty is a legitimate "not filled in" and becomes null silently; anything
 * else that does not parse, or does not fit the column, is reported.
 */
function parseAmount(value: unknown, where: string, precision: 12 | 14): number | null {
  const raw = str(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/^RM\s*/i, '').replace(/,/g, '').replace(/\s+/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    report.unparseableNumbers.push(`${where}: "${raw}"`);
    return null;
  }
  const n = Math.round(Number(cleaned) * 100) / 100;
  const limit = precision === 14 ? 1e12 : 1e10;
  if (!Number.isFinite(n) || Math.abs(n) >= limit) {
    report.unparseableNumbers.push(`${where}: "${raw}" does not fit NUMERIC(${precision},2)`);
    return null;
  }
  return n;
}

/** ISO timestamp, or null (reported) when present but invalid. */
function parseTimestamp(value: unknown, where: string): string | null {
  const raw = str(value).trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) {
    report.unparseableDates.push(`${where}: "${raw}"`);
    return null;
  }
  return new Date(t).toISOString();
}

/** YYYY-MM-DD date, or null (reported) when present but invalid. */
function parseDate(value: unknown, where: string): string | null {
  const raw = str(value).trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && !Number.isNaN(Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`))) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  report.unparseableDates.push(`${where}: "${raw}"`);
  return null;
}

const yesNo = (v: unknown): 'yes' | 'no' | null => (v === 'yes' || v === 'no' ? v : null);
const format = (v: unknown): 'hardcopy' | 'softcopy' | null => (v === 'hardcopy' || v === 'softcopy' ? v : null);

/** "REQ-0042" or "REQ-EDGC-0042" -> { prefix: 'REQ', number: 42 }. */
function splitDocumentNumber(value: string): { prefix: string; number: number } | null {
  const m = value.trim().match(/^([A-Za-z]+)-(?:[A-Za-z0-9]+-)?(\d+)$/);
  return m ? { prefix: m[1].toUpperCase(), number: Number(m[2]) } : null;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

const chunks = <T>(items: T[]) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH) out.push(items.slice(i, i + BATCH));
  return out;
};

function fail(table: string, action: string, error: { message: string; details?: string | null; hint?: string | null }): never {
  const extra = [error.details, error.hint].filter(Boolean).join(' ');
  throw new Error(`${action} ${table} failed: ${error.message}${extra ? ` (${extra})` : ''}`);
}

async function selectAll(sb: SupabaseClient, table: string, columns = '*'): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999);
    if (error) fail(table, 'Reading', error);
    rows.push(...((data as unknown as Row[]) || []));
    if (!data || data.length < 1000) return rows;
  }
}

/** Upserts and returns the written rows (with generated ids). */
async function upsert(sb: SupabaseClient, table: string, rows: Row[], onConflict: string, returning = '*'): Promise<Row[]> {
  if (!rows.length) return [];
  if (DRY_RUN) {
    countWritten(table, rows.length);
    return rows.map((r, i) => ({ id: -(i + 1), ...r }));
  }
  const out: Row[] = [];
  for (const part of chunks(rows)) {
    const { data, error } = await sb.from(table).upsert(part, { onConflict }).select(returning);
    if (error) fail(table, 'Writing', error);
    out.push(...((data as unknown as Row[]) || []));
  }
  countWritten(table, rows.length);
  return out;
}

/** Replaces the child rows of the given parents: delete theirs, insert the new set. */
async function replaceChildren(sb: SupabaseClient, table: string, parentColumn: string, parentIds: unknown[], rows: Row[]) {
  if (DRY_RUN) {
    countWritten(table, rows.length);
    return;
  }
  for (const part of chunks(parentIds)) {
    if (!part.length) continue;
    const { error } = await sb.from(table).delete().in(parentColumn, part as (string | number)[]);
    if (error) fail(table, 'Clearing', error);
  }
  for (const part of chunks(rows)) {
    const { error } = await sb.from(table).insert(part);
    if (error) fail(table, 'Writing', error);
  }
  countWritten(table, rows.length);
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env).');
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log(`IS Studio migration ${DRY_RUN ? '(DRY RUN: nothing will be written)' : ''}`);
  console.log(`Company: ${COMPANY_CODE}\n`);

  // ---- Read the old document and users (read only) ----
  const { data: docRows, error: docError } = await sb.from('workspace_data').select('id, tasks, runbooks, settings');
  if (docError) fail('workspace_data', 'Reading', docError);
  const doc = (docRows || []).find((r: Row) => r.id === 'default') as Row | undefined;
  const formDoc = (docRows || []).find((r: Row) => r.id === 'form-submissions') as Row | undefined;
  if (!doc) throw new Error('workspace_data row "default" not found; nothing to migrate.');

  const tasks = (Array.isArray(doc.tasks) ? doc.tasks : []) as Row[];
  const runbooks = (Array.isArray(doc.runbooks) ? doc.runbooks : []) as Row[];
  const settings = (doc.settings && typeof doc.settings === 'object' ? doc.settings : {}) as Row;
  const formStore = (formDoc?.settings && typeof formDoc.settings === 'object' ? formDoc.settings : {}) as Row;
  const submissions = (Array.isArray(formStore.submissions) ? formStore.submissions : []) as Row[];
  const formCounters = (formStore.counters && typeof formStore.counters === 'object' ? formStore.counters : {}) as Record<string, unknown>;

  const users = await selectAll(sb, 'app_users', 'id, email, name, company_id');
  countRead('tickets (workspace_data.tasks)', tasks.length);
  countRead('runbooks (workspace_data.runbooks)', runbooks.length);
  countRead('form submissions (form-submissions row)', submissions.length);
  countRead('settings (workspace_data.settings)', 1);
  countRead('app_users', users.length);

  // ---- Company ----
  let company: Row | undefined;
  {
    const { data, error } = await sb.from('companies').select('id, code, name').eq('code', COMPANY_CODE).maybeSingle();
    if (error) fail('companies', 'Reading', error);
    company = data || undefined;
    if (!company) {
      const [created] = await upsert(sb, 'companies', [{ code: COMPANY_CODE, name: COMPANY_NAME }], 'code');
      company = created;
    }
  }
  const companyId = company!.id as number;

  // ---- Reference data from the new tables ----
  const categories = await selectAll(sb, 'categories', 'id, name');
  const sites = (await selectAll(sb, 'sites', 'id, company_id, name')).filter((s) => s.company_id === companyId);
  const systemOptions = await selectAll(sb, 'form_system_options', 'id');
  const returnOptions = await selectAll(sb, 'form_asset_return_options', 'id, form_type, sort_order');

  const categoryByName = new Map(categories.map((c) => [key(c.name), c.id as number]));
  const siteByName = new Map(sites.map((s) => [key(s.name), s.id as number]));
  const userByEmail = new Map(users.map((u) => [key(u.email), u]));
  const systemOptionIds = new Set(systemOptions.map((o) => String(o.id)));
  const returnOptionsByType = (type: string) =>
    returnOptions
      .filter((o) => o.form_type === type)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((o) => String(o.id));

  const resolveCategory = (name: unknown, where: string): number | null => {
    const n = text(name);
    if (!n) return null;
    const id = categoryByName.get(key(n));
    if (!id) note(report.unknownCategories, n, where);
    return id ?? null;
  };
  const resolveSite = (location: unknown, where: string): number | null => {
    const l = text(location);
    if (!l) return null;
    const id = siteByName.get(key(l));
    if (!id) note(report.unmappedLocations, l, where);
    return id ?? null;
  };
  const resolveUserByEmail = (email: unknown, name: unknown, where: string): string | null => {
    const e = key(email);
    const user = e ? userByEmail.get(e) : undefined;
    if (user) return String(user.id);
    const label = [text(name), e ? `<${e}>` : null].filter(Boolean).join(' ') || '(no name or email)';
    note(report.unmatchedUsers, label, where);
    return null;
  };
  /** completedBy / rejectedBy store only a name: accept exactly one user with that name. */
  const resolveUserByName = (name: unknown, where: string): string | null => {
    const n = key(name);
    if (!n) return null;
    const found = users.filter((u) => key(u.name) === n);
    if (found.length === 1) return String(found[0].id);
    note(report.unmatchedUsers, `${text(name)} (name only${found.length > 1 ? `, ${found.length} users share it` : ''})`, where);
    return null;
  };

  // ---- Users: attach to the company (nothing else about a user changes) ----
  const usersWithoutCompany = users.filter((u) => u.company_id == null);
  if (usersWithoutCompany.length) {
    if (!DRY_RUN) {
      const { error } = await sb.from('app_users').update({ company_id: companyId }).is('company_id', null);
      if (error) fail('app_users', 'Updating', error);
    }
    countWritten('app_users (company_id set)', usersWithoutCompany.length);
  }

  // ---- Runbooks ----
  const runbookRows = runbooks.map((rb) => {
    const where = `runbook ${str(rb.code) || str(rb.id)}`;
    return {
      legacy_id: str(rb.id),
      code: str(rb.code).trim(),
      title: text(rb.title, 300) || '(untitled)',
      category_id: resolveCategory(rb.category, where),
      scope: 'group',
      company_id: null,
      site_id: null,
      status: ['active', 'draft', 'deprecated'].includes(str(rb.status)) ? str(rb.status) : 'active',
      version: text(rb.version, 20) || '1.0.0',
      author_name: text(rb.author, 200),
      author_role: text(rb.authorRole, 200),
      symptom: text(rb.symptom),
      root_cause_analysis: text(rb.rootCauseAnalysis),
      rollback_plan: text(rb.rollbackPlan),
      last_updated: parseDate(rb.lastUpdated, `${where} lastUpdated`),
    };
  });
  const writtenRunbooks = await upsert(sb, 'runbooks', runbookRows, 'legacy_id', 'id, legacy_id');
  const runbookIdByLegacy = new Map(writtenRunbooks.map((r) => [String(r.legacy_id), r.id as number]));
  const runbookIds = [...runbookIdByLegacy.values()];

  const rbTags: Row[] = [];
  const rbPatterns: Row[] = [];
  const rbDiagnostics: Row[] = [];
  const rbRemediation: Row[] = [];
  const rbPostmortem: Row[] = [];
  const rbReview: Row[] = [];
  for (const rb of runbooks) {
    const runbook_id = runbookIdByLegacy.get(str(rb.id));
    if (runbook_id == null) continue;
    const list = (v: unknown) => (Array.isArray(v) ? v : []);
    const seenTags = new Set<string>();
    for (const tag of list(rb.tags)) {
      const t = text(tag, 100);
      if (t && !seenTags.has(t.toLowerCase())) {
        seenTags.add(t.toLowerCase());
        rbTags.push({ runbook_id, tag: t });
      }
    }
    list(rb.triggerAlertPatterns).map((p) => text(p)).filter(Boolean)
      .forEach((pattern, i) => rbPatterns.push({ runbook_id, position: i + 1, pattern }));
    list(rb.diagnosticSteps).forEach((s: Row, i) => {
      const shell = str(s?.shellType);
      const knownShell = SHELL_TYPES.includes(shell);
      if (shell && !knownShell) {
        report.unresolvedReferences.push(`runbook ${str(rb.code)} diagnostic step ${i + 1}: shell type "${shell}" is not in the list; stored as general`);
      }
      rbDiagnostics.push({
        runbook_id,
        position: i + 1,
        title: text(s?.title, 300) || `Check ${i + 1}`,
        explanation: text(s?.explanation),
        cli: text(s?.cli),
        shell_type: knownShell ? shell : 'general',
      });
    });
    list(rb.remediationSteps).forEach((s: Row, i) =>
      rbRemediation.push({
        runbook_id,
        position: i + 1,
        title: text(s?.title, 300) || `Step ${i + 1}`,
        instruction: text(s?.instruction),
        command: text(s?.command),
        dangerous: Boolean(s?.dangerous),
        verification: text(s?.verification),
      })
    );
    list(rb.postMortemChecklist).map((p) => text(p)).filter(Boolean)
      .forEach((item, i) => rbPostmortem.push({ runbook_id, position: i + 1, item }));
    list(rb.needsConfirming).map((p) => text(p)).filter(Boolean)
      .forEach((n, i) => rbReview.push({ runbook_id, kind: 'needs_confirming', position: i + 1, note: n }));
    list(rb.placeholders).map((p) => text(p)).filter(Boolean)
      .forEach((n, i) => rbReview.push({ runbook_id, kind: 'placeholder', position: i + 1, note: n }));
  }
  await replaceChildren(sb, 'runbook_tags', 'runbook_id', runbookIds, rbTags);
  await replaceChildren(sb, 'runbook_trigger_patterns', 'runbook_id', runbookIds, rbPatterns);
  await replaceChildren(sb, 'runbook_diagnostic_steps', 'runbook_id', runbookIds, rbDiagnostics);
  await replaceChildren(sb, 'runbook_remediation_steps', 'runbook_id', runbookIds, rbRemediation);
  await replaceChildren(sb, 'runbook_postmortem_items', 'runbook_id', runbookIds, rbPostmortem);
  await replaceChildren(sb, 'runbook_review_items', 'runbook_id', runbookIds, rbReview);

  // ---- Tickets ----
  const ticketRows = tasks.map((t) => {
    const where = `ticket ${str(t.ticketNumber)}`;
    const status = str(t.status);
    if (!TICKET_STATUSES.includes(status)) {
      report.unresolvedReferences.push(`${where}: status "${status}" is not a known status; stored as backlog`);
    }
    // The portal stores the chosen category as systemRequested; the app shows that first.
    const categoryName = text(t.systemRequested) || text(t.category);
    const assignee = (t.assignee && typeof t.assignee === 'object' ? t.assignee : {}) as Row;
    return {
      legacy_id: str(t.id),
      company_id: companyId,
      ticket_number: str(t.ticketNumber).trim(),
      title: text(t.title, 300) || '(untitled)',
      description: text(t.description),
      raw_logs: text(t.rawLogs),
      error_signature: text(t.errorSignature, 500),
      status: TICKET_STATUSES.includes(status) ? status : 'backlog',
      category_id: resolveCategory(categoryName, where),
      requester_id: t.requesterEmail || t.requesterName ? resolveUserByEmail(t.requesterEmail, t.requesterName, `${where} requester`) : null,
      assignee_id: assignee.email || assignee.name ? resolveUserByEmail(assignee.email, assignee.name, `${where} assignee`) : null,
      site_id: resolveSite(t.userLocation, where),
      device_info: text(t.deviceInfo, 300),
      phone_ext: text(t.userPhoneExt, 32),
      hod_name: text(t.hodName, 200),
      hod_email: text(t.hodEmail, 320),
      is_user_submitted: Boolean(t.isUserSubmitted),
      incident_summary: text(t.incidentSummary),
      resolution_notes: text(t.resolutionNotes),
      due_date: parseTimestamp(t.dueDate, `${where} dueDate`),
      resolved_at: parseTimestamp(t.resolvedAt, `${where} resolvedAt`),
      created_at: parseTimestamp(t.createdAt, `${where} createdAt`) || new Date().toISOString(),
      updated_at: parseTimestamp(t.updatedAt, `${where} updatedAt`) || parseTimestamp(t.createdAt, where) || new Date().toISOString(),
    };
  });
  const writtenTickets = await upsert(sb, 'tickets', ticketRows, 'legacy_id', 'id, legacy_id, status, updated_at');
  const ticketIdByLegacy = new Map(writtenTickets.map((r) => [String(r.legacy_id), r.id as number]));
  const ticketIds = [...ticketIdByLegacy.values()];

  const ticketTags: Row[] = [];
  const checklist: Row[] = [];
  for (const t of tasks) {
    const ticket_id = ticketIdByLegacy.get(str(t.id));
    if (ticket_id == null) continue;
    for (const [source, list] of [['automated', t.automatedTags], ['manual', t.manualTags]] as const) {
      const seen = new Set<string>();
      for (const tag of Array.isArray(list) ? list : []) {
        const v = text(tag, 100);
        if (v && !seen.has(v.toLowerCase())) {
          seen.add(v.toLowerCase());
          ticketTags.push({ ticket_id, source, tag: v });
        }
      }
    }
    (Array.isArray(t.checklist) ? t.checklist : []).forEach((c: Row, i: number) => {
      const itemText = text(c?.text, 500);
      if (itemText) checklist.push({ ticket_id, position: i + 1, item_text: itemText, done: Boolean(c.done), command: text(c.command) });
    });
  }
  await replaceChildren(sb, 'ticket_tags', 'ticket_id', ticketIds, ticketTags);
  await replaceChildren(sb, 'ticket_checklist_items', 'ticket_id', ticketIds, checklist);

  // Status history: the document kept no history, so each ticket gets one row
  // recording the state it was in at migration. Only added when a ticket has
  // no history yet, so a re-run never duplicates it.
  {
    const existing = DRY_RUN ? [] : await selectAll(sb, 'ticket_status_history', 'ticket_id');
    const hasHistory = new Set(existing.map((r) => Number(r.ticket_id)));
    const historyRows = writtenTickets
      .filter((t) => !hasHistory.has(Number(t.id)))
      .map((t) => ({
        ticket_id: t.id,
        from_status: null,
        to_status: t.status,
        changed_by_id: null,
        changed_at: t.updated_at,
        note: 'State at migration from workspace_data; earlier changes were not recorded.',
      }));
    if (historyRows.length) {
      if (!DRY_RUN) {
        for (const part of chunks(historyRows)) {
          const { error } = await sb.from('ticket_status_history').insert(part);
          if (error) fail('ticket_status_history', 'Writing', error);
        }
      }
      countWritten('ticket_status_history', historyRows.length);
    }
  }

  // Runbook <-> ticket links, from both places the document kept them.
  {
    const pairs = new Map<string, Row>();
    const link = (runbookLegacy: string, ticketLegacy: string, where: string) => {
      const runbook_id = runbookIdByLegacy.get(runbookLegacy);
      const ticket_id = ticketIdByLegacy.get(ticketLegacy);
      if (runbook_id == null || ticket_id == null) {
        report.unresolvedReferences.push(`${where}: links runbook "${runbookLegacy}" and ticket "${ticketLegacy}", but one of them does not exist`);
        return;
      }
      pairs.set(`${runbook_id}:${ticket_id}`, { runbook_id, ticket_id });
    };
    for (const rb of runbooks) {
      for (const tid of Array.isArray(rb.relatedTaskIds) ? rb.relatedTaskIds : []) link(str(rb.id), str(tid), `runbook ${str(rb.code)} relatedTaskIds`);
    }
    for (const t of tasks) {
      if (t.linkedRunbookId) link(str(t.linkedRunbookId), str(t.id), `ticket ${str(t.ticketNumber)} linkedRunbookId`);
    }
    await replaceChildren(sb, 'runbook_related_tickets', 'runbook_id', runbookIds, [...pairs.values()]);
  }

  // ---- Forms ----
  const submissionRows = submissions.map((s) => {
    const where = `form ${str(s.formNumber)}`;
    const d = (s.data && typeof s.data === 'object' ? s.data : {}) as Row;
    const by = (s.submittedBy && typeof s.submittedBy === 'object' ? s.submittedBy : {}) as Row;
    const isAsset = s.type === 'disposal' || s.type === 'allocation';
    return {
      legacy_id: str(s.id),
      company_id: companyId,
      form_number: str(s.formNumber).trim(),
      form_type: str(s.type),
      submitted_by_id: resolveUserByEmail(by.email, by.name, `${where} submitted by`),
      submitted_at: parseTimestamp(s.submittedAt, `${where} submittedAt`) || new Date().toISOString(),
      // Asset forms name the applicant "Submitted By" and have no phone or designation.
      requestor_name: text(isAsset ? d.submittedBy : d.requestorName, 200),
      phone_ext: isAsset ? null : text(d.phoneExt, 32),
      designation: isAsset ? null : text(d.designation, 200),
      department: text(d.department, 200),
      request_date: parseDate(d.requestDate, `${where} requestDate`),
      site_id: resolveSite(d.location, where),
      has_attachments: isAsset ? null : yesNo(d.hasAttachments),
      attachment_format: isAsset ? null : format(d.attachmentFormat),
      viewed_at: parseTimestamp(s.viewedAt, `${where} viewedAt`),
      completed_at: parseTimestamp(s.completedAt, `${where} completedAt`),
      completed_by_id: s.completedBy ? resolveUserByName(s.completedBy, `${where} completed by`) : null,
      rejected_at: parseTimestamp(s.rejectedAt, `${where} rejectedAt`),
      rejected_by_id: s.rejectedBy ? resolveUserByName(s.rejectedBy, `${where} rejected by`) : null,
      rejection_reason: text(s.rejectionReason),
    };
  });
  const writtenForms = await upsert(sb, 'form_submissions', submissionRows, 'legacy_id', 'id, legacy_id');
  const formIdByLegacy = new Map(writtenForms.map((r) => [String(r.legacy_id), r.id as number]));

  const userIdRows: Row[] = [];
  const userIdSystems: Row[] = [];
  const requisitionRows: Row[] = [];
  const requisitionItems: Row[] = [];
  const assetRows: Row[] = [];
  const assetItems: Row[] = [];
  const assetReturns: Row[] = [];
  const formIdsByType: Record<string, number[]> = { 'user-id': [], requisition: [], asset: [] };

  for (const s of submissions) {
    const submission_id = formIdByLegacy.get(str(s.id));
    if (submission_id == null) continue;
    const where = `form ${str(s.formNumber)}`;
    const d = (s.data && typeof s.data === 'object' ? s.data : {}) as Row;

    if (s.type === 'user-id') {
      formIdsByType['user-id'].push(submission_id);
      userIdRows.push({ submission_id, others_detail: text(d.othersDetail, 300), remarks: text(d.remarks) });
      const systems = (d.systems && typeof d.systems === 'object' ? d.systems : {}) as Record<string, unknown>;
      for (const [optionId, ticked] of Object.entries(systems)) {
        if (!ticked) continue;
        if (!systemOptionIds.has(optionId)) {
          report.unresolvedReferences.push(`${where}: system "${optionId}" is not in form_system_options; not migrated`);
          continue;
        }
        userIdSystems.push({ submission_id, option_id: optionId });
      }
    } else if (s.type === 'requisition') {
      formIdsByType.requisition.push(submission_id);
      requisitionRows.push({
        submission_id,
        ref_no: text(d.refNo, 60),
        company_name: text(d.company, 200),
        attachment_remark: text(d.attachmentRemark, 500),
        budgeted: yesNo(d.budgeted),
        budgeted_amount: parseAmount(d.budgetedAmount, `${where} budgetedAmount`, 14),
        utilised_amount: parseAmount(d.utilisedAmount, `${where} utilisedAmount`, 14),
        proposed_capex: parseAmount(d.proposedCapex, `${where} proposedCapex`, 14),
        balance_amount: parseAmount(d.balanceAmount, `${where} balanceAmount`, 14),
        purpose: text(d.purpose),
      });
      for (const [section, list] of [['requested', d.items], ['it', d.itItems]] as const) {
        (Array.isArray(list) ? list : []).forEach((item: Row, i: number) =>
          requisitionItems.push({
            submission_id,
            section,
            position: i + 1,
            description: text(item?.description),
            quantity: parseAmount(item?.quantity, `${where} ${section} item ${i + 1} quantity`, 12),
            unit_price: parseAmount(item?.price, `${where} ${section} item ${i + 1} price`, 14),
          })
        );
      }
    } else if (s.type === 'disposal' || s.type === 'allocation') {
      formIdsByType.asset.push(submission_id);
      assetRows.push({ submission_id, employee_id: text(d.employeeId, 60), reference_no: text(d.referenceNo, 60), it_remarks: text(d.itRemarks) });
      (Array.isArray(d.items) ? d.items : []).forEach((item: Row, i: number) =>
        assetItems.push({
          submission_id,
          position: i + 1,
          description: text(item?.description),
          spec_model: text(item?.specModel, 200),
          serial_number: text(item?.serialNumber, 120),
          quantity: parseAmount(item?.quantity, `${where} item ${i + 1} quantity`, 12),
          remarks: text(item?.remarks),
        })
      );
      // Ticks were stored by POSITION in the form's option list. Map each to
      // the option at that position in today's order, which is what the PDF
      // printed, and store its stable id from now on.
      const options = returnOptionsByType(str(s.type));
      (Array.isArray(d.itReturnOptions) ? d.itReturnOptions : []).forEach((ticked: unknown, i: number) => {
        if (!ticked) return;
        const optionId = options[i];
        if (!optionId) {
          report.unresolvedReferences.push(`${where}: Section D tick at position ${i + 1} has no matching ${s.type} option; not migrated`);
          return;
        }
        assetReturns.push({ submission_id, option_id: optionId });
      });
    } else {
      report.unresolvedReferences.push(`${where}: unknown form type "${str(s.type)}"; only the shared fields were migrated`);
    }
  }

  await upsert(sb, 'form_user_id', userIdRows, 'submission_id', 'submission_id');
  await replaceChildren(sb, 'form_user_id_systems', 'submission_id', formIdsByType['user-id'], userIdSystems);
  await upsert(sb, 'form_requisition', requisitionRows, 'submission_id', 'submission_id');
  await replaceChildren(sb, 'form_requisition_items', 'submission_id', formIdsByType.requisition, requisitionItems);
  await upsert(sb, 'form_asset', assetRows, 'submission_id', 'submission_id');
  await replaceChildren(sb, 'form_asset_items', 'submission_id', formIdsByType.asset, assetItems);
  await replaceChildren(sb, 'form_asset_returns', 'submission_id', formIdsByType.asset, assetReturns);

  // ---- Attachments (tickets and forms) ----
  {
    const rows: Row[] = [];
    const add = (a: Row, parent: { ticket_id?: number; form_submission_id?: number }, where: string) => {
      const storageKey = text(a?.id, 200);
      if (!storageKey) {
        report.unresolvedReferences.push(`${where}: attachment "${str(a?.name)}" has no storage id; not migrated`);
        return;
      }
      rows.push({
        storage_key: storageKey,
        ticket_id: parent.ticket_id ?? null,
        form_submission_id: parent.form_submission_id ?? null,
        file_name: text(a.name, 260) || storageKey,
        size_bytes: Number.isFinite(Number(a.size)) ? Math.max(0, Math.round(Number(a.size))) : 0,
        content_type: text(a.type, 150),
        storage_backend: a.storage === 'local' ? 'local' : 'supabase',
        uploaded_at: parseTimestamp(a.uploadedAt, `${where} attachment uploadedAt`) || new Date().toISOString(),
      });
    };
    for (const t of tasks) {
      const ticket_id = ticketIdByLegacy.get(str(t.id));
      for (const a of Array.isArray(t.attachments) ? t.attachments : []) if (ticket_id != null) add(a, { ticket_id }, `ticket ${str(t.ticketNumber)}`);
    }
    for (const s of submissions) {
      const form_submission_id = formIdByLegacy.get(str(s.id));
      for (const a of Array.isArray(s.attachments) ? s.attachments : []) if (form_submission_id != null) add(a, { form_submission_id }, `form ${str(s.formNumber)}`);
    }
    await upsert(sb, 'attachments', rows, 'storage_key', 'id');
  }

  // ---- Document number sequences ----
  // Seeded from the highest number already issued per prefix. The document's
  // own counters are also honoured: a number issued and later deleted must
  // never be issued again. A sequence never moves down.
  {
    const highest = new Map<string, number>();
    const bump = (prefix: string, n: number) => highest.set(prefix, Math.max(highest.get(prefix) || 0, n));
    for (const t of tasks) {
      const parts = splitDocumentNumber(str(t.ticketNumber));
      if (parts) bump(parts.prefix, parts.number);
      else report.unresolvedReferences.push(`ticket "${str(t.ticketNumber)}": number has no PREFIX-NNNN form; kept as-is, not counted in a sequence`);
    }
    for (const s of submissions) {
      const parts = splitDocumentNumber(str(s.formNumber));
      if (parts) bump(parts.prefix, parts.number);
    }
    const foundOnly = new Map(highest);
    const counters = new Map<string, number>();
    const lastTicket = Number(settings.lastTicketSequence);
    if (Number.isFinite(lastTicket) && lastTicket > 0) counters.set('REQ', lastTicket);
    const formPrefix: Record<string, string> = { 'user-id': 'UID', requisition: 'IRQ', disposal: 'DSP', allocation: 'ALC' };
    for (const [type, value] of Object.entries(formCounters)) {
      const prefix = formPrefix[type];
      if (prefix && Number.isFinite(Number(value)) && Number(value) > 0) counters.set(prefix, Number(value));
    }
    for (const [prefix, value] of counters) bump(prefix, value);

    const existing = (await selectAll(sb, 'ticket_sequences', 'company_id, prefix, last_value')).filter((r) => r.company_id === companyId);
    const current = new Map(existing.map((r) => [String(r.prefix), Number(r.last_value)]));
    const rows = [...highest.entries()].map(([prefix, value]) => {
      const last_value = Math.max(value, current.get(prefix) || 0);
      report.sequences.push(
        `${prefix}: highest number found ${foundOnly.get(prefix) ?? 0}` +
          `${counters.has(prefix) ? `, old counter ${counters.get(prefix)}` : ''}` +
          `${current.has(prefix) ? `, already in table ${current.get(prefix)}` : ''} -> last_value ${last_value}`
      );
      return { company_id: companyId, prefix, last_value };
    });
    await upsert(sb, 'ticket_sequences', rows, 'company_id,prefix', 'prefix');
  }

  // ---- Settings (single row) ----
  {
    const views = (settings.visibleViews && typeof settings.visibleViews === 'object' ? settings.visibleViews : {}) as Row;
    const on = (v: unknown) => v !== false;
    const defaultView = str(settings.defaultView);
    const retention = Number(settings.completedTicketRetentionMinutes);
    await upsert(
      sb,
      'settings',
      [
        {
          id: 1,
          default_view: ['kanban', 'list', 'history', 'handbook', 'analytics', 'forms', 'formHistory'].includes(defaultView) ? defaultView : 'kanban',
          show_kanban: on(views.kanban),
          show_list: on(views.list),
          show_history: on(views.history),
          show_handbook: on(views.handbook),
          show_analytics: on(views.analytics),
          show_forms: on(views.forms),
          show_form_history: on(views.formHistory),
          completed_ticket_retention_minutes: Number.isFinite(retention) && retention > 0 ? Math.round(retention) : 60,
          chat_knowledge_mode: settings.chatKnowledgeMode === 'full' ? 'full' : 'scoped',
          default_category_id: resolveCategory(settings.defaultCategory, 'settings defaultCategory'),
          operator_name: text(settings.operatorName, 200),
          updated_at: new Date().toISOString(),
        },
      ],
      'id',
      'id'
    );
    const kept = new Set(['defaultView', 'visibleViews', 'completedTicketRetentionMinutes', 'chatKnowledgeMode', 'defaultCategory', 'operatorName', 'lastTicketSequence']);
    const dropped = Object.keys(settings).filter((k) => !kept.has(k));
    if (dropped.length) report.notMigrated.push(`settings keys with no column (retired or per-browser): ${dropped.join(', ')}`);
  }

  // Fields present in the document that the schema deliberately does not carry.
  const presentKeys = (items: Row[], names: string[]) => names.filter((n) => items.some((i) => i && i[n] !== undefined));
  const ticketDropped = presentKeys(tasks, ['requesterName', 'requesterEmail', 'requesterDepartment', 'requesterId', 'affectedUsersEstimate', 'systemRequested']);
  if (ticketDropped.length) {
    report.notMigrated.push(
      `ticket fields replaced by references or retired: ${ticketDropped.join(', ')} ` +
        '(requester details now come from app_users; systemRequested became category_id; affectedUsersEstimate was retired)'
    );
  }
  const assigneeCopies = tasks.filter((t) => t.assignee).length;
  if (assigneeCopies) report.notMigrated.push(`ticket assignee {name, role, email} copies (${assigneeCopies}) replaced by assignee_id`);
  const fileNameLists = submissions.filter((s) => Array.isArray((s.data as Row)?.attachmentFileNames) && ((s.data as Row).attachmentFileNames as unknown[]).length).length;
  report.notMigrated.push(`form attachmentFileNames lists: dropped by design (${fileNameLists} non-empty); attachments table records the files`);
  report.notMigrated.push('workspace_data.rules: dropped (tagging rules were removed in 14092026ver023)');

  printReport();
}

function printReport() {
  const section = (title: string) => console.log(`\n== ${title} ==`);
  section('Rows read');
  for (const [what, n] of Object.entries(report.read)) console.log(`  ${String(n).padStart(5)}  ${what}`);
  section(DRY_RUN ? 'Rows that would be written' : 'Rows written');
  for (const [table, n] of Object.entries(report.written)) console.log(`  ${String(n).padStart(5)}  ${table}`);

  const list = (title: string, items: string[]) => {
    section(`${title} (${items.length})`);
    if (!items.length) console.log('  none');
    items.forEach((i) => console.log(`  - ${i}`));
  };
  const mapList = (title: string, map: Map<string, string[]>) =>
    list(title, [...map.entries()].map(([k, where]) => `${k}  [${where.length}x: ${where.slice(0, 6).join('; ')}${where.length > 6 ? '; ...' : ''}]`));

  mapList('Unmatched users (reference left empty)', report.unmatchedUsers);
  mapList('Unmapped locations (create sites, then re-run)', report.unmappedLocations);
  mapList('Unknown categories (category left empty)', report.unknownCategories);
  list('Unparseable numbers (left empty)', report.unparseableNumbers);
  list('Unparseable dates (left empty)', report.unparseableDates);
  list('Unresolved references', report.unresolvedReferences);
  list('Sequences', report.sequences);
  list('Not migrated, by design', report.notMigrated);
  console.log(DRY_RUN ? '\nDry run complete. Nothing was written.' : '\nMigration complete. workspace_data was not modified.');
}

main().catch((err) => {
  console.error(`\nMigration stopped: ${err instanceof Error ? err.message : String(err)}`);
  console.error('Nothing in workspace_data was modified. Fix the cause and re-run; completed steps are safe to repeat.');
  process.exit(1);
});
