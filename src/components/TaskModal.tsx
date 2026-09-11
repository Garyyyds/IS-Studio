import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Terminal, 
  Copy, 
  Check, 
  FileText, 
  AlertTriangle,
  User,
  Laptop,
  Building2,
  Mail,
  Edit3,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Shield,
  Layers,
  ChevronDown,
  Lock
} from 'lucide-react';
import { Task, Runbook, PriorityLevel, EnvironmentType, ITCategory, TaskStatus, UserRole } from '../types';
import { exportIncidentPostMortemPdf } from '../utils/pdfExport';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTask: Task) => void;
  onDelete: (taskId: string) => void;
  runbooks?: Runbook[];
  onOpenRunbook?: (runbookId: string) => void;
  onGenerateRunbookFromTask?: (task: Task) => void;
  userRole?: UserRole;
}

const emptyTask: Task = {
  id: '',
  ticketNumber: '',
  title: '',
  description: '',
  priority: 'P3',
  priorityRationale: '',
  environment: 'Corporate LAN',
  category: 'Application',
  status: 'backlog',
  createdAt: '',
  updatedAt: '',
  impactScore: 5,
  urgencyScore: 5,
  automatedTags: [],
  manualTags: [],
  checklist: [],
  isAutoTagged: false,
  requesterName: '',
  requesterEmail: '',
  requesterDepartment: 'General',
  deviceInfo: 'Company Workstation (macOS / Windows)',
  urgencyLevel: 'medium',
  assignee: {
    name: 'Unassigned',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    role: 'IT Engineer',
    email: 'it-support@internal.corp',
  },
};

const CATEGORIES: { value: ITCategory; label: string; desc: string }[] = [
  { value: 'Application', label: 'Software & Tool Access', desc: 'Figma, Slack, Jira, GitHub, Office 365' },
  { value: 'Networking', label: 'Network, Wi-Fi & Corporate VPN', desc: 'Office Wi-Fi, WireGuard, Cisco AnyConnect' },
  { value: 'SysAdmin', label: 'Hardware, Laptop & Peripherals', desc: 'MacBook, ThinkPad, external monitors, docks' },
  { value: 'Security & IAM', label: 'Password, SSO, Okta 2FA & Accounts', desc: 'Password reset, MFA tokens, locked accounts' },
  { value: 'Cloud Infra', label: 'Cloud, Server & Infrastructure', desc: 'AWS, GCP, Kubernetes, CI/CD runners' },
  { value: 'Database', label: 'Database & Data Access', desc: 'PostgreSQL, Redis, analytics permissions' },
  { value: 'DevOps & SRE', label: 'DevOps & Reliability', desc: 'Production incidents, alerts, pipelines' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'backlog', label: 'Received / In Queue', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  { value: 'investigating', label: 'Under Investigation', color: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200' },
  { value: 'in_progress', label: 'In Progress / Working', color: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200' },
  { value: 'blocked', label: 'Blocked / Pending Info', color: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200' },
  { value: 'testing', label: 'Testing & Verification', color: 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200' },
  { value: 'done', label: 'Resolved / Closed', color: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  userRole,
}) => {
  const isReadOnly = userRole === 'user';
  const [formData, setFormData] = useState<Task>(task || emptyTask);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditingRequester, setIsEditingRequester] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData(task);
      setConfirmDelete(false);
    }
  }, [task]);

  if (!isOpen) return null;

  const handleCopyLogs = () => {
    if (formData.rawLogs) {
      navigator.clipboard.writeText(formData.rawLogs);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    }
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    const newItem = {
      id: `chk-${Date.now()}`,
      text: newChecklistText.trim(),
      done: false,
    };

    setFormData({
      ...formData,
      checklist: [...formData.checklist, newItem],
    });
    setNewChecklistText('');
  };

  const handleToggleChecklist = (id: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      ),
    });
  };

  const handleRemoveChecklist = (id: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.filter((item) => item.id !== id),
    });
  };

  const handleUrgencyChange = (urgency: 'low' | 'medium' | 'critical') => {
    let priority: PriorityLevel = 'P3';

    if (urgency === 'critical') {
      priority = 'P1';
    } else if (urgency === 'medium') {
      priority = 'P2';
    } else {
      priority = 'P4';
    }

    setFormData({
      ...formData,
      urgencyLevel: urgency,
      priority,
    });
  };

  const handlePriorityChange = (priority: PriorityLevel) => {
    setFormData({
      ...formData,
      priority,
    });
  };

  const handleStatusChange = (status: TaskStatus) => {
    const isDone = status === 'done';
    setFormData({
      ...formData,
      status,
      resolvedAt: isDone ? (formData.resolvedAt || new Date().toISOString()) : undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    onSave({
      ...formData,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
              {formData.ticketNumber || 'NEW TICKET'}
            </span>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                formData.priority === 'P1'
                  ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
                  : formData.priority === 'P2'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                  : formData.priority === 'P3'
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
                {formData.priority}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                STATUS_OPTIONS.find((s) => s.value === formData.status)?.color || ''
              }`}>
                {STATUS_OPTIONS.find((s) => s.value === formData.status)?.label || formData.status}
              </span>
              {isReadOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>View Only</span>
                </span>
              )}
            </div>
            {formData.createdAt && (
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <Clock className="w-3 h-3" />
                <span>Opened {new Date(formData.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {formData.id && (
              <button
                type="button"
                onClick={() => exportIncidentPostMortemPdf(formData)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Export Ticket / Incident PDF Report"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body and Fixed Footer */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Requester & Workstation Card (Identical to User-Side) */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                  {formData.requesterName ? formData.requesterName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Requester Information</span>
                    <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      (Employee who reported the issue)
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {formData.requesterName || 'Employee Requester'} • {formData.requesterDepartment || 'General Department'}
                  </p>
                </div>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setIsEditingRequester(!isEditingRequester)}
                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditingRequester ? 'Done' : 'Edit Requester'}</span>
                </button>
              )}
            </div>

            {/* Editable or Display Requester Info */}
            {isEditingRequester ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Requester Name
                  </label>
                  <input
                    type="text"
                    value={formData.requesterName || ''}
                    onChange={(e) => setFormData({ ...formData, requesterName: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Sarah Jenkins"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={formData.requesterEmail || ''}
                    onChange={(e) => setFormData({ ...formData, requesterEmail: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. sarah@company.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.requesterDepartment || ''}
                    onChange={(e) => setFormData({ ...formData, requesterDepartment: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Design / Marketing"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Device / Workstation
                  </label>
                  <input
                    type="text"
                    value={formData.deviceInfo || ''}
                    onChange={(e) => setFormData({ ...formData, deviceInfo: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. MacBook Pro M2"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Email</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                    {formData.requesterEmail || 'Unspecified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Department</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 block">
                    {formData.requesterDepartment || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Workstation Device</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{formData.deviceInfo || 'Workstation / Laptop'}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Reported Urgency</span>
                  <span className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                    formData.urgencyLevel === 'critical'
                      ? 'text-red-600 dark:text-red-400'
                      : formData.urgencyLevel === 'low'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {formData.urgencyLevel === 'critical'
                      ? 'Critical / Work Blocked'
                      : formData.urgencyLevel === 'low'
                      ? 'Low Impact / Routine'
                      : 'Medium / Slowed Down'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Issue Details Section (Same as user portal) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Issue Details Mentioned in Ticket</span>
            </h3>

            {/* Title / Summary */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Summary / What is the issue? {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={!isReadOnly}
                disabled={isReadOnly}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Cannot connect to Singapore Office VPN, or Need Figma Enterprise Access"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed transition"
              />
            </div>

            {/* Category and Impact / Urgency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={formData.category}
                    disabled={isReadOnly}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ITCategory })}
                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 pr-9 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label} ({cat.desc})
                      </option>
                    ))}
                  </select>
                  {!isReadOnly && <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                </div>
              </div>

              {/* Environment / System Context */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Environment Context
                </label>
                <div className="relative">
                  <select
                    value={formData.environment}
                    disabled={isReadOnly}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value as EnvironmentType })}
                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 pr-9 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    <option value="Corporate LAN">Corporate LAN / Office Network</option>
                    <option value="Production">Production Environment</option>
                    <option value="Staging">Staging / Pre-Release</option>
                    <option value="Internal Tooling">Internal Tooling</option>
                    <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                    <option value="DR / Failover">DR / Failover</option>
                  </select>
                  {!isReadOnly && <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                </div>
              </div>
            </div>

            {/* Urgency Level Selector (Matches User Portal cards) */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Work Impact & Urgency Level
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => !isReadOnly && handleUrgencyChange('low')}
                  className={`p-3 rounded-xl border text-left transition ${
                    isReadOnly ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    formData.urgencyLevel === 'low'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Low Impact</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Minor inquiry or question. Work is unblocked.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => !isReadOnly && handleUrgencyChange('medium')}
                  className={`p-3 rounded-xl border text-left transition ${
                    isReadOnly ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    formData.urgencyLevel === 'medium'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Medium / Slowed Down</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Impaired productivity. Core task is delayed.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => !isReadOnly && handleUrgencyChange('critical')}
                  className={`p-3 rounded-xl border text-left transition ${
                    isReadOnly ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    formData.urgencyLevel === 'critical'
                      ? 'bg-red-50 dark:bg-red-950/50 border-red-500 ring-1 ring-red-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>Critical / Blocked</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Complete work blocker. Cannot perform job.
                  </p>
                </button>
              </div>
            </div>

            {/* Detailed Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Detailed Description of the Issue
              </label>
              <textarea
                rows={4}
                disabled={isReadOnly}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Details of what happened, symptoms, what the user was doing, or specific error message..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed transition"
              />
            </div>

            {/* Error Code, Log Output or URL (Same as user side) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Error Code, Log Output or URL (Optional)</span>
                </label>
                {formData.rawLogs && (
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {copiedLogs ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLogs ? 'Copied' : 'Copy Logs'}</span>
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={formData.rawLogs || ''}
                onChange={(e) => setFormData({ ...formData, rawLogs: e.target.value })}
                placeholder="Paste any error message, terminal stack trace, HTTP 500 error, or relevant URL here..."
                className="w-full font-mono bg-slate-950 text-emerald-400 border border-slate-800 rounded-xl p-3 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-90 disabled:cursor-not-allowed transition"
              />
            </div>
          </div>

          {/* Admin Triage & Management Section */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{isReadOnly ? 'IT Support & Assignment Status' : 'Admin Triage & Ticket Management'}</span>
            </h3>

            {/* Status, Priority & Assignee controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Ticket Status
                </label>
                <div className="relative">
                  <select
                    value={formData.status}
                    disabled={isReadOnly}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 pr-9 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {!isReadOnly && <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Priority {isReadOnly ? 'Assigned' : 'Override'}
                </label>
                <div className="relative">
                  <select
                    value={formData.priority}
                    disabled={isReadOnly}
                    onChange={(e) => handlePriorityChange(e.target.value as PriorityLevel)}
                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 pr-9 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    <option value="P1">P1 - Critical Blocker</option>
                    <option value="P2">P2 - High Degraded</option>
                    <option value="P3">P3 - Standard Medium</option>
                    <option value="P4">P4 - Low / Routine</option>
                  </select>
                  {!isReadOnly && <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                </div>
              </div>

              {/* IT Assignee */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Assigned IT Technician
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={formData.assignee?.name || (isReadOnly ? 'Unassigned' : '')}
                  onChange={(e) => setFormData({
                    ...formData,
                    assignee: { ...formData.assignee, name: e.target.value }
                  })}
                  placeholder={isReadOnly ? 'Unassigned' : 'e.g. Alex Rivera'}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Action Checklist */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Remediation Action Checklist ({formData.checklist.filter(c => c.done).length}/{formData.checklist.length})
              </label>
              
              {formData.checklist.length > 0 ? (
                <div className="space-y-1.5 mb-2">
                  {formData.checklist.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs"
                    >
                      <label className={`flex items-center gap-2 flex-1 min-w-0 mr-2 ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          disabled={isReadOnly}
                          onChange={() => !isReadOnly && handleToggleChecklist(item.id)}
                          className="rounded text-indigo-600 focus:ring-0 w-4 h-4 disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                        <span className={`truncate ${item.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                          {item.text}
                        </span>
                      </label>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklist(item.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-1">No action checklist steps listed.</div>
              )}

              {/* Add checklist item */}
              {!isReadOnly && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklist(e);
                      }
                    }}
                    placeholder="Add action item step (e.g. Verify DNS propagation, Reset MFA secret key)..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklist}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>
              )}
            </div>

            {/* Resolution Notes (Visible to employee upon ticket completion) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Resolution & Fix Notes</span>
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Visible to employee in My Tickets
                </span>
              </div>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={formData.resolutionNotes || ''}
                onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
                placeholder={isReadOnly ? 'No resolution notes provided yet by the IT technician.' : 'Explain what steps were taken to resolve this ticket. The user will see this resolution message when their ticket is marked resolved...'}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed transition"
              />
            </div>
          </div>
        </div>

        {/* Fixed Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0">
            {!isReadOnly && formData.id ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">Delete ticket?</span>
                  <button
                    type="button"
                    onClick={() => onDelete(formData.id)}
                    className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition cursor-pointer p-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2.5">
              {isReadOnly ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
                  >
                    Save Ticket
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
