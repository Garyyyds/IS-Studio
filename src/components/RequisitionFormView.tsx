import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  FileDown,
  Plus,
  Trash2,
  ClipboardList,
  Loader2,
  AlertTriangle,
  Lock,
  Paperclip,
  Wallet,
  X,
} from 'lucide-react';
import { AppUser, RequisitionFormData, RequisitionItem } from '../types';
import {
  exportRequisitionFormPdf,
  REQ_SECTION_A_TITLE,
  REQ_SECTION_B_TITLE,
  REQ_SECTION_C_TITLE,
  REQ_SECTION_D_TITLE,
  REQ_SECTION_E_TITLE,
  REQ_SECTION_F_TITLE,
  REQ_ATTACHMENTS_LABEL,
  REQ_ATTACHMENT_FORMATS,
  REQ_ATTACHMENT_REMARK_LABEL,
  REQ_ATTACHMENT_REMARK_PLACEHOLDER,
  REQ_SUPPORTING_DOCS_NOTE,
  REQ_BUDGETED_LABEL,
  REQ_COST_FIELDS,
  REQ_PURPOSE_LABEL,
  REQ_PURPOSE_PLACEHOLDER,
  REQ_IT_REMARKS_LABEL,
  REQ_IT_REMARKS_PLACEHOLDER,
  REQ_PRICE_NOTE,
  REQ_SIGNATURE_LABELS,
  REQ_IT_SIGNATURE_LABELS,
  REQ_CEO_THRESHOLD,
  REQ_CEO_THRESHOLD_NOTE,
  REQ_CEO_SIGNATORY,
  itemsTotal,
  formatTotal,
} from '../utils/requisitionFormPdf';

interface RequisitionFormViewProps {
  currentUser: AppUser;
  onBack: () => void;
}

const blankItem = (): RequisitionItem => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: '',
  quantity: '',
  price: '',
});

// Grow a cell to fit however many lines it now holds, so typed newlines stay
// visible instead of scrolling out of a one-line box.
const autoGrow = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

export const RequisitionFormView: React.FC<RequisitionFormViewProps> = ({
  currentUser,
  onBack,
}) => {
  // Annotated separately rather than as useState<RequisitionFormData>(...): a
  // type argument on useState widens the target to a union, which stops
  // TypeScript reporting missing or misspelled fields in this object.
  const initialForm: RequisitionFormData = {
    // Left blank deliberately: IT allocates the reference when the form lands.
    refNo: '',
    requestDate: new Date().toISOString().slice(0, 10),
    // Blank so the form can be raised on someone else's behalf.
    requestorName: '',
    phoneExt: '',
    designation: '',
    department: currentUser.department || '',
    company: '',
    location: '',
    hasAttachments: '',
    attachmentFormat: '',
    attachmentRemark: '',
    attachmentFileNames: [],
    budgeted: '',
    budgetedAmount: '',
    utilisedAmount: '',
    proposedCapex: '',
    balanceAmount: '',
    purpose: '',
    items: [blankItem()],
    itRemarks: '',
    itItems: [blankItem()],
  };

  const [form, setForm] = useState(initialForm);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Yes and No clear each other; re-picking the current answer clears it so
  // nothing is stuck selected. Answering No also drops the format, remark and
  // files, which would otherwise print beside an unticked Yes.
  const setHasAttachments = (value: 'yes' | 'no') => {
    setForm((prev) => {
      const next = prev.hasAttachments === value ? '' : value;
      return next === 'yes'
        ? { ...prev, hasAttachments: next }
        : {
            ...prev,
            hasAttachments: next,
            attachmentFormat: '',
            attachmentRemark: '',
            attachmentFileNames: [],
          };
    });
  };

  const setBudgeted = (value: 'yes' | 'no') => {
    setForm((prev) => ({ ...prev, budgeted: prev.budgeted === value ? '' : value }));
  };

  // Only a softcopy carries file names, so switching away from it drops them.
  const setAttachmentFormat = (value: 'hardcopy' | 'softcopy') => {
    setForm((prev) => {
      const next = prev.attachmentFormat === value ? '' : value;
      return {
        ...prev,
        attachmentFormat: next,
        attachmentFileNames: next === 'softcopy' ? prev.attachmentFileNames : [],
      };
    });
  };

  // Picked files are appended, so the button can be used repeatedly. Names are
  // de-duplicated because the same file adds nothing the second time.
  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Both item tables share these handlers; `key` picks which one to act on.
  const setItem = (
    key: 'items' | 'itItems',
    id: string,
    field: 'description' | 'quantity' | 'price',
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const addRow = (key: 'items' | 'itItems') => {
    setForm((prev) => ({ ...prev, [key]: [...prev[key], blankItem()] }));
  };

  const removeRow = (key: 'items' | 'itItems', id: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].length > 1 ? prev[key].filter((item) => item.id !== id) : prev[key],
    }));
  };

  const requestTotal = itemsTotal(form.items);
  const itTotal = itemsTotal(form.itItems);
  // Section F only applies over the threshold, so the card says whether this
  // particular request will need it.
  const needsCeo = Math.max(requestTotal, itTotal) > REQ_CEO_THRESHOLD;

  const handleExport = async () => {
    if (!form.requestorName.trim()) {
      setError('User/Requestor Name is required.');
      return;
    }
    if (!form.items.some((item) => item.description.trim())) {
      setError('Add at least one item under Section C before exporting.');
      return;
    }

    setError(null);
    setIsExporting(true);
    try {
      // Blank rows are dropped so the PDF numbering runs 1..n without gaps.
      const used = (items: RequisitionItem[]) =>
        items.filter((item) => [item.description, item.quantity, item.price].some((v) => v.trim()));

      await exportRequisitionFormPdf({
        ...form,
        items: used(form.items),
        itItems: used(form.itItems),
      });
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

  const cardClass =
    'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden';

  const cardHeadClass =
    'px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800';

  const headingClass =
    'text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300';

  const hintClass = 'text-[10px] sm:text-xs text-slate-400 dark:text-slate-500';

  const tickClass =
    'w-4 h-4 shrink-0 rounded-sm border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer';

  const tickLabelClass =
    'text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap';

  const itBadge = (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
      <Lock className="w-3 h-3" />
      <span>Completed by IT</span>
    </span>
  );

  const textField = (label: string, field: string, placeholder?: string, required?: boolean) => (
    <div>
      <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      <input
        type="text"
        value={(form as any)[field]}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );

  // The four investment figures, each prefixed so the unit is never in doubt.
  const amountField = (label: string, field: string) => (
    <div key={field}>
      <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
        {label.replace(/:$/, '')}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
          RM
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={(form as any)[field]}
          onChange={(e) => setField(field, e.target.value)}
          placeholder="0.00"
          className={`${inputClass} pl-10`}
        />
      </div>
    </div>
  );

  // Section C and Section E print the same four columns, so they share one
  // table rather than two near-identical copies.
  const itemTable = (key: 'items' | 'itItems', total: number) => (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/40 text-left">
              <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-12">
                No.
              </th>
              <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Description
              </th>
              <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-20">
                Qty
              </th>
              <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-32">
                * Price (RM)
              </th>
              <th className="py-2 px-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {form[key].map((item, index) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td className="py-2 px-3 font-mono text-xs font-bold text-slate-500 dark:text-slate-400 text-center align-top">
                  {index + 1}
                </td>
                <td className="py-2 px-3 align-top">
                  <textarea
                    rows={1}
                    value={item.description}
                    onChange={(e) => {
                      setItem(key, item.id, 'description', e.target.value);
                      autoGrow(e.target);
                    }}
                    placeholder="e.g. Dell Latitude 5450, i7 / 16GB / 512GB SSD"
                    className={cellClass}
                  />
                </td>
                <td className="py-2 px-3 align-top">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={item.quantity}
                    onChange={(e) => setItem(key, item.id, 'quantity', e.target.value)}
                    placeholder="1"
                    className={`${cellClass} text-center`}
                  />
                </td>
                <td className="py-2 px-3 align-top">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.price}
                    onChange={(e) => setItem(key, item.id, 'price', e.target.value)}
                    placeholder="0.00"
                    className={`${cellClass} text-right`}
                  />
                </td>
                <td className="py-2 px-3 text-center align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(key, item.id)}
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

      {/* Total updates as prices are typed, so the figure on screen is the one
          that will print. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
        <p className={hintClass}>{REQ_PRICE_NOTE}</p>
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total
          </span>
          <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
            {formatTotal(total)}
          </span>
        </div>
      </div>
    </>
  );

  const addRowButton = (key: 'items' | 'itItems') => (
    <button
      type="button"
      onClick={() => addRow(key)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      <span>Add Row</span>
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>IT Hardware, Software &amp; Peripherals Requisition</span>
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
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
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
      <div className={cardClass}>
        <div className={cardHeadClass}>
          <h3 className={headingClass}>{REQ_SECTION_A_TITLE}</h3>
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {textField('Ref No.', 'refNo', 'IT/IR/__ /__ /__')}
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
          {textField('User/Requestor Name', 'requestorName', undefined, true)}
          {textField('Phone/Ext', 'phoneExt')}
          {textField('Designation', 'designation')}
          {textField('Department', 'department')}
          {textField('Company', 'company')}
          {textField('Location', 'location')}
        </div>
      </div>

      {/* SECTION B */}
      <div className={cardClass}>
        <div className={cardHeadClass}>
          <h3 className={headingClass}>{REQ_SECTION_B_TITLE}</h3>
        </div>
        <div className="p-4 sm:p-6 space-y-5">
          {/* Attachments */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Paperclip className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {REQ_ATTACHMENTS_LABEL.replace(/:$/, '')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {(['yes', 'no'] as const).map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <input
                    id={`attach-${value}`}
                    type="checkbox"
                    checked={form.hasAttachments === value}
                    onChange={() => setHasAttachments(value)}
                    className={tickClass}
                  />
                  <label htmlFor={`attach-${value}`} className={tickLabelClass}>
                    {value === 'yes' ? 'Yes' : 'No'}
                  </label>
                </div>
              ))}
            </div>

            {/* Format and reference only apply once Yes is chosen. */}
            {form.hasAttachments === 'yes' && (
              <div className="mt-3 pl-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {REQ_ATTACHMENT_FORMATS.map((option) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <input
                        id={`format-${option.id}`}
                        type="checkbox"
                        checked={form.attachmentFormat === option.id}
                        onChange={() => setAttachmentFormat(option.id)}
                        className={tickClass}
                      />
                      <label htmlFor={`format-${option.id}`} className={tickLabelClass}>
                        {option.label}
                      </label>
                    </div>
                  ))}
                  </div>

                  {/* Attaching is only meaningful for a softcopy. The files
                      themselves travel separately; the form records which ones
                      accompany it. */}
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

                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    {REQ_ATTACHMENT_REMARK_LABEL.replace(/:$/, '')}
                  </label>
                  <input
                    type="text"
                    value={form.attachmentRemark}
                    onChange={(e) => setField('attachmentRemark', e.target.value)}
                    placeholder={REQ_ATTACHMENT_REMARK_PLACEHOLDER}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <p className={`${hintClass} mt-2`}>{REQ_SUPPORTING_DOCS_NOTE}</p>
          </div>

          {/* Budget */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 mb-2">
              <Wallet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {REQ_BUDGETED_LABEL.replace(/:$/, '')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {(['yes', 'no'] as const).map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <input
                    id={`budgeted-${value}`}
                    type="checkbox"
                    checked={form.budgeted === value}
                    onChange={() => setBudgeted(value)}
                    className={tickClass}
                  />
                  <label htmlFor={`budgeted-${value}`} className={tickLabelClass}>
                    {value === 'yes' ? 'Yes' : 'No'}
                  </label>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {REQ_COST_FIELDS.map((field) => amountField(field.label, field.id as string))}
            </div>
          </div>

          {/* Purpose */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              {REQ_PURPOSE_LABEL.replace(/:$/, '')}
            </label>
            <textarea
              rows={3}
              value={form.purpose}
              onChange={(e) => {
                setField('purpose', e.target.value);
                autoGrow(e.target);
              }}
              placeholder={REQ_PURPOSE_PLACEHOLDER}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </div>
        </div>
      </div>

      {/* SECTION C */}
      <div className={cardClass}>
        <div className={`${cardHeadClass} flex items-center justify-between gap-3`}>
          <h3 className={headingClass}>{REQ_SECTION_C_TITLE}</h3>
          {addRowButton('items')}
        </div>
        {itemTable('items', requestTotal)}
      </div>

      {/* SECTION D - signed on the printed sheet */}
      <div className={cardClass}>
        <div className={cardHeadClass}>
          <h3 className={headingClass}>{REQ_SECTION_D_TITLE}</h3>
        </div>
        <div className="p-4 sm:p-6">
          <p className={hintClass}>
            Signature blocks for {REQ_SIGNATURE_LABELS.join(', ')} are added to the exported PDF for
            wet signing.
          </p>
        </div>
      </div>

      {/* SECTION E - completed by IT */}
      <div className={cardClass}>
        <div className={`${cardHeadClass} flex items-center justify-between gap-3`}>
          <h3 className={headingClass}>{REQ_SECTION_E_TITLE}</h3>
          <div className="flex items-center gap-2">
            {itBadge}
            {addRowButton('itItems')}
          </div>
        </div>
        <div className="p-4 sm:p-6 pb-0">
          <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            {REQ_IT_REMARKS_LABEL.replace(/:$/, '')}
          </label>
          <textarea
            rows={2}
            value={form.itRemarks}
            onChange={(e) => {
              setField('itRemarks', e.target.value);
              autoGrow(e.target);
            }}
            placeholder={REQ_IT_REMARKS_PLACEHOLDER}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          <p className={`${hintClass} mt-3`}>
            Signature blocks for {REQ_IT_SIGNATURE_LABELS.join(', ')} are added to the exported PDF
            for wet signing.
          </p>
        </div>
        <div className="mt-4">{itemTable('itItems', itTotal)}</div>
      </div>

      {/* SECTION F - signed on the printed sheet */}
      <div className={cardClass}>
        <div className={`${cardHeadClass} flex items-center justify-between gap-3`}>
          <h3 className={headingClass}>{REQ_SECTION_F_TITLE}</h3>
          {/* Whether this section actually applies depends on the total, so the
              badge answers that for the request in front of you. */}
          <span
            className={
              needsCeo
                ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
            }
          >
            <Lock className="w-3 h-3" />
            <span>{needsCeo ? 'Required for this request' : 'Not required'}</span>
          </span>
        </div>
        <div className="p-4 sm:p-6">
          <p className={hintClass}>
            {REQ_CEO_THRESHOLD_NOTE} The approved / not approved choice and the signing line for{' '}
            {REQ_CEO_SIGNATORY} are printed on the exported PDF.
          </p>
        </div>
      </div>
    </div>
  );
};
