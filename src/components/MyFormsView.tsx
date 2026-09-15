import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  ChevronRight,
  Paperclip,
  Calendar,
  AlertTriangle,
  FilePlus2,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Search,
} from 'lucide-react';
import { AppUser, FormSubmission, FormSubmissionType } from '../types';
import { FORM_TYPE_INFO, FORM_TYPE_ORDER, fetchFormSubmissions, formHeadline } from '../utils/formSubmissions';
import { FormSubmissionModal } from './FormSubmissionModal';
import { FORM_ICONS } from './FormHistoryView';
import { secondaryHeaderButton } from './FormSubmitControls';

interface MyFormsViewProps {
  currentUser: AppUser;
  /** Opens the Create Form picker. */
  onCreateForm: () => void;
}

/**
 * The employee's forms submitted to IT, kept apart per form type: pick a type
 * first, then only that type's forms are listed, newest first.
 */
export const MyFormsView: React.FC<MyFormsViewProps> = ({ currentUser, onCreateForm }) => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<FormSubmissionType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Refresh on returning to the window, so a form IT completed shows as Completed.
  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const opened = openId ? submissions.find((s) => s.id === openId) : undefined;
  const ofType = (type: FormSubmissionType) => submissions.filter((s) => s.type === type);

  const q = searchQuery.trim().toLowerCase();
  const records = selectedType
    ? ofType(selectedType).filter(
        (s) => !q || [s.formNumber, formHeadline(s), JSON.stringify(s.data)].join(' ').toLowerCase().includes(q)
      )
    : [];

  const refreshButton = (
    <button type="button" onClick={load} className={secondaryHeaderButton}>
      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      <span>Refresh</span>
    </button>
  );

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
        </div>
      )}

      {!selectedType ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>My Forms</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                Forms you have submitted to IT. Choose a form type to see its records.
              </p>
            </div>
            {refreshButton}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FORM_TYPE_ORDER.map((type) => {
              const Icon = FORM_ICONS[type];
              const forms = ofType(type);
              const inProgress = forms.filter((s) => !s.completedAt).length;
              return (
                <button
                  key={type}
                  type="button"
                  data-my-forms-type={type}
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
                      {isLoading && submissions.length === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                          …
                        </span>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {forms.length} submitted
                          </span>
                          {inProgress > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {inProgress} in progress
                            </span>
                          )}
                        </>
                      )}
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
                My Forms · {ofType(selectedType).length} submitted
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelectedType(null)} className={secondaryHeaderButton}>
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              {refreshButton}
            </div>
          </div>

          {ofType(selectedType).length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search these forms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          )}

          {isLoading && submissions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading your forms...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {q ? 'No matching forms' : 'No forms of this type yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {q ? 'Try a different search.' : 'Forms of this type you submit to IT from Create Form show up here.'}
              </p>
              {!q && (
                <button
                  type="button"
                  onClick={onCreateForm}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer inline-flex items-center gap-2"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>Create a Form</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((submission) => (
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
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{formHeadline(submission)}</h3>
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

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Submitted on {new Date(submission.submittedAt).toLocaleDateString()}
                      </span>
                      {submission.completedAt && (
                        <span>Completed on {new Date(submission.completedAt).toLocaleDateString()}</span>
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
        </>
      )}

      {opened && <FormSubmissionModal submission={opened} onClose={() => setOpenId(null)} />}
    </div>
  );
};
