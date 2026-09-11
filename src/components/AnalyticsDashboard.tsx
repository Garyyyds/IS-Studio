import React from 'react';
import { 
  Activity, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  BookOpen, 
  Zap, 
  TrendingUp, 
  CheckCircle2,
  Server,
  Layers,
  ArrowRight,
  Database,
  Cloud,
  Network,
  Cpu,
  Terminal
} from 'lucide-react';
import { Task, Runbook, TaggingRule, ITCategory } from '../types';

interface AnalyticsDashboardProps {
  tasks: Task[];
  runbooks: Runbook[];
  rules: TaggingRule[];
  onOpenRunbook: (id: string) => void;
}

const ALL_CATEGORIES: ITCategory[] = [
  'DevOps & SRE',
  'Database',
  'Cloud Infra',
  'Security & IAM',
  'Networking',
  'SysAdmin',
  'Application'
];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  tasks,
  runbooks,
  rules,
  onOpenRunbook,
}) => {
  // Status stats
  const resolvedCount = tasks.filter((t) => t.status === 'done').length;

  const totalActive = tasks.filter((t) => t.status !== 'done').length;
  const totalTasks = tasks.length || 1;
  const completionRate = Math.round((resolvedCount / totalTasks) * 100);

  // Priority counts
  const p1Count = tasks.filter((t) => t.priority === 'P1').length;
  const p2Count = tasks.filter((t) => t.priority === 'P2').length;
  const p3Count = tasks.filter((t) => t.priority === 'P3').length;
  const p4Count = tasks.filter((t) => t.priority === 'P4').length;

  // Status breakdown
  const statusCounts = {
    backlog: tasks.filter(t => t.status === 'backlog').length,
    investigating: tasks.filter(t => t.status === 'investigating').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    testing: tasks.filter(t => t.status === 'testing').length,
    done: resolvedCount,
  };

  // Runbook coverage
  const tasksWithRunbook = tasks.filter((t) => t.linkedRunbookId).length;
  const runbookCoveragePct = tasks.length > 0 ? Math.round((tasksWithRunbook / tasks.length) * 100) : 0;

  // Category counts with guaranteed entries to maintain perfect visual symmetry
  const categoryCounts: Record<string, number> = {};
  ALL_CATEGORIES.forEach(cat => {
    categoryCounts[cat] = 0;
  });
  tasks.forEach((t) => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        {/* Top Balanced Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Workstation Telemetry & Analytics
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Symmetrical overview of task resolution velocity, priority distribution, handbook coverage, and domain allocations.
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">{totalActive} Active</span>
            <span className="text-slate-400 dark:text-slate-500">|</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{resolvedCount} Done</span>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards - Grid with Equalized Height and Visual Anchor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Resolution Velocity */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Completion Rate
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-mono font-extrabold text-slate-900 dark:text-slate-100">{completionRate}%</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{resolvedCount}/{tasks.length} tasks</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        {/* Metric 2: Urgent Workload (P1 / P2) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                High Priority (P1/P2)
              </span>
              <AlertTriangle className={`w-4 h-4 ${p1Count > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-mono font-extrabold text-slate-900 dark:text-slate-100">{p1Count + p2Count}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">({p1Count} P1, {p2Count} P2)</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3">
            <div className="bg-red-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${((p1Count + p2Count) / totalTasks) * 100}%` }} />
          </div>
        </div>

        {/* Metric 3: Runbook SOP Coverage */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Handbook Playbooks
              </span>
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{runbookCoveragePct}%</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{runbooks.length} SOPs authored</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3">
            <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${runbookCoveragePct}%` }} />
          </div>
        </div>

        {/* Metric 4: Auto-Triage Rules */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Automated Rules
              </span>
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-mono font-extrabold text-amber-600 dark:text-amber-400">
                {tasks.filter((t) => t.isAutoTagged).length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">of {tasks.length} tagged</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3">
            <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(tasks.filter((t) => t.isAutoTagged).length / totalTasks) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Symmetrical Dual Panel Layout (Both sides have balanced structure and equal visual weight) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Panel: Priority Distribution & Workflow Status */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Priority Distribution</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-medium">Total: {tasks.length} Tasks</span>
            </div>

            <div className="space-y-3.5">
              {/* P1 Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-red-700 dark:text-red-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500" />
                    <span>P1 · Critical Outage</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{p1Count}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${tasks.length ? (p1Count / tasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* P2 Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>P2 · High Impact</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{p2Count}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${tasks.length ? (p2Count / tasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* P3 Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500" />
                    <span>P3 · Standard / Normal</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{p3Count}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${tasks.length ? (p3Count / tasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* P4 Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                    <span>P4 · Routine / Backlog</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{p4Count}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-slate-400 dark:bg-slate-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${tasks.length ? (p4Count / tasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Stage Balanced Summary Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              Workflow Stage Breakdown
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-lg p-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Backlog</span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{statusCounts.backlog}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-lg p-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Investig.</span>
                <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">{statusCounts.investigating}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-lg p-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Active</span>
                <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-400">{statusCounts.in_progress}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-lg p-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Blocked</span>
                <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400">{statusCounts.blocked}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-lg p-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Testing</span>
                <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-400">{statusCounts.testing}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-lg p-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Done</span>
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">{statusCounts.done}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Infrastructure Domains Grid (Even 2x3 Grid with stable heights) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Domain & Technology Allocations</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-medium">{ALL_CATEGORIES.length} Domains</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {ALL_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat] || 0;
                return (
                  <div 
                    key={cat} 
                    className={`rounded-xl p-3 border transition ${
                      count > 0 
                        ? 'bg-slate-50/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600' 
                        : 'bg-slate-50/30 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50 opacity-60'
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block truncate" title={cat}>
                      {cat}
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="text-lg font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{count}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">tasks</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Handbook Link Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Verified SOP Handbook</span>
            <span className="font-mono text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
              {runbooks.length} Active Procedures
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
