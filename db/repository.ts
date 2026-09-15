/**
 * Server-side data access for the normalised tables (db/schema.sql).
 *
 * The browser keeps working with the same shapes it always has (Task, Runbook,
 * UserSettings, FormSubmission); this module turns them into rows and back.
 * Every write touches only the record being changed, so two people editing
 * different tickets no longer overwrite each other, and a save of a ticket
 * someone else changed since it was opened is refused rather than silently
 * replacing their work.
 *
 * Record ids the browser sees are the `legacy_id` column: the original JSON
 * ids for migrated rows, and the browser-generated id for rows created since.
 *
 * Nothing here touches workspace_data.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  AssetFormData,
  FormSubmission,
  FormSubmissionType,
  RequisitionFormData,
  Runbook,
  StaffMember,
  Task,
  TaskStatus,
  TicketAttachment,
  UserIdFormData,
  UserSettings,
} from '../src/types';

type Row = Record<string, any>;

const TICKET_STATUSES: TaskStatus[] = ['backlog', 'investigating', 'in_progress', 'blocked', 'testing', 'done'];
const SHELL_TYPES = ['general', 'powershell', 'bash', 'sql', 'kubectl', 'docker'];
const FORM_PREFIX: Record<FormSubmissionType, string> = { 'user-id': 'UID', requisition: 'IRQ', disposal: 'DSP', allocation: 'ALC' };
export const TICKET_PREFIX = 'REQ';

/** Clear, user-facing failure with an HTTP status for the route to return. */
export class RepositoryError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type { StaffMember };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const text = (v: unknown, max?: number): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return max && s.length > max ? s.slice(0, max) : s;
};
const lower = (v: unknown) => (v == null ? '' : String(v).trim().toLowerCase());
const iso = (v: unknown): string | null => {
  const s = text(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};
const day = (v: unknown): string | null => {
  const s = text(v);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
};
const formatNumber = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, '0')}`;
const splitNumber = (value: string) => {
  const m = value.trim().match(/^([A-Za-z]+)-(?:[A-Za-z0-9]+-)?(\d+)$/);
  return m ? { prefix: m[1].toUpperCase(), number: Number(m[2]) } : null;
};

/**
 * Amounts arrive as typed text. Blank means not filled in; anything else must
 * parse, or the save is refused with the field named, so nothing is silently
 * stored as empty or zero.
 */
function amount(value: unknown, field: string, precision: 12 | 14): number | null {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/^RM\s*/i, '').replace(/[,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) throw new RepositoryError(400, `${field} must be a number (you entered "${raw}").`);
  const n = Math.round(Number(cleaned) * 100) / 100;
  if (Math.abs(n) >= (precision === 14 ? 1e12 : 1e10)) throw new RepositoryError(400, `${field} is too large.`);
  return n;
}
const amountText = (v: unknown) => (v == null ? '' : String(Number(v)));

function check(error: { message: string } | null, action: string): void {
  if (error) throw new Error(`${action}: ${error.message}`);
}

async function all(sb: SupabaseClient, table: string, columns = '*', filter?: (q: any) => any): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    check(error, `Reading ${table}`);
    rows.push(...((data as Row[]) || []));
    if (!data || data.length < 1000) return rows;
  }
}

const groupBy = (rows: Row[], key: string) => {
  const map = new Map<unknown, Row[]>();
  for (const r of rows) map.set(r[key], [...(map.get(r[key]) || []), r]);
  return map;
};
const byPosition = (rows: Row[] = []) => [...rows].sort((a, b) => a.position - b.position);

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class WorkspaceRepository {
  private companyIdCache: number | null = null;

  constructor(private sb: SupabaseClient, private companyCode: string) {}

  /** The company every record belongs to; created on first use if missing. */
  async companyId(): Promise<number> {
    if (this.companyIdCache != null) return this.companyIdCache;
    const { data, error } = await this.sb.from('companies').select('id').eq('code', this.companyCode).maybeSingle();
    if (error) {
      throw new RepositoryError(
        503,
        `The workspace tables are not available (${error.message}). Run db/schema.sql in Supabase, then db/migrate.ts.`
      );
    }
    if (data) return (this.companyIdCache = data.id as number);
    const created = await this.sb.from('companies').insert({ code: this.companyCode, name: this.companyCode }).select('id').single();
    check(created.error, 'Creating the company');
    return (this.companyIdCache = created.data!.id as number);
  }

  // ---- Reference data ----

  private async users(): Promise<Row[]> {
    return all(this.sb, 'app_users', 'id, email, name, role, department');
  }

  private async categories(): Promise<Map<string, number>> {
    const rows = await all(this.sb, 'categories', 'id, name');
    return new Map(rows.map((c) => [lower(c.name), c.id as number]));
  }

  /** IT staff who can be assigned tickets. */
  async staff(): Promise<StaffMember[]> {
    return (await this.users())
      .filter((u) => u.role === 'admin')
      .map((u) => ({ id: u.id, name: u.name, email: u.email, department: u.department || undefined }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---- Document numbers ----

  /**
   * Issues the next number for a prefix. The sequence row is advanced with a
   * compare-and-set, so two requests at the same moment never get the same
   * number; a number already used by an existing record is skipped.
   */
  async nextNumber(prefix: string, isTaken: (number: string) => Promise<boolean>): Promise<string> {
    const companyId = await this.companyId();
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error } = await this.sb
        .from('ticket_sequences')
        .select('last_value')
        .eq('company_id', companyId)
        .eq('prefix', prefix)
        .maybeSingle();
      check(error, 'Reading ticket_sequences');
      if (!data) {
        const inserted = await this.sb.from('ticket_sequences').insert({ company_id: companyId, prefix, last_value: 0 });
        if (inserted.error && !/duplicate|unique/i.test(inserted.error.message)) check(inserted.error, 'Creating a sequence');
        continue;
      }
      const next = Number(data.last_value) + 1;
      const updated = await this.sb
        .from('ticket_sequences')
        .update({ last_value: next })
        .eq('company_id', companyId)
        .eq('prefix', prefix)
        .eq('last_value', data.last_value)
        .select('last_value');
      check(updated.error, 'Advancing a sequence');
      if (!updated.data?.length) continue; // someone else took it; try again
      const number = formatNumber(prefix, next);
      if (!(await isTaken(number))) return number;
    }
    throw new RepositoryError(503, 'Could not issue a document number. Please try again.');
  }

  private async sequenceValue(prefix: string): Promise<number> {
    const companyId = await this.companyId();
    const { data } = await this.sb.from('ticket_sequences').select('last_value').eq('company_id', companyId).eq('prefix', prefix).maybeSingle();
    return data ? Number(data.last_value) : 0;
  }

  /** Moves a sequence up to at least `value` (never down), for numbers typed by hand. */
  private async raiseSequence(prefix: string, value: number) {
    const companyId = await this.companyId();
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data } = await this.sb.from('ticket_sequences').select('last_value').eq('company_id', companyId).eq('prefix', prefix).maybeSingle();
      if (!data) {
        const ins = await this.sb.from('ticket_sequences').insert({ company_id: companyId, prefix, last_value: value });
        if (!ins.error) return;
        continue;
      }
      if (Number(data.last_value) >= value) return;
      const up = await this.sb
        .from('ticket_sequences')
        .update({ last_value: value })
        .eq('company_id', companyId)
        .eq('prefix', prefix)
        .eq('last_value', data.last_value)
        .select('last_value');
      if (up.data?.length) return;
    }
  }

  // ---- Workspace ----

  async loadWorkspace(): Promise<{ tasks: Task[]; runbooks: Runbook[]; settings: Partial<UserSettings>; staff: StaffMember[]; lastSaved: string }> {
    const [tasks, runbooks, settings, staff, lastSaved] = await Promise.all([
      this.loadTickets(),
      this.loadRunbooks(),
      this.loadSettings(),
      this.staff(),
      this.lastChanged(),
    ]);
    return { tasks, runbooks, settings, staff, lastSaved };
  }

  /** Newest change to tickets, guides or settings, for other devices to notice. */
  async lastChanged(): Promise<string> {
    const companyId = await this.companyId();
    const newest = async (table: string, filter?: (q: any) => any) => {
      let q = this.sb.from(table).select('updated_at').order('updated_at', { ascending: false }).limit(1);
      if (filter) q = filter(q);
      const { data } = await q;
      return data?.[0]?.updated_at ? Date.parse(data[0].updated_at) : 0;
    };
    const times = await Promise.all([
      newest('tickets', (q) => q.eq('company_id', companyId)),
      newest('runbooks'),
      newest('settings'),
    ]);
    return new Date(Math.max(...times, 0)).toISOString();
  }

  /** Deletions leave no updated_at behind, so they advance the settings row's timestamp instead. */
  private async markChanged() {
    await this.sb.from('settings').upsert({ id: 1, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  }

  // ---- Tickets ----

  async loadTickets(only?: number[]): Promise<Task[]> {
    const companyId = await this.companyId();
    const tickets = await all(this.sb, 'tickets', '*', (q) => {
      let x = q.eq('company_id', companyId).order('created_at', { ascending: false });
      if (only) x = x.in('id', only);
      return x;
    });
    if (!tickets.length) return [];
    const ids = tickets.map((t) => t.id);
    const inIds = (q: any) => q.in('ticket_id', ids);
    const [users, categoryRows, tags, checklist, attachments, links, runbooks] = await Promise.all([
      this.users(),
      all(this.sb, 'categories', 'id, name'),
      all(this.sb, 'ticket_tags', '*', inIds),
      all(this.sb, 'ticket_checklist_items', '*', inIds),
      all(this.sb, 'attachments', '*', inIds),
      all(this.sb, 'runbook_related_tickets', '*', inIds),
      all(this.sb, 'runbooks', 'id, legacy_id'),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const categoryById = new Map(categoryRows.map((c) => [c.id, c.name]));
    const tagsBy = groupBy(tags, 'ticket_id');
    const checklistBy = groupBy(checklist, 'ticket_id');
    const attachmentsBy = groupBy(attachments, 'ticket_id');
    const linksBy = groupBy(links, 'ticket_id');
    const runbookLegacy = new Map(runbooks.map((r) => [r.id, r.legacy_id]));

    return tickets.map((t): Task => {
      const requester = t.requester_id ? userById.get(t.requester_id) : undefined;
      const assignee = t.assignee_id ? userById.get(t.assignee_id) : undefined;
      const category = (categoryById.get(t.category_id) as Task['category']) || 'Others';
      const ticketTags = tagsBy.get(t.id) || [];
      const link = (linksBy.get(t.id) || [])[0];
      return {
        id: t.legacy_id || `ticket-${t.id}`,
        ticketNumber: t.ticket_number,
        title: t.title,
        description: t.description || '',
        rawLogs: t.raw_logs || undefined,
        errorSignature: t.error_signature || undefined,
        status: t.status,
        automatedTags: ticketTags.filter((g) => g.source === 'automated').map((g) => g.tag),
        manualTags: ticketTags.filter((g) => g.source === 'manual').map((g) => g.tag),
        category,
        systemRequested: t.is_user_submitted ? category : undefined,
        assigneeId: assignee?.id,
        assignee: assignee
          ? { name: assignee.name, role: 'IT Technician', email: assignee.email }
          : { name: 'Unassigned', role: '', email: '' },
        requesterId: requester?.id,
        requesterName: requester?.name,
        requesterEmail: requester?.email,
        requesterDepartment: requester?.department || undefined,
        deviceInfo: t.device_info || undefined,
        isUserSubmitted: Boolean(t.is_user_submitted),
        userLocation: t.location_text || undefined,
        userPhoneExt: t.phone_ext || undefined,
        hodName: t.hod_name || undefined,
        hodEmail: t.hod_email || undefined,
        attachments: (attachmentsBy.get(t.id) || []).map(toAttachment),
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        dueDate: t.due_date || undefined,
        checklist: byPosition(checklistBy.get(t.id)).map((c) => ({ id: `chk-${c.id}`, text: c.item_text, done: Boolean(c.done), command: c.command || undefined })),
        linkedRunbookId: link ? runbookLegacy.get(link.runbook_id) || undefined : undefined,
        incidentSummary: t.incident_summary || undefined,
        resolutionNotes: t.resolution_notes || undefined,
        resolvedAt: t.resolved_at || undefined,
      };
    });
  }

  private async ticketIsNumberTaken(number: string): Promise<boolean> {
    const companyId = await this.companyId();
    const { data } = await this.sb.from('tickets').select('id').eq('company_id', companyId).eq('ticket_number', number).limit(1);
    return Boolean(data?.length);
  }

  /**
   * Creates or updates one ticket. `baseUpdatedAt` is when the editor last saw
   * the ticket; if it has changed since, the save is refused and the current
   * version is returned so the browser can show it.
   */
  async saveTicket(input: Task, opts: { actorId?: string; baseUpdatedAt?: string } = {}): Promise<{ task: Task } | { conflict: Task }> {
    if (!input?.id) throw new RepositoryError(400, 'Ticket id is required.');
    const companyId = await this.companyId();
    const { data: existing, error } = await this.sb
      .from('tickets')
      .select('id, status, updated_at, ticket_number')
      .eq('company_id', companyId)
      .eq('legacy_id', input.id)
      .maybeSingle();
    check(error, 'Reading ticket');

    if (existing && opts.baseUpdatedAt) {
      const base = Date.parse(opts.baseUpdatedAt);
      // Timestamps are written by this server to the millisecond and returned
      // unchanged, so any later value means someone else saved in between.
      if (!Number.isNaN(base) && Date.parse(existing.updated_at) > base) {
        const [current] = await this.loadTickets([existing.id]);
        return { conflict: current };
      }
    }

    // Issued numbers never change. A new ticket keeps a typed number only if no
    // ticket holds it and, for a numbered prefix, it is above the last one
    // issued (so a deleted ticket's number is not handed out again); otherwise
    // it gets the next one.
    let ticketNumber = existing?.ticket_number as string | undefined;
    if (!existing) {
      const typed = text(input.ticketNumber, 40);
      const parts = typed ? splitNumber(typed) : null;
      const usable =
        typed &&
        !(await this.ticketIsNumberTaken(typed)) &&
        (!parts || parts.number > (await this.sequenceValue(parts.prefix)));
      if (typed && usable) {
        ticketNumber = typed;
        if (parts) await this.raiseSequence(parts.prefix, parts.number);
      } else {
        ticketNumber = await this.nextNumber(TICKET_PREFIX, (n) => this.ticketIsNumberTaken(n));
      }
    }

    const [users, categories] = await Promise.all([this.users(), this.categories()]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const userByEmail = new Map(users.map((u) => [lower(u.email), u]));
    const resolveUser = (id?: string, email?: string) =>
      (id && userById.get(id)?.id) || (email && userByEmail.get(lower(email))?.id) || null;

    const status: TaskStatus = TICKET_STATUSES.includes(input.status) ? input.status : 'backlog';
    const now = new Date().toISOString();
    const row = {
      legacy_id: input.id,
      company_id: companyId,
      ticket_number: ticketNumber,
      title: text(input.title, 300) || 'Untitled Incident',
      description: text(input.description),
      raw_logs: text(input.rawLogs),
      error_signature: text(input.errorSignature, 500),
      status,
      category_id: categories.get(lower(input.systemRequested || input.category)) ?? null,
      requester_id: resolveUser(input.requesterId, input.requesterEmail),
      // An explicit "Unassigned" clears the technician; otherwise match the account.
      assignee_id: input.assigneeId === '' ? null : resolveUser(input.assigneeId, input.assignee?.email),
      location_text: text(input.userLocation, 200),
      device_info: text(input.deviceInfo, 300),
      phone_ext: text(input.userPhoneExt, 32),
      hod_name: text(input.hodName, 200),
      hod_email: text(input.hodEmail, 320),
      is_user_submitted: Boolean(input.isUserSubmitted),
      incident_summary: text(input.incidentSummary),
      resolution_notes: text(input.resolutionNotes),
      due_date: iso(input.dueDate),
      resolved_at: status === 'done' ? iso(input.resolvedAt) || now : null,
      created_at: existing ? undefined : iso(input.createdAt) || now,
      updated_at: now,
    };
    const saved = await this.sb.from('tickets').upsert(row, { onConflict: 'legacy_id' }).select('id').single();
    if (saved.error) {
      if (/uq_tickets_company_number/.test(saved.error.message)) throw new RepositoryError(409, `Ticket number ${ticketNumber} is already in use.`);
      check(saved.error, 'Saving ticket');
    }
    const ticketId = saved.data!.id as number;

    await this.replace('ticket_tags', 'ticket_id', ticketId, [
      ...uniqueTags(input.automatedTags).map((tag) => ({ ticket_id: ticketId, source: 'automated', tag })),
      ...uniqueTags(input.manualTags).map((tag) => ({ ticket_id: ticketId, source: 'manual', tag })),
    ]);
    await this.replace(
      'ticket_checklist_items',
      'ticket_id',
      ticketId,
      (input.checklist || [])
        .filter((c) => text(c?.text))
        .map((c, i) => ({ ticket_id: ticketId, position: i + 1, item_text: text(c.text, 500), done: Boolean(c.done), command: text(c.command) }))
    );
    await this.syncAttachments({ ticket_id: ticketId }, input.attachments || []);

    if (!existing || existing.status !== status) {
      const history = await this.sb.from('ticket_status_history').insert({
        ticket_id: ticketId,
        from_status: existing ? existing.status : null,
        to_status: status,
        changed_by_id: opts.actorId && userById.has(opts.actorId) ? opts.actorId : null,
        changed_at: now,
      });
      check(history.error, 'Recording status history');
    }

    if (input.linkedRunbookId) {
      const { data: rb } = await this.sb.from('runbooks').select('id').eq('legacy_id', input.linkedRunbookId).maybeSingle();
      if (rb) {
        await this.sb.from('runbook_related_tickets').upsert({ runbook_id: rb.id, ticket_id: ticketId }, { onConflict: 'runbook_id,ticket_id', ignoreDuplicates: true });
      }
    }

    const [task] = await this.loadTickets([ticketId]);
    return { task };
  }

  async deleteTickets(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const companyId = await this.companyId();
    const { data, error } = await this.sb.from('tickets').delete().eq('company_id', companyId).in('legacy_id', ids).select('id');
    check(error, 'Deleting tickets');
    await this.markChanged();
    return data?.length || 0;
  }

  // ---- Runbooks ----

  async loadRunbooks(only?: number[]): Promise<Runbook[]> {
    const runbooks = await all(this.sb, 'runbooks', '*', (q) => {
      let x = q.order('code', { ascending: true });
      if (only) x = x.in('id', only);
      return x;
    });
    if (!runbooks.length) return [];
    const ids = runbooks.map((r) => r.id);
    const inIds = (q: any) => q.in('runbook_id', ids);
    const [categoryRows, tags, patterns, diagnostics, remediation, postmortem, review, links, tickets] = await Promise.all([
      all(this.sb, 'categories', 'id, name'),
      all(this.sb, 'runbook_tags', '*', inIds),
      all(this.sb, 'runbook_trigger_patterns', '*', inIds),
      all(this.sb, 'runbook_diagnostic_steps', '*', inIds),
      all(this.sb, 'runbook_remediation_steps', '*', inIds),
      all(this.sb, 'runbook_postmortem_items', '*', inIds),
      all(this.sb, 'runbook_review_items', '*', inIds),
      all(this.sb, 'runbook_related_tickets', '*', inIds),
      all(this.sb, 'tickets', 'id, legacy_id'),
    ]);
    const categoryById = new Map(categoryRows.map((c) => [c.id, c.name]));
    const g = (rows: Row[]) => groupBy(rows, 'runbook_id');
    const [tagsBy, patternsBy, diagBy, remBy, postBy, reviewBy, linksBy] = [tags, patterns, diagnostics, remediation, postmortem, review, links].map(g);
    const ticketLegacy = new Map(tickets.map((t) => [t.id, t.legacy_id]));

    return runbooks.map((r): Runbook => ({
      id: r.legacy_id || `runbook-${r.id}`,
      code: r.code,
      title: r.title,
      category: (categoryById.get(r.category_id) as Runbook['category']) || 'Others',
      lastUpdated: r.last_updated || String(r.updated_at).slice(0, 10),
      author: r.author_name || '',
      authorRole: r.author_role || '',
      version: r.version,
      status: r.status,
      symptom: r.symptom || '',
      triggerAlertPatterns: byPosition(patternsBy.get(r.id)).map((p) => p.pattern),
      rootCauseAnalysis: r.root_cause_analysis || '',
      diagnosticSteps: byPosition(diagBy.get(r.id)).map((s) => ({ title: s.title, cli: s.cli || '', explanation: s.explanation || '', shellType: s.shell_type })),
      remediationSteps: byPosition(remBy.get(r.id)).map((s) => ({
        stepNumber: s.position,
        title: s.title,
        instruction: s.instruction || '',
        command: s.command || undefined,
        dangerous: Boolean(s.dangerous),
        verification: s.verification || '',
      })),
      rollbackPlan: r.rollback_plan || '',
      postMortemChecklist: byPosition(postBy.get(r.id)).map((p) => p.item),
      relatedTaskIds: (linksBy.get(r.id) || []).map((l) => ticketLegacy.get(l.ticket_id)).filter(Boolean),
      tags: (tagsBy.get(r.id) || []).map((t) => t.tag),
      needsConfirming: byPosition((reviewBy.get(r.id) || []).filter((i) => i.kind === 'needs_confirming')).map((i) => i.note),
      placeholders: byPosition((reviewBy.get(r.id) || []).filter((i) => i.kind === 'placeholder')).map((i) => i.note),
    }));
  }

  async saveRunbook(input: Runbook): Promise<Runbook> {
    if (!input?.id) throw new RepositoryError(400, 'Runbook id is required.');
    const code = text(input.code, 32);
    if (!code) throw new RepositoryError(400, 'Document code is required.');
    const categories = await this.categories();
    const row = {
      legacy_id: input.id,
      code,
      title: text(input.title, 300) || '(untitled)',
      category_id: categories.get(lower(input.category)) ?? null,
      scope: 'group',
      company_id: null,
      site_id: null,
      status: ['active', 'draft', 'deprecated'].includes(input.status) ? input.status : 'active',
      version: text(input.version, 20) || '1.0.0',
      author_name: text(input.author, 200),
      author_role: text(input.authorRole, 200),
      symptom: text(input.symptom),
      root_cause_analysis: text(input.rootCauseAnalysis),
      rollback_plan: text(input.rollbackPlan),
      last_updated: day(input.lastUpdated) || new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    };
    const saved = await this.sb.from('runbooks').upsert(row, { onConflict: 'legacy_id' }).select('id').single();
    if (saved.error) {
      if (/runbooks_code_key|duplicate key.*code/i.test(saved.error.message)) throw new RepositoryError(409, `Document code ${code} is already used by another guide.`);
      check(saved.error, 'Saving runbook');
    }
    const runbookId = saved.data!.id as number;
    const list = (v: unknown) => (Array.isArray(v) ? v : []);
    const nonEmpty = (v: unknown) => list(v).map((x) => text(x)).filter(Boolean) as string[];

    await this.replace('runbook_tags', 'runbook_id', runbookId, uniqueTags(input.tags).map((tag) => ({ runbook_id: runbookId, tag })));
    await this.replace('runbook_trigger_patterns', 'runbook_id', runbookId, nonEmpty(input.triggerAlertPatterns).map((pattern, i) => ({ runbook_id: runbookId, position: i + 1, pattern })));
    await this.replace(
      'runbook_diagnostic_steps',
      'runbook_id',
      runbookId,
      list(input.diagnosticSteps).map((s: any, i) => ({
        runbook_id: runbookId,
        position: i + 1,
        title: text(s?.title, 300) || `Check ${i + 1}`,
        explanation: text(s?.explanation),
        cli: text(s?.cli),
        shell_type: SHELL_TYPES.includes(s?.shellType) ? s.shellType : 'general',
      }))
    );
    await this.replace(
      'runbook_remediation_steps',
      'runbook_id',
      runbookId,
      list(input.remediationSteps).map((s: any, i) => ({
        runbook_id: runbookId,
        position: i + 1,
        title: text(s?.title, 300) || `Step ${i + 1}`,
        instruction: text(s?.instruction),
        command: text(s?.command),
        dangerous: Boolean(s?.dangerous),
        verification: text(s?.verification),
      }))
    );
    await this.replace('runbook_postmortem_items', 'runbook_id', runbookId, nonEmpty(input.postMortemChecklist).map((item, i) => ({ runbook_id: runbookId, position: i + 1, item })));
    await this.replace('runbook_review_items', 'runbook_id', runbookId, [
      ...nonEmpty(input.needsConfirming).map((note, i) => ({ runbook_id: runbookId, kind: 'needs_confirming', position: i + 1, note })),
      ...nonEmpty(input.placeholders).map((note, i) => ({ runbook_id: runbookId, kind: 'placeholder', position: i + 1, note })),
    ]);

    // Related tickets are replaced from the guide's own list.
    const legacyIds = list(input.relatedTaskIds).map(String);
    const tickets = legacyIds.length ? await all(this.sb, 'tickets', 'id, legacy_id', (q) => q.in('legacy_id', legacyIds)) : [];
    await this.replace('runbook_related_tickets', 'runbook_id', runbookId, tickets.map((t) => ({ runbook_id: runbookId, ticket_id: t.id })));

    const [runbook] = await this.loadRunbooks([runbookId]);
    return runbook;
  }

  async deleteRunbook(id: string): Promise<boolean> {
    const { data, error } = await this.sb.from('runbooks').delete().eq('legacy_id', id).select('id');
    check(error, 'Deleting runbook');
    await this.markChanged();
    return Boolean(data?.length);
  }

  // ---- Settings ----

  async loadSettings(): Promise<Partial<UserSettings>> {
    const companyId = await this.companyId();
    const [{ data: s }, { data: seq }, categoryRows] = await Promise.all([
      this.sb.from('settings').select('*').eq('id', 1).maybeSingle(),
      this.sb.from('ticket_sequences').select('last_value').eq('company_id', companyId).eq('prefix', TICKET_PREFIX).maybeSingle(),
      all(this.sb, 'categories', 'id, name'),
    ]);
    const out: Partial<UserSettings> = { lastTicketSequence: seq ? Number(seq.last_value) : 0 };
    if (!s) return out;
    return {
      ...out,
      defaultView: s.default_view,
      visibleViews: {
        kanban: s.show_kanban,
        list: s.show_list,
        history: s.show_history,
        handbook: s.show_handbook,
        analytics: s.show_analytics,
        forms: s.show_forms,
        formHistory: s.show_form_history,
      },
      completedTicketRetentionMinutes: s.completed_ticket_retention_minutes,
      chatKnowledgeMode: s.chat_knowledge_mode,
      defaultCategory: (categoryRows.find((c) => c.id === s.default_category_id)?.name as UserSettings['defaultCategory']) || 'Others',
      operatorName: s.operator_name || '',
    };
  }

  /** Saves the shared workspace settings. Theme is per browser and never stored. */
  async saveSettings(input: Partial<UserSettings>): Promise<Partial<UserSettings>> {
    const categories = await this.categories();
    const views = input.visibleViews || ({} as UserSettings['visibleViews']);
    const on = (v: unknown) => v !== false;
    const retention = Number(input.completedTicketRetentionMinutes);
    const views_ = ['kanban', 'list', 'history', 'handbook', 'analytics', 'forms', 'formHistory'];
    const { error } = await this.sb.from('settings').upsert(
      {
        id: 1,
        default_view: views_.includes(String(input.defaultView)) ? input.defaultView : 'kanban',
        show_kanban: on(views.kanban),
        show_list: on(views.list),
        show_history: on(views.history),
        show_handbook: on(views.handbook),
        show_analytics: on(views.analytics),
        show_forms: on(views.forms),
        show_form_history: on(views.formHistory),
        completed_ticket_retention_minutes: Number.isFinite(retention) && retention > 0 ? Math.round(retention) : 60,
        chat_knowledge_mode: input.chatKnowledgeMode === 'full' ? 'full' : 'scoped',
        default_category_id: categories.get(lower(input.defaultCategory)) ?? null,
        operator_name: text(input.operatorName, 200),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    check(error, 'Saving settings');
    return this.loadSettings();
  }

  // ---- Bulk operations (Settings > Data) ----

  /** Adds or updates everything in an exported backup. Nothing already stored is deleted. */
  async importWorkspace(data: { tasks?: Task[]; runbooks?: Runbook[]; settings?: Partial<UserSettings> }) {
    let runbooks = 0;
    let tickets = 0;
    for (const rb of Array.isArray(data.runbooks) ? data.runbooks : []) {
      await this.saveRunbook(rb);
      runbooks++;
    }
    for (const t of Array.isArray(data.tasks) ? data.tasks : []) {
      await this.saveTicket(t);
      tickets++;
    }
    if (data.settings && typeof data.settings === 'object') await this.saveSettings(data.settings);
    return { tickets, runbooks };
  }

  /** Deletes every ticket and guide, then loads the given starting data. */
  async resetWorkspace(data: { tasks: Task[]; runbooks: Runbook[]; settings: Partial<UserSettings> }) {
    const companyId = await this.companyId();
    check((await this.sb.from('tickets').delete().eq('company_id', companyId)).error, 'Clearing tickets');
    check((await this.sb.from('runbooks').delete().not('id', 'is', null)).error, 'Clearing runbooks');
    await this.markChanged();
    return this.importWorkspace(data);
  }

  // ---- Forms ----

  async listForms(email?: string): Promise<FormSubmission[]> {
    const companyId = await this.companyId();
    const users = await this.users();
    const userById = new Map(users.map((u) => [u.id, u]));
    let submitterIds: string[] | null = null;
    if (email) {
      submitterIds = users.filter((u) => lower(u.email) === lower(email)).map((u) => u.id);
      if (!submitterIds.length) return [];
    }
    const forms = await all(this.sb, 'form_submissions', '*', (q) => {
      let x = q.eq('company_id', companyId).order('submitted_at', { ascending: false });
      if (submitterIds) x = x.in('submitted_by_id', submitterIds);
      return x;
    });
    if (!forms.length) return [];
    const ids = forms.map((f) => f.id);
    const inIds = (q: any) => q.in('submission_id', ids);
    const [userId, systems, requisitions, reqItems, assets, assetItems, returns, returnOptions, attachments] = await Promise.all([
      all(this.sb, 'form_user_id', '*', inIds),
      all(this.sb, 'form_user_id_systems', '*', inIds),
      all(this.sb, 'form_requisition', '*', inIds),
      all(this.sb, 'form_requisition_items', '*', inIds),
      all(this.sb, 'form_asset', '*', inIds),
      all(this.sb, 'form_asset_items', '*', inIds),
      all(this.sb, 'form_asset_returns', '*', inIds),
      all(this.sb, 'form_asset_return_options', 'id, form_type, sort_order'),
      all(this.sb, 'attachments', '*', (q) => q.in('form_submission_id', ids)),
    ]);
    const one = (rows: Row[]) => new Map(rows.map((r) => [r.submission_id, r]));
    const userIdBy = one(userId);
    const reqBy = one(requisitions);
    const assetBy = one(assets);
    const systemsBy = groupBy(systems, 'submission_id');
    const reqItemsBy = groupBy(reqItems, 'submission_id');
    const assetItemsBy = groupBy(assetItems, 'submission_id');
    const returnsBy = groupBy(returns, 'submission_id');
    const attachmentsBy = groupBy(attachments, 'form_submission_id');
    const optionOrder = (type: string) => returnOptions.filter((o) => o.form_type === type).sort((a, b) => a.sort_order - b.sort_order).map((o) => o.id);

    return forms.map((f): FormSubmission => {
      const submitter = f.submitted_by_id ? userById.get(f.submitted_by_id) : undefined;
      const files = (attachmentsBy.get(f.id) || []).map(toAttachment);
      const yesNo = (v: unknown) => (v === 'yes' || v === 'no' ? v : '') as 'yes' | 'no' | '';
      const fmt = (v: unknown) => (v === 'hardcopy' || v === 'softcopy' ? v : '') as 'hardcopy' | 'softcopy' | '';
      let data: FormSubmission['data'];
      if (f.form_type === 'user-id') {
        const u = userIdBy.get(f.id) || {};
        data = {
          requestorName: f.requestor_name || '',
          phoneExt: f.phone_ext || '',
          designation: f.designation || '',
          requestDate: f.request_date || '',
          department: f.department || '',
          location: f.location_text || '',
          systems: Object.fromEntries((systemsBy.get(f.id) || []).map((s) => [s.option_id, true])),
          othersDetail: u.others_detail || '',
          remarks: u.remarks || '',
          hasAttachments: yesNo(f.has_attachments),
          attachmentFormat: fmt(f.attachment_format),
          attachmentFileNames: files.map((a) => a.name),
        } satisfies UserIdFormData;
      } else if (f.form_type === 'requisition') {
        const q = reqBy.get(f.id) || {};
        const items = (section: string) =>
          byPosition((reqItemsBy.get(f.id) || []).filter((i) => i.section === section)).map((i) => ({
            id: `item-${i.id}`,
            description: i.description || '',
            quantity: amountText(i.quantity),
            price: amountText(i.unit_price),
          }));
        data = {
          refNo: q.ref_no || '',
          requestDate: f.request_date || '',
          requestorName: f.requestor_name || '',
          phoneExt: f.phone_ext || '',
          designation: f.designation || '',
          department: f.department || '',
          company: q.company_name || '',
          location: f.location_text || '',
          hasAttachments: yesNo(f.has_attachments),
          attachmentFormat: fmt(f.attachment_format),
          attachmentRemark: q.attachment_remark || '',
          attachmentFileNames: files.map((a) => a.name),
          budgeted: yesNo(q.budgeted),
          budgetedAmount: amountText(q.budgeted_amount),
          utilisedAmount: amountText(q.utilised_amount),
          proposedCapex: amountText(q.proposed_capex),
          balanceAmount: amountText(q.balance_amount),
          purpose: q.purpose || '',
          items: items('requested'),
          itItems: items('it'),
        } satisfies RequisitionFormData;
      } else {
        const a = assetBy.get(f.id) || {};
        const ticked = new Set((returnsBy.get(f.id) || []).map((r) => r.option_id));
        const order = optionOrder(f.form_type);
        data = {
          employeeId: a.employee_id || '',
          referenceNo: a.reference_no || '',
          submittedBy: f.requestor_name || '',
          requestDate: f.request_date || '',
          department: f.department || '',
          location: f.location_text || '',
          items: byPosition(assetItemsBy.get(f.id)).map((i) => ({
            id: `item-${i.id}`,
            description: i.description || '',
            specModel: i.spec_model || '',
            serialNumber: i.serial_number || '',
            quantity: amountText(i.quantity),
            remarks: i.remarks || '',
          })),
          itReturnOptions: order.length ? order.map((id) => ticked.has(id)) : undefined,
          itRemarks: a.it_remarks || undefined,
        } satisfies AssetFormData;
      }
      return {
        id: f.legacy_id || `form-${f.id}`,
        formNumber: f.form_number,
        type: f.form_type,
        submittedAt: f.submitted_at,
        submittedBy: {
          id: submitter?.id || '',
          name: submitter?.name || f.requestor_name || '',
          email: submitter?.email || '',
          department: submitter?.department || undefined,
        },
        data,
        attachments: files.length ? files : undefined,
        viewedAt: f.viewed_at || undefined,
        completedAt: f.completed_at || undefined,
        completedBy: f.completed_by_id ? userById.get(f.completed_by_id)?.name : undefined,
        rejectedAt: f.rejected_at || undefined,
        rejectedBy: f.rejected_by_id ? userById.get(f.rejected_by_id)?.name : undefined,
        rejectionReason: f.rejection_reason || undefined,
      };
    });
  }

  private async loadForm(legacyId: string): Promise<{ row: Row; form: FormSubmission } | null> {
    const companyId = await this.companyId();
    const { data } = await this.sb.from('form_submissions').select('*').eq('company_id', companyId).eq('legacy_id', legacyId).maybeSingle();
    if (!data) return null;
    const forms = await this.listForms();
    const form = forms.find((f) => f.id === legacyId);
    return form ? { row: data, form } : null;
  }

  async createForm(input: {
    type: FormSubmissionType;
    data: FormSubmission['data'];
    attachments?: TicketAttachment[];
    submittedBy: { id?: string; email: string };
  }): Promise<FormSubmission> {
    const companyId = await this.companyId();
    const users = await this.users();
    const submitter =
      users.find((u) => input.submittedBy.id && u.id === input.submittedBy.id) ||
      users.find((u) => lower(u.email) === lower(input.submittedBy.email));
    if (!submitter) throw new RepositoryError(400, 'Sign in again before submitting.');

    const d = input.data as any;
    const isAsset = input.type === 'disposal' || input.type === 'allocation';
    // Parse amounts before anything is written, so a bad value leaves nothing half-saved.
    const reqAmounts =
      input.type === 'requisition'
        ? {
            budgeted_amount: amount(d.budgetedAmount, 'Budgeted Amount', 14),
            utilised_amount: amount(d.utilisedAmount, 'Utilised Amount', 14),
            proposed_capex: amount(d.proposedCapex, 'Proposed Capex', 14),
            balance_amount: amount(d.balanceAmount, 'Balance Amount', 14),
          }
        : null;
    const reqItems =
      input.type === 'requisition'
        ? (['requested', 'it'] as const).flatMap((section) =>
            (Array.isArray(section === 'requested' ? d.items : d.itItems) ? (section === 'requested' ? d.items : d.itItems) : []).map((item: any, i: number) => ({
              section,
              position: i + 1,
              description: text(item?.description),
              quantity: amount(item?.quantity, `${section === 'it' ? 'Section E' : 'Section C'} item ${i + 1} quantity`, 12),
              unit_price: amount(item?.price, `${section === 'it' ? 'Section E' : 'Section C'} item ${i + 1} price`, 14),
            }))
          )
        : [];
    const assetItems = isAsset
      ? (Array.isArray(d.items) ? d.items : []).map((item: any, i: number) => ({
          position: i + 1,
          description: text(item?.description),
          spec_model: text(item?.specModel, 200),
          serial_number: text(item?.serialNumber, 120),
          quantity: amount(item?.quantity, `Item ${i + 1} quantity`, 12),
          remarks: text(item?.remarks),
        }))
      : [];

    const formNumber = await this.nextNumber(FORM_PREFIX[input.type], async (n) => {
      const { data } = await this.sb.from('form_submissions').select('id').eq('company_id', companyId).eq('form_number', n).limit(1);
      return Boolean(data?.length);
    });
    const legacyId = `form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inserted = await this.sb
      .from('form_submissions')
      .insert({
        legacy_id: legacyId,
        company_id: companyId,
        form_number: formNumber,
        form_type: input.type,
        submitted_by_id: submitter.id,
        submitted_at: new Date().toISOString(),
        requestor_name: text(isAsset ? d.submittedBy : d.requestorName, 200),
        phone_ext: isAsset ? null : text(d.phoneExt, 32),
        designation: isAsset ? null : text(d.designation, 200),
        department: text(d.department, 200),
        request_date: day(d.requestDate),
        location_text: text(d.location, 200),
        has_attachments: isAsset ? null : d.hasAttachments === 'yes' || d.hasAttachments === 'no' ? d.hasAttachments : null,
        attachment_format: isAsset ? null : d.attachmentFormat === 'hardcopy' || d.attachmentFormat === 'softcopy' ? d.attachmentFormat : null,
      })
      .select('id')
      .single();
    check(inserted.error, 'Saving form');
    const submissionId = inserted.data!.id as number;

    try {
      if (input.type === 'user-id') {
        check((await this.sb.from('form_user_id').insert({ submission_id: submissionId, others_detail: text(d.othersDetail, 300), remarks: text(d.remarks) })).error, 'Saving form details');
        const { data: options } = await this.sb.from('form_system_options').select('id');
        const known = new Set((options || []).map((o) => o.id));
        const ticked = Object.entries(d.systems || {}).filter(([k, v]) => v && known.has(k)).map(([option_id]) => ({ submission_id: submissionId, option_id }));
        if (ticked.length) check((await this.sb.from('form_user_id_systems').insert(ticked)).error, 'Saving systems');
      } else if (input.type === 'requisition') {
        check(
          (
            await this.sb.from('form_requisition').insert({
              submission_id: submissionId,
              ref_no: text(d.refNo, 60),
              company_name: text(d.company, 200),
              attachment_remark: text(d.attachmentRemark, 500),
              budgeted: d.budgeted === 'yes' || d.budgeted === 'no' ? d.budgeted : null,
              purpose: text(d.purpose),
              ...reqAmounts,
            })
          ).error,
          'Saving form details'
        );
        if (reqItems.length) check((await this.sb.from('form_requisition_items').insert(reqItems.map((i) => ({ ...i, submission_id: submissionId })))).error, 'Saving items');
      } else {
        check((await this.sb.from('form_asset').insert({ submission_id: submissionId, employee_id: text(d.employeeId, 60), reference_no: text(d.referenceNo, 60), it_remarks: text(d.itRemarks) })).error, 'Saving form details');
        if (assetItems.length) check((await this.sb.from('form_asset_items').insert(assetItems.map((i: Row) => ({ ...i, submission_id: submissionId })))).error, 'Saving items');
        const { data: options } = await this.sb.from('form_asset_return_options').select('id, sort_order').eq('form_type', input.type).order('sort_order');
        const ticked = (Array.isArray(d.itReturnOptions) ? d.itReturnOptions : [])
          .map((v: unknown, i: number) => (v && options?.[i] ? { submission_id: submissionId, option_id: options[i].id } : null))
          .filter(Boolean);
        if (ticked.length) check((await this.sb.from('form_asset_returns').insert(ticked)).error, 'Saving Section D');
      }
      await this.syncAttachments({ form_submission_id: submissionId }, input.attachments || []);
    } catch (err) {
      // Remove the partly saved form so it does not appear with missing details.
      await this.sb.from('form_submissions').delete().eq('id', submissionId);
      throw err;
    }

    const saved = await this.loadForm(legacyId);
    return saved!.form;
  }

  private async updateForm(legacyId: string, change: (row: Row, users: Row[]) => Row | RepositoryError | null): Promise<FormSubmission> {
    const found = await this.loadForm(legacyId);
    if (!found) throw new RepositoryError(404, 'Form not found.');
    const users = await this.users();
    const patch = change(found.row, users);
    if (patch instanceof RepositoryError) throw patch;
    if (patch) {
      const { error } = await this.sb.from('form_submissions').update(patch).eq('id', found.row.id);
      if (error && /ck_form_submissions/.test(error.message)) throw new RepositoryError(409, 'This form is already closed.');
      check(error, 'Updating form');
    }
    return (await this.loadForm(legacyId))!.form;
  }

  /** People are recorded by account; the name the browser sends is matched to one. */
  private static userByNameOrId(users: Row[], who?: { id?: string; name?: string }) {
    if (who?.id) {
      const u = users.find((x) => x.id === who.id);
      if (u) return u.id;
    }
    const matches = users.filter((x) => lower(x.name) === lower(who?.name));
    return matches.length === 1 ? matches[0].id : null;
  }

  markFormViewed(id: string) {
    return this.updateForm(id, (row) => (row.viewed_at ? null : { viewed_at: new Date().toISOString() }));
  }

  completeForm(id: string, by: { id?: string; name?: string }) {
    return this.updateForm(id, (row, users) => {
      if (row.completed_at || row.rejected_at) return null;
      const now = new Date().toISOString();
      return { completed_at: now, completed_by_id: WorkspaceRepository.userByNameOrId(users, by), viewed_at: row.viewed_at || now };
    });
  }

  rejectForm(id: string, reason: string, by: { id?: string; name?: string }) {
    return this.updateForm(id, (row, users) => {
      if (row.form_type !== 'requisition') return new RepositoryError(400, 'Only requisition forms can be rejected.');
      if (row.completed_at) return new RepositoryError(409, 'This form is already marked Done.');
      if (row.rejected_at) return null;
      const now = new Date().toISOString();
      return { rejected_at: now, rejected_by_id: WorkspaceRepository.userByNameOrId(users, by), rejection_reason: reason, viewed_at: row.viewed_at || now };
    });
  }

  async deleteForm(id: string): Promise<boolean> {
    const companyId = await this.companyId();
    const { data, error } = await this.sb.from('form_submissions').delete().eq('company_id', companyId).eq('legacy_id', id).select('id');
    check(error, 'Deleting form');
    return Boolean(data?.length);
  }

  // ---- Shared ----

  /** Replaces a parent's child rows with the given set. */
  private async replace(table: string, parentColumn: string, parentId: number, rows: Row[]) {
    check((await this.sb.from(table).delete().eq(parentColumn, parentId)).error, `Clearing ${table}`);
    if (rows.length) check((await this.sb.from(table).insert(rows)).error, `Saving ${table}`);
  }

  /** Makes a ticket's or form's attachment rows match the given file list. */
  private async syncAttachments(parent: { ticket_id?: number; form_submission_id?: number }, files: TicketAttachment[]) {
    const column = parent.ticket_id != null ? 'ticket_id' : 'form_submission_id';
    const parentId = (parent.ticket_id ?? parent.form_submission_id) as number;
    const keys = files.map((f) => text(f?.id, 200)).filter(Boolean) as string[];
    let removal = this.sb.from('attachments').delete().eq(column, parentId);
    if (keys.length) removal = removal.not('storage_key', 'in', `(${keys.map((k) => `"${k.replace(/"/g, '')}"`).join(',')})`);
    check((await removal).error, 'Updating attachments');
    const rows = files
      .filter((f) => text(f?.id, 200))
      .map((f) => ({
        storage_key: text(f.id, 200),
        ticket_id: parent.ticket_id ?? null,
        form_submission_id: parent.form_submission_id ?? null,
        file_name: text(f.name, 260) || String(f.id),
        size_bytes: Number.isFinite(Number(f.size)) ? Math.max(0, Math.round(Number(f.size))) : 0,
        content_type: text(f.type, 150),
        storage_backend: f.storage === 'local' ? 'local' : 'supabase',
        uploaded_at: iso(f.uploadedAt) || new Date().toISOString(),
      }));
    if (rows.length) check((await this.sb.from('attachments').upsert(rows, { onConflict: 'storage_key' })).error, 'Saving attachments');
  }
}

function uniqueTags(list: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of Array.isArray(list) ? list : []) {
    const t = text(tag, 100);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

function toAttachment(a: Row): TicketAttachment {
  return {
    id: a.storage_key,
    name: a.file_name,
    size: Number(a.size_bytes) || 0,
    type: a.content_type || 'application/octet-stream',
    storage: a.storage_backend,
    uploadedAt: a.uploaded_at,
  };
}
