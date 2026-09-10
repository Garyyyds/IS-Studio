import React, { useState } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Check, 
  Clock, 
  Tag, 
  Play, 
  ShieldAlert, 
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { TaggingRule, PriorityLevel, ITCategory } from '../types';
import { evaluateTaskPriorityWithRules } from '../utils/priorityEngine';

interface PriorityRulesManagerProps {
  rules: TaggingRule[];
  onSaveRules: (updatedRules: TaggingRule[]) => void;
  onRunBatchScan: () => void;
  isScanning?: boolean;
}

const PRESET_TEST_CASES = [
  {
    label: 'P1 Outage: DB Connection Exhaustion',
    badge: 'P1 Outage',
    badgeClass: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
    text: 'FATAL: remaining connection slots are reserved for non-replication superuser connections in production billing cluster',
    env: 'Production' as const,
    affected: 15000,
  },
  {
    label: 'P2 High: Memory Spike / OOM Warning',
    badge: 'P2 High',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    text: 'WARN [WorkerPool]: Container memory usage exceeded 92% threshold; potential OOM crash loop impending',
    env: 'Production' as const,
    affected: 3500,
  },
  {
    label: 'P3 Medium: Expiring TLS Certificate',
    badge: 'P3 Medium',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
    text: 'Notice: SSL certificate for api.internal.infra expires in 5 days. Renewal needed before Friday.',
    env: 'Staging' as const,
    affected: 0,
  },
  {
    label: 'P4 Low: Minor Staging CSS Typo',
    badge: 'P4 Low',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    text: 'Minor typo in staging admin navigation banner. Please fix before next weekly release.',
    env: 'Staging' as const,
    affected: 0,
  },
];

export const PriorityRulesManager: React.FC<PriorityRulesManagerProps> = ({
  rules,
  onSaveRules,
  onRunBatchScan,
  isScanning = false,
}) => {
  const [testText, setTestText] = useState('FATAL: remaining connection slots are reserved for non-replication superuser connections in production billing cluster');
  const [testEnv, setTestEnv] = useState<'Production' | 'Staging'>('Production');
  const [testAffected, setTestAffected] = useState<number>(10000);
  const [isTestingSandbox, setIsTestingSandbox] = useState(false);
  const [lastTestedTime, setLastTestedTime] = useState<string | null>(null);

  // New Rule State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState<TaggingRule>({
    id: `rule-${Date.now()}`,
    name: '',
    matchType: 'keyword',
    pattern: '',
    targetPriority: 'P2',
    tagsToApply: ['auto-triage'],
    slaHours: 4,
    category: 'DevOps & SRE',
    enabled: true,
    description: '',
  });
  const [newTagInput, setNewTagInput] = useState('');

  // Live test result
  const testResult = evaluateTaskPriorityWithRules(
    {
      title: 'Sample Incident Evaluation',
      description: testText,
      environment: testEnv,
      affectedUsersEstimate: testAffected,
    },
    rules
  );

  // Find specifically which rules matched this test input
  const activeRules = rules.filter((r) => r.enabled);
  const combinedTestString = `${testText}`.toLowerCase();
  const matchedRules = activeRules.filter((rule) => {
    if (rule.matchType === 'keyword') {
      const keywords = rule.pattern.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
      return keywords.some((kw) => combinedTestString.includes(kw));
    } else if (rule.matchType === 'regex') {
      try {
        const re = new RegExp(rule.pattern, 'i');
        return re.test(combinedTestString);
      } catch {
        return false;
      }
    } else if (rule.matchType === 'environment') {
      return testEnv.toLowerCase() === rule.pattern.toLowerCase();
    }
    return false;
  });

  const handleRunSandboxTest = () => {
    setIsTestingSandbox(true);
    setTimeout(() => {
      setIsTestingSandbox(false);
      setLastTestedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 220);
  };

  const handleLoadPreset = (preset: typeof PRESET_TEST_CASES[0]) => {
    setTestText(preset.text);
    setTestEnv(preset.env);
    setTestAffected(preset.affected);
    setIsTestingSandbox(true);
    setTimeout(() => {
      setIsTestingSandbox(false);
      setLastTestedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 220);
  };

  const handleClearSandbox = () => {
    setTestText('');
    setTestAffected(0);
    setLastTestedTime(null);
  };

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    onSaveRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    onSaveRules(updated);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name || !newRule.pattern) return;

    onSaveRules([...rules, newRule]);
    setShowAddModal(false);
    setNewRule({
      id: `rule-${Date.now()}`,
      name: '',
      matchType: 'keyword',
      pattern: '',
      targetPriority: 'P2',
      tagsToApply: ['auto-triage'],
      slaHours: 4,
      category: 'DevOps & SRE',
      enabled: true,
      description: '',
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Automated Priority Tagging & SLA Rules Engine
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-mono font-bold">
              {rules.filter((r) => r.enabled).length} Active Rules
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Automatically evaluates incoming tickets and logs for severity keywords, CVE patterns, cluster health deviations, and SLA response targets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRunBatchScan}
            disabled={isScanning}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <Zap className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning All Tasks...' : 'Run Auto-Tagging Scan'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Rule</span>
          </button>
        </div>
      </div>

      {/* Live Sandbox & Rule Evaluation Tester */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-600 dark:text-indigo-400 fill-indigo-600 dark:fill-indigo-400" />
              <span>Rule Evaluation Sandbox</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simulate how raw incident logs, alert messages, and environment contexts are evaluated by your active triage rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {lastTestedTime && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Last tested {lastTestedTime}</span>
              </span>
            )}
            <button
              onClick={handleRunSandboxTest}
              disabled={isTestingSandbox || !testText.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isTestingSandbox ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating Rules...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Test in Sandbox</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preset Sample Alerts */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Load Preset Sample:</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TEST_CASES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleLoadPreset(preset)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                <span className={`px-1 py-0.2 rounded text-[9px] font-bold border ${preset.badgeClass}`}>
                  {preset.badge}
                </span>
                <span className="truncate max-w-[180px] sm:max-w-none">{preset.label.split(':')[1]?.trim() || preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">
          {/* Input text & Controls */}
          <div className="lg:col-span-2 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Incident Payload, Alert Body, or Raw Log Snippet
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {testText.length} chars
                </span>
              </div>
              <textarea
                rows={4}
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 shadow-inner"
                placeholder="Type or paste incident title, alert body, or server error log..."
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Target Environment:</span>
                  <select
                    value={testEnv}
                    onChange={(e) => setTestEnv(e.target.value as any)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 font-medium cursor-pointer focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Estimated Affected Users:</span>
                  <input
                    type="number"
                    min={0}
                    value={testAffected}
                    onChange={(e) => setTestAffected(Number(e.target.value))}
                    className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Action Buttons under Input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearSandbox}
                  disabled={!testText && testAffected === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleRunSandboxTest}
                  disabled={isTestingSandbox || !testText.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Run Sandbox Test</span>
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Match Output */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Evaluation Output
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    matchedRules.length > 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${matchedRules.length > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <span>{matchedRules.length > 0 ? `${matchedRules.length} Rule${matchedRules.length > 1 ? 's' : ''} Matched` : 'Default Baseline'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Calculated Priority:</span>
                <span
                  className={`px-3 py-1 rounded-md text-xs font-bold border shadow-xs ${
                    testResult.priority === 'P1'
                      ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900 animate-pulse'
                      : testResult.priority === 'P2'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                      : testResult.priority === 'P3'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                  }`}
                >
                  {testResult.priority} Severity
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Target SLA:</span>
                <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
                  {testResult.slaHours} Hours
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Category:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">{testResult.category}</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-medium">Automated Tags:</span>
                <div className="flex flex-wrap gap-1">
                  {testResult.automatedTags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Matched Rules Specific Breakdown */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Matched Active Rule(s):
                </span>
                {matchedRules.length > 0 ? (
                  <div className="space-y-1.5">
                    {matchedRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="text-[11px] p-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-between gap-1"
                      >
                        <span className="font-medium text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">{rule.name}</span>
                        </span>
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
                          {rule.targetPriority}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-white/60 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>No specific custom rule matched. System baseline heuristics applied.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                Evaluation Rationale:
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {testResult.priorityRationale}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
            Configured Tagging & Triage Rules ({rules.length})
          </h3>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {rules.map((rule) => (
            <div key={rule.id} className="p-4 sm:p-5 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-[300px]">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{rule.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      rule.targetPriority === 'P1'
                        ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                        : rule.targetPriority === 'P2'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900'
                    }`}
                  >
                    Sets {rule.targetPriority}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    SLA: {rule.slaHours}h
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">{rule.description}</p>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="font-mono text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                    Pattern: {rule.pattern}
                  </span>
                  <span className="text-slate-400 dark:text-slate-600">•</span>
                  <div className="flex flex-wrap gap-1">
                    {rule.tagsToApply.map((t, i) => (
                      <span key={i} className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    rule.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </button>

                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/60 text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  title="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Custom Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Create Automated Priority Rule</h3>

            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                  placeholder="e.g., Redis Connection Refused Auto-P2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Priority</label>
                  <select
                    value={newRule.targetPriority}
                    onChange={(e) => setNewRule({ ...newRule, targetPriority: e.target.value as PriorityLevel })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="P1">P1 - Critical (Outage)</option>
                    <option value="P2">P2 - High (Degraded)</option>
                    <option value="P3">P3 - Medium (Minor)</option>
                    <option value="P4">P4 - Low (Routine)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">SLA Target (Hours)</label>
                  <input
                    type="number"
                    value={newRule.slaHours}
                    onChange={(e) => setNewRule({ ...newRule, slaHours: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Match Keywords (comma separated) *</label>
                <input
                  type="text"
                  required
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                  placeholder="redis connection refused, WRONGTYPE, maxmemory"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description / Rationale</label>
                <textarea
                  rows={2}
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900"
                  placeholder="Technical justification for this rule..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
