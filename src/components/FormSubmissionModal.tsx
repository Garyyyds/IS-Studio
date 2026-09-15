import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  Trash2,
  Lock,
  Clock,
  User,
  Paperclip,
  Loader2,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { AssetFormData, FormSubmission, RequisitionFormData, UserIdFormData } from '../types';
import { FORM_TYPE_INFO } from '../utils/formSubmissions';
import { attachmentUrl, formatBytes } from '../utils/attachments';
import { exportUserIdFormPdf, SERVER_REQUEST_ROWS } from '../utils/userIdFormPdf';
import {
  exportRequisitionFormPdf,
  REQ_COST_FIELDS,
  formatAmount,
  formatTotal,
  itemsTotal,
  lineTotal,
} from '../utils/requisitionFormPdf';
import { exportAssetFormPdf, DISPOSAL_FORM, ALLOCATION_FORM } from '../utils/assetFormPdf';

interface FormSubmissionModalProps {
  submission: FormSubmission;
  onClose: () => void;
  /** Omitted for employees viewing their own form, who cannot delete it. */
  onDelete?: (id: string) => Promise<void>;
  /** Shows a Done button; given only in the admin inbox. */
  onComplete?: (id: string) => Promise<void>;
}

type Row = { label: string; value?: string };

const yesNo = (value: string) => (value === 'yes' ? 'Yes' : value === 'no' ? 'No' : '');
const formatDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString() : '');

/** Read-only view of a submitted form, with the same PDF the employee can export. */
export const FormSubmissionModal: React.FC<FormSubmissionModalProps> = ({ submission, onClose, onDelete, onComplete }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleExport = async () => {
    setError(null);
    setIsExporting(true);
    try {
      if (submission.type === 'user-id') await exportUserIdFormPdf(submission.data as UserIdFormData);
      else if (submission.type === 'requisition') await exportRequisitionFormPdf(submission.data as RequisitionFormData);
      else {
        await exportAssetFormPdf(
          submission.data as AssetFormData,
          submission.type === 'disposal' ? DISPOSAL_FORM : ALLOCATION_FORM
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Could not generate the PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleComplete = async () => {
    if (!onComplete) return;
    setError(null);
    setIsCompleting(true);
    try {
      await onComplete(submission.id);
    } catch (err: any) {
      setError(err?.message || 'Could not mark the form as done.');
      setIsCompleting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setError(null);
    setIsDeleting(true);
    try {
      await onDelete(submission.id);
    } catch (err: any) {
      setError(err?.message || 'Could not delete the form.');
      setIsDeleting(false);
    }
  };

  const info = FORM_TYPE_INFO[submission.type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${submission.formNumber} ${info.title}`}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
              {submission.formNumber}
            </span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{info.title}</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Submitted by employee</span>
            </span>
            {submission.completedAt ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 className="w-3 h-3" />
                <span>Completed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                <span>In Progress</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60 transition cursor-pointer"
              title="Export as PDF"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
            </div>
          )}

          <Section title="Submission" icon={<User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}>
            <InfoGrid
              rows={[
                { label: 'Submitted by', value: submission.submittedBy.name },
                { label: 'Email', value: submission.submittedBy.email },
                { label: 'Department', value: submission.submittedBy.department },
                { label: 'Submitted on', value: new Date(submission.submittedAt).toLocaleString() },
                ...(submission.completedAt
                  ? [
                      { label: 'Completed on', value: new Date(submission.completedAt).toLocaleString() },
                      { label: 'Completed by', value: submission.completedBy },
                    ]
                  : []),
              ]}
            />
          </Section>

          {submission.type === 'user-id' && <UserIdDetails data={submission.data as UserIdFormData} />}
          {submission.type === 'requisition' && <RequisitionDetails data={submission.data as RequisitionFormData} />}
          {(submission.type === 'disposal' || submission.type === 'allocation') && (
            <AssetDetails data={submission.data as AssetFormData} />
          )}

          <Section title="Attachments" icon={<Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}>
            {submission.attachments?.length ? (
              <ul className="flex flex-wrap gap-2">
                {submission.attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={attachmentUrl(file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 max-w-[280px] px-2 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:underline"
                      title={file.name}
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-slate-400 font-normal">{formatBytes(file.size)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">No files were uploaded with this form.</p>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          {!onDelete ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {submission.completedAt
                ? `Completed by IT on ${formatDate(submission.completedAt)}`
                : 'In progress with IT'}
            </span>
          ) : confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">Delete this form for everyone?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <Clock className="w-3 h-3" />
              <span>{formatDate(submission.submittedAt)}</span>
            </span>
            {onComplete && !submission.completedAt && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={isCompleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-xs transition cursor-pointer"
              >
                {isCompleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 space-y-3">
    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
      {icon}
      <span>{title}</span>
    </h3>
    {children}
  </div>
);

const InfoGrid: React.FC<{ rows: Row[] }> = ({ rows }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
    {rows.map((row) => (
      <div key={row.label} className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{row.label}</dt>
        <dd className="text-sm text-slate-800 dark:text-slate-200 break-words whitespace-pre-wrap">
          {row.value?.trim() ? row.value : <span className="text-slate-400 dark:text-slate-500">—</span>}
        </dd>
      </div>
    ))}
  </dl>
);

const TextBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
      {value.trim() ? value : <span className="text-slate-400 dark:text-slate-500">—</span>}
    </p>
  </div>
);

const Table: React.FC<{ headers: string[]; rows: string[][]; footer?: string[] }> = ({ headers, rows, footer }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
    <table className="w-full text-xs">
      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
        <tr>
          <th className="px-3 py-2 text-left font-semibold w-10">No.</th>
          {headers.map((h) => (
            <th key={h} className="px-3 py-2 text-left font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
        {rows.length ? (
          rows.map((cells, i) => (
            <tr key={i}>
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              {cells.map((cell, j) => (
                <td key={j} className="px-3 py-2 whitespace-pre-wrap break-words">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={headers.length + 1} className="px-3 py-3 text-center text-slate-400">
              No items
            </td>
          </tr>
        )}
      </tbody>
      {footer && (
        <tfoot className="border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white">
          <tr>
            <td />
            {footer.map((cell, i) => (
              <td key={i} className="px-3 py-2">
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);

const UserIdDetails: React.FC<{ data: UserIdFormData }> = ({ data }) => {
  const systems = SERVER_REQUEST_ROWS.flat()
    .filter((cell) => data.systems?.[cell.id])
    .map((cell) => (cell.freeText ? `Others: ${data.othersDetail || ''}`.trim() : cell.label));
  return (
    <>
      <Section title="A. User / Requestor Information">
        <InfoGrid
          rows={[
            { label: 'User / Requestor Name', value: data.requestorName },
            { label: 'Phone / Ext', value: data.phoneExt },
            { label: 'Designation', value: data.designation },
            { label: 'Request Date', value: data.requestDate },
            { label: 'Department', value: data.department },
            { label: 'Location', value: data.location },
          ]}
        />
      </Section>
      <Section title="B. Systems Requested">
        {systems.length ? (
          <div className="flex flex-wrap gap-1.5">
            {systems.map((label) => (
              <span
                key={label}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">None selected</p>
        )}
        <TextBlock label="Remarks" value={data.remarks || ''} />
        <InfoGrid
          rows={[
            { label: 'Attachments', value: yesNo(data.hasAttachments) },
            { label: 'Format', value: data.attachmentFormat === 'softcopy' ? 'Softcopy' : data.attachmentFormat === 'hardcopy' ? 'Hardcopy' : '' },
          ]}
        />
      </Section>
    </>
  );
};

const RequisitionDetails: React.FC<{ data: RequisitionFormData }> = ({ data }) => (
  <>
    <Section title="A. User / Requestor Information">
      <InfoGrid
        rows={[
          { label: 'Ref No.', value: data.refNo },
          { label: 'Request Date', value: data.requestDate },
          { label: 'User / Requestor Name', value: data.requestorName },
          { label: 'Phone / Ext', value: data.phoneExt },
          { label: 'Designation', value: data.designation },
          { label: 'Department', value: data.department },
          { label: 'Company', value: data.company },
          { label: 'Location', value: data.location },
        ]}
      />
    </Section>
    <Section title="B. Purpose, Reason & Investment Cost Breakdown">
      <TextBlock label="Description of Purpose / Reason" value={data.purpose || ''} />
      <InfoGrid
        rows={[
          { label: 'Budgeted', value: yesNo(data.budgeted) },
          ...REQ_COST_FIELDS.map((field) => ({
            label: field.label.replace(/:$/, ''),
            value: formatAmount(String(data[field.id] ?? '')) ? `RM ${formatAmount(String(data[field.id] ?? ''))}` : '',
          })),
          { label: 'Attachments', value: yesNo(data.hasAttachments) },
          {
            label: 'Format',
            value: [
              data.attachmentFormat === 'softcopy' ? 'Softcopy' : data.attachmentFormat === 'hardcopy' ? 'Hardcopy' : '',
              data.attachmentRemark,
            ]
              .filter(Boolean)
              .join(' · '),
          },
        ]}
      />
    </Section>
    <Section title="C. Items Requested">
      <Table
        headers={['Description', 'Qty', 'Unit Price (RM)', 'Total (RM)']}
        rows={(data.items || []).map((item) => [
          item.description,
          item.quantity,
          formatAmount(item.price),
          item.price.trim() ? formatTotal(lineTotal(item)) : '',
        ])}
        footer={['', '', 'Total', formatTotal(itemsTotal(data.items || []))]}
      />
    </Section>
  </>
);

const AssetDetails: React.FC<{ data: AssetFormData }> = ({ data }) => (
  <>
    <Section title="A. Application Information">
      <InfoGrid
        rows={[
          { label: 'Employee ID', value: data.employeeId },
          { label: 'Reference No.', value: data.referenceNo },
          { label: 'Submitted By', value: data.submittedBy },
          { label: 'Request Date', value: data.requestDate },
          { label: 'Department', value: data.department },
          { label: 'Location', value: data.location },
        ]}
      />
    </Section>
    <Section title="B. Inventory List">
      <Table
        headers={['Description', 'Spec / Model', 'Serial Number', 'Qty', 'Remarks']}
        rows={(data.items || []).map((item) => [
          item.description,
          item.specModel,
          item.serialNumber,
          item.quantity,
          item.remarks,
        ])}
      />
    </Section>
  </>
);
