import React, { useCallback, useEffect, useState } from 'react';
import { FileText, ChevronRight, Paperclip, Calendar, AlertTriangle, FilePlus2, Loader2, RefreshCw } from 'lucide-react';
import { AppUser, FormSubmission } from '../types';
import { FORM_TYPE_INFO, fetchFormSubmissions, formHeadline } from '../utils/formSubmissions';
import { FormSubmissionModal } from './FormSubmissionModal';

interface MyFormsViewProps {
  currentUser: AppUser;
  /** Opens the Create Form picker. */
  onCreateForm: () => void;
}

/** The employee's history of forms submitted to IT, newest first. */
export const MyFormsView: React.FC<MyFormsViewProps> = ({ currentUser, onCreateForm }) => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setSubmissions(await fetchFormSubmissions(currentUser.email));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load your forms.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.email]);

  // Refresh on returning to the window, so "Viewed by IT" appears without a reload.
  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const opened = openId ? submissions.find((s) => s.id === openId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">My Submitted Forms</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Every form you have submitted to IT: In Progress while IT works on it, Completed once IT is done.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
        </div>
      )}

      {isLoading && submissions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading your forms...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No forms submitted yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Forms you submit to IT from Create Form, such as a requisition or new user ID, show up here.
          </p>
          <button
            type="button"
            onClick={onCreateForm}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer inline-flex items-center gap-2"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Create a Form</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              data-my-form={submission.formNumber}
              onClick={() => setOpenId(submission.id)}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition cursor-pointer space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shrink-0">
                    {submission.formNumber}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {FORM_TYPE_INFO[submission.type].title}
                  </h3>
                </div>
                {submission.completedAt ? (
                  <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                    Completed
                  </span>
                ) : (
                  <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                    In Progress
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{formHeadline(submission)}</p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Submitted on {new Date(submission.submittedAt).toLocaleDateString()}
                  </span>
                  {submission.completedAt && (
                    <span className="flex items-center gap-1">
                      Completed on {new Date(submission.completedAt).toLocaleDateString()}
                    </span>
                  )}
                  {submission.attachments && submission.attachments.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {submission.attachments.length} file{submission.attachments.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                  <span>View form</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {opened && <FormSubmissionModal submission={opened} onClose={() => setOpenId(null)} />}
    </div>
  );
};
