import type { Runbook, StaffMember, Task, UserSettings } from '../types';

/**
 * Per-record saves for tickets, IT Handbook guides and workspace settings.
 * Every call throws an Error carrying a message fit to show the user.
 */

/** A save refused because someone else changed the ticket first. */
export class TicketConflictError extends Error {
  constructor(message: string, public current: Task) {
    super(message);
  }
}

export interface WorkspaceSnapshot {
  tasks: Task[];
  runbooks: Runbook[];
  settings: Partial<UserSettings>;
  staff: StaffMember[];
  lastSaved: string;
}

// The signed-in account travels with each request so the server can record
// who changed a ticket's status or closed a form.
function currentUserId(): string | undefined {
  try {
    return JSON.parse(localStorage.getItem('it_ops_current_user') || 'null')?.id || undefined;
  } catch {
    return undefined;
  }
}

export async function apiFetch<T = any>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const userId = currentUserId();
  if (userId) headers['x-user-id'] = userId;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method || 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 409 && data?.task) throw new TicketConflictError(data.error, data.task);
  if (!res.ok) throw new Error(data?.error || `The server returned an error (${res.status}).`);
  return data as T;
}

export const loadWorkspace = () => apiFetch<WorkspaceSnapshot>('/api/data');

/** `baseUpdatedAt` is the ticket's updatedAt when it was opened; omit it for a new ticket. */
export async function saveTicket(task: Task, baseUpdatedAt?: string): Promise<Task> {
  const data = await apiFetch<{ task: Task }>(`/api/tickets/${encodeURIComponent(task.id)}`, {
    method: 'PUT',
    body: { task, baseUpdatedAt },
  });
  return data.task;
}

export const deleteTickets = (ids: string[]) =>
  ids.length === 1
    ? apiFetch(`/api/tickets/${encodeURIComponent(ids[0])}`, { method: 'DELETE' })
    : apiFetch('/api/tickets/delete', { method: 'POST', body: { ids } });

export async function saveRunbook(runbook: Runbook): Promise<Runbook> {
  const data = await apiFetch<{ runbook: Runbook }>(`/api/runbooks/${encodeURIComponent(runbook.id)}`, {
    method: 'PUT',
    body: { runbook },
  });
  return data.runbook;
}

export const deleteRunbook = (id: string) => apiFetch(`/api/runbooks/${encodeURIComponent(id)}`, { method: 'DELETE' });

export async function saveSettings(settings: UserSettings): Promise<Partial<UserSettings>> {
  // Theme is chosen per browser and never shared.
  const { themeMode: _theme, ...shared } = settings;
  const data = await apiFetch<{ settings: Partial<UserSettings> }>('/api/settings', { method: 'PUT', body: { settings: shared } });
  return data.settings;
}

export const importWorkspace = (data: { tasks?: Task[]; runbooks?: Runbook[]; settings?: Partial<UserSettings> }) =>
  apiFetch<WorkspaceSnapshot>('/api/workspace/import', { method: 'POST', body: data });

export const resetWorkspace = (data: { tasks: Task[]; runbooks: Runbook[]; settings: Partial<UserSettings> }) =>
  apiFetch<WorkspaceSnapshot>('/api/workspace/reset', { method: 'POST', body: data });
