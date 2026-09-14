import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  CheckSquare, 
  Plus, 
  Trash2, 
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
  Lock,
  Paperclip,
  MapPin,
  Phone,
  Server,
  ClipboardList,
  UserCheck,
} from 'lucide-react';
import { Task, Runbook, EnvironmentType, ITCategory, TaskStatus, UserRole } from '../types';
import { exportTicketPdf } from '../utils/supportRequestPdf';
import { attachmentUrl, formatBytes } from '../utils/attachments';

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
  environment: 'Corporate LAN',
  category: 'Application',
  status: 'backlog',
  createdAt: '',
  updatedAt: '',
  automatedTags: [],
  manualTags: [],
  checklist: [],
  isAutoTagged: false,
  requesterName: '',
  requesterEmail: '',
  requesterDepartment: 'General',
  deviceInfo: '',
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
  // Tickets raised through the employee portal carry what the employee typed.
  // IT works the ticket (status, assignee, checklist, resolution) but must not
  // rewrite that record, so those fields stay locked even for admins. Tickets
  // an admin creates on the board remain fully editable.
  const isPortalSubmission =
    Boolean(formData.systemRequested) || (formData.manualTags || []).includes('Portal Submission');
  const lockSubmission = isReadOnly || isPortalSubmission;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditingRequester, setIsEditingRequester] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData(task);
      setConfirmDelete(false);
    }
  }, [task]);

  if (!isOpen) return null;

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
                onClick={() => exportTicketPdf(formData)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Export as IT Support Request PDF"
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

              {!lockSubmission && (
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
            {isEditingRequester && !lockSubmission ? (
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
                    Affected Device
                  </label>
                  <input
                    type="text"
                    value={formData.deviceInfo || ''}
                    onChange={(e) => setFormData({ ...formData, deviceInfo: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Laptop, Printer"
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
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Affected Device</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{formData.deviceInfo || 'Unspecified'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Request Details - captured by the employee portal form */}
          {(formData.systemRequested ||
            formData.userLocation ||
            formData.userPhoneExt ||
            formData.hodName ||
            formData.hodEmail ||
            (formData.attachments && formData.attachments.length > 0)) && (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Request Details</span>
                <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                  (Submitted through the employee portal)
                </span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                {[
                  { label: 'Category', value: formData.systemRequested, Icon: Server },
                  { label: 'Location', value: formData.userLocation, Icon: MapPin },
                  { label: 'Phone / Ext', value: formData.userPhoneExt, Icon: Phone },
                  { label: 'HOD Name', value: formData.hodName, Icon: UserCheck },
                ].map(({ label, value, Icon }) => (
                  <div key={label} className="min-w-0">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{label}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Icon className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{value || 'Unspecified'}</span>
                    </span>
                  </div>
                ))}
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">HOD Email</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    {formData.hodEmail ? (
                      <a
                        href={`mailto:${formData.hodEmail}`}
                        className="truncate text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {formData.hodEmail}
                      </a>
                    ) : (
                      <span className="truncate">Unspecified</span>
                    )}
                  </span>
                </div>
              </div>

              {formData.attachments && formData.attachments.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1.5">
                    Attachments ({formData.attachments.length})
                  </span>
                  {/* Shared grid so every file's name, size and location line up. */}
                  <ul className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                    {formData.attachments.map((file) => (
                      <li key={file.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                        <a
                          href={attachmentUrl(file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={file.name}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                        >
                          {file.name}
                        </a>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 text-right">
                          {formatBytes(file.size)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Issue Details Section (Same as user portal) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Issue Details Mentioned in Ticket</span>
              {isPortalSubmission && !isReadOnly && (
                <span className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <Lock className="w-3 h-3" />
                  <span>Submitted by employee</span>
                </span>
              )}
            </h3>

            {/* Title / Summary */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Summary / What is the issue? {!lockSubmission && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={!lockSubmission}
                disabled={lockSubmission}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Cannot connect to Singapore Office VPN, or Need Figma Enterprise Access"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed transition"
              />
            </div>

            {/* Category & Environment - admin-created tickets only */}
            {!isPortalSubmission && (
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
            )}

            {/* Detailed Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                {isPortalSubmission ? 'Remarks / Description' : 'Detailed Description of the Issue'}
              </label>
              <textarea
                rows={4}
                disabled={lockSubmission}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Details of what happened, symptoms, what the user was doing, or specific error message..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:text-slate-700 dark:disabled:text-slate-300 disabled:cursor-not-allowed transition"
              />
            </div>
          </div>

          {/* Admin Triage & Management Section */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{isReadOnly ? 'IT Support & Assignment Status' : 'Admin Triage & Ticket Management'}</span>
            </h3>

            {/* Status & assignee controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
