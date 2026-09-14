import { Task } from '../types';

// Ticket numbers run REQ-0001, REQ-0002, ... and are never reused. The highest
// number handed out is kept in the shared workspace settings, so deleting the
// newest ticket does not give its number to the next one.

const PATTERN = /^REQ-(\d+)$/i;

/** 12 for "REQ-0012"; 0 for anything that is not a REQ number. */
export function sequenceOf(ticketNumber?: string): number {
  const match = PATTERN.exec((ticketNumber || '').trim());
  return match ? parseInt(match[1], 10) : 0;
}

export function formatTicketNumber(sequence: number): string {
  return `REQ-${String(sequence).padStart(4, '0')}`;
}

/** One past the highest number already issued or still on the board. */
export function nextTicketSequence(tasks: Task[], lastIssued = 0): number {
  return Math.max(lastIssued || 0, 0, ...tasks.map((t) => sequenceOf(t.ticketNumber))) + 1;
}
