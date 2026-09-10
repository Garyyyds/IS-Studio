import React, { useState } from 'react';
import { 
  LifeBuoy, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Search, 
  ExternalLink, 
  ChevronRight,
  User,
  Building2,
  Laptop,
  HelpCircle,
  Sparkles,
  Inbox,
  Filter,
  CheckCircle,
  XCircle,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Task, Runbook, AppUser, PriorityLevel, ITCategory, EnvironmentType, TaskStatus } from '../types';

interface UserPortalViewProps {
  currentUser: AppUser;
  tasks: Task[];
  runbooks: Runbook[];
  onSubmitTicket: (newTask: Partial<Task>) => void;
  onSelectTask: (task: Task) => void;
  onOpenRunbook: (runbookId: string) => void;
}

export const UserPortalView: React.FC<UserPortalViewProps> = ({
  currentUser,
  tasks,
  runbooks,
  onSubmitTicket,
  onSelectTask,
  onOpenRunbook,
}) => {
  const [activeTab, setActiveTab] = useState<'submit' | 'my-tickets' | 'help'>('submit');
  
  // Submit Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ITCategory>('Application');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [deviceInfo, setDeviceInfo] = useState('Company Laptop (macOS / Windows)');
  const [rawLogs, setRawLogs] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // My Tickets Filter
  const [ticketFilter, setTicketFilter] = useState<'all' | 'active' | 'resolved'>('all');
  
  // Help Center Search
  const [helpSearch, setHelpSearch] = useState('');

  // Filter tasks submitted by the current user (or matching their email)
  const myTickets = tasks.filter(t => 
    t.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
    t.requesterId === currentUser.id ||
    (t.isUserSubmitted && t.requesterName === currentUser.name)
  );

  const activeMyTickets = myTickets.filter(t => t.status !== 'done');
  const resolvedMyTickets = myTickets.filter(t => t.status === 'done');

  const filteredTickets = myTickets.filter(t => {
    if (ticketFilter === 'active') return t.status !== 'done';
    if (ticketFilter === 'resolved') return t.status === 'done';
    return true;
  });

  const filteredRunbooks = runbooks.filter(r => 
    r.status === 'active' && (
      r.title.toLowerCase().includes(helpSearch.toLowerCase()) ||
      r.symptom.toLowerCase().includes(helpSearch.toLowerCase()) ||
      r.tags.some(tag => tag.toLowerCase().includes(helpSearch.toLowerCase()))
    )
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);

    // Map urgency to priority
    let mappedPriority: PriorityLevel = 'P3';
    let impactScore = 5;
    let urgencyScore = 5;
    let slaHours = 8;

    if (urgency === 'critical') {
      mappedPriority = 'P1';
      impactScore = 9;
      urgencyScore = 9;
      slaHours = 2;
    } else if (urgency === 'high') {
      mappedPriority = 'P2';
      impactScore = 7;
      urgencyScore = 8;
      slaHours = 4;
    } else if (urgency === 'low') {
      mappedPriority = 'P4';
      impactScore = 3;
      urgencyScore = 3;
      slaHours = 24;
    }

    const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();
    const ticketNumber = `REQ-${1000 + tasks.length + 1}`;

    const newTicket: Partial<Task> = {
      ticketNumber,
      title: title.trim(),
      description: description.trim(),
      rawLogs: rawLogs.trim() || undefined,
      category,
      environment: 'Corporate LAN',
      priority: mappedPriority,
      priorityRationale: `User submitted request via Employee Portal with ${urgency.toUpperCase()} urgency.`,
      status: 'backlog',
      impactScore,
      urgencyScore,
      slaHours,
      slaDeadline,
      automatedTags: ['User Request', urgency.toUpperCase(), category],
      manualTags: ['Portal Submission'],
      isAutoTagged: false,
      checklist: [
        { id: 'step-1', text: 'Review user submitted request & assess impact', done: false },
        { id: 'step-2', text: 'Reach out to employee or apply remediation runbook', done: false },
        { id: 'step-3', text: 'Verify resolution with employee and close ticket', done: false }
      ],
      assignee: {
        name: 'IT Helpdesk Queue',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: 'Triage Specialist',
        email: 'helpdesk@company.com'
      },
      // Requester metadata
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      requesterEmail: currentUser.email,
      requesterDepartment: currentUser.department || 'General',
      deviceInfo: deviceInfo.trim() || undefined,
      isUserSubmitted: true,
      urgencyLevel: urgency,
    };

    onSubmitTicket(newTicket);
    setSubmittedId(ticketNumber);
    setIsSubmitting(false);

    // Reset form
    setTitle('');
    setDescription('');
    setRawLogs('');
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'backlog':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Received / In Queue
          </span>
        );
      case 'investigating':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
            Under Investigation
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
            IT Specialist Working on It
          </span>
        );
      case 'blocked':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
            Waiting for Vendor / Hardware
          </span>
        );
      case 'testing':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800">
            Testing / Verification
          </span>
        );
      case 'done':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
            Resolved & Completed
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/40 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        {/* Employee Greeting Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-lg font-bold shadow-sm">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Employee Service Desk
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
                Self-Service Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Logged in as <strong>{currentUser.name}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                {currentUser.department || 'General Staff'}
              </span>
            </p>
          </div>
        </div>

        {/* Quick Employee Stats */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {activeMyTickets.length}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
              Open Requests
            </div>
          </div>

          <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {resolvedMyTickets.length}
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
              Resolved
            </div>
          </div>
        </div>
      </div>

      {/* Portal Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('submit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'submit'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit IT Request</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my-tickets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'my-tickets'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>My Tickets</span>
            {activeMyTickets.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                {activeMyTickets.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('help')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'help'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Self-Service SOP Guides</span>
          </button>
        </div>
      </div>

      {/* SUBMISSION CONFIRMATION NOTICE */}
      {submittedId && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                IT Ticket Created Successfully ({submittedId})
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                Your issue has been routed to the IT Operations queue and synced to Supabase. An IT technician will triage it shortly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('my-tickets');
                setSubmittedId(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition cursor-pointer"
            >
              View in My Tickets
            </button>
            <button
              type="button"
              onClick={() => setSubmittedId(null)}
              className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: SUBMIT REQUEST FORM */}
      {activeTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <div className="mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-indigo-600" />
                <span>Submit an IT Incident or Request</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tell us what you're experiencing. Our IT team will triage and troubleshoot your issue.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Summary / What is the issue? <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cannot connect to Singapore Office VPN, or Need Figma Enterprise Access"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ITCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Application">Software & Tool Access (Figma, Slack, Jira)</option>
                    <option value="Networking">Network, Wi-Fi & Corporate VPN</option>
                    <option value="SysAdmin">Hardware, Laptop, Monitor & Peripherals</option>
                    <option value="Security & IAM">Password, SSO, Okta 2FA & Accounts</option>
                    <option value="Cloud Infra">Cloud, Server & Infrastructure</option>
                    <option value="Database">Database & Data Access</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    Your Device / Workstation
                  </label>
                  <div className="relative">
                    <Laptop className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={deviceInfo}
                      onChange={(e) => setDeviceInfo(e.target.value)}
                      placeholder="e.g. MacBook Pro M2, ThinkPad X1"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Urgency / Work Impact */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  How does this impact your work?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div
                    onClick={() => setUrgency('low')}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      urgency === 'low'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Low Impact</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                      Minor issue or question. I can still perform my day-to-day work.
                    </p>
                  </div>

                  <div
                    onClick={() => setUrgency('medium')}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      urgency === 'medium'
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Medium / Slowed Down</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                      Impaired productivity. A core task is slowed down or troublesome.
                    </p>
                  </div>

                  <div
                    onClick={() => setUrgency('critical')}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      urgency === 'critical'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Critical / Work Blocked</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                      Complete blocker. Unable to do my job until resolved.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Detailed Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain what happened, what you were trying to do, and any error message you saw..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Error Code, Log Output or URL (Optional)
                </label>
                <textarea
                  rows={2}
                  value={rawLogs}
                  onChange={(e) => setRawLogs(e.target.value)}
                  placeholder="Paste any error dialogue text, URL, or screenshot URL here..."
                  className="w-full px-3.5 py-2 rounded-xl font-mono text-[11px] border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Requester: <strong>{currentUser.name}</strong> ({currentUser.email})
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !description.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Ticket</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Sidebar: Guidelines & Quick Help */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Target SLA Response Times</span>
              </h3>
              <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <strong>Critical Blocker:</strong>
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">&lt; 2 Hours</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <strong>Medium Urgency:</strong>
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">&lt; 4 Hours</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <strong>Standard Request:</strong>
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">&lt; 24 Hours</span>
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/50 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Self-Service Troubleshooting</span>
              </h3>
              <p className="text-xs text-indigo-900/80 dark:text-indigo-300 leading-relaxed">
                Need a quick fix for VPN, Wi-Fi passwords, or laptop monitors? Check our company SOP guides first:
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('help')}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Browse {runbooks.length} Help Guides</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY TICKETS LIST & STATUS TRACKER */}
      {activeTab === 'my-tickets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                My Service Requests ({myTickets.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track real-time progress, technician assignments, and resolution notes.
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setTicketFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  ticketFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All ({myTickets.length})
              </button>
              <button
                type="button"
                onClick={() => setTicketFilter('active')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  ticketFilter === 'active'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                In Progress ({activeMyTickets.length})
              </button>
              <button
                type="button"
                onClick={() => setTicketFilter('resolved')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  ticketFilter === 'resolved'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Resolved ({resolvedMyTickets.length})
              </button>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No tickets in this view
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {ticketFilter === 'all'
                  ? "You haven't submitted any IT tickets yet. Click 'Submit IT Request' to report any issue."
                  : `You don't have any ${ticketFilter} tickets at the moment.`}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('submit')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer inline-flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit a Request</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => onSelectTask(ticket)}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition cursor-pointer space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        {ticket.ticketNumber}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {ticket.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(ticket.status)}
                      <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                        ticket.priority === 'P1'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                          : ticket.priority === 'P2'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {ticket.priority} Priority
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {ticket.description}
                  </p>

                  {/* Resolution Notes preview if resolved */}
                  {ticket.status === 'done' && ticket.resolutionNotes && (
                    <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-200">
                      <strong>IT Resolution Note:</strong> {ticket.resolutionNotes}
                    </div>
                  )}

                  {/* Ticket Footer details */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                    <div className="flex items-center gap-3">
                      <span>Submitted on {new Date(ticket.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Category: <strong>{ticket.category}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <img
                          src={ticket.assignee.avatar}
                          alt={ticket.assignee.name}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          Assigned: {ticket.assignee.name}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SELF-SERVICE HELP CENTER & SOP GUIDES */}
      {activeTab === 'help' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              <span>Company IT Self-Service Knowledge Base</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Browse approved standard operating procedures and solutions for common IT issues.
            </p>

            <div className="relative pt-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={helpSearch}
                onChange={(e) => setHelpSearch(e.target.value)}
                placeholder="Search troubleshooting guides (e.g. VPN, password, Wi-Fi, monitor)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRunbooks.map((runbook) => (
              <div
                key={runbook.id}
                onClick={() => onOpenRunbook(runbook.id)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                      {runbook.code}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      v{runbook.version}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {runbook.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                    {runbook.symptom}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{runbook.diagnosticSteps.length + runbook.remediationSteps.length} Guided Steps</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                    Read Guide <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
