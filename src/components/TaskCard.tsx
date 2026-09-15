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
  User,
  Paperclip,
} from 'lucide-react';
import { Task, Runbook, TaskStatus, UserSettings } from '../types';
import { getTaskRetentionInfo, DEFAULT_COMPLETED_RETENTION_MINUTES } from '../utils/ticketRetention';

interface TaskCardProps {
  task: Task;
  linkedRunbook?: Runbook;
  settings?: UserSettings;
  onSelect: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onOpenRunbook?: (runbookId: string) => void;
  onDelete?: (taskId: string) => void;
  /** Makes the card draggable onto another board lane. */
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
}

/** Drag data type for a ticket card, so other drags (text, files) are ignored. */
export const TICKET_DRAG_TYPE = 'application/x-is-studio-ticket';

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
  onDragStart,
  onDragEnd,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const draggable = Boolean(onDragStart);

  const currentStatusIndex = STATUS_ORDER.indexOf(task.status);
  const canMoveLeft = currentStatusIndex > 0;
  const canMoveRight = currentStatusIndex < STATUS_ORDER.length - 1;

  const retentionMinutes = settings?.completedTicketRetentionMinutes ?? DEFAULT_COMPLETED_RETENTION_MINUTES;
  const retentionInfo = task.status === 'done' ? getTaskRetentionInfo(task, retentionMinutes) : null;

  return (
    <div 
      className={`group relative rounded-xl border p-3.5 shadow-xs transition-all hover:shadow-md bg-white dark:bg-slate-900 overflow-hidden ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isDragging ? 'opacity-40' : ''}`}
      onClick={() => onSelect(task)}
      draggable={draggable}
      onDragStart={(e) => {
        if (!onDragStart) return;
        e.dataTransfer.setData(TICKET_DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
        onDragStart(task.id);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd?.();
      }}
    >
      {/* Top Row: ticket ID and due info */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900 group-hover:text-indigo-800 dark:group-hover:text-indigo-200 transition">
            {task.ticketNumber}
          </span>
          {(task.isUserSubmitted || task.requesterName) && (
            <span className="inline-flex items-center text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800" title={`User Request from ${task.requesterName || 'Employee'}${task.requesterDepartment ? ` (${task.requesterDepartment})` : ''}`}>
              <User className="w-2.5 h-2.5 mr-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{task.requesterName ? task.requesterName.split(' ')[0] : 'User'}</span>
            </span>
          )}
          {task.attachments && task.attachments.length > 0 && (
            <span
              className="inline-flex items-center text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
              title={task.attachments.map((file) => file.name).join(', ')}
            >
              <Paperclip className="w-2.5 h-2.5 mr-0.5 text-slate-500 dark:text-slate-400" />
              <span>{task.attachments.length}</span>
            </span>
          )}
        </div>

        {/* Completion state, or the due date when one is set */}
        {(task.status === 'done' || task.dueDate) && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>
              {task.status === 'done'
                ? 'Completed'
                : `Due ${new Date(task.dueDate!).toLocaleDateString()}`}
            </span>
          </div>
        )}
      </div>

      {/* Task Title */}
      <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
        {task.title}
      </h3>

      {/* System Context & Blast Radius */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[10px]">
        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
          {task.category}
        </span>
      </div>

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
