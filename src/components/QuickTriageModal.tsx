import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  Terminal, 
  Zap, 
  Plus, 
  BookOpen, 
  Check, 
  Clock, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { Task, Runbook, PriorityLevel, ITCategory, EnvironmentType } from '../types';

interface QuickTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (task: Task) => void;
  onGenerateRunbook: (runbookData: Partial<Runbook>) => void;
}

export const QuickTriageModal: React.FC<QuickTriageModalProps> = ({
  isOpen,
  onClose,
  onCreateTask,
  onGenerateRunbook,
}) => {
  const [rawText, setRawText] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [environment, setEnvironment] = useState<EnvironmentType>('Production');
  const [affectedEstimate, setAffectedEstimate] = useState<number>(5000);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTicketNumber(`INC-${Math.floor(1000 + Math.random() * 9000)}`);
    } else {
      setResult(null);
      setError(null);
      setRawText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!rawText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/classify-priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: rawText.split('\n')[0].slice(0, 100) || 'Incident Triage',
          description: rawText,
          rawLogs: rawText,
          environment,
          affectedUsers: affectedEstimate,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI triage server error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to triage snippet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTaskFromTriage = () => {
    if (!result) return;

    const finalTicketNumber = ticketNumber.trim() || `INC-${Date.now().toString().slice(-4)}`;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      ticketNumber: finalTicketNumber,
      title: rawText.split('\n')[0].slice(0, 120) || 'Production Alert Incident',
      description: rawText,
      rawLogs: rawText,
      status: 'investigating',
      priority: (result.priority as PriorityLevel) || 'P2',
      priorityRationale: result.priorityRationale || 'AI Auto-Triage based on error log patterns.',
      automatedTags: result.automatedTags || ['ai-triage'],
      manualTags: [],
      category: (result.category as ITCategory) || 'DevOps & SRE',
      environment,
      impactScore: result.impactScore || 7,
      urgencyScore: result.urgencyScore || 7,
      affectedUsersEstimate: affectedEstimate,
      assignee: {
        name: 'On-Call SRE',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: 'Incident Responder',
        email: 'oncall@internal.corp',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + (result.recommendedSlaHours || 4) * 60 * 60 * 1000).toISOString(),
      slaHours: result.recommendedSlaHours || 4,
      checklist: (result.suggestedChecklist || []).map((item: any, i: number) => ({
        id: `chk-${Date.now()}-${i}`,
        text: item.text,
        command: item.command,
        done: false,
      })),
      isAutoTagged: true,
    };

    onCreateTask(newTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                AI Fast Incident Triage & Priority Classifier
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Paste error logs, Prometheus alert JSON, or stack trace for instant priority tagging and SOP recommendation.
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

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Paste Raw Error Log, Stack Trace, or Alert Snippet *</span>
            </label>
            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder={`Example:
2026-09-01 08:14:22 [FATAL] Database connection timeout: remaining connection slots are reserved for non-replication superuser connections
at pool.getConnection (/app/node_modules/pg-pool/index.js:52)`}
            />
          </div>

          {/* Context selectors */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Target Environment:</span>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="DR / Failover">DR / Failover</option>
                <option value="Corporate LAN">Corporate LAN</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Estimated Affected Users:</span>
              <input
                type="number"
                value={affectedEstimate}
                onChange={(e) => setAffectedEstimate(Number(e.target.value))}
                className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading || !rawText.trim()}
              className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzing Log with AI...' : 'Analyze & Classify'}</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* AI Result Card */}
          {result && (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-5 space-y-4 shadow-xs animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-bold border ${
                      result.priority === 'P1'
                        ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 animate-pulse'
                        : result.priority === 'P2'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                    }`}
                  >
                    {result.priority}
                  </span>
                  <span className="text-xs font-mono text-indigo-700 dark:text-indigo-300 font-bold">
                    SLA Target: {result.recommendedSlaHours} Hours
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {result.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span>Impact: {result.impactScore}/10</span>
                  <span>•</span>
                  <span>Urgency: {result.urgencyScore}/10</span>
                </div>
              </div>

              {/* Rationale */}
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  ITIL / SRE Triage Rationale:
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">{result.priorityRationale}</p>
              </div>

              {/* Potential Root Cause Hint */}
              {result.potentialRootCauseHint && (
                <div className="bg-white dark:bg-slate-800/90 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-1">
                    Root Cause Hypothesis:
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">{result.potentialRootCauseHint}</p>
                </div>
              )}

              {/* Automated Tags */}
              {result.automatedTags && (
                <div>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Extracted Tags:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.automatedTags.map((tag: string, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/60"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Remediation Checklist */}
              {result.suggestedChecklist && result.suggestedChecklist.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Immediate Action Checklist & CLI Commands:
                  </span>
                  <div className="space-y-1.5">
                    {result.suggestedChecklist.map((chk: any, i: number) => (
                      <div key={i} className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="font-medium text-slate-800 dark:text-slate-200 mb-1">{chk.text}</div>
                        {chk.command && (
                          <div className="font-mono text-[11px] text-emerald-400 bg-slate-950 p-1.5 rounded border border-slate-800">
                            $ {chk.command}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions & Ticket Number Input */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/60">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Ticket #:
                  </label>
                  <input
                    type="text"
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    placeholder="e.g. INC-2045 or JIRA-100"
                    className="w-40 sm:w-48 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateTaskFromTriage}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Kanban Task</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
