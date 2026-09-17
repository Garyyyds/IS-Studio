import React, { useState } from 'react';
import { Send, Loader2, CheckCircle2, Eraser } from 'lucide-react';
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
 * Clears the whole form. Asks first, in place, so one stray click cannot wipe a
 * long form; the confirm buttons keep the header's height so nothing jumps.
 */
export const ClearFormButton: React.FC<ClearFormButtonProps> = ({ onClear, disabled = false }) => {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2" role="group" aria-label="Confirm clearing the form">
        <button
          type="button"
          onClick={() => {
            onClear();
            setConfirming(false);
          }}
          className={dangerHeaderButton}
        >
          <Eraser className="w-4 h-4" />
          <span>Clear all fields</span>
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={secondaryHeaderButton}>
          <span>Cancel</span>
        </button>
      </div>
    );
  }

  return (
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

/** Destructive header action (DESIGN.md Danger button), same height as the others. */
export const dangerHeaderButton =
  'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 shadow-xs transition-colors';

/** Secondary style for Back and Export to PDF beside the primary action. */
export const secondaryHeaderButton =
  'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs transition-colors';
