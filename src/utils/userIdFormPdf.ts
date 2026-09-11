import { UserIdFormData } from '../types';
import {
  createFormDoc,
  drawHeaderBand,
  drawTitleBar,
  drawSectionHeader,
  drawInfoRows,
  drawSignatureBlock,
  drawRuledRemarks,
  drawTickBox,
  SECTION_GAP,
} from './formChrome';

export const USER_ID_FORM_TITLE = 'USER ID REQUISITION FORM';

/**
 * Section B is a three-column grid of systems the requester can tick. The
 * layout below reproduces the paper form row by row; `freeText: true` marks the
 * entry that is followed by a write-in rule rather than just a label.
 */
export const SERVER_REQUEST_ROWS: { id: string; label: string; freeText?: boolean }[][] = [
  [
    { id: 'email', label: 'Email' },
    { id: 'doc-control', label: 'Doc. Control (QM)' },
    { id: 'nav', label: 'NAV' },
  ],
  [
    { id: 'file-server', label: 'File Server' },
    { id: 'internet', label: 'Internet' },
    { id: 'advance-retails', label: 'Advance Retails System' },
  ],
  [
    { id: 'network', label: 'Network' },
    { id: 'hris', label: 'HRIS' },
    { id: 'ebuilder', label: 'Ebuilder' },
  ],
  [
    { id: 'printer', label: 'Printer' },
    { id: 'database', label: 'Database' },
    { id: 'others', label: 'Others:', freeText: true },
  ],
];

export const NATURE_OF_REQUEST_LABEL = 'Nature of Request:';

/**
 * Single-select: only one nature applies to a request, so the on-screen tick
 * boxes clear each other and the PDF marks at most one.
 */
export const NATURE_OF_REQUEST_ROWS: { id: string; label: string }[][] = [
  [
    { id: 'new', label: 'New' },
    { id: 'transfer', label: 'Transfer' },
    { id: 'termination', label: 'Termination' },
  ],
  [
    { id: 'reset-password', label: 'Reset Password / Quota' },
    { id: 'temporary', label: 'Temporary' },
  ],
];

export const REMARKS_LABEL = 'Remarks:';
export const REMARKS_PLACEHOLDER = 'e.g. Function / Grouping';

export const ATTACHMENTS_LABEL = 'Attachments:';

/** How the attachment is provided. Only a softcopy can carry a file name. */
export const ATTACHMENT_FORMATS: { id: 'hardcopy' | 'softcopy'; label: string }[] = [
  { id: 'hardcopy', label: 'Hardcopy' },
  { id: 'softcopy', label: 'Softcopy' },
];

export const ATTACHMENTS_NOTE =
  '*Note: HR to route this form to Document Controller when there is a staff movement or new staff onboard and provide the related attachment.';

export const USER_ID_SIGNATURE_LABELS = ['Requestor', 'HOD', 'IT'];

export const USER_ID_SECTION_A_TITLE = 'A. USER ID APPLICATION INFORMATION';
export const USER_ID_SECTION_B_TITLE = 'B. SERVER REQUEST';

export async function exportUserIdFormPdf(form: UserIdFormData) {
  const ctx = createFormDoc();
  const { doc, margin, contentWidth } = ctx;

  await drawHeaderBand(ctx);
  drawTitleBar(ctx, USER_ID_FORM_TITLE);

  // --- Section A: applicant information ---
  drawSectionHeader(ctx, USER_ID_SECTION_A_TITLE);

  drawInfoRows(ctx, [
    ['Employee ID:', form.employeeId, 'Phone/Ext:', form.phoneExt],
    ['Submitted By:', form.submittedBy, 'Request Date:', form.requestDate],
    ['Department:', form.department, 'Location:', form.location],
  ]);

  ctx.y += SECTION_GAP;

  // --- Section B: server request tick grid ---
  drawSectionHeader(ctx, USER_ID_SECTION_B_TITLE);

  const colWidth = contentWidth / 3;
  const rowHeight = 7;
  const tickBoxSize = 3.6;
  const labelOffset = tickBoxSize + 2.5;
  // Tick rows are positioned by their text baseline, so the first one has to be
  // pushed clear of the section header it would otherwise be drawn on top of.
  const firstRowBaseline = 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  // Shared three-column tick grid, used by both the server list and the
  // nature-of-request options so the two blocks line up on the page.
  const drawTickRows = (
    rows: { id: string; label: string; freeText?: boolean }[][],
    isTicked: (id: string) => boolean
  ) => {
    rows.forEach((row) => {
      row.forEach((cell, colIndex) => {
        const x = margin + colIndex * colWidth;
        const cellRight = x + colWidth;

        // Box sits on the text baseline so the tick lines up with the label.
        drawTickBox(ctx, x, ctx.y - tickBoxSize + 0.6, tickBoxSize, isTicked(cell.id));
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(cell.label, x + labelOffset, ctx.y);

        if (cell.freeText) {
          const lineStart = x + labelOffset + doc.getTextWidth(cell.label) + 2;
          doc.line(lineStart, ctx.y + 1, cellRight - 4, ctx.y + 1);
          if (form.othersDetail?.trim()) {
            const fitted = doc.splitTextToSize(
              form.othersDetail.trim(),
              cellRight - 4 - lineStart - 1
            )[0];
            doc.text(fitted, lineStart + 1, ctx.y);
          }
        }
      });

      ctx.y += rowHeight;
    });
  };

  ctx.y += firstRowBaseline;
  drawTickRows(SERVER_REQUEST_ROWS, (id) => Boolean(form.systems?.[id]));

  // --- Nature of request, continuing below the server list ---
  ctx.y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(NATURE_OF_REQUEST_LABEL, margin, ctx.y);
  ctx.y += 6;

  drawTickRows(NATURE_OF_REQUEST_ROWS, (id) => form.natureOfRequest === id);

  // --- Remarks ---
  ctx.y += 4;
  drawRuledRemarks(ctx, REMARKS_LABEL, form.remarks);

  // --- Attachments ---
  ctx.y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(ATTACHMENTS_LABEL, margin, ctx.y);

  doc.setFont('helvetica', 'normal');

  // Row 1: Yes / No.
  let attachX = margin + doc.getTextWidth(ATTACHMENTS_LABEL) + 6;
  drawTickBox(ctx, attachX, ctx.y - tickBoxSize + 0.6, tickBoxSize, form.hasAttachments === 'yes');
  doc.text('Yes', attachX + labelOffset, ctx.y);
  attachX += labelOffset + doc.getTextWidth('Yes') + 10;

  drawTickBox(ctx, attachX, ctx.y - tickBoxSize + 0.6, tickBoxSize, form.hasAttachments === 'no');
  doc.text('No', attachX + labelOffset, ctx.y);

  ctx.y += 6.5;

  // Row 2: the format, indented under the Yes/No pair, with the recorded file
  // name on the right when a softcopy is attached.
  const formatX = margin + doc.getTextWidth(ATTACHMENTS_LABEL) + 6;
  let optionX = formatX;

  ATTACHMENT_FORMATS.forEach((option) => {
    drawTickBox(
      ctx,
      optionX,
      ctx.y - tickBoxSize + 0.6,
      tickBoxSize,
      form.hasAttachments === 'yes' && form.attachmentFormat === option.id
    );
    doc.text(option.label, optionX + labelOffset, ctx.y);
    optionX += labelOffset + doc.getTextWidth(option.label) + 10;
  });

  // A softcopy is provided separately, so the sheet records which file it is.
  if (form.hasAttachments === 'yes' && form.attachmentFormat === 'softcopy' && form.attachmentFileName.trim()) {
    const fileLabel = 'File:';
    doc.setFont('helvetica', 'bold');
    doc.text(fileLabel, optionX, ctx.y);
    doc.setFont('helvetica', 'normal');
    const nameX = optionX + doc.getTextWidth(fileLabel) + 2;
    const available = margin + contentWidth - nameX;
    const fitted = doc.splitTextToSize(form.attachmentFileName.trim(), available)[0];
    doc.text(fitted, nameX, ctx.y);
  }

  ctx.y += 7;

  // --- Footnote ---
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  const noteLines = doc.splitTextToSize(ATTACHMENTS_NOTE, contentWidth) as string[];
  doc.text(noteLines, margin, ctx.y);
  ctx.y += noteLines.length * 3.6;
  doc.setTextColor(0, 0, 0);

  ctx.y += SECTION_GAP;

  drawSignatureBlock(ctx, USER_ID_SIGNATURE_LABELS, { anchorToFoot: true });

  const safeRef = (form.employeeId || form.submittedBy || 'form').replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`User_ID_Requisition_${safeRef}.pdf`);
}
