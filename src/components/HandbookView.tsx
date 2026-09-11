import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Sparkles, 
  FileDown, 
  Terminal, 
  AlertTriangle, 
  Check, 
  Copy, 
  Edit3, 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  Lock
} from 'lucide-react';
import { Runbook, ITCategory, UserRole } from '../types';
import { exportRunbookToPdf } from '../utils/pdfExport';

interface HandbookViewProps {
  runbooks: Runbook[];
  onOpenEditor: (runbook?: Runbook) => void;
  onDeleteRunbook: (id: string) => void;
  onOpenAiGenerator: () => void;
  onExportFullHandbook: () => void;
  userRole?: UserRole;
}

export const HandbookView: React.FC<HandbookViewProps> = ({
  runbooks,
  onOpenEditor,
  onDeleteRunbook,
  onOpenAiGenerator,
  onExportFullHandbook,
  userRole,
}) => {
  const isReadOnly = userRole === 'user';
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedRunbookId, setExpandedRunbookId] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState<string | null>(null);
  const [runbookToDelete, setRunbookToDelete] = useState<Runbook | null>(null);

  const categories = [
    'ALL',
    'Networking',
    'SysAdmin',
    'Database',
    'DevOps & SRE',
    'Cloud Infra',
    'Security & IAM',
    'Application',
  ];

  const filteredRunbooks = runbooks.filter((rb) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = rb.title.toLowerCase().includes(q);
      const matchCode = rb.code.toLowerCase().includes(q);
      const matchSymptom = rb.symptom.toLowerCase().includes(q);
      const matchRca = rb.rootCauseAnalysis.toLowerCase().includes(q);
      const matchTags = rb.tags.some((t) => t.toLowerCase().includes(q));
      const matchCli = rb.diagnosticSteps.some((d) => d.cli.toLowerCase().includes(q)) ||
        rb.remediationSteps.some((r) => (r.command || '').toLowerCase().includes(q));
      if (!matchTitle && !matchCode && !matchSymptom && !matchRca && !matchTags && !matchCli) {
        return false;
      }
    }

    // Category
    if (selectedCategory !== 'ALL' && rb.category !== selectedCategory) {
      return false;
    }

    return true;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCli(id);
    setTimeout(() => setCopiedCli(null), 2000);
  };

  const handleExportSinglePdf = (rb: Runbook, e: React.MouseEvent) => {
    e.stopPropagation();
    exportRunbookToPdf(rb);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-screen-2xl mx-auto">
        {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              IT Issue-Solution Handbook & SOP Runbooks
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-mono font-bold">
              {runbooks.length} Active Procedures
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Authoritative troubleshooting playbooks, root cause analyses (RCA), CLI triage scripts, and remediation procedures. Export directly to team-ready PDF documentation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isReadOnly && (
            <span className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Read-Only SOP Mode</span>
            </span>
          )}

          {!isReadOnly && (
            <button
              onClick={onOpenAiGenerator}
              className="px-3.5 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>AI Generate SOP</span>
            </button>
          )}

          <button
            onClick={onExportFullHandbook}
            className="px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Export complete runbook catalog into a compiled PDF manual"
          >
            <FileDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Export Full Handbook PDF</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={() => onOpenEditor()}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Write New Runbook</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative min-w-[280px] max-w-md flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search symptoms, CLI commands, codes (e.g. SOP-NET-004, fileshare, ping)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
          />
        </div>

        {/* Categories Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Runbook Items List */}
      <div className="space-y-4">
        {filteredRunbooks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 dark:text-slate-500">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No runbooks match your search criteria.</p>
          </div>
        ) : (
          filteredRunbooks.map((rb) => {
            const isExpanded = expandedRunbookId === rb.id;

            return (
              <div
                key={rb.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                {/* Runbook Header Card */}
                <div
                  onClick={() => setExpandedRunbookId(isExpanded ? null : rb.id)}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-[300px]">
                    <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                      {rb.code}
                    </span>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{rb.title}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{rb.category}</span>
                        <span>•</span>
                        <span>{rb.environment}</span>
                        <span>•</span>
                        <span>v{rb.version}</span>
                        <span>•</span>
                        <span>Updated: {rb.lastUpdated}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleExportSinglePdf(rb, e)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      title="Export single SOP runbook to PDF"
                    >
                      <FileDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Export SOP PDF</span>
                    </button>

                    <button
                      onClick={() => onOpenEditor(rb)}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 text-xs transition cursor-pointer"
                      title={isReadOnly ? "View Runbook Details" : "Edit Runbook"}
                    >
                      {isReadOnly ? <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Edit3 className="w-4 h-4" />}
                    </button>

                    {!isReadOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRunbookToDelete(rb);
                        }}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-500 hover:text-red-700 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 text-xs transition cursor-pointer"
                        title="Delete Runbook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedRunbookId(isExpanded ? null : rb.id)}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Detailed Runbook Content */}
                {isExpanded && (
                  <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-6">
                    {/* 1. Symptoms & Trigger Alerts */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>1. Observable Symptoms & Trigger Patterns</span>
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">{rb.symptom}</p>

                      {rb.triggerAlertPatterns && rb.triggerAlertPatterns.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Matched Alert Payloads:
                          </span>
                          <div className="space-y-1">
                            {rb.triggerAlertPatterns.map((pat, i) => (
                              <div
                                key={i}
                                className="font-mono text-[11px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded border border-red-200 dark:border-red-800"
                              >
                                {pat}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Root Cause Analysis (RCA) */}
                    {rb.rootCauseAnalysis && (
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-2">
                          2. Root Cause Analysis (RCA)
                        </h4>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{rb.rootCauseAnalysis}</p>
                      </div>
                    )}

                    {/* 3. Diagnostic Workflow CLI */}
                    {rb.diagnosticSteps && rb.diagnosticSteps.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>3. Diagnostic Triage & Live Inspection Commands</span>
                        </h4>

                        <div className="space-y-3">
                          {rb.diagnosticSteps.map((diag, index) => (
                            <div key={index} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  3.{index + 1} {diag.title}
                                </span>
                                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
                                  {diag.shellType}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-2.5">{diag.explanation}</p>

                              {/* Terminal Command Box */}
                              <div className="flex items-center justify-between bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-xs text-emerald-400">
                                <span className="overflow-x-auto whitespace-pre">$ {diag.cli}</span>
                                <button
                                  onClick={() => handleCopy(diag.cli, `diag-${rb.id}-${index}`)}
                                  className="ml-3 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0 cursor-pointer"
                                  title="Copy command to clipboard"
                                >
                                  {copiedCli === `diag-${rb.id}-${index}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Remediation Steps */}
                    {rb.remediationSteps && rb.remediationSteps.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>4. Step-by-Step Remediation Workflow</span>
                        </h4>

                        <div className="space-y-3">
                          {rb.remediationSteps.map((step) => (
                            <div
                              key={step.stepNumber}
                              className={`rounded-xl p-4 border shadow-2xs ${
                                step.dangerous
                                  ? 'bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  Step {step.stepNumber}: {step.title}
                                </span>
                                {step.dangerous && (
                                  <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 text-[10px] font-bold">
                                    ⚠️ High-Risk Action
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line mb-2.5">{step.instruction}</p>

                              {step.command && (
                                <div className="flex items-center justify-between bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-xs text-emerald-400 mb-2.5">
                                  <span className="overflow-x-auto whitespace-pre">$ {step.command}</span>
                                  <button
                                    onClick={() => handleCopy(step.command!, `rem-${rb.id}-${step.stepNumber}`)}
                                    className="ml-3 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0 cursor-pointer"
                                    title="Copy command to clipboard"
                                  >
                                    {copiedCli === `rem-${rb.id}-${step.stepNumber}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              )}

                              <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">
                                <span className="text-slate-500 dark:text-slate-400 font-normal">Verification: </span>
                                {step.verification}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. Rollback & Post-Mortem */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rb.rollbackPlan && (
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                          <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide mb-1.5">
                            5. Rollback & Safeguard Protocol
                          </h4>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{rb.rollbackPlan}</p>
                        </div>
                      )}

                      {rb.postMortemChecklist && rb.postMortemChecklist.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1.5">
                            6. Post-Mortem Preventive Actions
                          </h4>
                          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                            {rb.postMortemChecklist.map((item, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-indigo-600 dark:text-indigo-400 shrink-0">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Expanded Action Bar */}
                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 gap-3">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Author: <span className="font-semibold text-slate-700 dark:text-slate-300">{rb.author}</span> ({rb.authorRole})
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenEditor(rb)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Procedure</span>
                        </button>
                        <button
                          onClick={(e) => handleExportSinglePdf(rb, e)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Export PDF</span>
                        </button>
                        <button
                          onClick={() => setRunbookToDelete(rb)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          <span>Delete SOP</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* In-App Delete Confirmation Modal (Reliable in iFrame sandboxes) */}
      {runbookToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                onClick={() => setRunbookToDelete(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Delete SOP Runbook?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Are you sure you want to delete <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{runbookToDelete.code}</span> (
                <span className="font-medium text-slate-800 dark:text-slate-200">{runbookToDelete.title}</span>)?
              </p>
              <p className="text-[11px] text-red-600 dark:text-red-400 mt-2 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200/60 dark:border-red-900/40">
                ⚠️ This action cannot be undone. Any linked incidents will detach from this runbook.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRunbookToDelete(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = runbookToDelete.id;
                  setRunbookToDelete(null);
                  if (expandedRunbookId === idToDelete) {
                    setExpandedRunbookId(null);
                  }
                  onDeleteRunbook(idToDelete);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
