/**
 * IT Assistant knowledge base: turns IT Handbook guides into prompt text and,
 * in scoped mode, picks the guides relevant to a question.
 *
 * Everything here is pure: plain functions over runbooks and strings, with no
 * network, storage or AI SDK imports. Retrieval therefore costs no model call
 * of its own and survives a change of AI provider untouched. The server uses it
 * to build the attempt-1 prompt; the admin Settings view uses it to show how
 * large the handbook is.
 */

/** The runbook fields read here. Kept structural so server data typed as any fits. */
export interface KnowledgeRunbook {
  code?: string;
  title?: string;
  category?: string;
  status?: string;
  symptom?: string;
  triggerAlertPatterns?: string[];
  rootCauseAnalysis?: string;
  tags?: string[];
  diagnosticSteps?: { title?: string; explanation?: string }[];
  remediationSteps?: { title?: string; instruction?: string; verification?: string; dangerous?: boolean }[];
}

export type ChatKnowledgeMode = 'scoped' | 'full';

/** Scoped mode trims to this many characters, after ranking. Full mode only warns past it. */
export const CHAT_KNOWLEDGE_MAX_CHARS = 60000;

/** Rough characters per token, for size estimates shown to admins and written to logs. */
export const CHARS_PER_TOKEN = 4;

/** Draft and deprecated guides are never given to the assistant. */
export function isActiveRunbook(rb: KnowledgeRunbook | null | undefined): rb is KnowledgeRunbook {
  return Boolean(rb) && rb!.status !== 'draft' && rb!.status !== 'deprecated';
}

/**
 * One guide as prompt text. Steps flagged dangerous and raw commands are left
 * out: the assistant talks to employees, who should only ever be given safe
 * self-service actions.
 */
export function runbookBlock(rb: KnowledgeRunbook): string {
  const lines: string[] = [];
  lines.push(`[${rb.code}] ${rb.title}`);
  if (rb.category) lines.push(`Category: ${rb.category}`);
  if (rb.symptom) lines.push(`Symptom: ${rb.symptom}`);
  if (Array.isArray(rb.triggerAlertPatterns) && rb.triggerAlertPatterns.length) {
    lines.push(`Typical error messages: ${rb.triggerAlertPatterns.join(' | ')}`);
  }
  if (rb.rootCauseAnalysis) lines.push(`Usual cause: ${rb.rootCauseAnalysis}`);
  (rb.diagnosticSteps || []).forEach((s, i) => {
    lines.push(`Check ${i + 1}: ${s.title}${s.explanation ? ' - ' + s.explanation : ''}`);
  });
  (rb.remediationSteps || [])
    .filter((s) => !s.dangerous)
    .forEach((s, i) => {
      lines.push(
        `Fix ${i + 1}: ${s.title}${s.instruction ? ' - ' + s.instruction : ''}${s.verification ? ' (Confirm: ' + s.verification + ')' : ''}`
      );
    });
  return lines.join('\n');
}

const BLOCK_SEPARATOR = '\n\n';

/** Plain-text knowledge base for the given guides, in the order given. Inactive guides are skipped. */
export function knowledgeBaseText(runbooks: KnowledgeRunbook[]): string {
  return runbooks.filter(isActiveRunbook).map(runbookBlock).join(BLOCK_SEPARATOR);
}

/** Active guide count per category, so the chat can hide categories with nothing to search. */
export function activeGuideCountsByCategory(runbooks: KnowledgeRunbook[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rb of runbooks.filter(isActiveRunbook)) {
    if (rb.category) counts[rb.category] = (counts[rb.category] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Company systems and hosts. A question naming one of these is about that
 * system, so a guide that mentions it is boosted.
 */
export const DOMAIN_TERMS = [
  'nav',
  'xilnex',
  'ebuilder',
  'hris',
  'fortinet',
  'eadeco.local',
  'nav18app',
  'edlive',
  'hq-file01',
  'ipsecvpn1',
];

// Relative strength of each kind of evidence.
const WEIGHT = {
  /** A quoted phrase from the question found word for word in the guide. */
  quotedPhrase: 24,
  /** An error code, IP address or host name found in the guide. */
  identifier: 16,
  /** A domain dictionary term found in the guide. */
  domainTerm: 8,
};

/** How much a word counts depending on where in the guide it appears. */
const FIELD_WEIGHT = {
  title: 2,
  triggerAlertPatterns: 2,
  tags: 1.5,
  category: 1.5,
  symptom: 1,
};

/**
 * Title, tags and category say what a guide is about; symptom and error text
 * are prose that shares everyday words ("please", "again", "keeps") with any
 * long question. A guide matched only through its prose counts for this share,
 * so a ramble does not pull in guides on unrelated subjects. Literal matches on
 * quoted text, codes and host names are unaffected.
 */
const PROSE_ONLY_FACTOR = 0.25;

/** The question an employee opened with outweighs a later "still not working". */
const ORIGINAL_QUESTION_WEIGHT = 3;
const LATEST_MESSAGE_WEIGHT = 1;

/**
 * A guide is kept only if it scores at least this share of the best match.
 * Almost any two texts share a word or two, so without a floor one precise
 * match ("nav18app is not available") would drag in every guide that merely
 * shares a common word with the question.
 */
export const RELATIVE_SCORE_FLOOR = 0.2;

/**
 * An ordinary word (not a tag or category) counts only if (guides + 1) / (guides
 * containing it) reaches this, i.e. it appears in roughly a quarter of the
 * guides or fewer.
 */
const DISTINCTIVE_RATIO = 4;

/** Shortest word indexed at all, so fragments like "is", "my" and "do" carry no weight. */
const MIN_TERM_LENGTH = 3;

/** Shortest word that counts without being a tag, category or domain term. */
const MIN_ORDINARY_TERM_LENGTH = 4;

export interface RankedRunbook<T extends KnowledgeRunbook = KnowledgeRunbook> {
  runbook: T;
  score: number;
}

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Crude suffix stripping so "printer", "printing" and "prints" meet at
 * "print". Applied the same way to questions and guides, so it only has to be
 * consistent, not linguistically correct.
 */
function stem(word: string): string {
  for (const suffix of ['ing', 'ers', 'er', 'ed', 'es', 's']) {
    if (word.length - suffix.length >= MIN_TERM_LENGTH && word.endsWith(suffix)) {
      if (suffix === 's' && word.endsWith('ss')) return word;
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/**
 * Words in a text. Compound identifiers are kept whole and also split, so
 * "hq-file01" matches "hq-file01" exactly and "file01" on its own.
 */
function terms(text: string): Set<string> {
  const found = new Set<string>();
  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9._-]*[a-z0-9]|[a-z0-9]/g) || [];
  for (const word of words) {
    if (word.length >= MIN_TERM_LENGTH) found.add(stem(word));
    if (/[._-]/.test(word)) {
      for (const part of word.split(/[._-]+/)) {
        if (part.length >= MIN_TERM_LENGTH) found.add(stem(part));
      }
    }
  }
  return found;
}

/**
 * The strongest evidence a question can carry: text an employee copied off the
 * screen. These are matched against the guide as literal substrings, which is
 * what catches a guide's triggerAlertPatterns.
 */
function strongSignals(text: string): { quoted: string[]; identifiers: string[] } {
  const quoted = new Set<string>();
  // Opening quote after start, space, colon or bracket, so the apostrophe in
  // "don't" is never mistaken for a quote.
  const quotePattern = /(?:^|[\s:(\[])["'‘“]([^"'‘’“”]{3,}?)["'’”](?=$|[\s.,;:!?)\]])/g;
  for (const match of text.matchAll(quotePattern)) quoted.add(normalise(match[1]));

  const identifiers = new Set<string>();
  const add = (value: string) => {
    const v = value.toLowerCase().replace(/^[\\/]+/, '');
    if (v.length >= 3) identifiers.add(v);
  };
  // Windows / hex error codes: 0x80070035
  for (const m of text.matchAll(/\b0x[0-9a-f]{4,}\b/gi)) add(m[0]);
  // "Error 123", "error code: 53", "System error 53"
  for (const m of text.matchAll(/\berror\s*(?:code\s*)?[:#]?\s*(\d{2,})\b/gi)) add(`error ${m[1]}`);
  // IP addresses
  for (const m of text.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) add(m[0]);
  // Dotted host and domain names: eadeco.local, mail.company.com (not plain numbers like 1.5)
  for (const m of text.matchAll(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\b/gi)) add(m[0]);
  // Machine names mixing letters and digits: nav18app, hq-file01, ipsecvpn1
  for (const m of text.matchAll(/(?:\\\\)?\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*\d[a-z0-9-]*\b/gi)) {
    if (/[a-z]/i.test(m[0]) && /\d/.test(m[0])) add(m[0]);
  }
  return { quoted: [...quoted], identifiers: [...identifiers] };
}

/** Everything about one guide the ranking needs, built once per request. */
interface IndexedRunbook<T extends KnowledgeRunbook> {
  runbook: T;
  /** Words in the title, tags and category, with the weight of the strongest field. */
  topicWeights: Map<string, number>;
  /** Words in the symptom and error messages, with the weight of the strongest field. */
  proseWeights: Map<string, number>;
  /** Searchable text for literal matches. */
  text: string;
}

function weigh(fields: [string, number][]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [value, weight] of fields) {
    for (const term of terms(value)) weights.set(term, Math.max(weights.get(term) || 0, weight));
  }
  return weights;
}

function indexRunbook<T extends KnowledgeRunbook>(runbook: T): IndexedRunbook<T> {
  const topic: [string, number][] = [
    [runbook.title || '', FIELD_WEIGHT.title],
    [(runbook.tags || []).join(' '), FIELD_WEIGHT.tags],
    [runbook.category || '', FIELD_WEIGHT.category],
  ];
  const prose: [string, number][] = [
    [(runbook.triggerAlertPatterns || []).join(' \n '), FIELD_WEIGHT.triggerAlertPatterns],
    [runbook.symptom || '', FIELD_WEIGHT.symptom],
  ];
  return {
    runbook,
    topicWeights: weigh(topic),
    proseWeights: weigh(prose),
    text: normalise([...topic, ...prose].map(([value]) => value).join(' \n ')),
  };
}

/**
 * Ranks guides against a question by term overlap, most relevant first.
 *
 * - Ordinary words are weighted by inverse document frequency across the
 *   guides given: a word in few guides (nav18app, edlive) tells them apart and
 *   counts for a lot. A word found in more than half of them (such as "cannot"
 *   in a handbook of "user cannot ..." symptoms) cannot tell them apart and
 *   counts for nothing, which is what stands in for a stopword list.
 * - Domain dictionary terms, and quoted text, error codes, IP addresses and
 *   host names lifted from the question, count heavily whatever their frequency.
 * - The employee's original question counts three times their latest message.
 *
 * Word frequencies come from `corpus` when given, otherwise from `runbooks`.
 * Pass the whole handbook as the corpus when ranking a single category: inside
 * the Printer category every guide says "printer", so frequencies measured
 * there alone would make the category's own subject count for nothing.
 *
 * Every guide given is returned with its score, including zero scores.
 */
export function rankRunbooks<T extends KnowledgeRunbook>(
  runbooks: T[],
  originalQuestion: string,
  latestMessage: string,
  corpus: KnowledgeRunbook[] = runbooks
): RankedRunbook<T>[] {
  if (runbooks.length === 0) return [];
  const indexed = runbooks.map(indexRunbook);
  const statistics = corpus === runbooks ? indexed : corpus.map(indexRunbook);
  const total = Math.max(statistics.length, 1);

  const documentFrequency = new Map<string, number>();
  // Words the handbook's authors chose as tags or categories. These name a
  // subject, so they always count, even in a handbook where most guides share
  // it (a printer-heavy handbook must still find printer guides for "printer").
  const keywords = new Set<string>();
  for (const doc of statistics) {
    for (const term of new Set([...doc.topicWeights.keys(), ...doc.proseWeights.keys()])) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }
  for (const rb of corpus) {
    for (const term of terms([...(rb.tags || []), rb.category || ''].join(' '))) keywords.add(term);
  }
  // Any other word must be distinctive: found in at most about a quarter of the
  // guides. Words like "the", "and" and "cannot" sit in many titles and
  // symptoms, cannot tell guides apart, and are ignored. The bar is lowered for
  // a handbook of only a few guides, so a one-guide handbook stays searchable.
  const distinctiveRatio = Math.min(DISTINCTIVE_RATIO, total + 1);
  const idf = (term: string) => {
    const df = documentFrequency.get(term);
    if (!df) return 0;
    const ratio = (total + 1) / df;
    if (keywords.has(term) || DOMAIN_TERMS.includes(term)) return Math.log(ratio);
    // Short words count only as keywords: "vpn" and "dns" are tags, while
    // "for", "the" and "who" are not and say nothing about the subject.
    if (term.length < MIN_ORDINARY_TERM_LENGTH) return 0;
    return ratio >= distinctiveRatio ? Math.log(ratio) : 0;
  };

  const scoreText = (doc: IndexedRunbook<T>, query: string): number => {
    if (!query.trim()) return 0;
    let topicScore = 0;
    let proseScore = 0;
    for (const term of terms(query)) {
      const topicWeight = doc.topicWeights.get(term);
      if (topicWeight) topicScore += idf(term) * Math.max(topicWeight, doc.proseWeights.get(term) || 0);
      else if (doc.proseWeights.has(term)) proseScore += idf(term) * doc.proseWeights.get(term)!;
    }
    let score = topicScore > 0 ? topicScore + proseScore : proseScore * PROSE_ONLY_FACTOR;

    const queryText = normalise(query);
    for (const term of DOMAIN_TERMS) {
      const pattern = new RegExp(`(^|[^a-z0-9])${term.replace(/[.\-]/g, '\\$&')}($|[^a-z0-9])`);
      if (pattern.test(queryText) && pattern.test(doc.text)) score += WEIGHT.domainTerm;
    }

    const { quoted, identifiers } = strongSignals(query);
    for (const phrase of quoted) {
      if (doc.text.includes(phrase)) score += WEIGHT.quotedPhrase;
    }
    for (const id of identifiers) {
      if (doc.text.includes(id)) score += WEIGHT.identifier;
    }
    return score;
  };

  const original = originalQuestion || '';
  const latest = latestMessage && latestMessage.trim() !== original.trim() ? latestMessage : '';

  return indexed
    .map((doc, position) => ({
      runbook: doc.runbook,
      score: ORIGINAL_QUESTION_WEIGHT * scoreText(doc, original) + LATEST_MESSAGE_WEIGHT * scoreText(doc, latest),
      position,
    }))
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .map(({ runbook, score }) => ({ runbook, score: Math.round(score * 100) / 100 }));
}

export interface ScopedSelection<T extends KnowledgeRunbook = KnowledgeRunbook> {
  /** Active guides left after the category filter. */
  considered: number;
  /** Guides to send, most relevant first. */
  selected: RankedRunbook<T>[];
  /** Guides that scored nothing, or too little next to the best match. */
  notRelevant: number;
  /** Relevant guides dropped because the character cap was reached. */
  trimmedByCap: number;
  /** The knowledge base text for the selected guides. */
  text: string;
}

/**
 * Scoped retrieval: category filter, rank, drop irrelevant guides, then cap.
 * When nothing is relevant the result is empty; it never falls back to the
 * whole handbook, and attempt 1 then honestly reports the guides do not cover
 * the question.
 */
export function selectScopedRunbooks<T extends KnowledgeRunbook>(
  runbooks: T[],
  options: { category?: string; originalQuestion: string; latestMessage: string; maxChars?: number }
): ScopedSelection<T> {
  const maxChars = options.maxChars ?? CHAT_KNOWLEDGE_MAX_CHARS;
  const active = runbooks.filter(isActiveRunbook) as T[];
  const inCategory = options.category ? active.filter((rb) => rb.category === options.category) : active;

  // Word frequencies always come from the whole active handbook (see rankRunbooks).
  const ranked = rankRunbooks(inCategory, options.originalQuestion, options.latestMessage, active);
  const best = ranked[0]?.score || 0;
  const relevant = ranked.filter((r) => r.score > 0 && r.score >= best * RELATIVE_SCORE_FLOOR);

  // Cap after ranking, so what is trimmed is the least relevant. The best
  // match is always kept, even if it alone is over the cap.
  const selected: RankedRunbook<T>[] = [];
  const blocks: string[] = [];
  let used = 0;
  for (const item of relevant) {
    const block = runbookBlock(item.runbook);
    const added = block.length + (blocks.length ? BLOCK_SEPARATOR.length : 0);
    if (blocks.length && used + added > maxChars) break;
    selected.push(item);
    blocks.push(block);
    used += added;
  }

  return {
    considered: inCategory.length,
    selected,
    notRelevant: ranked.length - relevant.length,
    trimmedByCap: relevant.length - selected.length,
    text: blocks.join(BLOCK_SEPARATOR),
  };
}
