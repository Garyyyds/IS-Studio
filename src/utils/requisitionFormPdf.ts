import { RequisitionFormData, RequisitionItem } from '../types';
import {
  createFormDoc,
  drawHeaderBand,
  drawTitleBar,
  drawSectionHeader,
  drawInfoRows,
  drawSignatureBlock,
  drawRuledRemarks,
  drawFileNames,
  drawItemTable,
  drawFootnote,
  drawTickOptions,
  tickOptionPitch,
  ensureRoom,
  TableColumn,
  SECTION_GAP,
} from './formChrome';

export const REQUISITION_FORM_TITLE = 'IT HARDWARE, SOFTWARE, & PERIPHERALS REQUISITION FORM';

export const REQ_SECTION_A_TITLE = 'A. USER / REQUESTOR INFORMATION';
export const REQ_SECTION_B_TITLE = 'B. PURPOSE, REASON & INVESTMENT COST BREAKDOWN';
export const REQ_SECTION_C_TITLE = 'C. ITEMS REQUESTED';
export const REQ_SECTION_D_TITLE = 'D. AUTHORISATION';
export const REQ_SECTION_E_TITLE = 'E. FOR IT DEPARTMENT USE';
export const REQ_SECTION_F_TITLE = 'F. FOR CHIEF EXECUTIVE OFFICER USE';

export const REQ_ATTACHMENTS_LABEL = 'Attachments:';
export const REQ_ATTACHMENT_FORMATS: { id: 'hardcopy' | 'softcopy'; label: string }[] = [
  { id: 'hardcopy', label: 'Hardcopy' },
  { id: 'softcopy', label: 'Softcopy' },
];
export const REQ_ATTACHMENT_REMARK_LABEL = 'Remark:';
export const REQ_ATTACHMENT_REMARK_PLACEHOLDER = 'e.g. Quotation QT-2026-0881';
export const REQ_SUPPORTING_DOCS_NOTE =
  'Kindly attach supporting documents, i.e. quotation, proposal, drawings or specifications.';

export const REQ_BUDGETED_LABEL = 'Budgeted:';

/** The four investment figures, in the order the spreadsheet lists them. */
export const REQ_COST_FIELDS: { id: keyof RequisitionFormData; label: string }[] = [
  { id: 'budgetedAmount', label: 'Budgeted Amount:' },
  { id: 'utilisedAmount', label: 'Utilised Amount:' },
  { id: 'proposedCapex', label: 'Proposed Capex:' },
  { id: 'balanceAmount', label: 'Balance Amount:' },
];

export const REQ_PURPOSE_LABEL = 'Description of Purpose / Reason:';
export const REQ_PURPOSE_PLACEHOLDER = 'e.g. Purchase of two (2) laptops';

export const REQ_IT_REMARKS_LABEL = 'Remarks / Hardware & Software Required:';
export const REQ_IT_REMARKS_PLACEHOLDER = 'e.g. Dell Latitude 5450, Windows 11 Pro, Office 365';

export const REQ_PRICE_NOTE =
  '* Estimated price. The actual current market price is obtained from Procurement after negotiation and comparison.';

export const REQ_ITEM_COLUMNS: TableColumn[] = [
  { header: 'No.', width: 0.07, align: 'center' },
  { header: 'Description', width: 0.63 },
  { header: 'Qty', width: 0.1, align: 'center' },
  { header: '* Price (RM)', width: 0.2, align: 'right' },
];

export const REQ_SIGNATURE_LABELS = [
  'User/Requestor',
  'Authorised By (Superior)',
  'Authorised By (COO)',
];

export const REQ_IT_SIGNATURE_LABELS = ['Processed By', 'Recommended By', 'Approved By'];

/**
 * Section F only applies above this figure, which is why the paper form marks
 * the band "Above 10K require".
 */
export const REQ_CEO_THRESHOLD = 10000;
export const REQ_CEO_THRESHOLD_NOTE = 'Required for requests above RM10,000.00.';
export const REQ_CEO_DECISION_LABEL = 'The above request is:';
export const REQ_CEO_DECISION_OPTIONS = ['Approved', 'Not approved'];

/**
 * Printed beneath the Section F signing line. Held here rather than inline so a
 * change of signatory is a one-line edit.
 *
 * The source spreadsheet titles the band "Chief Executive Officer" but names a
 * CFO underneath; both are reproduced as they appear on the company form.
 */
export const REQ_CEO_SIGNATORY = 'Mr. Kelvin Yip, CFO';

/** Numeric value of a typed amount, ignoring spaces, commas and any RM prefix. */
export function parseAmount(value: string): number {
  const n = Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** 13400 becomes "13,400.00". Empty input stays empty so blank cells print blank. */
export function formatAmount(value: string): string {
  if (!String(value == null ? '' : value).trim()) return '';
  return parseAmount(value).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Line total for one row: quantity times unit price, quantity defaulting to 1. */
export function lineTotal(item: RequisitionItem): number {
  const qty = parseAmount(item.quantity) || 1;
  return qty * parseAmount(item.price);
}

export function itemsTotal(items: RequisitionItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function formatTotal(amount: number): string {
  return 'RM' + amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Table body rows, numbered 1..n. At least one row always prints. */
function itemRows(items: RequisitionItem[]): string[][] {
  const printed = items.length ? items : [{ id: '', description: '', quantity: '', price: '' }];
  return printed.map((item, i) => [
    String(i + 1),
    item.description || '',
    item.quantity || '',
    formatAmount(item.price),
  ]);
}

export async function exportRequisitionFormPdf(form: RequisitionFormData) {
  const ctx = createFormDoc();
  const { doc, margin, contentWidth } = ctx;

  await drawHeaderBand(ctx);
  drawTitleBar(ctx, REQUISITION_FORM_TITLE);

  // --- Section A: who is asking ---
  drawSectionHeader(ctx, REQ_SECTION_A_TITLE);

  drawInfoRows(ctx, [
    ['Ref No:', form.refNo, 'Request Date:', form.requestDate],
    ['User/Requestor Name:', form.requestorName, 'Phone/Ext:', form.phoneExt],
    ['Designation:', form.designation, 'Department:', form.department],
    ['Company:', form.company, 'Location:', form.location],
  ]);

  ctx.y += SECTION_GAP;

  // --- Section B: why, and what it costs ---
  drawSectionHeader(ctx, REQ_SECTION_B_TITLE);
  ctx.y += 6;

  // Attachments: Yes/No on one row, the format beneath on the same pitch so
  // Hardcopy sits under Yes and Softcopy under No.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(REQ_ATTACHMENTS_LABEL, margin, ctx.y);

  doc.setFont('helvetica', 'normal');
  const optionsX = margin + doc.getTextWidth(REQ_ATTACHMENTS_LABEL) + 6;
  const attachPitch = tickOptionPitch(ctx, [
    'Yes',
    'No',
    ...REQ_ATTACHMENT_FORMATS.map((f) => f.label),
  ]);

  drawTickOptions(ctx, optionsX, attachPitch, [
    { label: 'Yes', ticked: form.hasAttachments === 'yes' },
    { label: 'No', ticked: form.hasAttachments === 'no' },
  ]);

  ctx.y += 6.5;

  drawTickOptions(
    ctx,
    optionsX,
    attachPitch,
    REQ_ATTACHMENT_FORMATS.map((f) => ({
      label: f.label,
      ticked: form.hasAttachments === 'yes' && form.attachmentFormat === f.id,
    }))
  );

  // Recorded file names sit to the right of the format ticks, one per line so
  // a second name never starts back at the left margin.
  const fileLabelX = optionsX + REQ_ATTACHMENT_FORMATS.length * attachPitch;
  const attachedNames =
    form.hasAttachments === 'yes' && form.attachmentFormat === 'softcopy'
      ? form.attachmentFileNames
      : [];
  drawFileNames(ctx, fileLabelX, attachedNames);

  ctx.y += 6.5;

  // The remark gets its own full-width ruled line beneath, rather than sharing
  // the format row, so there is room to write more than a reference number.
  drawRuledRemarks(ctx, REQ_ATTACHMENT_REMARK_LABEL, form.attachmentRemark, 1);
  drawFootnote(ctx, REQ_SUPPORTING_DOCS_NOTE);
  ctx.y += 7;

  // Budgeted yes/no, on the same pitch as the attachment ticks above.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(REQ_BUDGETED_LABEL, margin, ctx.y);
  drawTickOptions(ctx, optionsX, attachPitch, [
    { label: 'Yes', ticked: form.budgeted === 'yes' },
    { label: 'No', ticked: form.budgeted === 'no' },
  ]);

  ctx.y += 4;

  // The four investment figures, boxed two to a row like the applicant block.
  drawInfoRows(ctx, [
    [
      REQ_COST_FIELDS[0].label,
      formatAmount(form.budgetedAmount),
      REQ_COST_FIELDS[1].label,
      formatAmount(form.utilisedAmount),
    ],
    [
      REQ_COST_FIELDS[2].label,
      formatAmount(form.proposedCapex),
      REQ_COST_FIELDS[3].label,
      formatAmount(form.balanceAmount),
    ],
  ]);

  ctx.y += 9;
  drawRuledRemarks(ctx, REQ_PURPOSE_LABEL, form.purpose, 3);

  ctx.y += SECTION_GAP;

  // --- Section C: what is being asked for ---
  ensureRoom(ctx, 30);
  drawSectionHeader(ctx, REQ_SECTION_C_TITLE);

  drawItemTable(ctx, REQ_ITEM_COLUMNS, itemRows(form.items), {
    totalLabel: 'Total',
    totalValue: formatTotal(itemsTotal(form.items)),
  });
  drawFootnote(ctx, REQ_PRICE_NOTE);

  ctx.y += SECTION_GAP;

  // --- Section D: signed by the requestor and their approvers ---
  ensureRoom(ctx, 32);
  drawSectionHeader(ctx, REQ_SECTION_D_TITLE);
  drawSignatureBlock(ctx, REQ_SIGNATURE_LABELS, { anchorToFoot: false, layout: 'stacked' });

  ctx.y += SECTION_GAP * 2;

  // --- Section E: completed by IT ---
  ensureRoom(ctx, 60);
  drawSectionHeader(ctx, REQ_SECTION_E_TITLE);
  ctx.y += 6;

  drawRuledRemarks(ctx, REQ_IT_REMARKS_LABEL, form.itRemarks, 2);
  ctx.y += 2;

  drawItemTable(ctx, REQ_ITEM_COLUMNS, itemRows(form.itItems), {
    totalLabel: 'Total',
    totalValue: formatTotal(itemsTotal(form.itItems)),
  });
  drawFootnote(ctx, REQ_PRICE_NOTE);

  drawSignatureBlock(ctx, REQ_IT_SIGNATURE_LABELS, { anchorToFoot: false, layout: 'stacked' });

  ctx.y += SECTION_GAP * 2;

  // --- Section F: the CEO decision, for requests over the threshold ---
  ensureRoom(ctx, 52);
  drawSectionHeader(ctx, REQ_SECTION_F_TITLE);
  ctx.y += 5;

  drawFootnote(ctx, REQ_CEO_THRESHOLD_NOTE);
  ctx.y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(REQ_CEO_DECISION_LABEL, margin, ctx.y);

  // Left unticked: the decision is made by hand on the printed sheet.
  doc.setFont('helvetica', 'normal');
  const decisionX = margin + doc.getTextWidth(REQ_CEO_DECISION_LABEL) + 6;
  drawTickOptions(
    ctx,
    decisionX,
    tickOptionPitch(ctx, REQ_CEO_DECISION_OPTIONS),
    REQ_CEO_DECISION_OPTIONS.map((label) => ({ label, ticked: false }))
  );

  ctx.y += 20;

  // Signing line sized to one column of the blocks above, so the sheet keeps
  // its rhythm rather than running a rule the full width of the page.
  const columnWidth = contentWidth / 3;
  doc.line(margin, ctx.y, margin + columnWidth - 8, ctx.y);

  // Date sits in the next column across, level with the signing line.
  const dateX = margin + columnWidth;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Date', dateX, ctx.y - 1);
  const dateLabelWidth = doc.getTextWidth('Date') + 2;
  doc.text(':', dateX + dateLabelWidth, ctx.y - 1);
  doc.line(dateX + dateLabelWidth + 3, ctx.y, dateX + columnWidth - 8, ctx.y);

  ctx.y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(REQ_CEO_SIGNATORY, margin, ctx.y);

  const safeRef = (form.refNo || form.requestorName || 'form').replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save('IT_Requisition_' + safeRef + '.pdf');
}
