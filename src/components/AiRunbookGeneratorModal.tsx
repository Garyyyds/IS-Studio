import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  BookOpen, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Runbook, Task, ITCategory, EnvironmentType } from '../types';

interface AiRunbookGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunbookGenerated: (runbook: Runbook) => void;
  initialTask?: Task | null;
}

const QUICK_PROMPT_PRESETS = [
  {
    title: 'Connection failure to fileshare (\\\\hq-file01)',
    category: 'Networking' as ITCategory,
    environment: 'Corporate LAN' as EnvironmentType,
    description: 'Workstation cannot connect to \\\\hq-file01 fileshare or map drive Z:. Need DNS verification and adapter DHCP reset.',
    logs: 'ping: could not find host hq-file01\nError 0x80070035: The network path was not found.',
  },
  {
    title: 'PostgreSQL Connection Pool Exhaustion & Deadlocks',
    category: 'Database' as ITCategory,
    environment: 'Production' as EnvironmentType,
    description: 'PgBouncer connection queue full, pg_stat_activity shows idle in transaction queries blocking table locks.',
    logs: 'FATAL: remaining connection slots are reserved for non-replication superuser connections',
  },
  {
    title: 'Kubernetes Pod CrashLoopBackOff & Exit 137 OOMKilled',
    category: 'DevOps & SRE' as ITCategory,
    environment: 'Production' as EnvironmentType,
    description: 'Container killed by Linux cgroup OOM killer due to memory spikes during load.',
    logs: 'Last State: Terminated, Reason: OOMKilled, Exit Code: 137',
  },
];

export const AiRunbookGeneratorModal: React.FC<AiRunbookGeneratorModalProps> = ({
  isOpen,
  onClose,
  onRunbookGenerated,
  initialTask,
}) => {
  const [incidentTitle, setIncidentTitle] = useState(initialTask?.title || '');
  const [incidentDescription, setIncidentDescription] = useState(initialTask?.description || '');
  const [rawLogs, setRawLogs] = useState(initialTask?.rawLogs || '');
  const [category, setCategory] = useState<ITCategory>(initialTask?.category || 'Networking');
  const [environment, setEnvironment] = useState<EnvironmentType>(initialTask?.environment || 'Corporate LAN');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setIncidentTitle(initialTask?.title || '');
      setIncidentDescription(initialTask?.description || '');
      setRawLogs(initialTask?.rawLogs || '');
      setCategory(initialTask?.category || 'Networking');
      setEnvironment(initialTask?.environment || 'Corporate LAN');
      setError(null);
    }
  }, [initialTask, isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (p: typeof QUICK_PROMPT_PRESETS[0]) => {
    setIncidentTitle(p.title);
    setCategory(p.category);
    setEnvironment(p.environment);
    setIncidentDescription(p.description);
    setRawLogs(p.logs);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTitle.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/generate-runbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentTitle,
          incidentDescription,
          rawLogs,
          category,
          environment,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI generation returned ${response.status}`);
      }

      const generatedData = await response.json();

      const newRunbook: Runbook = {
        id: `runbook-${Date.now()}`,
        code: generatedData.code || `SOP-${category.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        title: generatedData.title || incidentTitle,
        category: (generatedData.category as ITCategory) || category,
        environment,
        lastUpdated: new Date().toISOString().slice(0, 10),
        author: 'AI SRE Assistant (Reviewed by Lead)',
        authorRole: 'Infrastructure & Operations Engine',
        version: '1.0.0',
        status: 'active',
        symptom: generatedData.symptom || incidentDescription,
        triggerAlertPatterns: generatedData.triggerAlertPatterns || [incidentTitle],
        rootCauseAnalysis: generatedData.rootCauseAnalysis || 'Automated RCA from incident logs and architectural topology.',
        diagnosticSteps: generatedData.diagnosticSteps || [
          { title: 'Test Network & Host Connectivity', cli: 'ping hq-file01', explanation: 'Verify ICMP echo reply from destination server', shellType: 'general' },
        ],
        remediationSteps: generatedData.remediationSteps || [
          { stepNumber: 1, title: 'Execute Remediation', instruction: 'Perform step verification.', command: 'ipconfig /flushdns', dangerous: false, verification: 'Verify error resolves' },
        ],
        rollbackPlan: generatedData.rollbackPlan || 'Restore previous network configuration or restart service.',
        postMortemChecklist: generatedData.postMortemChecklist || ['Review DNS server configuration on DHCP scopes', 'Ensure Group Policy drive mappings are active'],
        relatedTaskIds: initialTask ? [initialTask.id] : [],
        tags: generatedData.tags || ['ai-generated', 'sop', category.toLowerCase()],
      };

      onRunbookGenerated(newRunbook);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate runbook with AI.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                AI Issue-Solution SOP Runbook Generator
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Transforms any incident, log output, or error scenario into an authoritative team runbook.
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
        <form onSubmit={handleGenerate} className="p-4 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          
          {/* Quick Preset Chips */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Quick Suggestions:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPT_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 transition text-left cursor-pointer"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
              Issue / Incident Summary *
            </label>
            <input
              type="text"
              required
              value={incidentTitle}
              onChange={(e) => setIncidentTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
              placeholder="e.g. Connection failure to fileshare (\\hq-file01)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ITCategory)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
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
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
              >
                <option value="Corporate LAN">Corporate LAN</option>
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="DR / Failover">DR / Failover</option>
              </select>
            </div>

          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
              Incident Context & Symptoms
            </label>
            <textarea
              rows={3}
              value={incidentDescription}
              onChange={(e) => setIncidentDescription(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
              placeholder="Describe what occurred, impact on users, and how the alert surfaced..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Optional Error Logs / Diagnostic Traces</span>
            </label>
            <textarea
              rows={4}
              value={rawLogs}
              onChange={(e) => setRawLogs(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder="Paste terminal outputs or error dumps to generate tailored CLI diagnostic commands..."
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !incidentTitle.trim()}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Generating Full SOP Runbook...' : 'Generate & Add to Handbook'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
