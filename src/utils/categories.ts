import { IT_CATEGORIES, ITCategory, Runbook, Task, UserSettings } from '../types';

// Data saved before categories followed the request form still carries the old
// seven values. Two have a direct equivalent; the rest have none, so they read
// as "Others" rather than disappearing from filters and counts.
const LEGACY_CATEGORIES: Record<string, ITCategory> = {
  Networking: 'Network',
  Database: 'Database',
  'DevOps & SRE': 'Others',
  'Security & IAM': 'Others',
  'Cloud Infra': 'Others',
  SysAdmin: 'Others',
  Application: 'Others',
};

export function normalizeCategory(value?: string | null): ITCategory {
  if (value && (IT_CATEGORIES as readonly string[]).includes(value)) return value as ITCategory;
  return (value && LEGACY_CATEGORIES[value]) || 'Others';
}

/** A portal ticket's category is the one the employee picked on the form. */
export const normalizeTask = (task: Task): Task => ({
  ...task,
  category: normalizeCategory(task.systemRequested || task.category),
});

export const normalizeTasks = (tasks: Task[]): Task[] => tasks.map(normalizeTask);

export const normalizeRunbooks = (runbooks: Runbook[]): Runbook[] =>
  runbooks.map((rb) => ({ ...rb, category: normalizeCategory(rb.category as string) }));

export function normalizeSettings<T extends Partial<UserSettings>>(settings: T): T {
  if (!settings) return settings;
  const next: any = { ...settings };
  if (next.defaultCategory) next.defaultCategory = normalizeCategory(next.defaultCategory);
  // Removed features: the Rules view and the card tag/checklist toggles.
  if (next.defaultView === 'rules') next.defaultView = 'kanban';
  if (next.visibleViews && 'rules' in next.visibleViews) {
    const { rules: _rules, ...views } = next.visibleViews;
    next.visibleViews = views;
  }
  delete next.showAutomatedTagsOnCards;
  delete next.showChecklistProgressOnCards;
  return next;
}
