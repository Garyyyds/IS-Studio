import jsPDF from 'jspdf';
import { DisposalFormData } from '../types';
import companyLogo from '../assets/company-logo.webp';

// Column widths are taken from the source spreadsheet (Excel units 8.78 / 46.89 /
// 35.78 / 30.66 / 8.78 / 35.78, totalling 166.67) and scaled to the 190mm of
// printable width on A4 portrait, so the PDF keeps the proportions of the
// original form.
const COL_RATIOS = [0.0527, 0.2813, 0.2147, 0.184, 0.0527, 0.2147];

export const DISPOSAL_NOTES = [
  '1. Covers IT assets are withdrawn from service — system units, monitors, keyboards, mice, and attached peripherals that are faulty or obsolete.',
  '2. Check the unit cannot be repaired, upgraded, or redeployed to another user or department before listing it for disposal.',
  '3. Hand over each item as listed — no swapping, cannibalising, or taking parts home. Any missing component must be noted before collection.',
  '4. Cross-check every item against Section B before release and record the actual quantity handed over.',
];

const COMPANY_ADDRESS = [
  'Lot 55992, Batu 5 Off Jalan Tunku Abdul Rahman',
  '31200 Ipoh, Perak Malaysia.',
];

// jsPDF cannot embed WebP. Browsers decode it natively, so round-trip the logo
// through a canvas to get PNG bytes. Returns null rather than throwing - a
// missing logo must not stop someone exporting their form.
async function loadLogoAsPng(): Promise<{ data: string; width: number; height: number } | null> {
  try {
    const image = new Image();
    image.src = companyLogo;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('logo failed to load'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);

    return {
      data: canvas.toDataURL('image/png'),
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } catch {
    return null;
  }
}

export async function exportDisposalFormPdf(form: DisposalFormData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  const colWidths = COL_RATIOS.map((r) => r * contentWidth);
  // x offset of each column, plus the right edge as the final entry.
  const colX: number[] = [margin];
  colWidths.forEach((w, i) => colX.push(colX[i] + w));

  // Width spanning columns [from, to] inclusive.
  const span = (from: number, to: number) => colX[to + 1] - colX[from];

  let y = margin;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  // --- Header band: logo (A:B), address (C:D), empty box (E:F) ---
  const headerHeight = 18;
  const logo = await loadLogoAsPng();

  doc.rect(colX[0], y, span(0, 1), headerHeight);
  doc.rect(colX[2], y, span(2, 3), headerHeight);
  doc.rect(colX[4], y, span(4, 5), headerHeight);

  if (logo) {
    // Fit inside the logo cell while preserving the source aspect ratio.
    const maxW = span(0, 1) - 8;
    const maxH = headerHeight - 5;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const drawW = logo.width * ratio;
    const drawH = logo.height * ratio;
    doc.addImage(
      logo.data,
      'PNG',
      colX[0] + (span(0, 1) - drawW) / 2,
      y + (headerHeight - drawH) / 2,
      drawW,
      drawH
    );
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  COMPANY_ADDRESS.forEach((line, i) => {
    doc.text(line, colX[2] + 2, y + 6 + i * 4.5);
  });

  y += headerHeight;

  // --- Title bar ---
  const titleHeight = 7;
  doc.setFillColor(217, 217, 217);
  doc.rect(margin, y, contentWidth, titleHeight, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('IT FIXED ASSET DISPOSAL REQUEST FORM', pageWidth / 2, y + 4.8, { align: 'center' });
  y += titleHeight;

  // Shared renderer for the three pale-blue section headers.
  const sectionHeader = (label: string) => {
    const h = 6.5;
    doc.setFillColor(221, 235, 247);
    doc.rect(margin, y, contentWidth, h, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(label, pageWidth / 2, y + 4.4, { align: 'center' });
    y += h;
  };

  // --- Section A: application information ---
  sectionHeader('A. DISPOSAL APPLICATION INFORMATION');

  const infoRowHeight = 7;
  const infoRows: [string, string, string, string][] = [
    ['Employee ID:', form.employeeId, 'Reference No:', form.referenceNo],
    ['Submitted By:', form.submittedBy, 'Request Date:', form.requestDate],
    ['Department:', form.department, 'Location:', form.location],
  ];

  infoRows.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
    doc.rect(colX[0], y, span(0, 2), infoRowHeight);
    doc.rect(colX[3], y, span(3, 5), infoRowHeight);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(leftLabel, colX[0] + 2, y + 4.6);
    doc.text(rightLabel, colX[3] + 2, y + 4.6);

    doc.setFont('helvetica', 'normal');
    const leftLabelW = doc.getTextWidth(leftLabel);
    const rightLabelW = doc.getTextWidth(rightLabel);
    if (leftValue) doc.text(leftValue, colX[0] + 4 + leftLabelW, y + 4.6);
    if (rightValue) doc.text(rightValue, colX[3] + 4 + rightLabelW, y + 4.6);

    y += infoRowHeight;
  });

  y += 4;

  // --- Section B: inventory list ---
  sectionHeader('B. INVENTORY LIST FOR DISPOSAL');

  const tableHeaders = ['No.', 'Disposal Description', 'Spec / Model', 'Serial Number', 'Quantity', 'Remarks'];
  const headerRowHeight = 7;

  doc.setFillColor(242, 242, 242);
  tableHeaders.forEach((label, i) => {
    doc.rect(colX[i], y, colWidths[i], headerRowHeight, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(label, colX[i] + colWidths[i] / 2, y + 4.6, { align: 'center' });
  });
  y += headerRowHeight;

  const bodyRowHeight = 7;
  // The table prints exactly the rows the requester filled in - no padding to a
  // fixed count - so the PDF matches what they saw on screen.
  const printedRows = Math.max(form.items.length, 1);

  for (let i = 0; i < printedRows; i++) {
    // Start a new page before a row would cross the bottom margin.
    if (y + bodyRowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    const item = form.items[i];
    const cells = [
      String(i + 1),
      item?.description || '',
      item?.specModel || '',
      item?.serialNumber || '',
      item?.quantity || '',
      item?.remarks || '',
    ];

    cells.forEach((text, c) => {
      doc.rect(colX[c], y, colWidths[c], bodyRowHeight);
      if (!text) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      // Centre the narrow numeric columns, left-align the prose ones.
      const centred = c === 0 || c === 4;
      const available = colWidths[c] - 3;
      const clipped = doc.splitTextToSize(text, available)[0];
      doc.text(
        clipped,
        centred ? colX[c] + colWidths[c] / 2 : colX[c] + 1.5,
        y + 4.6,
        centred ? { align: 'center' } : undefined
      );
    });

    y += bodyRowHeight;
  }

  y += 4;

  // --- Section C: acknowledgement ---
  if (y + 60 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }

  sectionHeader('C. ACKNOWLEDGEMENT');

  const noteLabelHeight = 6;
  doc.rect(margin, y, contentWidth, noteLabelHeight);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Note:', margin + 2, y + 4.2);
  y += noteLabelHeight;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  DISPOSAL_NOTES.forEach((note) => {
    const lines = doc.splitTextToSize(note, contentWidth - 4);
    const h = Math.max(6, lines.length * 4 + 2);
    doc.rect(margin, y, contentWidth, h);
    doc.text(lines, margin + 2, y + 4.2);
    y += h;
  });

  y += 12;

  // --- Signature block: Requestor (A:B), HOD (C:D), IT (E:F) ---
  const sigColumns: [string, number, number][] = [
    ['Requestor:', 0, 1],
    ['HOD:', 2, 3],
    ['IT:', 4, 5],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  sigColumns.forEach(([label, from, to]) => {
    doc.text(label, colX[from], y);
    // Signing line, inset so it does not butt against the next column.
    doc.line(colX[from] + doc.getTextWidth(label) + 2, y + 1, colX[from] + span(from, to) - 4, y + 1);
  });

  y += 10;

  sigColumns.forEach(([, from, to]) => {
    doc.text('Date:', colX[from], y);
    doc.line(colX[from] + doc.getTextWidth('Date:') + 2, y + 1, colX[from] + span(from, to) - 4, y + 1);
  });

  const safeRef = (form.referenceNo || form.submittedBy || 'form').replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`IT_Asset_Disposal_${safeRef}.pdf`);
}
