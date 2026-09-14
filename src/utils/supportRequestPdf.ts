import {
  createFormDoc,
  drawHeaderBand,
  drawTitleBar,
  drawSectionHeader,
  drawInfoRows,
  drawRuledRemarks,
  drawFileNames,
  drawSignatureBlock,
  ensureRoom,
  SECTION_GAP,
} from './formChrome';

export const SUPPORT_REQUEST_TITLE = 'IT SUPPORT REQUEST FORM';

export const SUPPORT_SECTION_A_TITLE = 'A. REQUESTOR INFORMATION';
export const SUPPORT_SECTION_B_TITLE = 'B. REQUEST DETAILS';
export const SUPPORT_SECTION_C_TITLE = 'C. ACKNOWLEDGEMENT';
export const SUPPORT_SECTION_D_TITLE = 'D. FOR IT DEPARTMENT USE';

export const SUPPORT_SIGNATURE_LABELS = ['User/Requestor', 'Authorized By (HOD)'];
export const SUPPORT_IT_SIGNATURE_LABELS = ['Processed By', 'Approved By'];

/** Everything the printed sheet shows, as entered on the IT Support Request form. */
export interface SupportRequestPdfData {
  requestDate: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  location: string;
  phoneExt: string;
  hodName: string;
  hodEmail: string;
  summary: string;
  /** The option picked in the form's Category list. */
  category: string;
  affectedDevice: string;
  description: string;
  attachmentNames: string[];
}

export async function exportSupportRequestPdf(data: SupportRequestPdfData) {
  const ctx = createFormDoc();
  const { doc, margin } = ctx;

  await drawHeaderBand(ctx);
  drawTitleBar(ctx, SUPPORT_REQUEST_TITLE);

  // --- Section A: who is asking, and who approves ---
  drawSectionHeader(ctx, SUPPORT_SECTION_A_TITLE);
  drawInfoRows(ctx, [
    ['Requestor Name:', data.requesterName, 'Request Date:', data.requestDate],
    ['Email:', data.requesterEmail, 'Department:', data.department],
    ['Location:', data.location, 'Phone/Ext:', data.phoneExt],
    ['HOD Name:', data.hodName, 'HOD Email:', data.hodEmail],
  ]);

  ctx.y += SECTION_GAP;

  // --- Section B: what the request is ---
  drawSectionHeader(ctx, SUPPORT_SECTION_B_TITLE);
  drawInfoRows(ctx, [['Category:', data.category, 'Affected Device:', data.affectedDevice]]);

  ctx.y += 8;
  drawRuledRemarks(ctx, 'Summary:', data.summary, 1);

  ctx.y += 2;
  drawRuledRemarks(ctx, 'Remarks / Description:', data.description, 4);

  // File names are listed so the printed copy records what accompanied the
  // ticket; the files themselves stay with the ticket in the system.
  if (data.attachmentNames.length) {
    ctx.y += 2;
    ensureRoom(ctx, 8);
    drawFileNames(ctx, margin, data.attachmentNames);
    ctx.y += 6;
  }

  ctx.y += SECTION_GAP;

  // --- Section C: requestor and HOD sign ---
  ensureRoom(ctx, 32);
  drawSectionHeader(ctx, SUPPORT_SECTION_C_TITLE);
  drawSignatureBlock(ctx, SUPPORT_SIGNATURE_LABELS, { anchorToFoot: false, layout: 'stacked' });

  ctx.y += SECTION_GAP * 2;

  // --- Section D: completed by IT ---
  ensureRoom(ctx, 32);
  drawSectionHeader(ctx, SUPPORT_SECTION_D_TITLE);
  drawSignatureBlock(ctx, SUPPORT_IT_SIGNATURE_LABELS, { anchorToFoot: false, layout: 'stacked' });

  const safeRef = (data.summary || data.requesterName || 'form')
    .trim()
    .slice(0, 60)
    .replace(/[^a-zA-Z0-9-_]+/g, '_');
  doc.save(`IT_Support_Request_${safeRef}.pdf`);
}
