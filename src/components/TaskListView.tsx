import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Clock, 
  CheckSquare, 
  BookOpen, 
  Zap, 
  Sparkles,
  ArrowUpDown, 
  FileText, 
  Download, 
  ShieldAlert,
  ChevronRight,
  Trash2,
  History,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { Task, Runbook, TaskStatus, PriorityLevel, UserSettings } from '../types';
import { exportIncidentPostMortemPdf } from '../utils/pdfExport';
import { isTaskRecentlyCompleted, getTaskRetentionInfo, DEFAULT_COMPLETED_RETENTION_MINUTES } from '../utils/ticketRetention';

interface TaskListViewProps {
  tasks: Task[];
  runbooks: Runbook[];
  settings?: UserSettings;
  onSelectTask: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onOpenRunbook: (runbookId: string) => void;
  onBatchPriority: (taskIds: string[], priority: PriorityLevel) => void;
  onOpenQuickTriage: () => void;
  onDeleteTask?: (taskId: string) => void;
  onBatchDelete?: (taskIds: string[]) => void;
  onNavigateToHistory?: () => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  runbooks,
  settings,
  onSelectTask,
  onStatusChange,
  onOpenRunbook,
  onBatchPriority,
  onOpenQuickTriage,
  onDeleteTask,
  onBatchDelete,
  onNavigateToHistory,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'priority' | 'created'>('priority');
  const [showAllDone, setShowAllDone] = useState(false);

  const retentionMinutes = settings?.completedTicketRetentionMinutes ?? DEFAULT_COMPLETED_RETENTION_MINUTES;

  const activeCount = tasks.filter((t) => t.status !== 'done').length;
  const totalDoneTasks = tasks.filter((t) => t.status === 'done');
  const recentDoneTasks = totalDoneTasks.filter((t) => isTaskRecentlyCompleted(t, retentionMinutes));
  const archivedDoneCount = totalDoneTasks.length - recentDoneTasks.length;

  const filteredTasks = tasks.filter((t) => {
    // Retention filter: hide done tickets older than retention window unless showAllDone is true
    if (t.status === 'done' && !showAllDone && !isTaskRecentlyCompleted(t, retentionMinutes)) {
      return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.ticketNumber.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.environment.toLowerCase().includes(q) ||
      t.automatedTags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'priority') {
      const pWeights = { P1: 4, P2: 3, P3: 2, P4: 1 };
      return pWeights[b.priority] - pWeights[a.priority];
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTasks.map((t) => t.id));
    }
  };

  const handleExportPostMortem = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    exportIncidentPostMortemPdf(task);
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="max-w-screen-2xl mx-auto">
        {/* Header & Bulk Action Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 mb-4 sm:mb-6 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Ticket Count & Search */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 text-xs">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              {activeCount} Active
            </span>
            <span className="hidden sm:inline text-[11px] text-slate-400 font-mono">
              ({tasks.length})
            </span>
          </div>

          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tickets, error signatures, services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <button
            onClick={onOpenQuickTriage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-xs font-semibold transition cursor-pointer shadow-xs shrink-0"
            title="Paste an IT log or alert to auto-classify priority"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>AI Triage</span>
          </button>
        </div>

        {/* Sort and Bulk controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <span className="whitespace-nowrap">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="priority">Priority (P1 → P4)</option>
              <option value="created">Created Date</option>
            </select>
          </div>

          {/* Bulk actions if items selected */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold whitespace-nowrap">
                {selectedIds.length} sel
              </span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shrink-0">
                {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => onBatchPriority(selectedIds, p)}
                    className="px-1.5 sm:px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-white dark:hover:bg-slate-700 rounded transition cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
              {onBatchDelete && (
                <button
                  onClick={() => {
                    onBatchDelete(selectedIds);
                    setSelectedIds([]);
                  }}
                  className="px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 bg-rose-50 dark:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition cursor-pointer"
                  title="Delete Selected"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Retention / History Notification Banner */}
      {archivedDoneCount > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 mb-4 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>{archivedDoneCount}</strong> resolved ticket{archivedDoneCount > 1 ? 's are' : ' is'} archived to the Ticket History page after the {retentionMinutes}-minute active window.
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllDone}
                onChange={(e) => setShowAllDone(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-0"
              />
              <span>Show archived in list</span>
            </label>
            {onNavigateToHistory && (
              <button
                onClick={onNavigateToHistory}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold cursor-pointer transition"
              >
                <span>Open History</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredTasks.length}
                    onChange={toggleSelectAll}
                    className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-0"
                  />
                </th>
                <th className="py-3 px-3">Ticket / Priority</th>
                <th className="py-3 px-4">Title & Context</th>
                <th className="py-3 px-3">Environment</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Checklist</th>
                <th className="py-3 px-3">Assignee</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No matching IT tasks found.
                  </td>
                </tr>
              ) : (
                sortedTasks.map((task) => {
                  const isSelected = selectedIds.includes(task.id);
                  const linkedRunbook = runbooks.find((r) => r.id === task.linkedRunbookId);
                  const completedCheck = task.checklist.filter((c) => c.done).length;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition ${
                        isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(task.id)}
                          className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-0"
                        />
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">{task.ticketNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              task.priority === 'P1'
                                ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                                : task.priority === 'P2'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                                : task.priority === 'P3'
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate mb-1">{task.title}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {task.automatedTags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-indigo-700 dark:text-indigo-300 font-mono bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            task.environment === 'Production'
                              ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                              : task.environment === 'Staging'
                              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {task.environment}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <select
                          value={task.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="backlog">Backlog</option>
                          <option value="investigating">Investigating</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="testing">Testing</option>
                          <option value="done">Resolved / Done</option>
                        </select>
                        {task.status === 'done' && (() => {
                          const retention = getTaskRetentionInfo(task, retentionMinutes);
                          return (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">
                                {retention.isArchived ? 'Archived' : `Archives in ${retention.formattedTimeLeft}`}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {task.checklist.length > 0 ? (
                          <span>
                            {completedCheck}/{task.checklist.length} ({Math.round((completedCheck / task.checklist.length) * 100)}%)
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={task.assignee.avatar}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[90px] font-medium">
                            {task.assignee.name.split(' ')[0]}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleExportPostMortem(task, e)}
                            className="px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                            title="Export Incident Post-Mortem to PDF"
                          >
                            <FileText className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            <span>PDF</span>
                          </button>
                          {onDeleteTask && (
                            <button
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition cursor-pointer"
                              title="Delete ticket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
};
