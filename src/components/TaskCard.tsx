import React, { useState } from 'react';
import { 
  Clock, 
  CheckSquare, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  Shield, 
  Tag,
  Zap,
  Server,
  Calendar,
  Trash2,
  CheckCircle2,
  History,
  User
} from 'lucide-react';
import { Task, Runbook, TaskStatus, UserSettings } from '../types';
import { calculateSlaStatus } from '../utils/priorityEngine';
import { getTaskRetentionInfo, DEFAULT_COMPLETED_RETENTION_MINUTES } from '../utils/ticketRetention';

interface TaskCardProps {
  task: Task;
  linkedRunbook?: Runbook;
  settings?: UserSettings;
  onSelect: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onOpenRunbook?: (runbookId: string) => void;
  onDelete?: (taskId: string) => void;
}

const STATUS_ORDER: TaskStatus[] = [
  'backlog',
  'investigating',
  'in_progress',
  'blocked',
  'testing',
  'done',
];

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  linkedRunbook,
  settings,
  onSelect,
  onStatusChange,
  onOpenRunbook,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const sla = calculateSlaStatus(task.createdAt, task.slaDeadline, task.status, task.resolvedAt);

  const completedChecklist = task.checklist.filter(c => c.done).length;
  const totalChecklist = task.checklist.length;
  const checklistPercent = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  const currentStatusIndex = STATUS_ORDER.indexOf(task.status);
  const canMoveLeft = currentStatusIndex > 0;
  const canMoveRight = currentStatusIndex < STATUS_ORDER.length - 1;

  const showSla = settings?.showSlaCountdown ?? false;
  const showTags = settings?.showAutomatedTagsOnCards ?? true;
  const showChecklist = settings?.showChecklistProgressOnCards ?? true;
  const retentionMinutes = settings?.completedTicketRetentionMinutes ?? DEFAULT_COMPLETED_RETENTION_MINUTES;
  const retentionInfo = task.status === 'done' ? getTaskRetentionInfo(task, retentionMinutes) : null;

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'P1':
        return {
          badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 ring-1 ring-rose-200 dark:ring-rose-900/50',
          dot: 'bg-rose-600 dark:bg-rose-500',
          border: 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900',
        };
      case 'P2':
        return {
          badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
          dot: 'bg-amber-600 dark:bg-amber-500',
          border: 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900',
        };
      case 'P3':
        return {
          badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
          dot: 'bg-indigo-600 dark:bg-indigo-400',
          border: 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900',
        };
      default:
        return {
          badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          dot: 'bg-slate-500 dark:bg-slate-400',
          border: 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900',
        };
    }
  };

  const getSlaBadgeStyle = (status: string) => {
    switch (status) {
      case 'breached':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 font-bold';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900';
      case 'met':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  const getEnvBadge = (env: string) => {
    switch (env) {
      case 'Production':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900';
      case 'Staging':
        return 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900';
      case 'DR / Failover':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const priorityTheme = getPriorityStyle(task.priority);

  return (
    <div 
      className={`group relative rounded-xl border p-3.5 shadow-xs transition-all hover:shadow-md cursor-pointer bg-white dark:bg-slate-900 overflow-hidden ${priorityTheme.border}`}
      onClick={() => onSelect(task)}
    >
      {/* Top Accent Stripe for P1 and P2 */}
      {task.priority === 'P1' && <div className="absolute top-0 left-0 right-0 h-1 bg-rose-600" />}
      {task.priority === 'P2' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />}

      {/* Top Row: Ticket ID, Priority & SLA / Due Info */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900 group-hover:text-indigo-800 dark:group-hover:text-indigo-200 transition">
            {task.ticketNumber}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityTheme.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priorityTheme.dot}`} />
            {task.priority}
          </span>
          {task.isAutoTagged && (
            <span className="inline-flex items-center text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900" title="Automated Priority Tagging Rule Applied">
              <Zap className="w-2.5 h-2.5 mr-0.5 text-indigo-600 dark:text-indigo-400" /> Auto
            </span>
          )}
          {(task.isUserSubmitted || task.requesterName) && (
            <span className="inline-flex items-center text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800" title={`User Request from ${task.requesterName || 'Employee'}${task.requesterDepartment ? ` (${task.requesterDepartment})` : ''}`}>
              <User className="w-2.5 h-2.5 mr-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{task.requesterName ? task.requesterName.split(' ')[0] : 'User'}</span>
            </span>
          )}
        </div>

        {/* SLA status badge OR clean Due info based on user setting */}
        {showSla ? (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border shrink-0 ${getSlaBadgeStyle(sla.status)}`}>
            <Clock className="w-3 h-3" />
            <span>{sla.formattedTime}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>{task.status === 'done' ? 'Completed' : `${task.slaHours}h target`}</span>
          </div>
        )}
      </div>

      {/* Task Title */}
      <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
        {task.title}
      </h3>

      {/* System Context & Blast Radius */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[10px]">
        <span className={`px-2 py-0.5 rounded border font-medium ${getEnvBadge(task.environment)}`}>
          {task.environment}
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
          {task.category}
        </span>
        {task.affectedUsersEstimate ? (
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            ~{task.affectedUsersEstimate.toLocaleString()} users
          </span>
        ) : null}
      </div>

      {/* Automated & Manual Tags (if enabled in settings) */}
      {showTags && (task.automatedTags.length > 0 || task.manualTags.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {task.automatedTags.slice(0, 3).map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
              #{tag}
            </span>
          ))}
          {task.automatedTags.length > 3 && (
            <span className="text-[9px] text-slate-400 font-mono self-center">
              +{task.automatedTags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Checklist Progress Bar if checklist items exist (if enabled in settings) */}
      {showChecklist && totalChecklist > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Remediation Tasks</span>
            </span>
            <span className="font-mono">{completedChecklist}/{totalChecklist}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                checklistPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600 dark:bg-indigo-500'
              }`}
              style={{ width: `${checklistPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Done Retention Countdown / History Badge */}
      {task.status === 'done' && retentionInfo && (
        <div className="flex items-center justify-between px-2 py-1 mb-2 rounded-md bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/70 text-[10px] text-emerald-700 dark:text-emerald-300">
          <span className="flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Resolved ({retentionInfo.formattedElapsed} ago)</span>
          </span>
          <span className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            {retentionInfo.isArchived ? (
              <span className="text-slate-500 dark:text-slate-400">Archived</span>
            ) : (
              <>
                <Clock className="w-2.5 h-2.5 animate-pulse text-emerald-500" />
                <span>Archives in {retentionInfo.formattedTimeLeft}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Card Footer: Quick Actions (Move Status Left/Right & Quick Delete) */}
      <div 
        className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {/* Quick Delete action button with inline two-step confirmation */}
          {onDelete && (
            isDeleting ? (
              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">Delete?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(task.id);
                    setIsDeleting(false);
                  }}
                  className="px-1 py-0.2 rounded bg-rose-600 text-white text-[9px] font-bold hover:bg-rose-700 cursor-pointer"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleting(false)}
                  className="px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[9px] hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsDeleting(true)}
                className="opacity-40 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                title="Delete ticket"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canMoveLeft}
            onClick={() => onStatusChange(task.id, STATUS_ORDER[currentStatusIndex - 1])}
            className="p-1 rounded bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            title={canMoveLeft ? `Move to ${STATUS_ORDER[currentStatusIndex - 1]}` : 'At leftmost state'}
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled={!canMoveRight}
            onClick={() => onStatusChange(task.id, STATUS_ORDER[currentStatusIndex + 1])}
            className="p-1 rounded bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            title={canMoveRight ? `Move to ${STATUS_ORDER[currentStatusIndex + 1]}` : 'At rightmost state'}
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
