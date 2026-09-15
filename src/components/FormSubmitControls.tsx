import React, { useState } from 'react';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';
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
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-xs transition-colors"
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

/** Secondary style for Export to PDF once Submit is the main action. */
export const secondaryHeaderButton =
  'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs transition-colors';
