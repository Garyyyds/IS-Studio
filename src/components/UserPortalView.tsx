import React, { useEffect, useRef, useState } from 'react';
import { 
  LifeBuoy, 
  ArrowLeft,
  FileDown,
  Send, 
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
  AlertCircle,
  FilePlus2,
  Recycle,
  ClipboardList,
  PackageCheck,
  KeyRound,
  Paperclip,
  X,
  Loader2,
  MapPin,
  Phone,
  UserCheck,
  Tag,
} from 'lucide-react';
import { Task, Runbook, AppUser, ITCategory, TaskStatus } from '../types';
import { SYSTEM_OPTIONS, MAX_ATTACHMENT_BYTES } from '../data/requestOptions';
import { exportSupportRequestPdf } from '../utils/supportRequestPdf';
import { uploadAttachment, formatBytes } from '../utils/attachments';
import { AssetFormView } from './AssetFormView';
import { UserIdFormView } from './UserIdFormView';
import { RequisitionFormView } from './RequisitionFormView';
import { MyFormsView } from './MyFormsView';
import { primaryHeaderButton, secondaryHeaderButton } from './FormSubmitControls';
import { DISPOSAL_FORM, ALLOCATION_FORM } from '../utils/assetFormPdf';

interface UserPortalViewProps {
  currentUser: AppUser;
  tasks: Task[];
  runbooks: Runbook[];
  /** Creates the ticket and returns the number it was given. */
  /** Saves the request and resolves to its ticket number; rejects with a message to show. */
  onSubmitTicket: (newTask: Partial<Task>) => Promise<string>;
  onSelectTask: (task: Task) => void;
  onOpenRunbook: (runbookId: string) => void;
  /** Changes each time the user asks to go home; the portal resets to its start page. */
  homeSignal?: number;
  /** When the IT Assistant hands over, opens the IT Support Request pre-filled. */
  ticketPrefill?: { summary: string; description: string; key: number } | null;
}

export const UserPortalView: React.FC<UserPortalViewProps> = ({
  currentUser,
  tasks,
  runbooks,
  onSubmitTicket,
  onSelectTask,
  onOpenRunbook,
  homeSignal = 0,
  ticketPrefill = null,
}) => {
  const [activeTab, setActiveTab] = useState<'my-tickets' | 'my-forms' | 'create-form' | 'help'>('create-form');
  // null shows the picker; a value opens that form.
  // Home = the Create Form picker, the page the portal opens on.
  useEffect(() => {
    if (!homeSignal) return;
    setActiveTab('create-form');
    setSelectedForm(null);
  }, [homeSignal]);

  const [selectedForm, setSelectedForm] = useState<
    'request' | 'requisition' | 'disposal' | 'allocation' | 'user-id' | null
  >(null);
  
  // Submit Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [systemRequested, setSystemRequested] = useState('');
  const [userLocation, setUserLocation] = useState('');
  const [userPhoneExt, setUserPhoneExt] = useState('');
  const [hodName, setHodName] = useState('');
  const [hodEmail, setHodEmail] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // The IT Assistant could not fix it: open the request form with what the
  // employee already described, so they only add the remaining details.
  useEffect(() => {
    if (!ticketPrefill) return;
    setActiveTab('create-form');
    setSelectedForm('request');
    setSubmittedId(null);
    setTitle(ticketPrefill.summary);
    setDescription(ticketPrefill.description);
  }, [ticketPrefill?.key]);
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

  // Picked files are appended, so the button can be used more than once. A file
  // already in the list (same name and size) is skipped, and anything over the
  // limit is refused up front rather than failing at submit time.
  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked: File[] = e.target.files ? Array.from(e.target.files) : [];
    const tooLarge = picked.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    const accepted = picked.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);

    setFiles((prev) => [
      ...prev,
      ...accepted.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size)),
    ]);
    setSubmitError(
      tooLarge.length
        ? `${tooLarge.map((f) => f.name).join(', ')} ${tooLarge.length > 1 ? 'are' : 'is'} over ${formatBytes(MAX_ATTACHMENT_BYTES)} and was not added.`
        : null
    );
    // Reset so picking the same file again after removing it still fires.
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Prints what is on screen right now, so it works before or after submitting.
  const handleExportPdf = async () => {
    if (!title.trim()) {
      setExportError('Fill in the Summary before exporting.');
      return;
    }

    setExportError(null);
    setIsExporting(true);
    try {
      await exportSupportRequestPdf({
        requestDate: new Date().toISOString().slice(0, 10),
        requesterName: currentUser.name,
        requesterEmail: currentUser.email,
        department: currentUser.department || '',
        location: userLocation.trim(),
        phoneExt: userPhoneExt.trim(),
        hodName: hodName.trim(),
        hodEmail: hodEmail.trim(),
        summary: title.trim(),
        category: systemRequested,
        affectedDevice: deviceInfo.trim(),
        description: description.trim(),
        attachmentNames: files.map((file) => file.name),
      });
    } catch (err: any) {
      setExportError(err?.message || 'Could not generate the PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    // Files go up first: if any fails, nothing is submitted and the form keeps
    // everything the employee entered so they can retry.
    let attachments;
    try {
      attachments = await Promise.all(files.map((file) => uploadAttachment(file)));
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not upload the attachments. Please try again.');
      setIsSubmitting(false);
      return;
    }

    const newTicket: Partial<Task> = {
      title: title.trim(),
      description: description.trim(),
      category: systemRequested as ITCategory,
      status: 'backlog',
      automatedTags: ['User Request', systemRequested],
      manualTags: ['Portal Submission'],
      checklist: [
        { id: 'step-1', text: 'Review user submitted request & assess impact', done: false },
        { id: 'step-2', text: 'Reach out to employee or apply remediation runbook', done: false },
        { id: 'step-3', text: 'Verify resolution with employee and close ticket', done: false }
      ],
      // New requests arrive unassigned; IT picks a technician when triaging.
      assigneeId: '',
      assignee: { name: 'Unassigned', role: '', email: '' },
      // Requester metadata
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      requesterEmail: currentUser.email,
      requesterDepartment: currentUser.department || 'General',
      deviceInfo: deviceInfo.trim() || undefined,
      isUserSubmitted: true,
      systemRequested,
      userLocation: userLocation.trim(),
      userPhoneExt: userPhoneExt.trim(),
      hodName: hodName.trim(),
      hodEmail: hodEmail.trim(),
      attachments: attachments.length ? attachments : undefined,
    };

    let ticketNumber: string;
    try {
      ticketNumber = await onSubmitTicket(newTicket);
    } catch (err: any) {
      // Nothing was saved; keep what the employee entered so they can retry.
      setSubmitError(err?.message || 'Could not submit the request. Please try again.');
      setIsSubmitting(false);
      return;
    }
    setSubmittedId(ticketNumber);
    setIsSubmitting(false);

    // Reset form
    setTitle('');
    setDescription('');
    setDeviceInfo('');
    setSystemRequested('');
    setUserLocation('');
    setUserPhoneExt('');
    setHodName('');
    setHodEmail('');
    setFiles([]);
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
        {/* Equal columns, each as wide as the longest label, so the selected
            tab and the gaps look the same whichever tab is active. */}
        <div className="grid grid-cols-[repeat(4,1fr)] gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              // Always land on the picker, the same place Back returns to,
              // rather than reopening whichever form was last left open.
              setSelectedForm(null);
              setActiveTab('create-form');
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'create-form'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Create Form</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my-tickets')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'my-tickets'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>My Tickets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my-forms')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'my-forms'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>My Forms</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('help')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
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

      {/* MY FORMS: history of forms submitted to IT */}
      {activeTab === 'my-forms' && (
        <MyFormsView
          currentUser={currentUser}
          onCreateForm={() => {
            setSelectedForm(null);
            setActiveTab('create-form');
          }}
        />
      )}

      {/* TAB 2: MY TICKETS LIST & STATUS TRACKER */}
      {activeTab === 'my-tickets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                My Service Requests
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
                  ? "You haven't submitted any IT tickets yet. Open IT Support Request to report an issue."
                  : `You don't have any ${ticketFilter} tickets at the moment.`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedForm('request');
                  setActiveTab('create-form');
                }}
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
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {ticket.description}
                  </p>

                  {/* What the employee entered on the IT Support Request, so the
                      status card shows the same details IT is working from. */}
                  {(() => {
                    const details = [
                      { label: 'Category', value: ticket.systemRequested, Icon: Tag },
                      { label: 'Affected Device', value: ticket.deviceInfo, Icon: Laptop },
                      { label: 'Location', value: ticket.userLocation, Icon: MapPin },
                      { label: 'Phone / Ext', value: ticket.userPhoneExt, Icon: Phone },
                      { label: 'HOD', value: ticket.hodName, Icon: UserCheck },
                      {
                        label: 'Attachments',
                        value: ticket.attachments?.length
                          ? `${ticket.attachments.length} file${ticket.attachments.length > 1 ? 's' : ''}`
                          : '',
                        Icon: Paperclip,
                      },
                    ].filter((d) => d.value);
                    if (!details.length) return null;
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                        {details.map(({ label, value, Icon }) => (
                          <div key={label} className="min-w-0">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{label}</span>
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <Icon className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate" title={value}>{value}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Ticket Footer details */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                    <div className="flex items-center gap-3">
                      <span>Submitted on {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Assigned: {ticket.assignee.name}
                      </span>
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
      {/* CREATE FORM TAB */}
      {activeTab === 'create-form' && (
        <div>
          {selectedForm === 'request' ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <LifeBuoy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>IT Support Request</span>
                  </h2>
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                    Tell us what you're experiencing. IT will triage and follow up.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSelectedForm(null)} className={secondaryHeaderButton}>
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className={primaryHeaderButton}
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    <span>{isExporting ? 'Generating...' : 'Export to PDF'}</span>
                  </button>
                </div>
              </div>

              {exportError && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{exportError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
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
                        placeholder="e.g. No Internet connection"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                          Category <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={systemRequested}
                          onChange={(e) => setSystemRequested(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                        >
                          <option value="">Select a category</option>
                          {SYSTEM_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                          Affected Device
                        </label>
                        <div className="relative">
                          <Laptop className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={deviceInfo}
                            onChange={(e) => setDeviceInfo(e.target.value)}
                            placeholder="e.g. Laptop, Printer"
                            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                          Location <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={userLocation}
                          onChange={(e) => setUserLocation(e.target.value)}
                          placeholder="e.g. HQ, KLO"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                          Phone / Extension <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={userPhoneExt}
                          onChange={(e) => setUserPhoneExt(e.target.value)}
                          placeholder="e.g. 1234"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                          HOD Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={hodName}
                          onChange={(e) => setHodName(e.target.value)}
                          placeholder="Name"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                          HOD Email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={hodEmail}
                          onChange={(e) => setHodEmail(e.target.value)}
                          placeholder="hod@eadeco.com.my"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Remarks / Description <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the issue in detail..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Attachments{' '}
                          <span className="font-normal text-slate-400">
                            (Optional)
                          </span>
                        </label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFilesPicked}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Add Files</span>
                        </button>
                      </div>

                      {files.length > 0 ? (
                        // One row per file on a shared grid, so names, sizes and remove
                        // buttons line up down the list however many are attached.
                        <ul className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                          {files.map((file, index) => (
                            <li
                              key={`${file.name}-${file.size}`}
                              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-3 py-2"
                            >
                              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 text-right">
                                {formatBytes(file.size)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                aria-label={`Remove ${file.name}`}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          Screenshots, error photos or documents that help IT understand the request.
                        </p>
                      )}
                    </div>

                    {submitError && (
                      <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                        <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{submitError}</p>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Requester: <strong>{currentUser.name}</strong> ({currentUser.email})
                      </span>
                      <button
                        type="submit"
                        disabled={isSubmitting || !title.trim() || !description.trim()}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-2 shadow-sm"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{isSubmitting ? (files.length ? 'Uploading...' : 'Submitting...') : 'Submit Ticket'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Sidebar: Guidelines & Quick Help */}
                <div className="space-y-4">
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
            </div>
          ) : selectedForm === 'user-id' ? (
            <UserIdFormView currentUser={currentUser} onBack={() => setSelectedForm(null)} />
          ) : selectedForm === 'requisition' ? (
            <RequisitionFormView currentUser={currentUser} onBack={() => setSelectedForm(null)} />
          ) : selectedForm === 'disposal' || selectedForm === 'allocation' ? (
            <AssetFormView
              config={selectedForm === 'disposal' ? DISPOSAL_FORM : ALLOCATION_FORM}
              currentUser={currentUser}
              onBack={() => setSelectedForm(null)}
            />
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Create a Form
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                  Choose the form you need. Every form can be submitted straight to IT, and the printable forms also export a PDF to sign.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* IT incident or support request - raises a ticket straight away */}
                <button
                  type="button"
                  onClick={() => setSelectedForm('request')}
                  className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                      <LifeBuoy className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    IT Support Request
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    Report an IT issue or ask for support. It goes straight to the IT queue as a ticket.
                  </p>
                </button>

                {/* Hardware, software and peripherals requisition */}
                <button
                  type="button"
                  onClick={() => setSelectedForm('requisition')}
                  className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                      <ClipboardList className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    IT Hardware, Software &amp; Peripherals Requisition
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    Request new hardware, software or peripherals with the purpose, cost breakdown
                    and item list.
                  </p>
                </button>

                {/* User ID requisition */}
                <button
                  type="button"
                  onClick={() => setSelectedForm('user-id')}
                  className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                      <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    New User ID Requisition
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    Request access to company systems such as email, file server, NAV or HRIS.
                  </p>
                </button>

                {/* Allocation form */}
                <button
                  type="button"
                  onClick={() => setSelectedForm('allocation')}
                  className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                      <PackageCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {ALLOCATION_FORM.pickerTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    {ALLOCATION_FORM.pickerBlurb}
                  </p>
                </button>

                {/* Disposal form */}
                <button
                  type="button"
                  onClick={() => setSelectedForm('disposal')}
                  className="text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900">
                      <Recycle className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {DISPOSAL_FORM.pickerTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    {DISPOSAL_FORM.pickerBlurb}
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
