import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Zap, 
  Sparkles,
  Layers,
  History,
  Clock,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Task, Runbook, TaskStatus, PriorityLevel, EnvironmentType, ITCategory, UserSettings } from '../types';
import { TaskCard } from './TaskCard';
import { isTaskRecentlyCompleted, DEFAULT_COMPLETED_RETENTION_MINUTES } from '../utils/ticketRetention';

interface KanbanBoardProps {
  tasks: Task[];
  runbooks: Runbook[];
  settings?: UserSettings;
  onSelectTask: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onOpenRunbook: (runbookId: string) => void;
  onNewTaskWithStatus: (status: TaskStatus) => void;
  onAutoScanAll: () => void;
  onOpenQuickTriage: () => void;
  onDeleteTask?: (taskId: string) => void;
  onNavigateToHistory?: () => void;
  isScanning?: boolean;
}

interface ColumnDef {
  id: TaskStatus;
  title: string;
  subtitle: string;
  color: string;
  borderColor: string;
  badgeBg: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'backlog',
    title: 'Backlog & Queue',
    subtitle: 'New tickets & scheduled changes',
    color: 'text-slate-800 dark:text-slate-100',
    borderColor: 'border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  },
  {
    id: 'investigating',
    title: 'Triage / Investigation',
    subtitle: 'Log inspection & root cause triage',
    color: 'text-purple-900 dark:text-purple-300',
    borderColor: 'border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  },
  {
    id: 'in_progress',
    title: 'Active Remediation',
    subtitle: 'Patching, rollback & live fix',
    color: 'text-indigo-900 dark:text-indigo-300',
    borderColor: 'border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
  },
  {
    id: 'blocked',
    title: 'Blocked / Pending',
    subtitle: 'Vendor support, approvals & locks',
    color: 'text-amber-900 dark:text-amber-300',
    borderColor: 'border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  },
  {
    id: 'testing',
    title: 'Verification / QA',
    subtitle: 'Smoke tests & health checks',
    color: 'text-blue-900 dark:text-blue-300',
    borderColor: 'border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  },
  {
    id: 'done',
    title: 'Resolved / Closed',
    subtitle: 'Post-mortem ready',
    color: 'text-emerald-900 dark:text-emerald-300',
    borderColor: 'border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  runbooks,
  settings,
  onSelectTask,
  onStatusChange,
  onOpenRunbook,
  onNewTaskWithStatus,
  onAutoScanAll,
  onOpenQuickTriage,
  onDeleteTask,
  onNavigateToHistory,
  isScanning = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | 'ALL'>('ALL');
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<ITCategory | 'ALL'>('ALL');
  const [showAllDone, setShowAllDone] = useState(false);
  const [mobileSelectedColumn, setMobileSelectedColumn] = useState<TaskStatus | 'ALL'>('ALL');

  const retentionMinutes = settings?.completedTicketRetentionMinutes ?? DEFAULT_COMPLETED_RETENTION_MINUTES;

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchNumber = task.ticketNumber.toLowerCase().includes(q);
      const matchDesc = task.description.toLowerCase().includes(q);
      const matchTags = task.automatedTags.some(t => t.toLowerCase().includes(q)) || task.manualTags.some(t => t.toLowerCase().includes(q));
      const matchLogs = (task.rawLogs || '').toLowerCase().includes(q);
      if (!matchTitle && !matchNumber && !matchDesc && !matchTags && !matchLogs) {
        return false;
      }
    }

    // Priority filter
    if (selectedPriority !== 'ALL' && task.priority !== selectedPriority) {
      return false;
    }

    // Environment filter
    if (selectedEnv !== 'ALL' && task.environment !== selectedEnv) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'ALL' && task.category !== selectedCategory) {
      return false;
    }

    return true;
  });

  const getRunbookForTask = (runbookId?: string) => {
    if (!runbookId) return undefined;
    return runbooks.find((r) => r.id === runbookId);
  };

  const activeTicketsCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-100 dark:bg-slate-950 transition-colors duration-200">
      {/* Controls & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-xs">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
          <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
            {/* Active Ticket Count & Search */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 text-xs">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {activeTicketsCount} <span className="hidden xs:inline">Active</span>
              </span>
              <span className="hidden sm:inline text-[11px] text-slate-400 font-mono">
                ({tasks.length})
              </span>
            </div>

            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 text-xs overflow-x-auto no-scrollbar pb-1 md:pb-0 shrink-0 snap-x">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 shrink-0 snap-start">
              {(['ALL', 'P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    selectedPriority === p
                      ? p === 'P1'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : p === 'P2'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : p === 'P3'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-700 dark:bg-slate-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Environment Filter */}
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 shrink-0 snap-start"
            >
              <option value="ALL">All Envs</option>
              <option value="Production">Production</option>
              <option value="Staging">Staging</option>
              <option value="DR / Failover">DR / Failover</option>
              <option value="Corporate LAN">Corporate LAN</option>
              <option value="Internal Tooling">Internal Tooling</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 shrink-0 snap-start"
            >
              <option value="ALL">All Categories</option>
              <option value="DevOps & SRE">DevOps & SRE</option>
              <option value="Database">Database</option>
              <option value="Cloud Infra">Cloud Infra</option>
              <option value="Security & IAM">Security & IAM</option>
              <option value="Networking">Networking</option>
              <option value="SysAdmin">SysAdmin</option>
              <option value="Application">Application</option>
            </select>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

            {/* Quick AI Triage */}
            <button
              onClick={onOpenQuickTriage}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-xs font-semibold transition cursor-pointer shadow-xs shrink-0 snap-start"
              title="Paste an IT log or alert to auto-classify priority"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">AI Triage</span>
              <span className="sm:hidden">AI</span>
            </button>

            {/* Automated Tagging Scan Trigger */}
            <button
              onClick={onAutoScanAll}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold transition disabled:opacity-50 cursor-pointer shadow-xs shrink-0 snap-start"
              title="Re-run Automated Priority Tagging Rules engine across all tasks"
            >
              <Zap className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{isScanning ? 'Scanning...' : 'Scan & Tag'}</span>
              <span className="sm:hidden">{isScanning ? '...' : 'Scan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Phone Dimension Quick Column Filter Tab Bar */}
      <div className="sm:hidden px-3 pt-2 pb-1.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setMobileSelectedColumn('ALL')}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
            mobileSelectedColumn === 'ALL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          All Lanes ({filteredTasks.length})
        </button>
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <button
              key={col.id}
              onClick={() => setMobileSelectedColumn(col.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                mobileSelectedColumn === col.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>{col.title.split(' ')[0]}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 font-mono">
                {colTasks.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Columns Board */}
      <div className="flex-1 overflow-x-auto py-3 sm:py-5">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className={`flex gap-4 sm:gap-5 ${
            mobileSelectedColumn === 'ALL' ? 'min-w-[1280px]' : 'w-full min-w-0 sm:min-w-[1280px]'
          } min-h-[calc(100vh-210px)] items-stretch`}>
            {(mobileSelectedColumn === 'ALL' ? COLUMNS : COLUMNS.filter((c) => c.id === mobileSelectedColumn)).map((col) => {
              const isDoneCol = col.id === 'done';
              const allColTasks = filteredTasks.filter((t) => t.status === col.id);
              const recentDoneTasks = allColTasks.filter((t) => isTaskRecentlyCompleted(t, retentionMinutes));
              const archivedDoneCount = isDoneCol ? allColTasks.length - recentDoneTasks.length : 0;
              const columnTasks = isDoneCol && !showAllDone ? recentDoneTasks : allColTasks;
              const p1Count = columnTasks.filter((t) => t.priority === 'P1').length;
              const colSubtitle = isDoneCol
                ? showAllDone
                  ? 'All resolved tickets'
                  : `Recent < ${retentionMinutes}m • Older archived`
                : col.subtitle;

              return (
                <div
                  key={col.id}
                  className={`flex-1 flex flex-col ${
                    mobileSelectedColumn !== 'ALL'
                      ? 'w-full min-w-full sm:min-w-[280px] sm:max-w-[340px]'
                      : 'min-w-[280px] max-w-[340px]'
                  } bg-slate-200/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xs font-bold text-slate-900 dark:text-white">{col.title}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${col.badgeBg}`}>
                          {columnTasks.length}
                        </span>
                        {p1Count > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-[10px] font-bold">
                            {p1Count} P1
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{colSubtitle}</p>
                    </div>

                    <button
                      onClick={() => onNewTaskWithStatus(col.id)}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      title={`Add task to ${col.title}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Archived Notification Banner for Done Column */}
                  {isDoneCol && archivedDoneCount > 0 && (
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 text-[11px] flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 text-[10px]">
                        <History className="w-3 h-3 text-slate-400 shrink-0" />
                        <span><strong>{archivedDoneCount}</strong> archived to History</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowAllDone(!showAllDone)}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                        >
                          {showAllDone ? 'Show <1h' : 'Show all'}
                        </button>
                        {onNavigateToHistory && (
                          <button
                            onClick={onNavigateToHistory}
                            className="text-[10px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer font-medium"
                            title="Open Ticket History page"
                          >
                            <span>History</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Column Task Cards Stream */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[220px]">
                    {columnTasks.length === 0 ? (
                      <div className="h-40 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 p-4 text-center bg-white/40 dark:bg-slate-900/30">
                        <Layers className="w-5 h-5 mb-1.5 opacity-30 text-slate-400 dark:text-slate-600" />
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">No tasks in this lane</span>
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          settings={settings}
                          onSelect={onSelectTask}
                          onStatusChange={onStatusChange}
                          onDelete={onDeleteTask}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
