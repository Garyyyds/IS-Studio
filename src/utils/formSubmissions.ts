import {
  AppUser,
  AssetFormData,
  FormSubmission,
  FormSubmissionType,
  RequisitionFormData,
  UserIdFormData,
} from '../types';
import { uploadAttachment } from './attachments';
import { DISPOSAL_FORM, ALLOCATION_FORM } from './assetFormPdf';

/** Lane order and names in the admin Form Inbox. */
export const FORM_TYPE_INFO: Record<FormSubmissionType, { title: string; subtitle: string }> = {
  requisition: {
    title: 'IT Hardware, Software & Peripherals',
    subtitle: 'Requisitions with cost breakdown',
  },
  'user-id': {
    title: 'New User ID Requisition',
    subtitle: 'System access requests',
  },
  allocation: {
    title: ALLOCATION_FORM.pickerTitle,
    subtitle: 'Assets issued to staff',
  },
  disposal: {
    title: DISPOSAL_FORM.pickerTitle,
    subtitle: 'Assets to write off',
  },
};

export const FORM_TYPE_ORDER: FormSubmissionType[] = ['requisition', 'user-id', 'allocation', 'disposal'];

/**
 * Sends a filled-in form to IT. Softcopy files are uploaded first: if one
 * fails, nothing is submitted and the employee keeps everything they entered.
 */
export async function submitForm(
  type: FormSubmissionType,
  data: FormSubmission['data'],
  files: File[],
  user: AppUser
): Promise<FormSubmission> {
  const attachments = await Promise.all(files.map((file) => uploadAttachment(file)));

  const res = await fetch('/api/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      data,
      attachments,
      submittedBy: { id: user.id, name: user.name, email: user.email, department: user.department },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.submission) {
    throw new Error(body?.error || `Could not submit the form (error ${res.status}).`);
  }
  return body.submission;
}

/** One-line summary of what a form is asking for. */
export function formHeadline(submission: FormSubmission): string {
  if (submission.type === 'user-id') {
    const data = submission.data as UserIdFormData;
    return data.requestorName ? `User ID for ${data.requestorName}` : 'New user ID';
  }
  if (submission.type === 'requisition') {
    const data = submission.data as RequisitionFormData;
    return data.purpose?.trim() || data.items?.[0]?.description || 'Requisition';
  }
  const items = (submission.data as AssetFormData).items || [];
  const first = items[0]?.description || 'Asset list';
  return items.length > 1 ? `${first} + ${items.length - 1} more` : first;
}

/** All submitted forms, or only those one employee submitted when an email is given. */
export async function fetchFormSubmissions(email?: string): Promise<FormSubmission[]> {
  const res = await fetch(email ? `/api/forms?email=${encodeURIComponent(email)}` : '/api/forms');
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'Could not load submitted forms.');
  return Array.isArray(body?.submissions) ? body.submissions : [];
}

export async function markFormViewed(id: string): Promise<FormSubmission | null> {
  const res = await fetch(`/api/forms/${encodeURIComponent(id)}/viewed`, { method: 'POST' });
  const body = await res.json().catch(() => null);
  return res.ok ? body?.submission ?? null : null;
}

export async function completeFormSubmission(id: string, completedBy: string): Promise<FormSubmission> {
  const res = await fetch(`/api/forms/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completedBy }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.submission) throw new Error(body?.error || 'Could not mark the form as done.');
  return body.submission;
}

export async function rejectFormSubmission(id: string, reason: string, rejectedBy: string): Promise<FormSubmission> {
  const res = await fetch(`/api/forms/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, rejectedBy }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.submission) throw new Error(body?.error || 'Could not reject the form.');
  return body.submission;
}

/** Only this form type can be rejected; the others are simply marked Done. */
export const canReject = (submission: FormSubmission) => submission.type === 'requisition';

/** A form is closed once it is marked Done or rejected. */
export const isFormClosed = (submission: FormSubmission) => Boolean(submission.completedAt || submission.rejectedAt);

export async function deleteFormSubmission(id: string): Promise<void> {
  const res = await fetch(`/api/forms/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || 'Could not delete the form.');
  }
}
