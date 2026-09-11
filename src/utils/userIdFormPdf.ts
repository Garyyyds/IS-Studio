import { UserIdFormData } from '../types';
import {
  createFormDoc,
  drawHeaderBand,
  drawTitleBar,
  drawSectionHeader,
  drawSignatureBlock,
  drawTickBox,
  SECTION_GAP,
} from './formChrome';

export const USER_ID_FORM_TITLE = 'USER ID REQUISITION FORM';

/**
 * Section A is a three-column grid of systems the requester can tick. The
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
    { id: 'hris-2', label: 'HRIS' },
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

export const USER_ID_SIGNATURE_LABELS = ['Requestor', 'HOD', 'IT'];

export const USER_ID_SECTION_A_TITLE = 'A. SERVER REQUEST';

export async function exportUserIdFormPdf(form: UserIdFormData) {
  const ctx = createFormDoc();
  const { doc, margin, contentWidth } = ctx;

  await drawHeaderBand(ctx);
  drawTitleBar(ctx, USER_ID_FORM_TITLE);

  // --- Section A: server request tick grid ---
  drawSectionHeader(ctx, USER_ID_SECTION_A_TITLE);

  const colWidth = contentWidth / 3;
  const rowHeight = 9;
  const tickBoxSize = 3.6;
  const labelOffset = tickBoxSize + 2.5;

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

  drawTickRows(SERVER_REQUEST_ROWS, (id) => Boolean(form.systems?.[id]));

  // --- Nature of request, continuing below the server list ---
  ctx.y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(NATURE_OF_REQUEST_LABEL, margin, ctx.y);
  ctx.y += 7;

  drawTickRows(NATURE_OF_REQUEST_ROWS, (id) => form.natureOfRequest === id);

  ctx.y += SECTION_GAP;

  drawSignatureBlock(ctx, USER_ID_SIGNATURE_LABELS, { anchorToFoot: true });

  const safeRef = (form.referenceNo || form.submittedBy || 'form').replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`User_ID_Requisition_${safeRef}.pdf`);
}
