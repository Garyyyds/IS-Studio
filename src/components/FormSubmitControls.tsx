import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, CheckCircle2, Eraser, X } from 'lucide-react';
import { AppUser, FormSubmission, FormSubmissionType } from '../types';
import { submitForm } from '../utils/formSubmissions';

/**
 * Submit-to-IT state shared by the printable forms. The form's current values
 * are remembered on success, so the same form cannot be sent twice by accident;
 * editing anything afterwards allows sending it again.
 */
export function useFormSubmit(type: FormSubmissionType, currentUser: AppUser) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ formNumber: string; snapshot: string } | null>(null);

  const submit = async (data: FormSubmission['data'], files: File[], snapshot: string) => {
    setIsSubmitting(true);
    try {
      const submission = await submitForm(type, data, files, currentUser);
      setSubmitted({ formNumber: submission.formNumber, snapshot });
      return submission;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting, submitted };
}

interface SubmitFormButtonProps {
  onClick: () => void;
  isSubmitting: boolean;
  /** True when this exact form has already been sent. */
  alreadySubmitted: boolean;
}

export const SubmitFormButton: React.FC<SubmitFormButtonProps> = ({ onClick, isSubmitting, alreadySubmitted }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isSubmitting || alreadySubmitted}
    title={alreadySubmitted ? 'This form has been submitted. Edit it to submit again.' : 'Send this form to IT'}
    className={primaryHeaderButton}
  >
    {isSubmitting ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : alreadySubmitted ? (
      <CheckCircle2 className="w-4 h-4" />
    ) : (
      <Send className="w-4 h-4" />
    )}
    <span>{isSubmitting ? 'Submitting...' : alreadySubmitted ? 'Submitted' : 'Submit to IT'}</span>
  </button>
);

interface ClearFormButtonProps {
  /** Empties every field the employee filled in. */
  onClear: () => void;
  disabled?: boolean;
}

/**
 * Clears the whole form. Asks first in a pop-up, so one stray click cannot wipe
 * a long form.
 */
export const ClearFormButton: React.FC<ClearFormButtonProps> = ({ onClear, disabled = false }) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled}
        title="Empty every field and start this form again"
        className={secondaryHeaderButton}
      >
        <Eraser className="w-4 h-4" />
        <span>Clear Form</span>
      </button>

      {confirming && (
        <ClearFormDialog
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            onClear();
            setConfirming(false);
          }}
        />
      )}
    </>
  );
};

/** The confirmation pop-up, laid out like the Reject request dialog. */
const ClearFormDialog: React.FC<{ onCancel: () => void; onConfirm: () => void }> = ({ onCancel, onConfirm }) => {
  // Cancel has focus, so pressing Enter by habit keeps the form.
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-form-title"
        aria-describedby="clear-form-description"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <Eraser className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <h2 id="clear-form-title" className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Clear this form?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p id="clear-form-description" className="p-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Everything you have entered, including any attached files, will be removed and the form starts again. This
          cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <button ref={cancelRef} type="button" onClick={onCancel} className={secondaryHeaderButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-transparent bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
          >
            <Eraser className="w-4 h-4" />
            <span>Clear Form</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/** Confirmation shown after a form reaches IT. */
export const FormSubmittedNotice: React.FC<{ formNumber: string }> = ({ formNumber }) => (
  <div
    role="status"
    className="flex items-start gap-2 rounded-lg px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900"
  >
    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
      Submitted to IT as <span className="font-mono font-bold">{formNumber}</span>. It is saved under My Forms, and
      you can still export the PDF for signing.
    </p>
  </div>
);

/**
 * Primary header action. The transparent border matches the secondary button's
 * 1px border, so the two sit at exactly the same height side by side.
 */
export const primaryHeaderButton =
  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-transparent bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-xs transition-colors';

/** Secondary style for Back and Export to PDF beside the primary action. */
export const secondaryHeaderButton =
  'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs transition-colors';
