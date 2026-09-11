import jsPDF from 'jspdf';
import { AssetFormData } from '../types';
import companyLogo from '../assets/company-logo.webp';

// Column widths follow the source spreadsheet (Excel units 8.78 / 46.89 /
// 35.78 / 30.66 / 8.78 / 35.78) scaled to the 190mm of printable width on A4
// portrait, with one deviation: Quantity is widened from 10.0mm to 18.1mm
// because its header label measures 12.1mm and was being clipped. The extra
// width is taken proportionally from the three widest columns.
const COL_RATIOS = [0.0527, 0.2593, 0.2047, 0.174, 0.095, 0.2144];

// Uniform vertical gap between the form's sections.
const SECTION_GAP = 5;

const COMPANY_ADDRESS = [
  'Lot 55992, Batu 5 Off Jalan Tunku Abdul Rahman',
  '31200 Ipoh, Perak Malaysia.',
];

// Everything that differs between the asset forms. The layout itself is shared,
// so both sheets stay visually identical and a fix to one fixes both.
export interface AssetFormConfig {
  key: 'disposal' | 'allocation';
  /** Title bar on the printed form. */
  pdfTitle: string;
  sectionATitle: string;
  sectionBTitle: string;
  /** Second table column - what the listed asset is. */
  descriptionHeader: string;
  notes: string[];
  /** Leading part of the downloaded file name. */
  fileStem: string;
  /** Heading shown above the on-screen form. */
  screenTitle: string;
  /** Label for the description field on screen. */
  descriptionPlaceholder: string;
  remarksPlaceholder: string;
  /** Card shown in the "Create Form" picker. */
  pickerTitle: string;
  pickerBlurb: string;
  /** Message when Section B is empty on export. */
  emptyItemsError: string;
  /** Three signing columns at the foot of the printed form. */
  signatureLabels: [string, string, string];
  /** Optional fourth section, completed by IT rather than the requester. */
  sectionD?: SectionD;
}

/** A run of text within a tick-box line, so a single word can be emboldened. */
export interface TextSegment {
  text: string;
  bold?: boolean;
}

export interface SectionD {
  title: string;
  subheading: string;
  /** Each option prints as a line of text with a tick box at the right margin. */
  options: TextSegment[][];
  remarksLabel: string;
  signatories: [string, string];
}

export const DISPOSAL_FORM: AssetFormConfig = {
  key: 'disposal',
  pdfTitle: 'IT FIXED ASSET DISPOSAL REQUEST FORM',
  sectionATitle: 'A. DISPOSAL APPLICATION INFORMATION',
  sectionBTitle: 'B. INVENTORY LIST FOR DISPOSAL',
  descriptionHeader: 'Disposal Description',
  notes: [
    '1. Covers IT assets are withdrawn from service — system units, monitors, keyboards, mice, and attached peripherals that are faulty or obsolete.',
    '2. Check the unit cannot be repaired, upgraded, or redeployed to another user or department before listing it for disposal.',
    '3. Hand over each item as listed — no swapping, cannibalising, or taking parts home. Any missing component must be noted before collection.',
    '4. Cross-check every item against Section B before release and record the actual quantity handed over.',
  ],
  fileStem: 'IT_Asset_Disposal',
  screenTitle: 'IT Fixed Asset Disposal Request',
  descriptionPlaceholder: 'e.g. Desktop system unit',
  remarksPlaceholder: 'e.g. Faulty PSU',
  pickerTitle: 'IT Fixed Asset Disposal Request',
  pickerBlurb:
    'List faulty or obsolete IT assets for withdrawal from service, then export the signed-off PDF.',
  emptyItemsError: 'Add at least one item under Section B before exporting.',
  signatureLabels: ['Requestor', 'HOD', 'IT'],
};

export const ALLOCATION_FORM: AssetFormConfig = {
  key: 'allocation',
  pdfTitle: 'IT FIXED ASSET ALLOCATION FORM',
  sectionATitle: 'A. ALLOCATION APPLICATION INFORMATION',
  sectionBTitle: 'B. INVENTORY LIST FOR ALLOCATION',
  descriptionHeader: 'Asset Description',
  // Official policy wording supplied by the company, with the spelling
  // corrections the owner approved ("due to the", "observe", "referred").
  notes: [
    '1. Employee shall be solely or jointly responsible for the items listed above.',
    '2. Should the item(s) be lost or damaged due to the negligence under the care of employee the company shall reserves the rights to demand from the employee the replacement or payment for the items damaged or lost.',
    '3. Employee shall not transfer the possession of the items without written approval from IT Department and The Management.',
    '4. Upon expiry of the loan/usage period, employee must return the items to IT Department without further delay.',
    '5. Should the employee failed to observe the above guidelines, the matter might be referred to The Management and disciplinary action may be imposed upon the employee.',
  ],
  fileStem: 'IT_Asset_Allocation',
  screenTitle: 'IT Fixed Asset Allocation',
  descriptionPlaceholder: 'e.g. Laptop',
  remarksPlaceholder: 'e.g. New joiner issue',
  pickerTitle: 'IT Fixed Asset Allocation',
  pickerBlurb:
    'Record IT assets issued to an employee, then export the signed-off PDF for handover.',
  emptyItemsError: 'Add at least one item under Section B before exporting.',
  signatureLabels: ['Prepared/Installed By', 'Authorised By', 'Acknowledged/Accepted By'],
  sectionD: {
    title: 'D. FOR IT DEPARTMENT USE',
    subheading: 'Allocated Unit Returned Acknowledgement:',
    options: [
      [{ text: '1. Allocated units returned as stated above in good condition.' }],
      [
        { text: '2. Allocated units returned as stated above ' },
        { text: 'NOT', bold: true },
        { text: ' in good condition.' },
      ],
    ],
    remarksLabel: 'Remarks:',
    signatories: ['Resources Returned By', 'Checked By'],
  },
};

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

export async function exportAssetFormPdf(form: AssetFormData, config: AssetFormConfig) {
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

  // --- Header band: logo (A:B) and the address filling the rest (C:F) ---
  // The spreadsheet left an empty third box; the divider is dropped here so the
  // address block runs to the right edge instead.
  const headerHeight = 18;
  const logo = await loadLogoAsPng();

  doc.rect(colX[0], y, span(0, 1), headerHeight);
  doc.rect(colX[2], y, span(2, 5), headerHeight);

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

  // Centre the address block in its box, horizontally and vertically. The
  // first baseline is offset by half the block height plus the font's rough
  // ascent so the two lines sit optically centred rather than top-aligned.
  const addressLineHeight = 4.5;
  const addressCentreX = colX[2] + span(2, 5) / 2;
  const addressFirstBaseline =
    y + headerHeight / 2 - ((COMPANY_ADDRESS.length - 1) * addressLineHeight) / 2 + 1.2;

  COMPANY_ADDRESS.forEach((line, i) => {
    doc.text(line, addressCentreX, addressFirstBaseline + i * addressLineHeight, { align: 'center' });
  });

  y += headerHeight;

  // --- Title bar ---
  const titleHeight = 7;
  doc.setFillColor(217, 217, 217);
  doc.rect(margin, y, contentWidth, titleHeight, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(config.pdfTitle, pageWidth / 2, y + 4.8, { align: 'center' });
  // Title sits flush on Section A, as it does in the source spreadsheet.
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
  sectionHeader(config.sectionATitle);

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

  y += SECTION_GAP;

  // --- Section B: inventory list ---
  sectionHeader(config.sectionBTitle);

  const tableHeaders = [
    'No.',
    config.descriptionHeader,
    'Spec / Model',
    'Serial Number',
    'Quantity',
    'Remarks',
  ];
  const headerRowHeight = 7;

  tableHeaders.forEach((label, i) => {
    // doc.text() sets the non-stroking colour to the text colour, so the fill
    // has to be re-set before every filled rect - otherwise each cell after the
    // first inherits black and paints over its own label.
    doc.setFillColor(242, 242, 242);
    doc.rect(colX[i], y, colWidths[i], headerRowHeight, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(label, colX[i] + colWidths[i] / 2, y + 4.6, { align: 'center' });
  });
  y += headerRowHeight;

  const bodyRowHeight = 7;
  const bodyLineHeight = 3.6;
  const cellPadX = 1.5;
  const firstBaseline = 4.6;
  // The table prints exactly the rows the requester filled in - no padding to a
  // fixed count - so the PDF matches what they saw on screen.
  const printedRows = Math.max(form.items.length, 1);

  for (let i = 0; i < printedRows; i++) {
    const item = form.items[i];
    const cells = [
      String(i + 1),
      item?.description || '',
      item?.specModel || '',
      item?.serialNumber || '',
      item?.quantity || '',
      item?.remarks || '',
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    // Wrap each cell to its column. splitTextToSize honours the newlines the
    // requester typed as well as wrapping anything too long, so a cell holding
    // "os: win 11\ncpu speed: 123" comes back as two lines.
    const wrapped = cells.map((text, c) =>
      text ? (doc.splitTextToSize(text, colWidths[c] - cellPadX * 2) as string[]) : []
    );

    // The row grows to whichever cell needs the most lines.
    const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));
    const rowHeight = Math.max(bodyRowHeight, maxLines * bodyLineHeight + 3);

    // Start a new page before a row would cross the bottom margin.
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    wrapped.forEach((lines, c) => {
      doc.rect(colX[c], y, colWidths[c], rowHeight);
      if (!lines.length) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      // Centre the narrow numeric columns, left-align the prose ones.
      const centred = c === 0 || c === 4;
      doc.text(
        lines,
        centred ? colX[c] + colWidths[c] / 2 : colX[c] + cellPadX,
        y + firstBaseline,
        centred ? { align: 'center' } : undefined
      );
    });

    y += rowHeight;
  }

  y += SECTION_GAP;

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
  config.notes.forEach((note) => {
    const lines = doc.splitTextToSize(note, contentWidth - 4);
    const h = Math.max(6, lines.length * 4 + 2);
    doc.rect(margin, y, contentWidth, h);
    doc.text(lines, margin + 2, y + 4.2);
    y += h;
  });

  // --- Signature block ---
  // Three equal columns rather than the spreadsheet's uneven merges, so the
  // signing lines are the same length.
  const sigLabels = config.signatureLabels;
  const sigColWidth = contentWidth / 3;
  const sigGutter = 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Widest label decides where every colon sits, in every column.
  const inlineLabelWidth = Math.max(...[...sigLabels, 'Date'].map((l) => doc.getTextWidth(l))) + 2;
  const inlineLineLength = sigColWidth - sigGutter - (inlineLabelWidth + 3);

  // Short labels sit beside their signing line with the colons aligned. Long
  // ones (the allocation form's "Acknowledged/Accepted By") would squeeze the
  // line down to about 11mm, so those stack the label above a full-width line.
  const MIN_INLINE_LINE = 25;
  const stacked = inlineLineLength < MIN_INLINE_LINE;

  const signatureBlockHeight = stacked ? 20 : 14;
  const signatureFootRoom = 10;
  const naturalSignatureY = y + SECTION_GAP * 2;
  const anchoredSignatureY = pageHeight - margin - signatureBlockHeight - signatureFootRoom;

  // With a Section D to follow, the signatures stay where they fall so there is
  // room beneath them. Otherwise a short form would leave the lower half of the
  // page blank, so drop them to the foot of the sheet when there is room.
  if (naturalSignatureY + signatureBlockHeight > pageHeight - margin) {
    doc.addPage();
    y = config.sectionD ? margin : anchoredSignatureY;
  } else if (config.sectionD) {
    y = naturalSignatureY;
  } else {
    y = Math.max(naturalSignatureY, anchoredSignatureY);
  }

  if (stacked) {
    doc.setFontSize(8);
    const dateLabelWidth = doc.getTextWidth('Date') + 2;

    sigLabels.forEach((label, i) => {
      const x = margin + i * sigColWidth;
      const lineEnd = x + sigColWidth - sigGutter;

      doc.text(`${label}:`, x, y);
      doc.line(x, y + 6, lineEnd, y + 6);

      doc.text('Date', x, y + 14);
      doc.text(':', x + dateLabelWidth, y + 14);
      doc.line(x + dateLabelWidth + 3, y + 15, lineEnd, y + 15);
    });
  } else {
    // Within a column the colon sits at a fixed offset, which lines
    // "Requestor :" up with "Date :" beneath it.
    const signatureRow = (labels: string[], rowY: number) => {
      labels.forEach((label, i) => {
        const x = margin + i * sigColWidth;
        doc.text(label, x, rowY);
        doc.text(':', x + inlineLabelWidth, rowY);
        doc.line(x + inlineLabelWidth + 3, rowY + 1, x + sigColWidth - sigGutter, rowY + 1);
      });
    };

    signatureRow(sigLabels, y);
    y += 10;
    signatureRow(['Date', 'Date', 'Date'], y);
  }

  y += stacked ? 16 : 6;

  // --- Section D: completed by IT when the asset comes back ---
  if (config.sectionD) {
    const d = config.sectionD;
    const tickBoxSize = 4;
    const tickBoxX = margin + contentWidth - tickBoxSize - 2;
    const sectionDHeight = 60;

    if (y + sectionDHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    sectionHeader(d.title);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(d.subheading, margin, y);
    y += 6;

    doc.setFontSize(8);
    d.options.forEach((segments) => {
      // Draw the runs left to right so a single word can be bold mid-sentence.
      let x = margin;
      segments.forEach((segment) => {
        doc.setFont('helvetica', segment.bold ? 'bold' : 'normal');
        doc.text(segment.text, x, y);
        x += doc.getTextWidth(segment.text);
      });
      doc.rect(tickBoxX, y - tickBoxSize + 1, tickBoxSize, tickBoxSize);
      y += 6;
    });

    y += 2;

    // Remarks rule runs to the right margin.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(d.remarksLabel, margin, y);
    const remarksLabelWidth = doc.getTextWidth(d.remarksLabel);
    doc.line(margin + remarksLabelWidth + 2, y + 1, margin + contentWidth, y + 1);

    y += 16;

    // Two evenly spaced signing columns, label above a full-width line.
    const dColWidth = contentWidth / 2;
    const dGutter = 10;
    doc.setFontSize(8);
    d.signatories.forEach((label, i) => {
      const x = margin + i * dColWidth;
      doc.text(`${label}:`, x, y);
      doc.line(x, y + 10, x + dColWidth - dGutter, y + 10);
    });
  }

  const safeRef = (form.referenceNo || form.submittedBy || 'form').replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`${config.fileStem}_${safeRef}.pdf`);
}
