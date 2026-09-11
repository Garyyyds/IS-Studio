import React, { useState } from 'react';
import {
  ArrowLeft,
  FileDown,
  Plus,
  Trash2,
  Recycle,
  PackageCheck,
  Info,
  AlertTriangle,
  Loader2,
  Lock,
} from 'lucide-react';
import { AppUser, AssetFormData, AssetFormItem } from '../types';
import { exportAssetFormPdf, AssetFormConfig } from '../utils/assetFormPdf';

interface AssetFormViewProps {
  config: AssetFormConfig;
  currentUser: AppUser;
  onBack: () => void;
}

// Open with a single row; the requester adds slots as needed and the PDF prints
// exactly the rows they filled in.
const STARTING_ROWS = 1;

const blankItem = (): AssetFormItem => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  specModel: '',
  serialNumber: '',
  quantity: '',
  remarks: '',
});

const todayIso = () => new Date().toISOString().slice(0, 10);

// Grow a Section B cell to fit however many lines it now holds, so typed
// newlines stay visible instead of scrolling out of a one-line box.
const autoGrow = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

export const AssetFormView: React.FC<AssetFormViewProps> = ({ config, currentUser, onBack }) => {
  const [form, setForm] = useState<AssetFormData>(() => ({
    employeeId: '',
    referenceNo: '',
    submittedBy: currentUser.name || '',
    requestDate: todayIso(),
    department: currentUser.department || '',
    location: '',
    items: Array.from({ length: STARTING_ROWS }, blankItem),
  }));

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (field: keyof Omit<AssetFormData, 'items' | 'itReturnOptions'>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setReturnOption = (index: number, checked: boolean) => {
    setForm((prev) => {
      const next = [...(prev.itReturnOptions ?? [])];
      next[index] = checked;
      return { ...prev, itReturnOptions: next };
    });
  };

  const setItem = (id: string, field: keyof Omit<AssetFormItem, 'id'>, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const addRow = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, blankItem()] }));
  };

  const removeRow = (id: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((item) => item.id !== id) : prev.items,
    }));
  };

  const handleExport = async () => {
    const hasItem = form.items.some((item) => item.description.trim());
    if (!hasItem) {
      setError(config.emptyItemsError);
      return;
    }
    if (!form.submittedBy.trim()) {
      setError('Submitted By is required.');
      return;
    }

    setError(null);
    setIsExporting(true);
    try {
      // Blank rows are dropped so the PDF numbering runs 1..n without gaps.
      await exportAssetFormPdf(
        {
          ...form,
          items: form.items.filter((item) =>
            [item.description, item.specModel, item.serialNumber, item.quantity, item.remarks].some(
              (v) => v.trim()
            )
          ),
        },
        config
      );
    } catch (err: any) {
      setError(err?.message || 'Could not generate the PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2 rounded-lg text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition';

  const cellClass =
    'w-full px-2 py-1.5 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-y min-h-[30px] leading-snug';

  const HeadingIcon = config.key === 'allocation' ? PackageCheck : Recycle;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <HeadingIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>{config.screenTitle}</span>
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
            {config.sectionATitle.replace(/^A\.\s*/, 'A. ')}
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
              Reference No.
            </label>
            <input
              type="text"
              value={form.referenceNo}
              onChange={(e) => setField('referenceNo', e.target.value)}
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
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {config.sectionBTitle}
          </h3>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 text-left">
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-12">No.</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {config.descriptionHeader}
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Spec / Model
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Serial Number
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-20">
                  Quantity
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Remarks</th>
                <th className="py-2 px-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {form.items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-3 font-mono text-xs font-bold text-slate-500 dark:text-slate-400 text-center align-top">
                    {index + 1}
                  </td>
                  <td className="py-2 px-3 align-top">
                    <textarea
                      rows={1}
                      value={item.description}
                      onChange={(e) => {
                        setItem(item.id, 'description', e.target.value);
                        autoGrow(e.target);
                      }}
                      placeholder={config.descriptionPlaceholder}
                      className={cellClass}
                    />
                  </td>
                  <td className="py-2 px-3 align-top">
                    <textarea
                      rows={1}
                      value={item.specModel}
                      onChange={(e) => {
                        setItem(item.id, 'specModel', e.target.value);
                        autoGrow(e.target);
                      }}
                      placeholder="e.g. Dell OptiPlex 7090"
                      className={cellClass}
                    />
                  </td>
                  <td className="py-2 px-3 align-top">
                    <textarea
                      rows={1}
                      value={item.serialNumber}
                      onChange={(e) => {
                        setItem(item.id, 'serialNumber', e.target.value);
                        autoGrow(e.target);
                      }}
                      placeholder="e.g. SN-88213"
                      className={cellClass}
                    />
                  </td>
                  <td className="py-2 px-3 align-top">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => setItem(item.id, 'quantity', e.target.value)}
                      placeholder="1"
                      className={`${cellClass} text-center`}
                    />
                  </td>
                  <td className="py-2 px-3 align-top">
                    <textarea
                      rows={1}
                      value={item.remarks}
                      onChange={(e) => {
                        setItem(item.id, 'remarks', e.target.value);
                        autoGrow(e.target);
                      }}
                      placeholder={config.remarksPlaceholder}
                      className={cellClass}
                    />
                  </td>
                  <td className="py-2 px-3 text-center align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(item.id)}
                      aria-label={`Remove row ${index + 1}`}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION C */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            C. Acknowledgement
          </h3>
        </div>
        <div className="p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Note</span>
          </div>
          <ul className="space-y-2">
            {config.notes.map((note) => (
              <li
                key={note}
                className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed"
              >
                {note}
              </li>
            ))}
          </ul>
          <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            Signature blocks for {config.signatureLabels.join(', ')} are added to the exported PDF
            for wet signing.
          </p>
        </div>
      </div>

      {/* SECTION D - printed for IT to complete by hand, shown here as a preview */}
      {config.sectionD && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {config.sectionD.title}
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <Lock className="w-3 h-3" />
              <span>Completed by IT</span>
            </span>
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {config.sectionD.subheading}
            </p>
            <ul className="space-y-2">
              {config.sectionD.options.map((segments, i) => (
                <li key={i}>
                  <label className="flex items-start justify-between gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed cursor-pointer">
                    <span>
                      {segments.map((segment, s) =>
                        segment.bold ? (
                          <strong key={s} className="font-bold text-slate-900 dark:text-slate-100">
                            {segment.text}
                          </strong>
                        ) : (
                          <span key={s}>{segment.text}</span>
                        )
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={form.itReturnOptions?.[i] ?? false}
                      onChange={(e) => setReturnOption(i, e.target.checked)}
                      className="mt-0.5 w-4 h-4 shrink-0 rounded-sm border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    />
                  </label>
                </li>
              ))}
            </ul>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                {config.sectionD.remarksLabel.replace(/:$/, '')}
              </label>
              <input
                type="text"
                value={form.itRemarks ?? ''}
                onChange={(e) => setField('itRemarks', e.target.value)}
                className={inputClass}
              />
            </div>

            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              {config.sectionD.signatories.join(' and ')} signing lines, each with a date, are
              printed on the PDF for wet signing on return.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
