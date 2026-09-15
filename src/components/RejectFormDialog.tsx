import React, { useEffect, useRef, useState } from 'react';
import { XCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { FormSubmission } from '../types';
import { FORM_TYPE_INFO } from '../utils/formSubmissions';
import { secondaryHeaderButton } from './FormSubmitControls';

const MAX_REASON_CHARS = 1000;

interface RejectFormDialogProps {
  submission: FormSubmission;
  onCancel: () => void;
  /** Rejects the form; a thrown error is shown in the dialog. */
  onSubmit: (reason: string) => Promise<void>;
}

/** Asks for the reason a requisition is not approved; the employee sees it. */
export const RejectFormDialog: React.FC<RejectFormDialogProps> = ({ submission, onCancel, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Escape cancels this dialog only. Capturing it first stops the form window
  // underneath from closing too.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isSubmitting) return;
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel, isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Write the reason for rejecting this request.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(reason.trim());
    } catch (err: any) {
      setError(err?.message || 'Could not reject the form.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={() => !isSubmitting && onCancel()}
    >
      <form
        role="dialog"
        aria-label="Reject request"
        data-reject-dialog
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">Reject request</h2>
            <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 shrink-0">
              {submission.formNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cancel"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {FORM_TYPE_INFO[submission.type].title} from{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{submission.submittedBy.name}</span>. The
            employee will see this reason in My Forms.
          </p>

          <div>
            <label htmlFor="reject-reason" className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Reason for rejection <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="reject-reason"
              ref={textareaRef}
              rows={4}
              maxLength={MAX_REASON_CHARS}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Not in this year's budget. Please resubmit next quarter."
              className="w-full px-3.5 py-2 rounded-lg text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-y min-h-[96px] leading-relaxed"
            />
            <p className="mt-1 text-right text-[10px] text-slate-400">
              {reason.length}/{MAX_REASON_CHARS}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <button type="button" onClick={onCancel} disabled={isSubmitting} className={secondaryHeaderButton}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-transparent bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-xs transition-colors"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
