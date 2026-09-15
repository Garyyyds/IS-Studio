/**
 * Stage 3: check the normalised tables against the original JSONB document.
 *
 *   npx tsx db/verify.ts
 *
 * Read only: it reads workspace_data, app_users and the new tables, and writes
 * nothing anywhere.
 *
 * Reports:
 *  1. counts per entity, old document vs new tables;
 *  2. a field-by-field comparison for a sample of 20 tickets, 10 runbooks and
 *     10 form submissions, including their child rows.
 *
 * The expected value of every field is derived here from the old document,
 * independently of db/migrate.ts, so a mistake in the migration cannot hide
 * itself by being repeated in the check.
 *
 * A difference is marked "explained" when it is one the migration is required
 * to leave for a person to resolve: a user, site or category with no match, or
 * a number or date that does not parse. Everything else is a MISMATCH, and the
 * script exits with code 1 if there is any.
 *
 * Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIGRATION_COMPANY_CODE (default EDC).
 */
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;

const COMPANY_CODE = (process.env.MIGRATION_COMPANY_CODE || 'EDC').trim().toUpperCase();
const SAMPLE = { tickets: 20, runbooks: 10, forms: 10 };

// ---------------------------------------------------------------------------
// Normalisation used only for comparing
// ---------------------------------------------------------------------------

/** Empty strings and missing values compare equal to NULL; text is trimmed. */
const t = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const lower = (v: unknown) => (t(v) || '').toLowerCase();
const bool = (v: unknown) => Boolean(v);
const epoch = (v: unknown): number | null => {
  const s = t(v);
  if (!s) return null;
  const n = Date.parse(s);
  return Number.isNaN(n) ? NaN : n;
};
const day = (v: unknown): string | null => {
  const s = t(v);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const n = Date.parse(s);
  return Number.isNaN(n) ? 'unparseable' : new Date(n).toISOString().slice(0, 10);
};
/** A typed amount as the number it means, 'unparseable', or null when blank. */
const amount = (v: unknown): number | 'unparseable' | null => {
  const s = t(v);
  if (!s) return null;
  const c = s.replace(/^RM\s*/i, '').replace(/[,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(c) ? Math.round(Number(c) * 100) / 100 : 'unparseable';
};
const num = (v: unknown): number | null => (v == null ? null : Math.round(Number(v) * 100) / 100);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const countLines: string[] = [];
const diffLines: string[] = [];
let mismatches = 0;
let explained = 0;

function countCheck(entity: string, oldCount: number, newCount: number, note = '') {
  const ok = oldCount === newCount;
  if (!ok) mismatches++;
  countLines.push(`  ${ok ? 'OK      ' : 'MISMATCH'}  ${entity.padEnd(46)} old ${String(oldCount).padStart(4)}   new ${String(newCount).padStart(4)}${note ? `   ${note}` : ''}`);
}

/**
 * Compares one field. `explain` returns a reason when the difference is an
 * accepted outcome (e.g. no matching user exists), otherwise null. The new
 * value must then be the documented fallback: `fallback`, or NULL by default.
 */
function field(record: string, name: string, expected: unknown, actual: unknown, explain?: () => string | null, fallback: unknown = null) {
  const same =
    (expected == null && actual == null) ||
    (typeof expected === 'number' && typeof actual === 'number' && (Number.isNaN(expected) ? Number.isNaN(actual) : Math.abs(expected - actual) < 0.005)) ||
    JSON.stringify(expected) === JSON.stringify(actual);
  if (same) return;
  const reason = explain ? explain() : null;
  if (reason && JSON.stringify(actual ?? null) === JSON.stringify(fallback)) {
    explained++;
    diffLines.push(`  explained  ${record}  ${name}: old ${JSON.stringify(expected)} -> new ${JSON.stringify(actual ?? null)} (${reason})`);
  } else {
    mismatches++;
    diffLines.push(`  MISMATCH   ${record}  ${name}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function all(sb: SupabaseClient, table: string, columns = '*'): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`Reading ${table}: ${error.message}`);
    rows.push(...((data as unknown as Row[]) || []));
    if (!data || data.length < 1000) return rows;
  }
}

const groupBy = <T extends Row>(rows: T[], keyName: string) => {
  const map = new Map<unknown, T[]>();
  for (const r of rows) {
    const k = r[keyName];
    map.set(k, [...(map.get(k) || []), r]);
  }
  return map;
};
const byPosition = (rows: Row[] = []) => [...rows].sort((a, b) => a.position - b.position);

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env).');
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Old document
  const { data: docRows, error } = await sb.from('workspace_data').select('id, tasks, runbooks, settings');
  if (error) throw new Error(`Reading workspace_data: ${error.message}`);
  const doc = (docRows || []).find((r: Row) => r.id === 'default') as Row;
  const formDoc = (docRows || []).find((r: Row) => r.id === 'form-submissions') as Row | undefined;
  const tasks: Row[] = Array.isArray(doc?.tasks) ? doc.tasks : [];
  const runbooks: Row[] = Array.isArray(doc?.runbooks) ? doc.runbooks : [];
  const settingsDoc: Row = doc?.settings || {};
  const submissions: Row[] = Array.isArray(formDoc?.settings?.submissions) ? formDoc!.settings.submissions : [];
  const formCounters: Row = formDoc?.settings?.counters || {};

  // New tables
  const [company] = (await all(sb, 'companies')).filter((c) => c.code === COMPANY_CODE);
  if (!company) throw new Error(`Company ${COMPANY_CODE} not found in the new tables. Has db/migrate.ts been run?`);
  const users = await all(sb, 'app_users', 'id, email, name, company_id');
  const categories = await all(sb, 'categories');
  const sites = await all(sb, 'sites');
  const tickets = (await all(sb, 'tickets')).filter((r) => r.company_id === company.id);
  const ticketTags = await all(sb, 'ticket_tags');
  const checklist = await all(sb, 'ticket_checklist_items');
  const history = await all(sb, 'ticket_status_history');
  const rbs = await all(sb, 'runbooks');
  const rbTags = await all(sb, 'runbook_tags');
  const rbPatterns = await all(sb, 'runbook_trigger_patterns');
  const rbDiag = await all(sb, 'runbook_diagnostic_steps');
  const rbRem = await all(sb, 'runbook_remediation_steps');
  const rbPost = await all(sb, 'runbook_postmortem_items');
  const rbReview = await all(sb, 'runbook_review_items');
  const rbRelated = await all(sb, 'runbook_related_tickets');
  const forms = (await all(sb, 'form_submissions')).filter((r) => r.company_id === company.id);
  const fUser = await all(sb, 'form_user_id');
  const fSystems = await all(sb, 'form_user_id_systems');
  const fReq = await all(sb, 'form_requisition');
  const fReqItems = await all(sb, 'form_requisition_items');
  const fAsset = await all(sb, 'form_asset');
  const fAssetItems = await all(sb, 'form_asset_items');
  const fReturns = await all(sb, 'form_asset_returns');
  const returnOptions = await all(sb, 'form_asset_return_options');
  const systemOptions = await all(sb, 'form_system_options');
  const attachments = await all(sb, 'attachments');
  const sequences = (await all(sb, 'ticket_sequences')).filter((r) => r.company_id === company.id);
  const settingsRows = await all(sb, 'settings');

  const userById = new Map(users.map((u) => [u.id, u]));
  const userEmails = new Set(users.map((u) => lower(u.email)));
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryNames = new Set(categories.map((c) => lower(c.name)));
  const siteById = new Map(sites.map((s) => [s.id, s.name]));
  const siteNames = new Set(sites.filter((s) => s.company_id === company.id).map((s) => lower(s.name)));
  const ticketByLegacy = new Map(tickets.map((r) => [r.legacy_id, r]));
  const ticketLegacyById = new Map(tickets.map((r) => [r.id, r.legacy_id]));
  const rbByLegacy = new Map(rbs.map((r) => [r.legacy_id, r]));
  const formByLegacy = new Map(forms.map((r) => [r.legacy_id, r]));
  const tagsByTicket = groupBy(ticketTags, 'ticket_id');
  const checklistByTicket = groupBy(checklist, 'ticket_id');

  const noUser = (email: unknown) => (userEmails.has(lower(email)) ? null : 'no app_users row with that email');
  const noCategory = (name: unknown) => (categoryNames.has(lower(name)) ? null : 'no category with that name');
  const noSite = (name: unknown) => (siteNames.has(lower(name)) ? null : 'no site with that name');
  const badAmount = (v: unknown, precision: 12 | 14 = 14) => {
    const a = amount(v);
    if (a === 'unparseable') return 'number did not parse';
    if (typeof a === 'number' && Math.abs(a) >= (precision === 14 ? 1e12 : 1e10)) return `number does not fit NUMERIC(${precision},2)`;
    return null;
  };

  const uniqueCI = (list: unknown) => [...new Set((Array.isArray(list) ? list : []).map(t).filter(Boolean).map((s) => s!.toLowerCase()))];
  const nonEmpty = (list: unknown) => (Array.isArray(list) ? list : []).map(t).filter(Boolean) as string[];

  // ---------------------------------------------------------------------------
  // 1. Counts
  // ---------------------------------------------------------------------------
  const ids = (rows: Row[]) => new Set(rows.map((r) => r.id));
  const within = (rows: Row[], column: string, parents: Set<unknown>) => rows.filter((r) => parents.has(r[column])).length;

  const migratedTicketIds = new Set(tasks.map((x) => ticketByLegacy.get(x.id)?.id).filter((v) => v != null));
  countCheck('tickets', tasks.length, tasks.filter((x) => ticketByLegacy.has(x.id)).length);
  const extraTickets = tickets.filter((r) => !tasks.some((x) => x.id === r.legacy_id)).length;
  if (extraTickets) countLines.push(`  note      ${extraTickets} ticket row(s) in the new table have no counterpart in the document`);
  countCheck(
    'ticket tags (unique per ticket and source)',
    tasks.reduce((n, x) => n + uniqueCI(x.automatedTags).length + uniqueCI(x.manualTags).length, 0),
    within(ticketTags, 'ticket_id', migratedTicketIds)
  );
  countCheck('ticket checklist items', tasks.reduce((n, x) => n + (Array.isArray(x.checklist) ? x.checklist.filter((c: Row) => t(c?.text)).length : 0), 0), within(checklist, 'ticket_id', migratedTicketIds));
  countCheck('ticket status history (one initial row per ticket)', tasks.length, new Set(history.filter((h) => migratedTicketIds.has(h.ticket_id)).map((h) => h.ticket_id)).size, 'tickets with at least one row');
  countCheck('ticket attachments', tasks.reduce((n, x) => n + (Array.isArray(x.attachments) ? x.attachments.length : 0), 0), within(attachments, 'ticket_id', migratedTicketIds));

  const migratedRbIds = new Set(runbooks.map((x) => rbByLegacy.get(x.id)?.id).filter((v) => v != null));
  countCheck('runbooks', runbooks.length, runbooks.filter((x) => rbByLegacy.has(x.id)).length);
  countCheck('runbook tags (unique per runbook)', runbooks.reduce((n, x) => n + uniqueCI(x.tags).length, 0), within(rbTags, 'runbook_id', migratedRbIds));
  countCheck('runbook trigger patterns', runbooks.reduce((n, x) => n + nonEmpty(x.triggerAlertPatterns).length, 0), within(rbPatterns, 'runbook_id', migratedRbIds));
  countCheck('runbook diagnostic steps', runbooks.reduce((n, x) => n + (Array.isArray(x.diagnosticSteps) ? x.diagnosticSteps.length : 0), 0), within(rbDiag, 'runbook_id', migratedRbIds));
  countCheck('runbook remediation steps', runbooks.reduce((n, x) => n + (Array.isArray(x.remediationSteps) ? x.remediationSteps.length : 0), 0), within(rbRem, 'runbook_id', migratedRbIds));
  countCheck('runbook post-mortem items', runbooks.reduce((n, x) => n + nonEmpty(x.postMortemChecklist).length, 0), within(rbPost, 'runbook_id', migratedRbIds));
  countCheck('runbook review items', runbooks.reduce((n, x) => n + nonEmpty(x.needsConfirming).length + nonEmpty(x.placeholders).length, 0), within(rbReview, 'runbook_id', migratedRbIds));
  {
    const pairs = new Set<string>();
    const taskIds = new Set(tasks.map((x) => x.id));
    const rbIds = new Set(runbooks.map((x) => x.id));
    for (const rb of runbooks) for (const tid of Array.isArray(rb.relatedTaskIds) ? rb.relatedTaskIds : []) if (taskIds.has(tid)) pairs.add(`${rb.id}|${tid}`);
    for (const x of tasks) if (x.linkedRunbookId && rbIds.has(x.linkedRunbookId)) pairs.add(`${x.linkedRunbookId}|${x.id}`);
    countCheck('runbook <-> ticket links (both directions, existing both ends)', pairs.size, within(rbRelated, 'runbook_id', migratedRbIds));
  }

  const migratedFormIds = new Set(submissions.map((x) => formByLegacy.get(x.id)?.id).filter((v) => v != null));
  countCheck('form submissions', submissions.length, submissions.filter((x) => formByLegacy.has(x.id)).length);
  for (const type of ['user-id', 'requisition', 'disposal', 'allocation']) {
    const oldN = submissions.filter((x) => x.type === type).length;
    const detail = type === 'user-id' ? fUser : type === 'requisition' ? fReq : fAsset;
    const newN = detail.filter((d) => forms.some((f) => f.id === d.submission_id && f.form_type === type)).length;
    countCheck(`  ${type} detail rows`, oldN, newN);
  }
  const knownSystems = new Set(systemOptions.map((o) => o.id));
  countCheck(
    'user-id ticked systems (known options)',
    submissions.filter((x) => x.type === 'user-id').reduce((n, x) => n + Object.entries(x.data?.systems || {}).filter(([k, v]) => v && knownSystems.has(k)).length, 0),
    within(fSystems, 'submission_id', migratedFormIds)
  );
  countCheck(
    'requisition items (requested + IT)',
    submissions.filter((x) => x.type === 'requisition').reduce((n, x) => n + (x.data?.items?.length || 0) + (x.data?.itItems?.length || 0), 0),
    within(fReqItems, 'submission_id', migratedFormIds)
  );
  countCheck(
    'asset items',
    submissions.filter((x) => x.type === 'disposal' || x.type === 'allocation').reduce((n, x) => n + (x.data?.items?.length || 0), 0),
    within(fAssetItems, 'submission_id', migratedFormIds)
  );
  {
    const optionCount = (type: string) => returnOptions.filter((o) => o.form_type === type).length;
    countCheck(
      'asset Section D ticks (with a matching option)',
      submissions
        .filter((x) => x.type === 'disposal' || x.type === 'allocation')
        .reduce((n, x) => n + (Array.isArray(x.data?.itReturnOptions) ? x.data.itReturnOptions.filter((v: unknown, i: number) => v && i < optionCount(x.type)).length : 0), 0),
      within(fReturns, 'submission_id', migratedFormIds)
    );
  }
  countCheck('form attachments', submissions.reduce((n, x) => n + (Array.isArray(x.attachments) ? x.attachments.length : 0), 0), within(attachments, 'form_submission_id', migratedFormIds));
  countCheck('settings row', doc?.settings ? 1 : 0, settingsRows.length);

  // Sequences must cover every number already issued and the old counters.
  {
    const expected = new Map<string, number>();
    const bump = (p: string, n: number) => expected.set(p, Math.max(expected.get(p) || 0, n));
    const split = (s: unknown) => String(s || '').trim().match(/^([A-Za-z]+)-(?:[A-Za-z0-9]+-)?(\d+)$/);
    for (const x of tasks) { const m = split(x.ticketNumber); if (m) bump(m[1].toUpperCase(), Number(m[2])); }
    for (const x of submissions) { const m = split(x.formNumber); if (m) bump(m[1].toUpperCase(), Number(m[2])); }
    if (Number(settingsDoc.lastTicketSequence) > 0) bump('REQ', Number(settingsDoc.lastTicketSequence));
    const prefixes: Row = { 'user-id': 'UID', requisition: 'IRQ', disposal: 'DSP', allocation: 'ALC' };
    for (const [type, v] of Object.entries(formCounters)) if (prefixes[type] && Number(v) > 0) bump(prefixes[type], Number(v));
    for (const [prefix, value] of expected) {
      const row = sequences.find((s) => s.prefix === prefix);
      const ok = row && row.last_value >= value;
      if (!ok) mismatches++;
      countLines.push(`  ${ok ? 'OK      ' : 'MISMATCH'}  sequence ${prefix.padEnd(37)} needs >= ${String(value).padStart(4)}   has ${row ? String(row.last_value).padStart(4) : 'none'}`);
    }
  }

  // Ticket numbers must be exactly as issued.
  {
    const changed = tasks.filter((x) => ticketByLegacy.has(x.id) && t(ticketByLegacy.get(x.id)!.ticket_number) !== t(x.ticketNumber));
    countCheck('ticket numbers unchanged', 0, changed.length, changed.length ? changed.map((x) => x.ticketNumber).join(', ') : '');
    const changedForms = submissions.filter((x) => formByLegacy.has(x.id) && t(formByLegacy.get(x.id)!.form_number) !== t(x.formNumber));
    countCheck('form numbers unchanged', 0, changedForms.length);
  }

  // ---------------------------------------------------------------------------
  // 2. Field-level comparison on samples
  // ---------------------------------------------------------------------------

  // Tickets
  for (const x of tasks.slice(0, SAMPLE.tickets)) {
    const rec = `ticket ${x.ticketNumber}`;
    const r = ticketByLegacy.get(x.id);
    if (!r) { mismatches++; diffLines.push(`  MISMATCH   ${rec}: not found in tickets`); continue; }
    const categoryName = t(x.systemRequested) || t(x.category);
    const statuses = ['backlog', 'investigating', 'in_progress', 'blocked', 'testing', 'done'];
    field(rec, 'ticket_number', t(x.ticketNumber), t(r.ticket_number));
    field(rec, 'title', t(x.title) || '(untitled)', t(r.title));
    field(rec, 'description', t(x.description), t(r.description));
    field(rec, 'raw_logs', t(x.rawLogs), t(r.raw_logs));
    field(rec, 'status', x.status, r.status, () => (statuses.includes(x.status) ? null : 'status not in the list; stored as backlog'), 'backlog');
    field(rec, 'category', categoryName, categoryById.get(r.category_id) ?? null, () => noCategory(categoryName));
    field(rec, 'requester (email)', lower(x.requesterEmail) || null, r.requester_id ? lower(userById.get(r.requester_id)?.email) : null, () => noUser(x.requesterEmail));
    field(rec, 'assignee (email)', lower(x.assignee?.email) || null, r.assignee_id ? lower(userById.get(r.assignee_id)?.email) : null, () => noUser(x.assignee?.email));
    field(rec, 'site (location)', t(x.userLocation), siteById.get(r.site_id) ?? null, () => noSite(x.userLocation));
    field(rec, 'device_info', t(x.deviceInfo), t(r.device_info));
    field(rec, 'phone_ext', t(x.userPhoneExt), t(r.phone_ext));
    field(rec, 'hod_name', t(x.hodName), t(r.hod_name));
    field(rec, 'hod_email', t(x.hodEmail), t(r.hod_email));
    field(rec, 'is_user_submitted', bool(x.isUserSubmitted), bool(r.is_user_submitted));
    field(rec, 'incident_summary', t(x.incidentSummary), t(r.incident_summary));
    field(rec, 'resolution_notes', t(x.resolutionNotes), t(r.resolution_notes));
    field(rec, 'created_at', epoch(x.createdAt), epoch(r.created_at));
    field(rec, 'updated_at', epoch(x.updatedAt), epoch(r.updated_at));
    field(rec, 'resolved_at', epoch(x.resolvedAt), epoch(r.resolved_at), () => (Number.isNaN(epoch(x.resolvedAt)) ? 'date did not parse' : null));
    field(rec, 'due_date', epoch(x.dueDate), epoch(r.due_date), () => (Number.isNaN(epoch(x.dueDate)) ? 'date did not parse' : null));
    const tagSet = (source: string, list: unknown) => uniqueCI(list).sort();
    const newTags = (source: string) => (tagsByTicket.get(r.id) || []).filter((g) => g.source === source).map((g) => lower(g.tag)).sort();
    field(rec, 'automated tags', tagSet('automated', x.automatedTags), newTags('automated'));
    field(rec, 'manual tags', tagSet('manual', x.manualTags), newTags('manual'));
    field(
      rec,
      'checklist',
      (Array.isArray(x.checklist) ? x.checklist : []).filter((c: Row) => t(c?.text)).map((c: Row) => [t(c.text), bool(c.done)]),
      byPosition(checklistByTicket.get(r.id)).map((c) => [t(c.item_text), bool(c.done)])
    );
    field(
      rec,
      'attachments',
      (Array.isArray(x.attachments) ? x.attachments : []).map((a: Row) => [t(a.id), t(a.name), Number(a.size) || 0]).sort(),
      attachments.filter((a) => a.ticket_id === r.id).map((a) => [t(a.storage_key), t(a.file_name), Number(a.size_bytes)]).sort()
    );
  }

  // Runbooks
  const rbChildren = (rows: Row[], id: number) => byPosition(rows.filter((c) => c.runbook_id === id));
  for (const x of runbooks.slice(0, SAMPLE.runbooks)) {
    const rec = `runbook ${x.code}`;
    const r = rbByLegacy.get(x.id);
    if (!r) { mismatches++; diffLines.push(`  MISMATCH   ${rec}: not found in runbooks`); continue; }
    field(rec, 'code', t(x.code), t(r.code));
    field(rec, 'title', t(x.title), t(r.title));
    field(rec, 'category', t(x.category), categoryById.get(r.category_id) ?? null, () => noCategory(x.category));
    field(rec, 'scope', 'group', r.scope);
    field(rec, 'status', t(x.status) || 'active', r.status);
    field(rec, 'version', t(x.version) || '1.0.0', t(r.version));
    field(rec, 'author', t(x.author), t(r.author_name));
    field(rec, 'author_role', t(x.authorRole), t(r.author_role));
    field(rec, 'symptom', t(x.symptom), t(r.symptom));
    field(rec, 'root_cause_analysis', t(x.rootCauseAnalysis), t(r.root_cause_analysis));
    field(rec, 'rollback_plan', t(x.rollbackPlan), t(r.rollback_plan));
    field(rec, 'last_updated', day(x.lastUpdated), day(r.last_updated), () => (day(x.lastUpdated) === 'unparseable' ? 'date did not parse' : null));
    field(rec, 'tags', uniqueCI(x.tags).sort(), rbTags.filter((g) => g.runbook_id === r.id).map((g) => lower(g.tag)).sort());
    field(rec, 'trigger patterns', nonEmpty(x.triggerAlertPatterns), rbChildren(rbPatterns, r.id).map((p) => t(p.pattern)));
    {
      const shells = ['general', 'powershell', 'bash', 'sql', 'kubectl', 'docker'];
      const got = rbChildren(rbDiag, r.id);
      (x.diagnosticSteps || []).forEach((s: Row, i: number) => {
        const row = got[i] || {};
        field(rec, `diagnostic step ${i + 1}`, [t(s.title), t(s.cli), t(s.explanation)], [t(row.title), t(row.cli), t(row.explanation)]);
        const shell = t(s.shellType) || 'general';
        field(rec, `diagnostic step ${i + 1} shell_type`, shell, t(row.shell_type), () => (shells.includes(shell) ? null : 'shell type not in the list; stored as general'), 'general');
      });
      field(rec, 'diagnostic step count', (x.diagnosticSteps || []).length, got.length);
    }
    field(
      rec,
      'remediation steps',
      (x.remediationSteps || []).map((s: Row) => [t(s.title), t(s.instruction), t(s.command), bool(s.dangerous), t(s.verification)]),
      rbChildren(rbRem, r.id).map((s) => [t(s.title), t(s.instruction), t(s.command), bool(s.dangerous), t(s.verification)])
    );
    field(rec, 'post-mortem items', nonEmpty(x.postMortemChecklist), rbChildren(rbPost, r.id).map((p) => t(p.item)));
    field(rec, 'needs confirming', nonEmpty(x.needsConfirming), rbChildren(rbReview.filter((i) => i.kind === 'needs_confirming'), r.id).map((i) => t(i.note)));
    field(rec, 'placeholders', nonEmpty(x.placeholders), rbChildren(rbReview.filter((i) => i.kind === 'placeholder'), r.id).map((i) => t(i.note)));
    {
      const taskIds = new Set(tasks.map((k) => k.id));
      const expectedLinks = new Set<string>((x.relatedTaskIds || []).filter((id: string) => taskIds.has(id)));
      for (const k of tasks) if (k.linkedRunbookId === x.id) expectedLinks.add(k.id);
      field(rec, 'related tickets', [...expectedLinks].sort(), rbRelated.filter((l) => l.runbook_id === r.id).map((l) => ticketLegacyById.get(l.ticket_id)).sort());
    }
  }

  // Form submissions
  for (const x of submissions.slice(0, SAMPLE.forms)) {
    const rec = `form ${x.formNumber}`;
    const r = formByLegacy.get(x.id);
    if (!r) { mismatches++; diffLines.push(`  MISMATCH   ${rec}: not found in form_submissions`); continue; }
    const d: Row = x.data || {};
    const isAsset = x.type === 'disposal' || x.type === 'allocation';
    field(rec, 'form_number', t(x.formNumber), t(r.form_number));
    field(rec, 'form_type', x.type, r.form_type);
    field(rec, 'submitted by (email)', lower(x.submittedBy?.email) || null, r.submitted_by_id ? lower(userById.get(r.submitted_by_id)?.email) : null, () => noUser(x.submittedBy?.email));
    field(rec, 'submitted_at', epoch(x.submittedAt), epoch(r.submitted_at));
    field(rec, 'requestor_name', t(isAsset ? d.submittedBy : d.requestorName), t(r.requestor_name));
    field(rec, 'phone_ext', isAsset ? null : t(d.phoneExt), t(r.phone_ext));
    field(rec, 'designation', isAsset ? null : t(d.designation), t(r.designation));
    field(rec, 'department', t(d.department), t(r.department));
    field(rec, 'request_date', day(d.requestDate), day(r.request_date), () => (day(d.requestDate) === 'unparseable' ? 'date did not parse' : null));
    field(rec, 'site (location)', t(d.location), siteById.get(r.site_id) ?? null, () => noSite(d.location));
    field(rec, 'has_attachments', isAsset ? null : ['yes', 'no'].includes(d.hasAttachments) ? d.hasAttachments : null, r.has_attachments);
    field(rec, 'attachment_format', isAsset ? null : ['hardcopy', 'softcopy'].includes(d.attachmentFormat) ? d.attachmentFormat : null, r.attachment_format);
    field(rec, 'viewed_at', epoch(x.viewedAt), epoch(r.viewed_at));
    field(rec, 'completed_at', epoch(x.completedAt), epoch(r.completed_at));
    field(rec, 'completed by (name)', t(x.completedBy), r.completed_by_id ? t(userById.get(r.completed_by_id)?.name) : null, () =>
      users.filter((u) => lower(u.name) === lower(x.completedBy)).length === 1 ? null : 'no single app_users row with that name'
    );
    field(rec, 'rejected_at', epoch(x.rejectedAt), epoch(r.rejected_at));
    field(rec, 'rejected by (name)', t(x.rejectedBy), r.rejected_by_id ? t(userById.get(r.rejected_by_id)?.name) : null, () =>
      users.filter((u) => lower(u.name) === lower(x.rejectedBy)).length === 1 ? null : 'no single app_users row with that name'
    );
    field(rec, 'rejection_reason', t(x.rejectionReason), t(r.rejection_reason));
    field(
      rec,
      'attachments',
      (Array.isArray(x.attachments) ? x.attachments : []).map((a: Row) => [t(a.id), t(a.name)]).sort(),
      attachments.filter((a) => a.form_submission_id === r.id).map((a) => [t(a.storage_key), t(a.file_name)]).sort()
    );

    if (x.type === 'user-id') {
      const u = fUser.find((row) => row.submission_id === r.id);
      field(rec, 'others_detail', t(d.othersDetail), t(u?.others_detail));
      field(rec, 'remarks', t(d.remarks), t(u?.remarks));
      field(
        rec,
        'systems',
        Object.entries(d.systems || {}).filter(([k, v]) => v && knownSystems.has(k)).map(([k]) => k).sort(),
        fSystems.filter((s) => s.submission_id === r.id).map((s) => s.option_id).sort()
      );
    } else if (x.type === 'requisition') {
      const q = fReq.find((row) => row.submission_id === r.id) || {};
      field(rec, 'ref_no', t(d.refNo), t(q.ref_no));
      field(rec, 'company_name', t(d.company), t(q.company_name));
      field(rec, 'attachment_remark', t(d.attachmentRemark), t(q.attachment_remark));
      field(rec, 'budgeted', ['yes', 'no'].includes(d.budgeted) ? d.budgeted : null, q.budgeted ?? null);
      for (const [oldKey, newKey] of [['budgetedAmount', 'budgeted_amount'], ['utilisedAmount', 'utilised_amount'], ['proposedCapex', 'proposed_capex'], ['balanceAmount', 'balance_amount']]) {
        field(rec, newKey, amount(d[oldKey]), num(q[newKey]), () => badAmount(d[oldKey]));
      }
      field(rec, 'purpose', t(d.purpose), t(q.purpose));
      for (const [section, list] of [['requested', d.items], ['it', d.itItems]] as const) {
        const got = byPosition(fReqItems.filter((i) => i.submission_id === r.id && i.section === section));
        (Array.isArray(list) ? list : []).forEach((item: Row, i: number) => {
          const row = got[i] || {};
          field(rec, `${section} item ${i + 1} description`, t(item.description), t(row.description));
          field(rec, `${section} item ${i + 1} quantity`, amount(item.quantity), num(row.quantity), () => badAmount(item.quantity, 12));
          field(rec, `${section} item ${i + 1} unit_price`, amount(item.price), num(row.unit_price), () => badAmount(item.price));
        });
        field(rec, `${section} item count`, Array.isArray(list) ? list.length : 0, got.length);
      }
    } else if (isAsset) {
      const a = fAsset.find((row) => row.submission_id === r.id) || {};
      field(rec, 'employee_id', t(d.employeeId), t(a.employee_id));
      field(rec, 'reference_no', t(d.referenceNo), t(a.reference_no));
      field(rec, 'it_remarks', t(d.itRemarks), t(a.it_remarks));
      const got = byPosition(fAssetItems.filter((i) => i.submission_id === r.id));
      (Array.isArray(d.items) ? d.items : []).forEach((item: Row, i: number) => {
        const row = got[i] || {};
        field(rec, `item ${i + 1} description`, t(item.description), t(row.description));
        field(rec, `item ${i + 1} spec_model`, t(item.specModel), t(row.spec_model));
        field(rec, `item ${i + 1} serial_number`, t(item.serialNumber), t(row.serial_number));
        field(rec, `item ${i + 1} quantity`, amount(item.quantity), num(row.quantity), () => badAmount(item.quantity, 12));
        field(rec, `item ${i + 1} remarks`, t(item.remarks), t(row.remarks));
      });
      const options = returnOptions.filter((o) => o.form_type === x.type).sort((p, q) => p.sort_order - q.sort_order).map((o) => o.id);
      field(
        rec,
        'Section D ticks',
        (Array.isArray(d.itReturnOptions) ? d.itReturnOptions : []).map((v: unknown, i: number) => (v ? options[i] : null)).filter(Boolean).sort(),
        fReturns.filter((s) => s.submission_id === r.id).map((s) => s.option_id).sort()
      );
    }
  }

  // Settings
  {
    const s = settingsRows[0] || {};
    const v: Row = settingsDoc.visibleViews || {};
    const rec = 'settings';
    field(rec, 'default_view', t(settingsDoc.defaultView) || 'kanban', s.default_view);
    for (const [oldKey, newKey] of [['kanban', 'show_kanban'], ['list', 'show_list'], ['history', 'show_history'], ['handbook', 'show_handbook'], ['analytics', 'show_analytics'], ['forms', 'show_forms'], ['formHistory', 'show_form_history']]) {
      field(rec, newKey, v[oldKey] !== false, bool(s[newKey]));
    }
    field(rec, 'completed_ticket_retention_minutes', Number(settingsDoc.completedTicketRetentionMinutes) || 60, s.completed_ticket_retention_minutes);
    field(rec, 'chat_knowledge_mode', settingsDoc.chatKnowledgeMode === 'full' ? 'full' : 'scoped', s.chat_knowledge_mode);
    field(rec, 'default_category', t(settingsDoc.defaultCategory), categoryById.get(s.default_category_id) ?? null, () => noCategory(settingsDoc.defaultCategory));
    field(rec, 'operator_name', t(settingsDoc.operatorName), t(s.operator_name));
  }

  // ---------------------------------------------------------------------------
  console.log(`IS Studio verification (company ${COMPANY_CODE}). Read only; nothing was written.\n`);
  console.log('== Counts: old document vs new tables ==');
  countLines.forEach((l) => console.log(l));
  const sampled = `${Math.min(SAMPLE.tickets, tasks.length)} tickets, ${Math.min(SAMPLE.runbooks, runbooks.length)} runbooks, ${Math.min(SAMPLE.forms, submissions.length)} forms, settings`;
  console.log(`\n== Field-level comparison (${sampled}) ==`);
  if (!diffLines.length) console.log('  every compared field agrees');
  diffLines.forEach((l) => console.log(l));
  console.log(
    `\n${mismatches === 0 ? 'PASS' : 'FAIL'}: ${mismatches} mismatch${mismatches === 1 ? '' : 'es'}, ` +
      `${explained} explained difference${explained === 1 ? '' : 's'} (listed in the migration report for a person to resolve).`
  );
  process.exit(mismatches === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`Verification could not run: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
