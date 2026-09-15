import React, { useCallback, useEffect, useState } from 'react';
import { Search, Layers, Paperclip, User, Calendar, Trash2, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { FormSubmission, FormSubmissionType } from '../types';
import {
  FORM_TYPE_INFO,
  FORM_TYPE_ORDER,
  fetchFormSubmissions,
  formHeadline as headline,
  markFormViewed,
  completeFormSubmission,
  deleteFormSubmission,
} from '../utils/formSubmissions';
import { FormSubmissionModal } from './FormSubmissionModal';

// Matches the ticket board's check for changes made on other devices.
const REFRESH_INTERVAL_MS = 20000;

/** Text the search box matches against. */
function searchText(submission: FormSubmission): string {
  return [
    submission.formNumber,
    submission.submittedBy.name,
    submission.submittedBy.email,
    submission.submittedBy.department,
    headline(submission),
    JSON.stringify(submission.data),
  ]
    .join(' ')
    .toLowerCase();
}

interface FormInboxViewProps {
  /** Recorded as who marked a form Done. */
  currentUserName: string;
}

export const FormInboxView: React.FC<FormInboxViewProps> = ({ currentUserName }) => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileLane, setMobileLane] = useState<FormSubmissionType | 'ALL'>('ALL');

  const load = useCallback(async () => {
    try {
      setSubmissions(await fetchFormSubmissions());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load submitted forms.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // New forms arrive from employees' browsers, so check again periodically and
  // whenever the window regains focus.
  useEffect(() => {
    load();
    const interval = window.setInterval(load, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', load);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  const openSubmission = (submission: FormSubmission) => {
    setOpenId(submission.id);
    if (!submission.viewedAt) {
      // Clear the New badge straight away; the server records it in the background.
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submission.id ? { ...s, viewedAt: new Date().toISOString() } : s))
      );
      markFormViewed(submission.id).catch(() => {});
    }
  };

  const handleDelete = async (id: string) => {
    await deleteFormSubmission(id);
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setOpenId((current) => (current === id ? null : current));
  };

  // Done moves the form to Form History straight away.
  const handleComplete = async (id: string) => {
    const updated = await completeFormSubmission(id, currentUserName);
    setSubmissions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    setOpenId((current) => (current === id ? null : current));
  };

  // The inbox holds only forms still being worked on.
  const open = submissions.filter((s) => !s.completedAt);
  const q = searchQuery.trim().toLowerCase();
  const visible = q ? open.filter((s) => searchText(s).includes(q)) : open;
  const newCount = open.filter((s) => !s.viewedAt).length;
  const openSubmissionRecord = openId ? submissions.find((s) => s.id === openId) : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-100 dark:bg-slate-950 transition-colors duration-200">
      {/* Controls bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
          <div className="w-full flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 text-xs"
              title={`${newCount} new, ${open.length} in the inbox`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{newCount} New</span>
              <span className="hidden sm:inline text-[11px] text-slate-400 font-mono">({open.length})</span>
            </div>

            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search forms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => load()}
              title="Check for new forms"
              aria-label="Refresh forms"
              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {error && (
            <div className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Phone: pick one lane */}
      <div className="sm:hidden px-3 pt-2 pb-1.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {(['ALL', ...FORM_TYPE_ORDER] as const).map((lane) => {
          const count = lane === 'ALL' ? visible.length : visible.filter((s) => s.type === lane).length;
          return (
            <button
              key={lane}
              onClick={() => setMobileLane(lane)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                mobileLane === lane
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {lane === 'ALL' ? 'All' : FORM_TYPE_INFO[lane].title.split(' ').slice(0, 2).join(' ')} ({count})
            </button>
          );
        })}
      </div>

      {/* Lanes */}
      <div className="flex-1 overflow-x-auto py-3 sm:py-5">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <div
            className={`flex gap-4 sm:gap-5 ${
              mobileLane === 'ALL' ? 'min-w-[1180px]' : 'w-full min-w-0 sm:min-w-[1180px]'
            } min-h-[calc(100vh-210px)] items-stretch`}
          >
            {(mobileLane === 'ALL' ? FORM_TYPE_ORDER : [mobileLane]).map((type) => {
              const laneForms = visible.filter((s) => s.type === type);
              return (
                <div
                  key={type}
                  data-form-lane={type}
                  className={`flex-1 flex flex-col ${
                    mobileLane !== 'ALL' ? 'w-full min-w-full sm:min-w-[280px]' : 'min-w-[280px]'
                  } bg-slate-200/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs`}
                >
                  <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white">{FORM_TYPE_INFO[type].title}</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {laneForms.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{FORM_TYPE_INFO[type].subtitle}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[220px]">
                    {laneForms.length === 0 ? (
                      <div className="h-40 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 p-4 text-center bg-white/40 dark:bg-slate-900/30">
                        <Layers className="w-5 h-5 mb-1.5 opacity-30 text-slate-400 dark:text-slate-600" />
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {isLoading ? 'Loading...' : q ? 'No matching forms' : 'No forms submitted'}
                        </span>
                      </div>
                    ) : (
                      laneForms.map((submission) => (
                        <FormCard
                          key={submission.id}
                          submission={submission}
                          onOpen={() => openSubmission(submission)}
                          onDelete={() => handleDelete(submission.id)}
                          onComplete={() => handleComplete(submission.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {openSubmissionRecord && (
        <FormSubmissionModal
          submission={openSubmissionRecord}
          onClose={() => setOpenId(null)}
          onDelete={handleDelete}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
};

interface FormCardProps {
  submission: FormSubmission;
  onOpen: () => void;
  onDelete: () => Promise<void>;
  onComplete: () => Promise<void>;
}

/** A submitted form. Deliberately not draggable: forms stay in their type's lane. */
const FormCard: React.FC<FormCardProps> = ({ submission, onOpen, onDelete, onComplete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const isNew = !submission.viewedAt;
  const firstName = submission.submittedBy.name ? submission.submittedBy.name.split(' ')[0] : 'User';

  return (
    <div
      className="group relative rounded-xl border p-3.5 shadow-xs transition-all hover:shadow-md cursor-pointer bg-white dark:bg-slate-900 overflow-hidden"
      onClick={onOpen}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
            {submission.formNumber}
          </span>
          <span
            className="inline-flex items-center text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"
            title={`Submitted by ${submission.submittedBy.name}${submission.submittedBy.department ? ` (${submission.submittedBy.department})` : ''}`}
          >
            <User className="w-2.5 h-2.5 mr-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>{firstName}</span>
          </span>
          {submission.attachments && submission.attachments.length > 0 && (
            <span
              className="inline-flex items-center text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
              title={submission.attachments.map((file) => file.name).join(', ')}
            >
              <Paperclip className="w-2.5 h-2.5 mr-0.5 text-slate-500 dark:text-slate-400" />
              <span>{submission.attachments.length}</span>
            </span>
          )}
        </div>
        {isNew && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white shrink-0">
            New
          </span>
        )}
      </div>

      <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2">
        {headline(submission)}
      </h3>

      {submission.submittedBy.department && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
            {submission.submittedBy.department}
          </span>
        </div>
      )}

      <div
        className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmDelete ? (
          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
            <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">Delete?</span>
            <button
              type="button"
              onClick={() => onDelete().catch(() => setConfirmDelete(false))}
              className="px-1 rounded bg-rose-600 text-white text-[9px] font-bold hover:bg-rose-700 cursor-pointer"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="opacity-40 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
            title="Delete form"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>{new Date(submission.submittedAt).toLocaleDateString()}</span>
          </span>
          <button
            type="button"
            disabled={isCompleting}
            onClick={() => {
              setIsCompleting(true);
              onComplete().catch(() => setIsCompleting(false));
            }}
            title="Mark as done and move to Form History"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-60 transition cursor-pointer"
          >
            {isCompleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
