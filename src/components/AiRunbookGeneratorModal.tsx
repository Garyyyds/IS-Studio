import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  X,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  Info,
  KeyRound,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { Runbook, Task, IT_CATEGORIES } from '../types';
import { renderSopText } from '../utils/sopDraft';

interface AiRunbookGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Adds the reviewed SOPs to the handbook. */
  onRunbooksGenerated: (runbooks: Runbook[]) => void;
  /** Recorded as the SOP owner when the notes do not name one. */
  ownerName: string;
  initialTask?: Task | null;
}

interface CheckedSop {
  runbook: Runbook;
  needsConfirming: string[];
  placeholders: string[];
  corrections: string[];
}

const NOTES_MAX_CHARS = 20000;

const NOTES_PLACEHOLDER = `e.g.
Staff at EA2 cannot print since this morning.
Printer shows "Error printing" and jobs stay in the queue.
Fix was: restart printer, clear the queue in Settings > Printers.
If the queue will not clear, call IT.`;

/** Notes to start from when the SOP is written from a ticket. */
function notesFromTask(task?: Task | null): string {
  if (!task) return '';
  return [
    task.title,
    task.systemRequested ? `Category: ${task.systemRequested}` : '',
    task.description,
    task.rawLogs ? `Error text:\n${task.rawLogs}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const AiRunbookGeneratorModal: React.FC<AiRunbookGeneratorModalProps> = ({
  isOpen,
  onClose,
  onRunbooksGenerated,
  ownerName,
  initialTask,
}) => {
  const [notes, setNotes] = useState('');
  const [categoryHint, setCategoryHint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sops: CheckedSop[]; splitNote: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNotes(notesFromTask(initialTask));
    setCategoryHint('');
    setError(null);
    setResult(null);
  }, [initialTask, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleWrite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/generate-runbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, categoryHint, owner: ownerName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.sops)) {
        throw new Error(data?.error || `The SOP writer is unavailable (error ${res.status}).`);
      }
      setResult({ sops: data.sops, splitNote: data.splitNote || '' });
    } catch (err: any) {
      setError(err?.message || 'Could not write the SOP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    if (!result) return;
    onRunbooksGenerated(
      result.sops.map((sop) => ({
        ...sop.runbook,
        relatedTaskIds: initialTask ? [initialTask.id] : sop.runbook.relatedTaskIds,
      }))
    );
    onClose();
  };

  const copyText = async (runbook: Runbook) => {
    try {
      await navigator.clipboard.writeText(renderSopText(runbook));
      setCopiedCode(runbook.code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setError('Copying is blocked in this browser. Select the text and copy it instead.');
    }
  };

  const draftCount = result ? result.sops.filter((s) => s.runbook.status === 'draft').length : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-label="AI SOP writer"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">AI SOP Writer</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {result
                  ? 'Review the SOP before it goes into the IT Handbook.'
                  : 'Turns rough notes into a finished handbook SOP, and flags anything the notes do not cover.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          /* Step 1: notes */
          <form onSubmit={handleWrite} className="flex-1 flex flex-col min-h-0">
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Paste what you know: what staff see, the exact error text, what fixed it. The writer uses only your
                  notes, marks gaps as <span className="font-semibold">Needs confirming</span>, and keeps passwords out
                  of the handbook. Notes covering several problems become one SOP each.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="sop-category" className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    id="sop-category"
                    value={categoryHint}
                    onChange={(e) => setCategoryHint(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="">Let the writer decide</option>
                    {IT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="sop-notes" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
                  Rough notes *
                </label>
                <textarea
                  id="sop-notes"
                  required
                  rows={12}
                  maxLength={NOTES_MAX_CHARS}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={NOTES_PLACEHOLDER}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 leading-relaxed resize-y"
                />
                <p className="mt-1 text-right text-[10px] text-slate-400">
                  {notes.length.toLocaleString()}/{NOTES_MAX_CHARS.toLocaleString()}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !notes.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-transparent bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-xs transition-colors"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isLoading ? 'Writing SOP...' : 'Write SOP'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: review */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {result.sops.length > 1 && (
                <div data-split-note className="flex items-start gap-2 rounded-lg px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    <span className="font-semibold">Split into {result.sops.length} SOPs.</span>{' '}
                    {result.splitNote || 'The notes cover more than one topic.'}
                  </p>
                </div>
              )}

              {draftCount > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  SOPs with anything to confirm are added as <span className="font-semibold">Draft</span>. The IT
                  Assistant does not use drafts until you fill the gaps and set them active in the handbook.
                </p>
              )}

              {result.sops.map(({ runbook, needsConfirming, placeholders, corrections }) => (
                <div
                  key={runbook.id}
                  data-sop={runbook.code}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
                        {runbook.code}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-medium">
                        {runbook.category}
                      </span>
                      {runbook.status === 'draft' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                          Draft · v{runbook.version}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          Ready · v{runbook.version}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(runbook)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {copiedCode === runbook.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode === runbook.code ? 'Copied' : 'Copy text'}</span>
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">{runbook.title}</h4>

                    {needsConfirming.length > 0 && (
                      <div data-needs-confirming className="rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Needs confirming ({needsConfirming.length})
                        </p>
                        <ul className="mt-1 space-y-0.5 list-disc pl-4 text-xs text-amber-700 dark:text-amber-300">
                          {needsConfirming.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {placeholders.length > 0 && (
                      <div data-placeholders className="rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <KeyRound className="w-3 h-3" /> Placeholders
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                          {placeholders.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {corrections.length > 0 && (
                      <ul data-corrections className="space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {corrections.map((item) => (
                          <li key={item} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <pre
                      data-sop-text
                      className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-[11px] leading-relaxed font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words"
                    >
                      {renderSopText(runbook)}
                    </pre>
                  </div>
                </div>
              ))}

              {error && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to notes</span>
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-transparent bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  Add {result.sops.length} SOP{result.sops.length > 1 ? 's' : ''} to Handbook
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
