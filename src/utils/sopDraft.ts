/**
 * Turns AI-written SOP drafts into IS Studio runbooks, and back into the SOP
 * text layout for review.
 *
 * The SOP writer is told the rules in its prompt, but the rules that protect
 * the handbook are enforced here as well, because a model can ignore a prompt:
 * category from the fixed list, a unique SOP-<AREA>-<NNN> code, v1.0.0, draft
 * while anything needs confirming, and no credential in any field. Pure
 * functions with no AI SDK imports, used by the server and the browser.
 */
import { DiagnosticStep, IT_CATEGORIES, ITCategory, RemediationStep, Runbook } from '../types';

export const SOP_COMPANY_LINE = 'ENTERPRISE IT OPERATIONS & SRE';
export const SOP_DEPARTMENT_LINE =
  'Infrastructure Engineering & Incident Response | Standard Operating Procedure (SOP)';

/** Area part of the SOP code for each category. */
export const SOP_AREA_BY_CATEGORY: Record<ITCategory, string> = {
  'E-mail': 'EML',
  FTP: 'FTP',
  NAV: 'NAV',
  'File Server': 'FS',
  Internet: 'INT',
  'Advance Retails System': 'ARS',
  Network: 'NET',
  HRIS: 'HRIS',
  Ebuilder: 'EBD',
  Printer: 'PRN',
  Database: 'DB',
  Others: 'GEN',
};

const SHELL_TYPES: DiagnosticStep['shellType'][] = ['general', 'powershell', 'bash', 'sql', 'kubectl', 'docker'];

export const SOP_MAX_TAGS = 15;

/** What the SOP writer returns for one SOP, before it is checked. */
export interface GeneratedSop {
  title?: string;
  code?: string;
  category?: string;
  owner?: string;
  symptom?: string;
  triggerAlertPatterns?: string[];
  rootCauseAnalysis?: string;
  diagnosticSteps?: { title?: string; explanation?: string; cli?: string; shellType?: string }[];
  remediationSteps?: { title?: string; instruction?: string; command?: string; verification?: string; dangerous?: boolean }[];
  rollbackPlan?: string;
  postMortemChecklist?: string[];
  tags?: string[];
  placeholders?: string[];
  needsConfirming?: string[];
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const list = (value: unknown) =>
  Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const unique = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Replaces anything that looks like a real credential with a named
 * placeholder. The handbook is readable by every employee and is fed to the IT
 * Assistant, so a password must never survive into it, whatever the model did.
 */
export function redactCredentials(value: string): { text: string; found: boolean } {
  let found = false;
  const result = value.replace(
    /\b(password|passwd|pwd|passcode|pin|secret|api[ _-]?key|access[ _-]?key|(?:wi-?fi|wireless|network|product|licen[cs]e)[ _-]?key|token|client[ _-]?secret)(\s*(?:is|=|:)\s*)(["']?)([^\s"'<>]{3,})\3/gi,
    (match, label: string, sep: string, quote: string, secret: string) => {
      // Already a placeholder such as <DOMAIN_ADMIN_PASSWORD>, or plain words.
      if (/^<[A-Z0-9_]+>$/.test(secret) || /^(required|needed|reset|expired|the|a|your|their|not)$/i.test(secret)) {
        return match;
      }
      found = true;
      return `${label}${sep}<REDACTED_${label.replace(/[\s-]+/g, '_').toUpperCase()}>`;
    }
  );
  return { text: result, found };
}

/** Next free SOP-<AREA>-<NNN> code for a category, given codes already in use. */
export function nextSopCode(category: ITCategory, usedCodes: Iterable<string>): string {
  const area = SOP_AREA_BY_CATEGORY[category];
  const used = new Set([...usedCodes].map((c) => c.toUpperCase()));
  let highest = 0;
  for (const code of used) {
    const match = code.match(new RegExp(`^SOP-${area}-(\\d{3,})$`));
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  let next = highest + 1;
  while (used.has(`SOP-${area}-${String(next).padStart(3, '0')}`)) next++;
  return `SOP-${area}-${String(next).padStart(3, '0')}`;
}

export interface CheckedSop {
  runbook: Runbook;
  needsConfirming: string[];
  placeholders: string[];
  /** Human-readable notes on what was corrected, e.g. a code already in use. */
  corrections: string[];
}

/**
 * Checks one generated SOP and turns it into a runbook. `usedCodes` is updated
 * with the code given, so several SOPs from the same notes never share one.
 */
export function checkGeneratedSop(
  raw: GeneratedSop,
  options: { usedCodes: Set<string>; owner: string; today: string; idSuffix: string }
): CheckedSop {
  const corrections: string[] = [];
  const needsConfirming = unique(list(raw.needsConfirming));
  const placeholders = unique(list(raw.placeholders));

  const requestedCategory = text(raw.category);
  const category: ITCategory = (IT_CATEGORIES as readonly string[]).includes(requestedCategory)
    ? (requestedCategory as ITCategory)
    : 'Others';
  if (requestedCategory && requestedCategory !== category) {
    corrections.push(`Category "${requestedCategory}" is not in the list, so it was set to Others.`);
  }

  const area = SOP_AREA_BY_CATEGORY[category];
  const requestedCode = text(raw.code).toUpperCase();
  let code = requestedCode;
  if (!new RegExp(`^SOP-${area}-\\d{3}$`).test(code) || options.usedCodes.has(code)) {
    code = nextSopCode(category, options.usedCodes);
    if (requestedCode) {
      corrections.push(
        options.usedCodes.has(requestedCode)
          ? `Code ${requestedCode} is already in the handbook, so this SOP is ${code}.`
          : `Code ${requestedCode} does not match SOP-${area}-NNN for ${category}, so this SOP is ${code}.`
      );
    }
  }
  options.usedCodes.add(code);

  // Every text field is checked for credentials before it can reach the handbook.
  let redacted = false;
  const clean = (value: string) => {
    const r = redactCredentials(value);
    if (r.found) redacted = true;
    return r.text;
  };

  const diagnosticSteps: DiagnosticStep[] = (raw.diagnosticSteps || [])
    .filter((s) => text(s?.title) || text(s?.cli))
    .map((s) => {
      const shell = text(s.shellType).toLowerCase() as DiagnosticStep['shellType'];
      return {
        title: clean(text(s.title) || 'Check'),
        explanation: clean(text(s.explanation)),
        cli: clean(text(s.cli)),
        shellType: SHELL_TYPES.includes(shell) ? shell : 'general',
      };
    });

  const remediationSteps: RemediationStep[] = (raw.remediationSteps || [])
    .filter((s) => text(s?.title) || text(s?.instruction))
    .map((s, i) => {
      const verification = text(s.verification);
      if (!verification) needsConfirming.push(`Step ${i + 1}: how to verify it worked.`);
      return {
        stepNumber: i + 1,
        title: clean(text(s.title) || `Step ${i + 1}`),
        instruction: clean(text(s.instruction)),
        command: text(s.command) ? clean(text(s.command)) : undefined,
        dangerous: Boolean(s.dangerous),
        verification: clean(verification) || '<VERIFICATION_NEEDED>',
      };
    });

  if (redacted) {
    placeholders.push('<REDACTED_...> values replaced credentials found in the draft');
    needsConfirming.push('A credential-like value was removed from the draft. Keep the real value out of the handbook.');
  }
  if (diagnosticSteps.length < 3 || diagnosticSteps.length > 5) {
    corrections.push(
      `${diagnosticSteps.length} diagnostic check${diagnosticSteps.length === 1 ? '' : 's'} instead of the usual 3-5; add more in the editor if the notes support them.`
    );
  }
  if (!list(raw.triggerAlertPatterns).length) {
    needsConfirming.push('The exact error text users see (Matched Alert Patterns).');
  }

  const tags = unique(list(raw.tags).map((t) => t.toLowerCase())).slice(0, SOP_MAX_TAGS);
  const draft = needsConfirming.length > 0;

  const runbook: Runbook = {
    id: `runbook-${options.idSuffix}`,
    code,
    title: clean(text(raw.title) || 'Untitled SOP'),
    category,
    lastUpdated: options.today,
    author: clean(text(raw.owner) || options.owner),
    authorRole: 'IT Department',
    version: '1.0.0',
    status: draft ? 'draft' : 'active',
    symptom: clean(text(raw.symptom)),
    triggerAlertPatterns: list(raw.triggerAlertPatterns).map(clean),
    rootCauseAnalysis: clean(text(raw.rootCauseAnalysis)),
    diagnosticSteps,
    remediationSteps,
    rollbackPlan: clean(text(raw.rollbackPlan)),
    postMortemChecklist: list(raw.postMortemChecklist).map(clean),
    relatedTaskIds: [],
    tags,
    needsConfirming: unique(needsConfirming),
    placeholders: unique(placeholders),
  };

  return { runbook, needsConfirming: runbook.needsConfirming!, placeholders: runbook.placeholders!, corrections };
}

const SHELL_LABEL: Record<DiagnosticStep['shellType'], string> = {
  general: 'GENERAL',
  powershell: 'POWERSHELL',
  bash: 'BASH',
  sql: 'SQL',
  kubectl: 'KUBECTL',
  docker: 'DOCKER',
};

/** The SOP laid out as text in the handbook's standard structure, for review and copying. */
export function renderSopText(runbook: Runbook): string {
  const out: string[] = [];
  out.push(SOP_COMPANY_LINE, SOP_DEPARTMENT_LINE, `${runbook.code} | v${runbook.version}${runbook.status === 'draft' ? ' (draft)' : ''}`, '');
  out.push(`# ${runbook.title}`, '');
  out.push('| CATEGORY | AUTHOR / OWNER | LAST UPDATED |', `| ${runbook.category} | ${runbook.author} | ${runbook.lastUpdated} |`, '');

  out.push('1. SYMPTOMS & TRIGGER SIGNATURES', runbook.symptom || '<SYMPTOMS_NEEDED>', '', 'Matched Alert Patterns:');
  (runbook.triggerAlertPatterns.length ? runbook.triggerAlertPatterns : ['<ERROR_TEXT_NEEDED>']).forEach((p) => out.push(`- ${p}`));
  out.push('');

  out.push('2. ROOT CAUSE ANALYSIS (RCA)', runbook.rootCauseAnalysis || '<ROOT_CAUSE_NEEDED>', '');

  out.push('3. DIAGNOSTIC WORKFLOW & TRIAGE CLI');
  runbook.diagnosticSteps.forEach((s, i) => {
    out.push(`${i + 1}. **${s.title}** [${SHELL_LABEL[s.shellType] || 'GENERAL'}]`);
    if (s.explanation) out.push(`   ${s.explanation}`);
    if (s.cli) out.push('   ```', ...s.cli.split('\n').map((l) => `   ${l}`), '   ```');
  });
  out.push('');

  out.push('4. STEP-BY-STEP REMEDIATION PROCEDURES');
  runbook.remediationSteps.forEach((s) => {
    out.push(`Step ${s.stepNumber}: ${s.title}`);
    if (s.instruction) out.push(...s.instruction.split('\n').map((l) => `   ${l}`));
    if (s.command) out.push('   ```', ...s.command.split('\n').map((l) => `   ${l}`), '   ```');
    out.push(`   *Verification: ${s.verification.replace(/^verification:\s*/i, '')}*`);
  });
  out.push('');

  out.push('5. ROLLBACK & DISASTER SAFEGUARD PROTOCOL', runbook.rollbackPlan || '<ROLLBACK_NEEDED>', '');

  out.push('6. POST-INCIDENT PREVENTATIVE ACTION ITEMS');
  runbook.postMortemChecklist.forEach((item) => out.push(`- [ ] ${item}`));
  out.push('');

  out.push(`TAGS: ${runbook.tags.join(', ')}`);
  if (runbook.placeholders?.length) {
    out.push('', 'PLACEHOLDERS:', ...runbook.placeholders.map((p) => `- ${p}`));
  }
  if (runbook.needsConfirming?.length) {
    out.push('', 'NEEDS CONFIRMING:', ...runbook.needsConfirming.map((n) => `- ${n}`));
  }
  return out.join('\n');
}
