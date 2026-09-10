import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  RotateCcw,
  Trash2,
  FileDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Filter,
  Check,
  Calendar,
  Layers,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Task, PriorityLevel, EnvironmentType, ITCategory, UserSettings } from '../types';
import {
  isTaskRecentlyCompleted,
  isTaskArchived,
  getTaskRetentionInfo,
  getTimeToResolve,
  DEFAULT_COMPLETED_RETENTION_MINUTES,
} from '../utils/ticketRetention';
import { calculateSlaStatus } from '../utils/priorityEngine';
import { exportIncidentPostMortemPdf } from '../utils/pdfExport';

interface TicketHistoryViewProps {
  tasks: Task[];
  settings: UserSettings;
  onSelectTask: (task: Task) => void;
  onReopenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onBatchDeleteTasks?: (taskIds: string[]) => void;
  onBatchReopenTasks?: (taskIds: string[]) => void;
  onNavigateToBoard?: () => void;
}

export const TicketHistoryView: React.FC<TicketHistoryViewProps> = ({
  tasks,
  settings,
  onSelectTask,
  onReopenTask,
  onDeleteTask,
  onBatchDeleteTasks,
  onBatchReopenTasks,
  onNavigateToBoard,
}) => {
  const [search, setSearch] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | 'ALL'>('ALL');
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<ITCategory | 'ALL'>('ALL');
  const [retentionFilter, setRetentionFilter] = useState<'all' | 'archived' | 'recent'>('all');
  const [sortBy, setSortBy] = useState<'resolved_desc' | 'resolved_asc' | 'priority' | 'duration'>('resolved_desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const retentionMinutes = settings.completedTicketRetentionMinutes ?? DEFAULT_COMPLETED_RETENTION_MINUTES;

  // All resolved tasks in storage
  const allResolvedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'done');
  }, [tasks]);

  // Metric stats
  const metrics = useMemo(() => {
    const total = allResolvedTasks.length;
    const recent = allResolvedTasks.filter((t) => isTaskRecentlyCompleted(t, retentionMinutes)).length;
    const archived = allResolvedTasks.filter((t) => isTaskArchived(t, retentionMinutes)).length;

    let slaMetCount = 0;
    let totalDurationMs = 0;

    allResolvedTasks.forEach((t) => {
      const sla = calculateSlaStatus(t.createdAt, t.slaDeadline, t.status, t.resolvedAt);
      if (sla.status !== 'breached') {
        slaMetCount++;
      }
      const duration = getTimeToResolve(t);
      totalDurationMs += duration.durationMs;
    });

    const slaMetRate = total > 0 ? Math.round((slaMetCount / total) * 100) : 100;
    const avgDurationMs = total > 0 ? totalDurationMs / total : 0;
    const avgDurationMinutes = Math.round(avgDurationMs / (1000 * 60));
    const avgDurationFormatted =
      avgDurationMinutes < 60
        ? `${avgDurationMinutes}m`
        : `${Math.floor(avgDurationMinutes / 60)}h ${avgDurationMinutes % 60}m`;

    return {
      total,
      recent,
      archived,
      slaMetRate,
      avgDurationFormatted,
    };
  }, [allResolvedTasks, retentionMinutes]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return allResolvedTasks.filter((task) => {
      // Retention filter
      if (retentionFilter === 'archived' && !isTaskArchived(task, retentionMinutes)) {
        return false;
      }
      if (retentionFilter === 'recent' && !isTaskRecentlyCompleted(task, retentionMinutes)) {
        return false;
      }

      // Priority
      if (selectedPriority !== 'ALL' && task.priority !== selectedPriority) {
        return false;
      }

      // Environment
      if (selectedEnv !== 'ALL' && task.environment !== selectedEnv) {
        return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && task.category !== selectedCategory) {
        return false;
      }

      // Keyword search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchNum = task.ticketNumber.toLowerCase().includes(q);
        const matchDesc = task.description.toLowerCase().includes(q);
        const matchResNotes = (task.resolutionNotes || '').toLowerCase().includes(q);
        const matchTags =
          task.automatedTags.some((tag) => tag.toLowerCase().includes(q)) ||
          task.manualTags.some((tag) => tag.toLowerCase().includes(q));
        const matchAssignee = task.assignee.name.toLowerCase().includes(q);
        if (!matchTitle && !matchNum && !matchDesc && !matchResNotes && !matchTags && !matchAssignee) {
          return false;
        }
      }

      return true;
    });
  }, [allResolvedTasks, retentionFilter, selectedPriority, selectedEnv, selectedCategory, search, retentionMinutes]);

  // Sorted tasks
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (sortBy === 'resolved_desc') {
        const timeA = a.resolvedAt ? new Date(a.resolvedAt).getTime() : new Date(a.updatedAt).getTime();
        const timeB = b.resolvedAt ? new Date(b.resolvedAt).getTime() : new Date(b.updatedAt).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'resolved_asc') {
        const timeA = a.resolvedAt ? new Date(a.resolvedAt).getTime() : new Date(a.updatedAt).getTime();
        const timeB = b.resolvedAt ? new Date(b.resolvedAt).getTime() : new Date(b.updatedAt).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'priority') {
        const pWeights = { P1: 4, P2: 3, P3: 2, P4: 1 };
        return pWeights[b.priority] - pWeights[a.priority];
      }
      if (sortBy === 'duration') {
        const durA = getTimeToResolve(a).durationMs;
        const durB = getTimeToResolve(b).durationMs;
        return durB - durA;
      }
      return 0;
    });
  }, [filteredTasks, sortBy]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedTasks.map((t) => t.id));
    }
  };

  // Export handlers
  const handleExportCsv = () => {
    if (sortedTasks.length === 0) return;
    const headers = [
      'Ticket Number',
      'Title',
      'Priority',
      'Category',
      'Environment',
      'Assignee',
      'Created At',
      'Resolved At',
      'Resolution Duration',
      'SLA Deadline',
      'SLA Status',
      'Resolution Notes',
    ];

    const rows = sortedTasks.map((t) => {
      const sla = calculateSlaStatus(t.createdAt, t.slaDeadline, t.status, t.resolvedAt);
      const duration = getTimeToResolve(t);
      return [
        `"${t.ticketNumber}"`,
        `"${t.title.replace(/"/g, '""')}"`,
        `"${t.priority}"`,
        `"${t.category}"`,
        `"${t.environment}"`,
        `"${t.assignee.name}"`,
        `"${t.createdAt}"`,
        `"${t.resolvedAt || t.updatedAt}"`,
        `"${duration.formatted}"`,
        `"${t.slaDeadline}"`,
        `"${sla.status.toUpperCase()}"`,
        `"${(t.resolutionNotes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ticket_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    if (sortedTasks.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sortedTasks, null, 2))}`;
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `ticket_history_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        {/* Top Banner / Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <History className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Ticket History & Archive
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {allResolvedTasks.length} resolved
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Completed incident repository. Tickets remain on the active Board for{' '}
              <strong className="text-slate-700 dark:text-slate-200 font-semibold">{retentionMinutes} minutes</strong>{' '}
              before moving into this permanent archive. Search historical resolutions, review post-mortems, or reopen tickets.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onNavigateToBoard && (
              <button
                onClick={onNavigateToBoard}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Back to Board</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </button>
            )}
            <button
              onClick={handleExportCsv}
              disabled={sortedTasks.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportJson}
              disabled={sortedTasks.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Metrics Overview Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Resolved</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {metrics.total}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Across all IT categories
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Active on Board (&lt;1h)</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {metrics.recent}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Visible on Kanban "Done" column
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Archived to History (&gt;1h)</div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {metrics.archived}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Permanently preserved records
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">SLA Met Compliance</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {metrics.slaMetRate}%
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              Avg MTTR: {metrics.avgDurationFormatted}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px] max-w-lg">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ticket #, incident summary, tags, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          {/* Retention Scope Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setRetentionFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                retentionFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All ({allResolvedTasks.length})
            </button>
            <button
              onClick={() => setRetentionFilter('recent')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                retentionFilter === 'recent'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Recent &lt;1h ({metrics.recent})
            </button>
            <button
              onClick={() => setRetentionFilter('archived')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                retentionFilter === 'archived'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Archived &gt;1h ({metrics.archived})
            </button>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="resolved_desc">Recently Resolved</option>
              <option value="resolved_asc">Oldest Resolved</option>
              <option value="priority">Priority (P1 → P4)</option>
              <option value="duration">MTTR (Longest First)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          {/* Priority */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="P1">P1 Critical</option>
            <option value="P2">P2 High</option>
            <option value="P3">P3 Medium</option>
            <option value="P4">P4 Low</option>
          </select>

          {/* Environment */}
          <select
            value={selectedEnv}
            onChange={(e) => setSelectedEnv(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Environments</option>
            <option value="Production">Production</option>
            <option value="Staging">Staging</option>
            <option value="DR / Failover">DR / Failover</option>
            <option value="Corporate LAN">Corporate LAN</option>
            <option value="Internal Tooling">Internal Tooling</option>
            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
          </select>

          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="DevOps & SRE">DevOps & SRE</option>
            <option value="Security & IAM">Security & IAM</option>
            <option value="Database">Database</option>
            <option value="Cloud Infra">Cloud Infra</option>
            <option value="Networking">Networking</option>
            <option value="Application">Application</option>
            <option value="SysAdmin">SysAdmin</option>
          </select>

          {(selectedPriority !== 'ALL' || selectedEnv !== 'ALL' || selectedCategory !== 'ALL' || search.trim()) && (
            <button
              onClick={() => {
                setSelectedPriority('ALL');
                setSelectedEnv('ALL');
                setSelectedCategory('ALL');
                setSearch('');
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
            >
              Reset Filters
            </button>
          )}

          {/* Bulk Selection Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 ml-auto pl-3 border-l border-slate-200 dark:border-slate-700">
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                {selectedIds.length} selected
              </span>
              {onBatchReopenTasks && (
                <button
                  onClick={() => {
                    onBatchReopenTasks(selectedIds);
                    setSelectedIds([]);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Selected</span>
                </button>
              )}
              {onBatchDeleteTasks && (
                <button
                  onClick={() => {
                    onBatchDeleteTasks(selectedIds);
                    setSelectedIds([]);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ticket List / Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center">
          <div className="col-span-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={sortedTasks.length > 0 && selectedIds.length === sortedTasks.length}
              onChange={toggleSelectAll}
              className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Ticket</span>
          </div>
          <div className="col-span-4 sm:col-span-5">Incident & Summary</div>
          <div className="col-span-2 hidden md:block">Category / Env</div>
          <div className="col-span-3 sm:col-span-2">Resolution & Retention</div>
          <div className="col-span-4 sm:col-span-2 text-right">Actions</div>
        </div>

        {/* Rows */}
        {sortedTasks.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500 mb-3">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              No archived tickets found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              {allResolvedTasks.length === 0
                ? 'When incidents are resolved on the Kanban board, they stay in the Done column for 1 hour before moving here.'
                : 'No tickets match the selected filters or search keywords. Try adjusting your filter parameters.'}
            </p>
            {allResolvedTasks.length > 0 && (
              <button
                onClick={() => {
                  setRetentionFilter('all');
                  setSelectedPriority('ALL');
                  setSelectedEnv('ALL');
                  setSelectedCategory('ALL');
                  setSearch('');
                }}
                className="mt-3 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedTasks.map((task) => {
              const isSelected = selectedIds.includes(task.id);
              const retentionInfo = getTaskRetentionInfo(task, retentionMinutes);
              const duration = getTimeToResolve(task);
              const sla = calculateSlaStatus(task.createdAt, task.slaDeadline, task.status, task.resolvedAt);

              const resolvedDateStr = task.resolvedAt
                ? new Date(task.resolvedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : new Date(task.updatedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

              // Priority pill styling
              const priorityColors: Record<PriorityLevel, string> = {
                P1: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 font-bold',
                P2: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
                P3: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
                P4: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
              };

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className={`grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer ${
                    isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''
                  }`}
                >
                  {/* Ticket # & Priority */}
                  <div
                    className="col-span-1 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(task.id)}
                      className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {task.ticketNumber}
                      </span>
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[10px] border mt-0.5 text-center ${priorityColors[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>

                  {/* Incident Title & Summary */}
                  <div className="col-span-4 sm:col-span-5 min-w-0 pr-2">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {task.resolutionNotes ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Resolution:{' '}
                        </span>
                      ) : null}
                      {task.resolutionNotes || task.description}
                    </div>
                    {/* Tags preview */}
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {task.automatedTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        >
                          #{tag}
                        </span>
                      ))}
                      {task.automatedTags.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{task.automatedTags.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category & Env */}
                  <div className="col-span-2 hidden md:flex flex-col gap-1 text-[11px]">
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      {task.category}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 truncate text-[10px]">
                      {task.environment}
                    </span>
                  </div>

                  {/* Resolution Timestamp & Retention Status */}
                  <div className="col-span-3 sm:col-span-2 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{resolvedDateStr}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">
                        MTTR: <strong className="font-mono text-slate-700 dark:text-slate-300">{duration.formatted}</strong>
                      </span>
                    </div>

                    {/* Retention Pill */}
                    <div className="mt-0.5">
                      {retentionInfo.isArchived ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          <History className="w-2.5 h-2.5 text-slate-400" />
                          <span>Archived</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <Clock className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                          <span>Board: {retentionInfo.formattedTimeLeft} left</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="col-span-4 sm:col-span-2 flex items-center justify-end gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Reopen Button */}
                    <button
                      onClick={() => onReopenTask(task.id)}
                      title="Reopen incident back to active Kanban board"
                      className="px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden lg:inline">Reopen</span>
                    </button>

                    {/* Post-Mortem Report */}
                    <button
                      onClick={() => exportIncidentPostMortemPdf(task)}
                      title="Download Incident Post-Mortem PDF"
                      className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Permanently */}
                    <button
                      onClick={() => setTaskToDelete(task)}
                      title="Delete ticket permanently"
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Delete Ticket from History?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {taskToDelete.ticketNumber} — {taskToDelete.title}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              This action permanently removes this incident record from server storage. The logs, diagnostic checklists, and resolution notes cannot be recovered.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setTaskToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteTask(taskToDelete.id);
                  setTaskToDelete(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
