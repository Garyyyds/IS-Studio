import { Task } from '../types';

export const DEFAULT_COMPLETED_RETENTION_MINUTES = 60; // 1 hour default

/**
 * Returns the timestamp (in ms) when the task was resolved.
 * Falls back to updatedAt or createdAt if resolvedAt was not recorded.
 */
export function getTaskResolvedTimestamp(task: Task): number {
  if (task.resolvedAt) {
    const time = new Date(task.resolvedAt).getTime();
    if (!isNaN(time)) return time;
  }
  if (task.updatedAt) {
    const time = new Date(task.updatedAt).getTime();
    if (!isNaN(time)) return time;
  }
  return new Date(task.createdAt).getTime();
}

/**
 * Checks if a task is completed/resolved.
 */
export function isTaskResolved(task: Task): boolean {
  return task.status === 'done';
}

/**
 * Checks if a completed task was resolved recently (within retention window, default 60 mins).
 */
export function isTaskRecentlyCompleted(
  task: Task,
  retentionMinutes: number = DEFAULT_COMPLETED_RETENTION_MINUTES
): boolean {
  if (task.status !== 'done') return false;
  // If retentionMinutes is negative or zero, nothing is retained on active board
  if (retentionMinutes <= 0) return false;
  // If set to -1 or very large (e.g. infinite), return true
  if (retentionMinutes >= 999999) return true;

  const resolvedTime = getTaskResolvedTimestamp(task);
  const now = Date.now();
  const elapsedMs = now - resolvedTime;
  const maxRetentionMs = retentionMinutes * 60 * 1000;

  return elapsedMs <= maxRetentionMs;
}

/**
 * Checks if a task is considered "Archived" to history:
 * It is resolved AND older than the retention window (e.g., > 1 hour).
 */
export function isTaskArchived(
  task: Task,
  retentionMinutes: number = DEFAULT_COMPLETED_RETENTION_MINUTES
): boolean {
  if (task.status !== 'done') return false;
  return !isTaskRecentlyCompleted(task, retentionMinutes);
}

/**
 * Formats a duration in milliseconds into a friendly human string (e.g., "18m", "2h 45m", "3d 2h").
 */
export function formatDurationMs(durationMs: number): string {
  if (durationMs < 0) durationMs = 0;
  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  if (totalMinutes < 1) return 'just now';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  
  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  if (hours < 24) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Computes human-readable retention countdown and elapsed information for a completed task.
 */
export function getTaskRetentionInfo(
  task: Task,
  retentionMinutes: number = DEFAULT_COMPLETED_RETENTION_MINUTES
): {
  elapsedMinutes: number;
  minutesRemaining: number;
  formattedElapsed: string;
  formattedTimeLeft: string;
  isArchived: boolean;
} {
  const resolvedTime = getTaskResolvedTimestamp(task);
  const now = Date.now();
  const elapsedMs = Math.max(0, now - resolvedTime);
  const maxRetentionMs = retentionMinutes * 60 * 1000;
  const remainingMs = Math.max(0, maxRetentionMs - elapsedMs);

  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  const minutesRemaining = Math.ceil(remainingMs / (60 * 1000));

  const isArchived = elapsedMs > maxRetentionMs;

  return {
    elapsedMinutes,
    minutesRemaining,
    formattedElapsed: formatDurationMs(elapsedMs),
    formattedTimeLeft: formatDurationMs(remainingMs),
    isArchived,
  };
}

/**
 * Computes total time to resolution (MTTR) from task creation to resolution timestamp.
 */
export function getTimeToResolve(task: Task): {
  durationMs: number;
  formatted: string;
} {
  const createdTime = new Date(task.createdAt).getTime();
  const resolvedTime = getTaskResolvedTimestamp(task);
  const durationMs = Math.max(0, resolvedTime - createdTime);
  return {
    durationMs,
    formatted: formatDurationMs(durationMs),
  };
}
