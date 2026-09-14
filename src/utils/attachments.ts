import { TicketAttachment } from '../types';
import { MAX_ATTACHMENT_BYTES } from '../data/requestOptions';

/**
 * Sends one file to the server's attachment store and returns the metadata to
 * keep on the ticket. The body is always sent as octet-stream - a file that
 * happens to be JSON would otherwise be swallowed by the server's JSON parser -
 * so the real content type travels in the query string instead.
 */
export async function uploadAttachment(file: File): Promise<TicketAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is larger than ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
  }

  const params = new URLSearchParams({
    name: file.name,
    type: file.type || 'application/octet-stream',
  });

  const res = await fetch(`/api/attachments?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });

  if (!res.ok) {
    let message = '';
    try {
      message = (await res.json())?.error || '';
    } catch {
      // Non-JSON error page, e.g. the body-size limit rejecting the request.
    }
    if (!message && res.status === 413) {
      message = `${file.name} is larger than ${formatBytes(MAX_ATTACHMENT_BYTES)}.`;
    }
    throw new Error(message || `Could not upload ${file.name}.`);
  }

  return res.json();
}

export function attachmentUrl(attachment: TicketAttachment): string {
  return `/api/attachments/${encodeURIComponent(attachment.id)}?name=${encodeURIComponent(
    attachment.name
  )}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
