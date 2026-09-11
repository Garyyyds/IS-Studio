import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  FileDown,
  KeyRound,
  AlertTriangle,
  Loader2,
  Paperclip,
  X,
  Lock,
} from 'lucide-react';
import { AppUser, UserIdFormData } from '../types';
import {
  exportUserIdFormPdf,
  SERVER_REQUEST_ROWS,
  REMARKS_LABEL,
  REMARKS_PLACEHOLDER,
  ATTACHMENTS_LABEL,
  ATTACHMENT_FORMATS,
  ATTACHMENTS_NOTE,
  USER_ID_SECTION_A_TITLE,
  USER_ID_SECTION_B_TITLE,
  USER_ID_SECTION_C_TITLE,
  USER_ID_SECTION_D_TITLE,
  USER_ID_SIGNATURE_LABELS,
  USER_ID_IT_SIGNATURE_LABELS,
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
    // Left blank deliberately: the form may be raised on someone else's behalf.
    requestorName: '',
    phoneExt: '',
    designation: '',
    requestDate: new Date().toISOString().slice(0, 10),
    department: currentUser.department || '',
    location: '',
    systems: {},
    othersDetail: '',
    remarks: '',
    hasAttachments: '',
    attachmentFormat: '',
    attachmentFileNames: [],
  };

  const [form, setForm] = useState(initialForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSystem = (id: string, checked: boolean) => {
    setForm((prev) => ({ ...prev, systems: { ...prev.systems, [id]: checked } }));
  };

  const setField = (
    field: 'requestorName' | 'phoneExt' | 'designation' | 'requestDate' | 'department' | 'location',
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Yes and No are mutually exclusive; re-ticking the current one clears it.
  // Choosing No also drops any format and file already picked.
  const setAttachments = (value: 'yes' | 'no' | '') => {
    setForm((prev) =>
      value === 'yes'
        ? { ...prev, hasAttachments: value }
        : { ...prev, hasAttachments: value, attachmentFormat: '', attachmentFileNames: [] }
    );
  };

  // Hardcopy and Softcopy are mutually exclusive. Only a softcopy can carry a
  // file, so switching to hardcopy clears any file already picked.
  const selectFormat = (id: 'hardcopy' | 'softcopy', checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      attachmentFormat: checked ? id : '',
      attachmentFileNames: checked && id === 'softcopy' ? prev.attachmentFileNames : [],
    }));
  };

  // Picked files are appended, so the button can be used repeatedly. Names are
  // de-duplicated because the same file adds nothing the second time.
  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Annotated because the event type resolves to any without React's types,
    // which would otherwise leave each entry as unknown.
    const list: FileList | null = e.target.files;
    const picked: string[] = list ? Array.from(list).map((file) => file.name) : [];
    if (picked.length) {
      setForm((prev) => ({
        ...prev,
        attachmentFileNames: [
          ...prev.attachmentFileNames,
          ...picked.filter((name) => !prev.attachmentFileNames.includes(name)),
        ],
      }));
    }
    // Reset the input so picking the same file again still fires a change.
    e.target.value = '';
  };

  const removeFile = (name: string) => {
    setForm((prev) => ({
      ...prev,
      attachmentFileNames: prev.attachmentFileNames.filter((n) => n !== name),
    }));
  };

  const clearFiles = () => {
    setForm((prev) => ({ ...prev, attachmentFileNames: [] }));
  };

  // Grow the remarks box to fit however many lines it holds.
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
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
            <span>New User ID Requisition</span>
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
              User/Requestor Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.requestorName}
              onChange={(e) => setField('requestorName', e.target.value)}
              placeholder="Full name"
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
              Designation
            </label>
            <input
              type="text"
              value={form.designation}
              onChange={(e) => setField('designation', e.target.value)}
              placeholder="e.g. Finance Executive"
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
        </div>
      </div>

      {/* Remarks and attachments */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              {REMARKS_LABEL.replace(/:$/, '')}
            </label>
            <textarea
              rows={3}
              value={form.remarks}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, remarks: e.target.value }));
                autoGrow(e.target);
              }}
              placeholder={REMARKS_PLACEHOLDER}
              className={`${inputClass} resize-y min-h-[72px] leading-relaxed`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              {ATTACHMENTS_LABEL.replace(/:$/, '')}
            </label>

            {/* Both rows live in one padded container so they share a left
                origin and column widths - Hardcopy under Yes, Softcopy under No. */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2.5 space-y-2.5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-[280px] max-w-full shrink-0">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasAttachments === 'yes'}
                    onChange={(e) => setAttachments(e.target.checked ? 'yes' : '')}
                    className="w-4 h-4 shrink-0 rounded-sm border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">Yes</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasAttachments === 'no'}
                    onChange={(e) => setAttachments(e.target.checked ? 'no' : '')}
                    className="w-4 h-4 shrink-0 rounded-sm border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">No</span>
                </label>
              </div>

            {/* Format, plus the attach control on the right */}
            <div
              className={`flex flex-wrap items-center justify-between gap-x-5 gap-y-3 transition ${
                form.hasAttachments === 'yes' ? '' : 'opacity-50 pointer-events-none'
              }`}
              aria-disabled={form.hasAttachments !== 'yes'}
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-[280px] max-w-full shrink-0">
                {ATTACHMENT_FORMATS.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.attachmentFormat === option.id}
                      onChange={(e) => selectFormat(option.id, e.target.checked)}
                      className="w-4 h-4 shrink-0 rounded-sm border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Attach is only meaningful for a softcopy */}
              <div className="flex items-center gap-2 shrink-0">
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
                  disabled={form.attachmentFormat !== 'softcopy'}
                  title={
                    form.attachmentFormat === 'softcopy'
                      ? 'Attach one or more files'
                      : 'Select Softcopy to attach files'
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{form.attachmentFileNames.length ? 'Add more' : 'Attach'}</span>
                </button>
              </div>
            </div>

            {/* Attached files */}
            {form.attachmentFormat === 'softcopy' && form.attachmentFileNames.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {form.attachmentFileNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 max-w-[240px] px-2 py-1 rounded-md text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    <span className="truncate" title={name}>
                      {name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(name)}
                      aria-label={`Remove ${name}`}
                      className="shrink-0 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clearFiles}
                  className="text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
            </div>

            <p className="mt-3 text-[10px] sm:text-xs italic text-slate-500 dark:text-slate-400 leading-relaxed">
              {ATTACHMENTS_NOTE}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION C */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {USER_ID_SECTION_C_TITLE}
          </h3>
        </div>
        <div className="p-4 sm:p-6">
          {/* Nothing here is fillable - the signing space only exists on the
              printed sheet, so the screen just names what will appear there. */}
          <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
            Signature blocks for {USER_ID_SIGNATURE_LABELS.join(', ')} are added to the exported
            PDF for wet signing.
          </p>
        </div>
      </div>

      {/* SECTION D - printed for IT to complete by hand */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {USER_ID_SECTION_D_TITLE}
          </h3>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Lock className="w-3 h-3" />
            <span>Completed by IT</span>
          </span>
        </div>
        <div className="p-4 sm:p-6">
          <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
            Signature blocks for {USER_ID_IT_SIGNATURE_LABELS.join(', ')} are added to the
            exported PDF for wet signing.
          </p>
        </div>
      </div>
    </div>
  );
};
