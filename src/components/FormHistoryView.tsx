import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  KeyRound,
  PackageCheck,
  Recycle,
  Search,
  Calendar,
  CheckCircle2,
  Paperclip,
  User,
  AlertTriangle,
  Loader2,
  Archive,
} from 'lucide-react';
import { FormSubmission, FormSubmissionType } from '../types';
import {
  FORM_TYPE_INFO,
  FORM_TYPE_ORDER,
  fetchFormSubmissions,
  formHeadline,
  deleteFormSubmission,
} from '../utils/formSubmissions';
import { FormSubmissionModal } from './FormSubmissionModal';

export const FORM_ICONS: Record<FormSubmissionType, React.ElementType> = {
  requisition: ClipboardList,
  'user-id': KeyRound,
  allocation: PackageCheck,
  disposal: Recycle,
};

/**
 * Completed forms, kept apart per form type: pick a type first, then only that
 * type's records are listed.
 */
export const FormHistoryView: React.FC = () => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<FormSubmissionType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSubmissions(await fetchFormSubmissions());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load form history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const handleDelete = async (id: string) => {
    await deleteFormSubmission(id);
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setOpenId(null);
  };

  // Newest completion first.
  const completed = submissions
    .filter((s) => s.completedAt)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  const countOf = (type: FormSubmissionType) => completed.filter((s) => s.type === type).length;
  const opened = openId ? submissions.find((s) => s.id === openId) : undefined;

  const q = searchQuery.trim().toLowerCase();
  const records = selectedType
    ? completed
        .filter((s) => s.type === selectedType)
        .filter(
          (s) =>
            !q ||
            [s.formNumber, s.submittedBy.name, s.submittedBy.email, s.submittedBy.department, s.completedBy, formHeadline(s), JSON.stringify(s.data)]
              .join(' ')
              .toLowerCase()
              .includes(q)
        )
    : [];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/40 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        {!selectedType ? (
          <>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Archive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Form History</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                Forms marked Done in the Form Inbox. Choose a form type to see its records.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FORM_TYPE_ORDER.map((type) => {
                const Icon = FORM_ICONS[type];
                const count = countOf(type);
                return (
                  <button
                    key={type}
                    type="button"
                    data-history-type={type}
                    onClick={() => {
                      setSelectedType(type);
                      setSearchQuery('');
                    }}
                    className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                        <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {isLoading ? '…' : `${count} completed`}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {FORM_TYPE_INFO[type].title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                      {FORM_TYPE_INFO[type].subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  {React.createElement(FORM_ICONS[selectedType], { className: 'w-5 h-5 text-indigo-600 dark:text-indigo-400' })}
                  <span>{FORM_TYPE_INFO[selectedType].title}</span>
                </h2>
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                  Form history · {countOf(selectedType)} completed
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search this form's history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {isLoading ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading history...</span>
              </div>
            ) : records.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <Archive className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {q ? 'No matching records' : 'No completed forms yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {q ? 'Try a different search.' : 'Forms of this type appear here once they are marked Done in the Form Inbox.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((submission) => (
                  <div
                    key={submission.id}
                    data-history-record={submission.formNumber}
                    onClick={() => setOpenId(submission.id)}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition cursor-pointer space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shrink-0">
                          {submission.formNumber}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{formHeadline(submission)}</h3>
                      </div>
                      <span className="self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {submission.submittedBy.name}
                          {submission.submittedBy.department ? ` · ${submission.submittedBy.department}` : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                        </span>
                        {submission.attachments && submission.attachments.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {submission.attachments.length} file{submission.attachments.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Completed {new Date(submission.completedAt!).toLocaleDateString()}
                        {submission.completedBy ? ` by ${submission.completedBy}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {opened && <FormSubmissionModal submission={opened} onClose={() => setOpenId(null)} onDelete={handleDelete} />}
    </div>
  );
};
