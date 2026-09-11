import React, { useState } from 'react';
import { ArrowLeft, FileDown, KeyRound, AlertTriangle, Loader2 } from 'lucide-react';
import { AppUser, UserIdFormData } from '../types';
import {
  exportUserIdFormPdf,
  SERVER_REQUEST_ROWS,
  NATURE_OF_REQUEST_ROWS,
  NATURE_OF_REQUEST_LABEL,
  USER_ID_SECTION_A_TITLE,
  USER_ID_SECTION_B_TITLE,
  USER_ID_SIGNATURE_LABELS,
} from '../utils/userIdFormPdf';

interface UserIdFormViewProps {
  currentUser: AppUser;
  onBack: () => void;
}

export const UserIdFormView: React.FC<UserIdFormViewProps> = ({ currentUser, onBack }) => {
  // Annotated separately rather than as useState<UserIdFormData>(...): a type
  // argument on useState widens the target to a union, which stops TypeScript
  // reporting missing or misspelled fields in this object.
  const initialForm: UserIdFormData = {
    employeeId: '',
    phoneExt: '',
    submittedBy: currentUser.name || '',
    requestDate: new Date().toISOString().slice(0, 10),
    department: currentUser.department || '',
    location: '',
    systems: {},
    othersDetail: '',
    natureOfRequest: '',
  };

  const [form, setForm] = useState(initialForm);

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSystem = (id: string, checked: boolean) => {
    setForm((prev) => ({ ...prev, systems: { ...prev.systems, [id]: checked } }));
  };

  const setField = (field: 'employeeId' | 'phoneExt' | 'submittedBy' | 'requestDate' | 'department' | 'location', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Single-select: ticking one option clears the rest, and re-ticking the
  // current choice clears it so nothing is stuck selected.
  const selectNature = (id: string, checked: boolean) => {
    setForm((prev) => ({ ...prev, natureOfRequest: checked ? id : '' }));
  };

  const handleExport = async () => {
    const anyTicked = Object.values(form.systems).some(Boolean);
    if (!anyTicked) {
      setError('Select at least one system under Section B before exporting.');
      return;
    }

    setError(null);
    setIsExporting(true);
    try {
      await exportUserIdFormPdf(form);
    } catch (err: any) {
      setError(err?.message || 'Could not generate the PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2 rounded-lg text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>User ID Requisition</span>
          </h2>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">
            Fill in and export as PDF for signing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-xs transition-colors"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            <span>{isExporting ? 'Generating...' : 'Export to PDF'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
        </div>
      )}

      {/* SECTION A */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {USER_ID_SECTION_A_TITLE}
          </h3>
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Employee ID
            </label>
            <input
              type="text"
              value={form.employeeId}
              onChange={(e) => setField('employeeId', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Phone/Ext
            </label>
            <input
              type="text"
              value={form.phoneExt}
              onChange={(e) => setField('phoneExt', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Submitted By <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.submittedBy}
              onChange={(e) => setField('submittedBy', e.target.value)}
              placeholder="Full name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Request Date
            </label>
            <input
              type="date"
              value={form.requestDate}
              onChange={(e) => setField('requestDate', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Department
            </label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setField('department', e.target.value)}
              placeholder="e.g. Finance"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* SECTION B */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {USER_ID_SECTION_B_TITLE}
          </h3>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            {SERVER_REQUEST_ROWS.flat().map((cell) => (
              <div key={cell.id} className="flex items-center gap-2 min-w-0">
                <input
                  id={`sys-${cell.id}`}
                  type="checkbox"
                  checked={form.systems[cell.id] ?? false}
                  onChange={(e) => toggleSystem(cell.id, e.target.checked)}
                  className="w-4 h-4 shrink-0 rounded-sm border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                />
                <label
                  htmlFor={`sys-${cell.id}`}
                  className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap"
                >
                  {cell.label}
                </label>

                {cell.freeText && (
                  <input
                    type="text"
                    value={form.othersDetail}
                    onChange={(e) => setForm((prev) => ({ ...prev, othersDetail: e.target.value }))}
                    aria-label="Others detail"
                    className="flex-1 min-w-0 px-2 py-1 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Nature of request - only one may be chosen */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-3">
              {NATURE_OF_REQUEST_LABEL}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
              {NATURE_OF_REQUEST_ROWS.flat().map((cell) => (
                <div key={cell.id} className="flex items-center gap-2 min-w-0">
                  <input
                    id={`nature-${cell.id}`}
                    type="checkbox"
                    checked={form.natureOfRequest === cell.id}
                    onChange={(e) => selectNature(cell.id, e.target.checked)}
                    className="w-4 h-4 shrink-0 rounded-sm border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  />
                  <label
                    htmlFor={`nature-${cell.id}`}
                    className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap"
                  >
                    {cell.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Signing note */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs px-4 sm:px-6 py-4">
        <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
          Signature blocks for {USER_ID_SIGNATURE_LABELS.join(', ')} are added to the exported PDF
          for wet signing.
        </p>
      </div>
    </div>
  );
};
