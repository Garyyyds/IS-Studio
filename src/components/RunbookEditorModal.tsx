import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Terminal, 
  Sparkles, 
  ShieldAlert, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Wand2,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Lock
} from 'lucide-react';
import { Runbook, EnvironmentType, ITCategory, DiagnosticStep, RemediationStep, UserRole } from '../types';

interface RunbookEditorModalProps {
  runbook: Runbook | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (runbook: Runbook) => void;
  onDelete?: (id: string) => void;
  userRole?: UserRole;
}

const PRESET_TEMPLATES = [
  {
    name: 'Windows SMB Fileshare & Drive Mapping (\\\\hq-file01)',
    category: 'Networking',
    runbook: {
      code: 'SOP-NET-004',
      title: 'Windows SMB Fileshare Connection Failure & Network Drive Mapping (\\\\hq-file01)',
      category: 'Networking',
      environment: 'Corporate LAN',
      author: 'Senior Systems Administrator',
      authorRole: 'Infrastructure Support Lead',
      version: '1.0.0',
      status: 'active' as const,
      symptom: 'End-users cannot access corporate fileshare \\\\hq-file01. Error dialog displays "The network path was not found (0x80070035)" or "Windows cannot access \\\\hq-file01". Mapped drive Z: shows red disconnection marker.',
      triggerAlertPatterns: [
        'The network path was not found (0x80070035)',
        'ping: could not find host hq-file01',
        'Windows cannot access \\\\hq-file01',
      ],
      rootCauseAnalysis: 'Client workstation network adapter is misconfigured with stale or invalid static DNS server addresses instead of DHCP automatic DNS, preventing internal Active Directory domain name resolution of the fileshare hostname.',
      diagnosticSteps: [
        {
          title: '1. Test Hostname & IP Reachability via Command Prompt',
          cli: 'ping hq-file01',
          explanation: 'Check whether cmd receives valid ICMP echo replies or "Destination host unreachable" / "Could not find host". If hostname fails, test ping to destination IP.',
          shellType: 'general' as const,
        },
        {
          title: '2. Inspect Current Adapter IPv4 & DNS Server Settings',
          cli: 'ipconfig /all',
          explanation: 'Inspect active adapter to confirm DHCP status and DNS Servers list.',
          shellType: 'general' as const,
        },
        {
          title: '3. Flush Local DNS Resolver Cache',
          cli: 'ipconfig /flushdns',
          explanation: 'Purges cached DNS lookup entries to force fresh query against domain DNS servers.',
          shellType: 'general' as const,
        },
        {
          title: '4. Test SMB Port 445 Connectivity via PowerShell',
          cli: 'Test-NetConnection -ComputerName hq-file01 -Port 445',
          explanation: 'Confirms TCP port 445 (SMB) is open through internal network firewalls.',
          shellType: 'powershell' as const,
        },
      ],
      remediationSteps: [
        {
          stepNumber: 1,
          title: 'Reset Network Adapter to Obtain DNS Automatically (DHCP)',
          instruction: '1. Open View Network Connections (Win+R -> ncpa.cpl).\n2. Right-click active Ethernet/Wi-Fi adapter -> Properties.\n3. Double-click "Internet Protocol Version 4 (TCP/IPv4)".\n4. Check "Obtain DNS server address automatically" & "Obtain an IP address automatically".\n5. Click OK to save.',
          command: 'netsh interface ip set dns name="Ethernet" source=dhcp',
          dangerous: false,
          verification: 'Run `ipconfig /all` and verify DNS servers match the corporate domain controller IP.',
        },
        {
          stepNumber: 2,
          title: 'Verify Ping Response from Command Prompt',
          instruction: 'Open Command Prompt (cmd) and execute `ping hq-file01` (or destination IP address). Verify 4 packets sent and 4 packets received (0% packet loss).',
          command: 'ping -n 4 hq-file01',
          dangerous: false,
          verification: 'Output confirms: "Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)".',
        },
        {
          stepNumber: 3,
          title: 'Access Fileshare & Map Network Drive to Z:',
          instruction: '1. Click Start (or Win+R) -> type `\\\\hq-file01` and press Enter.\n2. Right-click the fileshare folder -> select "Map network drive...".\n3. Choose Drive Letter `Z:`.\n4. Check "Reconnect at sign-in" and click Finish.',
          command: 'net use Z: \\\\hq-file01\\Shared /persistent:yes',
          dangerous: false,
          verification: 'Output confirms "The command completed successfully." Drive Z: appears in File Explorer.',
        },
        {
          stepNumber: 4,
          title: 'Test Connection in File Explorer',
          instruction: 'Open Windows File Explorer (Win+E) -> navigate to "This PC" -> double-click "Shared (\\\\hq-file01) (Z:)". Confirm files and folders open properly.',
          command: 'explorer.exe Z:\\',
          dangerous: false,
          verification: 'Directory structure loads immediately with read/write access.',
        },
      ],
      rollbackPlan: 'Restore static DNS settings via `netsh interface ip set dns name="Ethernet" static <PRIMARY_DNS_IP>` if a custom routing metric is required.',
      postMortemChecklist: [
        'Verify DHCP Option 006 (DNS Servers) across client subnets',
        'Ensure GPO Drive Maps policy automatically remaps Z: on login',
      ],
      tags: ['fileshare', 'smb', 'windows', 'networking', 'dns', 'drive-mapping'],
    },
  },
  {
    name: 'PostgreSQL Pool Saturation & Deadlock',
    category: 'Database',
    runbook: {
      code: 'SOP-DB-002',
      title: 'PostgreSQL Connection Exhaustion & Deadlock Kill Protocol',
      category: 'Database',
      environment: 'Production',
      author: 'Principal Database Reliability Engineer',
      authorRole: 'Database Team Lead',
      version: '1.0.0',
      status: 'active' as const,
      symptom: 'Applications return 503/500 errors. PostgreSQL server reports "FATAL: remaining connection slots are reserved for non-replication superuser connections".',
      triggerAlertPatterns: [
        'FATAL: sorry, too many clients already',
        'pg_stat_activity: state = "idle in transaction" > 60s',
      ],
      rootCauseAnalysis: 'Unclosed transaction blocks in web API workers holding table-level locks.',
      diagnosticSteps: [
        {
          title: 'Inspect Active Client Connections by State',
          cli: `sudo -u postgres psql -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"`,
          explanation: 'Identify if connections are stuck in idle in transaction.',
          shellType: 'sql' as const,
        },
        {
          title: 'Identify Top Long-Running Blocking Queries',
          cli: `sudo -u postgres psql -c "SELECT pid, now() - query_start AS duration, query, state FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"`,
          explanation: 'Pinpoints specific SQL queries holding transaction locks.',
          shellType: 'sql' as const,
        },
      ],
      remediationSteps: [
        {
          stepNumber: 1,
          title: 'Gracefully Cancel Blocking Transactions',
          instruction: 'Cancel queries idle in transaction for over 5 minutes.',
          command: `SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND (now() - state_change) > interval '5 minutes';`,
          dangerous: false,
          verification: 'Confirm connection count drops below 75% capacity.',
        },
      ],
      rollbackPlan: 'Keep replica ready for emergency traffic diversion.',
      postMortemChecklist: [
        'Configure idle_in_transaction_session_timeout = 60000 in postgresql.conf',
      ],
      tags: ['postgresql', 'database', 'deadlock', 'outage'],
    },
  },
  {
    name: 'Kubernetes Pod CrashLoopBackOff & OOMKilled',
    category: 'DevOps & SRE',
    runbook: {
      code: 'SOP-K8S-015',
      title: 'Kubernetes Pod CrashLoopBackOff & OOMKilled Emergency Protocol',
      category: 'DevOps & SRE',
      environment: 'Production',
      author: 'Staff SRE',
      authorRole: 'Infrastructure Engineer',
      version: '1.0.0',
      status: 'active' as const,
      symptom: 'Kubernetes deployment pods repeatedly terminating with status CrashLoopBackOff or exit code 137 (OOMKilled).',
      triggerAlertPatterns: [
        'Reason: OOMKilled, exitCode: 137',
        'KubePodCrashLooping: pod in namespace payment-service',
      ],
      rootCauseAnalysis: 'Container memory limit exceeded by spikes in memory allocation, or startup crash from missing environment config.',
      diagnosticSteps: [
        {
          title: 'Check Failing Pods Status & Exit Codes',
          cli: `kubectl get pods -n <NAMESPACE> -o wide | grep -E 'CrashLoopBackOff|OOMKilled|Error'`,
          explanation: 'Identify crashing instances and host nodes.',
          shellType: 'kubectl' as const,
        },
        {
          title: 'Inspect Previous Container Logs Before Termination',
          cli: `kubectl logs <POD_NAME> -n <NAMESPACE> --previous --tail=100`,
          explanation: 'Inspect stack trace right before the container was terminated.',
          shellType: 'kubectl' as const,
        },
      ],
      remediationSteps: [
        {
          stepNumber: 1,
          title: 'Patch Memory Resource Limits',
          instruction: 'Temporarily increase container memory limit to stabilize traffic.',
          command: `kubectl set resources deployment/<DEPLOYMENT_NAME> -n <NAMESPACE> --limits=memory=2Gi,cpu=1000m --requests=memory=1Gi,cpu=500m`,
          dangerous: false,
          verification: 'Run `kubectl rollout status deployment/<DEPLOYMENT_NAME> -n <NAMESPACE>`',
        },
      ],
      rollbackPlan: 'Execute `kubectl rollout undo deployment/<DEPLOYMENT_NAME> -n <NAMESPACE>`.',
      postMortemChecklist: [
        'Review memory allocation profiles with Datadog APM / Grafana',
      ],
      tags: ['kubernetes', 'k8s', 'oomkilled', 'crashloopbackoff'],
    },
  },
];

const buildDefaultRunbook = (rb?: Runbook | null): Runbook => ({
  id: rb?.id || `runbook-${Date.now()}`,
  code: rb?.code || `SOP-OPS-${Math.floor(100 + Math.random() * 900)}`,
  title: rb?.title || '',
  category: rb?.category || 'Networking',
  environment: rb?.environment || 'Corporate LAN',
  lastUpdated: new Date().toISOString().slice(0, 10),
  author: rb?.author || 'Alex Rivera',
  authorRole: rb?.authorRole || 'Senior Systems Administrator',
  version: rb?.version || '1.0.0',
  status: rb?.status || 'active',
  symptom: rb?.symptom || '',
  triggerAlertPatterns: rb?.triggerAlertPatterns || [''],
  rootCauseAnalysis: rb?.rootCauseAnalysis || '',
  diagnosticSteps: rb?.diagnosticSteps || [
    { title: 'Ping Destination Host or IP', cli: 'ping hq-file01', explanation: 'Check whether host responds to ICMP echo requests', shellType: 'general' },
  ],
  remediationSteps: rb?.remediationSteps || [
    { stepNumber: 1, title: 'Verify Network Adapter Settings', instruction: 'Check IPv4 properties and set to Obtain DNS automatically.', command: 'netsh interface ip set dns name="Ethernet" source=dhcp', dangerous: false, verification: 'Verify DNS server address resolves internal hostnames.' },
  ],
  rollbackPlan: rb?.rollbackPlan || 'Restore previous network adapter configuration or static IP settings if required.',
  postMortemChecklist: rb?.postMortemChecklist || ['Verify DHCP scope options across corporate subnets'],
  relatedTaskIds: rb?.relatedTaskIds || [],
  tags: rb?.tags || ['networking', 'sop'],
});

export const RunbookEditorModal: React.FC<RunbookEditorModalProps> = ({
  runbook,
  isOpen,
  onClose,
  onSave,
  onDelete,
  userRole,
}) => {
  const isReadOnly = userRole === 'user';
  const [formData, setFormData] = useState<Runbook>(() => buildDefaultRunbook(runbook));
  const [showRawImporter, setShowRawImporter] = useState(false);
  const [rawNotes, setRawNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedCli, setCopiedCli] = useState<string | null>(null);

  const handleCopyCommand = (cli: string) => {
    navigator.clipboard.writeText(cli);
    setCopiedCli(cli);
    setTimeout(() => setCopiedCli(null), 2000);
  };

  React.useEffect(() => {
    if (isOpen) {
      setFormData(buildDefaultRunbook(runbook));
      setShowRawImporter(false);
      setConfirmDelete(false);
      setRawNotes('');
    }
  }, [runbook, isOpen]);

  if (!isOpen) return null;

  // Diagnostic Steps
  const handleAddDiagnostic = () => {
    if (isReadOnly) return;
    setFormData({
      ...formData,
      diagnosticSteps: [
        ...formData.diagnosticSteps,
        {
          title: 'New Diagnostic Inspection',
          cli: '',
          explanation: '',
          shellType: 'general',
        },
      ],
    });
  };

  const handleUpdateDiagnostic = (index: number, field: keyof DiagnosticStep, value: any) => {
    if (isReadOnly) return;
    const updated = [...formData.diagnosticSteps];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, diagnosticSteps: updated });
  };

  const handleDeleteDiagnostic = (index: number) => {
    if (isReadOnly) return;
    setFormData({
      ...formData,
      diagnosticSteps: formData.diagnosticSteps.filter((_, i) => i !== index),
    });
  };

  // Remediation Steps
  const handleAddRemediation = () => {
    if (isReadOnly) return;
    const nextNum = formData.remediationSteps.length + 1;
    setFormData({
      ...formData,
      remediationSteps: [
        ...formData.remediationSteps,
        {
          stepNumber: nextNum,
          title: `Action Step ${nextNum}`,
          instruction: '',
          command: '',
          dangerous: false,
          verification: '',
        },
      ],
    });
  };

  const handleUpdateRemediation = (index: number, field: keyof RemediationStep, value: any) => {
    if (isReadOnly) return;
    const updated = [...formData.remediationSteps];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, remediationSteps: updated });
  };

  const handleDeleteRemediation = (index: number) => {
    if (isReadOnly) return;
    setFormData({
      ...formData,
      remediationSteps: formData.remediationSteps.filter((_, i) => i !== index),
    });
  };

  // Post Mortem Checklist
  const handleAddPostMortemItem = () => {
    if (isReadOnly) return;
    setFormData({
      ...formData,
      postMortemChecklist: [...formData.postMortemChecklist, ''],
    });
  };

  const handleUpdatePostMortemItem = (index: number, val: string) => {
    if (isReadOnly) return;
    const updated = [...formData.postMortemChecklist];
    updated[index] = val;
    setFormData({ ...formData, postMortemChecklist: updated });
  };

  const handleDeletePostMortemItem = (index: number) => {
    if (isReadOnly) return;
    setFormData({
      ...formData,
      postMortemChecklist: formData.postMortemChecklist.filter((_, i) => i !== index),
    });
  };

  // Apply a preset template
  const handleApplyPreset = (tpl: typeof PRESET_TEMPLATES[0]) => {
    if (isReadOnly) return;
    setFormData({
      ...formData,
      code: tpl.runbook.code,
      title: tpl.runbook.title,
      category: tpl.runbook.category,
      environment: tpl.runbook.environment,
      symptom: tpl.runbook.symptom,
      triggerAlertPatterns: tpl.runbook.triggerAlertPatterns,
      rootCauseAnalysis: tpl.runbook.rootCauseAnalysis,
      diagnosticSteps: tpl.runbook.diagnosticSteps,
      remediationSteps: tpl.runbook.remediationSteps,
      rollbackPlan: tpl.runbook.rollbackPlan,
      postMortemChecklist: tpl.runbook.postMortemChecklist,
      tags: tpl.runbook.tags,
    });
  };

  // Smart Parser for Raw Notes
  const handleParseRawNotes = () => {
    if (isReadOnly || !rawNotes.trim()) return;

    const lines = rawNotes.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let parsedTitle = formData.title;
    const extractedSteps: { instruction: string; command?: string; verification?: string }[] = [];
    const extractedDiags: DiagnosticStep[] = [];

    // Check first line for title
    const firstLine = lines[0].replace(/^(\d+[\.\)]|\-|\*)\s*/, '');
    if (!formData.title || formData.title === '') {
      parsedTitle = firstLine;
    }

    lines.forEach((line, idx) => {
      if (idx === 0 && (line.toLowerCase().includes('failure') || line.toLowerCase().includes('issue') || line.toLowerCase().includes('error'))) {
        return; // already used as title/symptom
      }

      const cleanLine = line.replace(/^(\d+[\.\)]|\-|\*)\s*/, '');
      
      // Check for command mentions
      if (cleanLine.toLowerCase().includes('ping') || cleanLine.toLowerCase().includes('cmd') || cleanLine.toLowerCase().includes('test-netconnection')) {
        const pingMatch = cleanLine.match(/ping\s+([^\s\/]+)/i);
        const host = pingMatch ? pingMatch[1] : 'hq-file01';
        extractedDiags.push({
          title: `Ping & Connectivity Verification (${host})`,
          cli: `ping ${host}`,
          explanation: 'Check whether cmd gets valid ICMP replies or host unreachable.',
          shellType: 'general',
        });
      }

      if (cleanLine.toLowerCase().includes('dns') || cleanLine.toLowerCase().includes('ipv4') || cleanLine.toLowerCase().includes('properties')) {
        extractedSteps.push({
          instruction: cleanLine,
          command: 'netsh interface ip set dns name="Ethernet" source=dhcp',
          verification: 'Confirm network adapter is set to Obtain DNS automatically.',
        });
      } else if (cleanLine.toLowerCase().includes('map network drive') || cleanLine.toLowerCase().includes('drive z')) {
        extractedSteps.push({
          instruction: cleanLine,
          command: 'net use Z: \\\\hq-file01\\Shared /persistent:yes',
          verification: 'Confirm Drive Z: mounts in Windows File Explorer.',
        });
      } else if (cleanLine.toLowerCase().includes('test connection') || cleanLine.toLowerCase().includes('file explorer')) {
        extractedSteps.push({
          instruction: cleanLine,
          command: 'explorer.exe Z:\\',
          verification: 'Confirm shared directory files open with full read/write access.',
        });
      } else {
        extractedSteps.push({
          instruction: cleanLine,
          verification: 'Verify step completed successfully.',
        });
      }
    });

    const newRemediations: RemediationStep[] = extractedSteps.map((s, i) => ({
      stepNumber: i + 1,
      title: s.instruction.length > 50 ? `${s.instruction.slice(0, 48)}...` : s.instruction,
      instruction: s.instruction,
      command: s.command || '',
      dangerous: false,
      verification: s.verification || 'Step completed without error.',
    }));

    setFormData(prev => ({
      ...prev,
      title: parsedTitle || prev.title,
      symptom: prev.symptom || `Connection error reported: ${firstLine}`,
      diagnosticSteps: extractedDiags.length > 0 ? extractedDiags : prev.diagnosticSteps,
      remediationSteps: newRemediations.length > 0 ? newRemediations : prev.remediationSteps,
    }));

    setShowRawImporter(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      onClose();
      return;
    }
    onSave({
      ...formData,
      lastUpdated: new Date().toISOString().slice(0, 10),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {isReadOnly ? 'IT Issue-Solution SOP Runbook Guide' : runbook ? 'Edit Issue-Solution SOP Runbook' : 'Author New IT Runbook & SOP'}
                </h3>
                {isReadOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>View Only</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isReadOnly ? 'Standard Operating Procedure (SOP) with diagnostic & remediation workflows (Read-Only Reference)' : 'Standard Operating Procedure (SOP) with diagnostic & remediation workflows'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Preset Quick Load Bar (Admin only) */}
          {!isReadOnly && (
            <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Quick-Load Preset Standard SOPs</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowRawImporter(!showRawImporter)}
                  className="text-xs text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 font-semibold flex items-center gap-1 underline underline-offset-2 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{showRawImporter ? 'Hide Smart Note Parser' : 'Smart Paste Raw Notes'}</span>
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-1">
                {PRESET_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyPreset(tpl)}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-slate-700 dark:text-slate-200 border border-indigo-200 dark:border-indigo-800 text-[11px] font-medium transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>{tpl.name}</span>
                  </button>
                ))}
              </div>

              {/* Collapsible Raw Note Parser */}
              {showRawImporter && (
                <div className="mt-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-800/60 space-y-2 animate-in fade-in duration-150">
                  <label className="block text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                    Paste unstructured troubleshooting steps / bullet points:
                  </label>
                  <textarea
                    rows={4}
                    value={rawNotes}
                    onChange={(e) => setRawNotes(e.target.value)}
                    placeholder={`1. Connection failure to fileshare (\\\\hq-file01)\n- Go to View Network Connection -> Properties -> IPv4\n- Check DNS settings -> Change back to Obtain DNS automatically\n- Go to cmd -> ping hq-file01\n- If success -> Start -> \\\\hq-file01 -> Map network drive Z: -> Finish`}
                    className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Automatically extracts symptoms, DNS/network configurations, CLI ping tests, and Drive Z: mapping.
                    </span>
                    <button
                      type="button"
                      onClick={handleParseRawNotes}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Auto-Format into SOP</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Code & Title Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                Document Code {!isReadOnly && '*'}
              </label>
              <input
                type="text"
                required={!isReadOnly}
                disabled={isReadOnly}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                placeholder="SOP-NET-004"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wide">
                Runbook Title {!isReadOnly && '*'}
              </label>
              <input
                type="text"
                required={!isReadOnly}
                disabled={isReadOnly}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                placeholder="e.g. Windows SMB Fileshare Connection Failure & Network Drive Mapping (\\hq-file01)"
              />
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Category</label>
              <select
                value={formData.category}
                disabled={isReadOnly}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
              >
                <option value="Networking">Networking</option>
                <option value="SysAdmin">SysAdmin</option>
                <option value="DevOps & SRE">DevOps & SRE</option>
                <option value="Database">Database</option>
                <option value="Cloud Infra">Cloud Infra</option>
                <option value="Security & IAM">Security & IAM</option>
                <option value="Application">Application</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Environment</label>
              <select
                value={formData.environment}
                disabled={isReadOnly}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
              >
                <option value="Corporate LAN">Corporate LAN</option>
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="DR / Failover">DR / Failover</option>
                <option value="Cloud Infrastructure">Cloud Infrastructure</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Author / Lead</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Observable Symptoms */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
              1. Observable Symptoms & Error Triggers {!isReadOnly && '*'}
            </label>
            <textarea
              rows={3}
              required={!isReadOnly}
              disabled={isReadOnly}
              value={formData.symptom}
              onChange={(e) => setFormData({ ...formData, symptom: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
              placeholder="e.g. End-users cannot access fileshare \\hq-file01, error dialog shows 0x80070035..."
            />
          </div>

          {/* Root Cause Analysis (RCA) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
              2. Root Cause Analysis (RCA)
            </label>
            <textarea
              rows={3}
              disabled={isReadOnly}
              value={formData.rootCauseAnalysis}
              onChange={(e) => setFormData({ ...formData, rootCauseAnalysis: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
              placeholder="Technical explanation (e.g. Workstation network adapter has stale static DNS server addresses instead of DHCP automatic DNS)..."
            />
          </div>

          {/* Diagnostic Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>3. Diagnostic Workflow & Inspection Commands</span>
              </label>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddDiagnostic}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Diagnostic Command</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {formData.diagnosticSteps.map((diag, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      placeholder="Diagnostic Step Title (e.g. Ping hq-file01 from Command Prompt)"
                      value={diag.title}
                      onChange={(e) => handleUpdateDiagnostic(idx, 'title', e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                    />
                    <select
                      value={diag.shellType}
                      disabled={isReadOnly}
                      onChange={(e) => handleUpdateDiagnostic(idx, 'shellType', e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-indigo-700 dark:text-indigo-400 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                    >
                      <option value="general">general / cmd</option>
                      <option value="powershell">powershell</option>
                      <option value="bash">bash</option>
                      <option value="kubectl">kubectl</option>
                      <option value="sql">sql</option>
                      <option value="docker">docker</option>
                    </select>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDiagnostic(idx)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      placeholder="Terminal CLI command to execute (e.g. ping hq-file01)..."
                      value={diag.cli}
                      onChange={(e) => handleUpdateDiagnostic(idx, 'cli', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-20 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-indigo-500 disabled:opacity-95"
                    />
                    {diag.cli && (
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(diag.cli)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition"
                      >
                        {copiedCli === diag.cli ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCli === diag.cli ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    disabled={isReadOnly}
                    placeholder="What to inspect in output (e.g. Verify reply received or destination unreachable)..."
                    value={diag.explanation}
                    onChange={(e) => handleUpdateDiagnostic(idx, 'explanation', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Remediation Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>4. Step-by-Step Remediation Procedures</span>
              </label>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddRemediation}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Remediation Step</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {formData.remediationSteps.map((step, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">Step {step.stepNumber}</span>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      placeholder="Step Title (e.g. Set IPv4 to Obtain DNS automatically)"
                      value={step.title}
                      onChange={(e) => handleUpdateRemediation(idx, 'title', e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                    />
                    {step.dangerous && (
                      <span className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded border border-red-200 dark:border-red-800 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>High-Risk</span>
                      </span>
                    )}
                    {!isReadOnly && !step.dangerous && (
                      <label className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300 cursor-pointer bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                        <input
                          type="checkbox"
                          checked={step.dangerous}
                          onChange={(e) => handleUpdateRemediation(idx, 'dangerous', e.target.checked)}
                          className="rounded bg-white dark:bg-slate-800 border-red-300 dark:border-red-700 text-red-600"
                        />
                        <span>High-Risk</span>
                      </label>
                    )}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRemediation(idx)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    placeholder="Clear instructions for the engineer or technician..."
                    value={step.instruction}
                    onChange={(e) => handleUpdateRemediation(idx, 'instruction', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                  />

                  {step.command && (
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isReadOnly}
                        placeholder="Optional execution command (e.g. netsh interface ip set dns name=Ethernet source=dhcp)..."
                        value={step.command || ''}
                        onChange={(e) => handleUpdateRemediation(idx, 'command', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-20 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-indigo-500 disabled:opacity-95"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(step.command!)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition"
                      >
                        {copiedCli === step.command ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCli === step.command ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    disabled={isReadOnly}
                    placeholder="Verification criteria (e.g. Verify ping returns reply with 0% packet loss)..."
                    value={step.verification}
                    onChange={(e) => handleUpdateRemediation(idx, 'verification', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 text-xs text-indigo-700 dark:text-indigo-400 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Rollback & Safeguard */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
              5. Rollback & Safeguard Protocol
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={formData.rollbackPlan}
              onChange={(e) => setFormData({ ...formData, rollbackPlan: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
              placeholder="Steps to restore static DNS or alternate network routes if fix fails..."
            />
          </div>

          {/* Post Mortem Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                6. Post-Mortem Action Items & Monitoring Hardening
              </label>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddPostMortemItem}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {formData.postMortemChecklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={isReadOnly}
                    placeholder="Action item (e.g. Verify DHCP Option 006 on domain scope)..."
                    value={item}
                    onChange={(e) => handleUpdatePostMortemItem(idx, e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/60 disabled:cursor-not-allowed"
                  />
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeletePostMortemItem(idx)}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between gap-3">
          <div>
            {!isReadOnly && runbook && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Confirm delete?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(runbook.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3.5 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>Delete Runbook</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-3">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Save SOP Runbook
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
