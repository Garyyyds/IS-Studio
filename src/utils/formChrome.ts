import jsPDF from 'jspdf';
import companyLogo from '../assets/company-logo.webp';

// Shared furniture for every printed company form: the logo/address band, the
// grey title bar, the pale-blue section headers and the signing block. Each
// form supplies its own body but draws the same chrome, so the sheets stay
// recognisably one family and a fix here reaches all of them.

export const MARGIN = 10;

/** Uniform vertical gap between a form's sections. */
export const SECTION_GAP = 5;

export const COMPANY_ADDRESS = [
  'Lot 55992, Batu 5 Off Jalan Tunku Abdul Rahman',
  '31200 Ipoh, Perak Malaysia.',
];

export interface FormDoc {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  /** Current vertical cursor, in mm from the top of the page. */
  y: number;
}

export function createFormDoc(): FormDoc {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  return {
    doc,
    pageWidth,
    pageHeight,
    margin: MARGIN,
    contentWidth: pageWidth - MARGIN * 2,
    y: MARGIN,
  };
}

// jsPDF cannot embed WebP. Browsers decode it natively, so round-trip the logo
// through a canvas to get PNG bytes. Returns null rather than throwing - a
// missing logo must not stop someone exporting their form.
export async function loadLogoAsPng(): Promise<{
  data: string;
  width: number;
  height: number;
} | null> {
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

/**
 * Logo on the left, address filling the rest. `logoWidth` lets a form match the
 * column grid of its own table; it defaults to a third of the content width.
 */
export async function drawHeaderBand(ctx: FormDoc, logoWidth?: number) {
  const { doc, margin, contentWidth } = ctx;
  const headerHeight = 18;
  const logoCellWidth = logoWidth ?? contentWidth / 3;
  const addressX = margin + logoCellWidth;
  const addressWidth = contentWidth - logoCellWidth;

  const logo = await loadLogoAsPng();

  doc.rect(margin, ctx.y, logoCellWidth, headerHeight);
  doc.rect(addressX, ctx.y, addressWidth, headerHeight);

  if (logo) {
    // Fit inside the logo cell while preserving the source aspect ratio.
    const maxW = logoCellWidth - 8;
    const maxH = headerHeight - 5;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const drawW = logo.width * ratio;
    const drawH = logo.height * ratio;
    doc.addImage(
      logo.data,
      'PNG',
      margin + (logoCellWidth - drawW) / 2,
      ctx.y + (headerHeight - drawH) / 2,
      drawW,
      drawH
    );
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  // Centre the address block in its box, horizontally and vertically. The
  // first baseline is offset by half the block height plus the font's rough
  // ascent so the lines sit optically centred rather than top-aligned.
  const lineHeight = 4.5;
  const centreX = addressX + addressWidth / 2;
  const firstBaseline =
    ctx.y + headerHeight / 2 - ((COMPANY_ADDRESS.length - 1) * lineHeight) / 2 + 1.2;

  COMPANY_ADDRESS.forEach((line, i) => {
    doc.text(line, centreX, firstBaseline + i * lineHeight, { align: 'center' });
  });

  ctx.y += headerHeight;
}

/** Grey title bar. Sits flush on the first section, as the spreadsheets do. */
export function drawTitleBar(ctx: FormDoc, title: string) {
  const { doc, margin, contentWidth, pageWidth } = ctx;
  const height = 7;

  doc.setFillColor(217, 217, 217);
  doc.rect(margin, ctx.y, contentWidth, height, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(title, pageWidth / 2, ctx.y + 4.8, { align: 'center' });

  ctx.y += height;
}

/** Pale-blue full-width section header. */
export function drawSectionHeader(ctx: FormDoc, label: string) {
  const { doc, margin, contentWidth, pageWidth } = ctx;
  const height = 6.5;

  doc.setFillColor(221, 235, 247);
  doc.rect(margin, ctx.y, contentWidth, height, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(label, pageWidth / 2, ctx.y + 4.4, { align: 'center' });

  ctx.y += height;
}

/** One row of the applicant block: a labelled value on each half of the page. */
export type InfoRow = [leftLabel: string, leftValue: string, rightLabel: string, rightValue: string];

/**
 * The two-column applicant block shared by every form. `splitAt` is the x of
 * the right-hand cell; it defaults to the middle of the content area, and the
 * asset forms pass their table's column boundary so the cells line up with the
 * inventory grid beneath.
 */
export function drawInfoRows(ctx: FormDoc, rows: InfoRow[], splitAt?: number) {
  const { doc, margin, contentWidth } = ctx;
  const rightX = splitAt ?? margin + contentWidth / 2;
  const leftWidth = rightX - margin;
  const rightWidth = margin + contentWidth - rightX;
  const rowHeight = 7;

  rows.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
    doc.rect(margin, ctx.y, leftWidth, rowHeight);
    doc.rect(rightX, ctx.y, rightWidth, rowHeight);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(leftLabel, margin + 2, ctx.y + 4.6);
    doc.text(rightLabel, rightX + 2, ctx.y + 4.6);

    doc.setFont('helvetica', 'normal');
    if (leftValue) doc.text(leftValue, margin + 4 + doc.getTextWidth(leftLabel), ctx.y + 4.6);
    if (rightValue) doc.text(rightValue, rightX + 4 + doc.getTextWidth(rightLabel), ctx.y + 4.6);

    ctx.y += rowHeight;
  });
}

/**
 * A labelled remarks block: one ruled line per line of text, each running to
 * the right margin. The first rule starts after the label; the rest span the
 * full width. Blank rules are still printed so there is room to write by hand.
 */
export function drawRuledRemarks(ctx: FormDoc, label: string, value?: string, minRules = 2) {
  const { doc, margin, contentWidth } = ctx;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(label, margin, ctx.y);

  const start = margin + doc.getTextWidth(label) + 2;
  // Wrapped to the shorter first-line width so every line fits either rule.
  const lines = value?.trim()
    ? (doc.splitTextToSize(value.trim(), margin + contentWidth - start - 2) as string[])
    : [];
  const rules = Math.max(minRules, lines.length);

  for (let i = 0; i < rules; i++) {
    const lineStart = i === 0 ? start : margin;
    doc.line(lineStart, ctx.y + 1, margin + contentWidth, ctx.y + 1);
    if (lines[i]) doc.text(lines[i], lineStart + 1, ctx.y);
    ctx.y += 6;
  }
}

/** Height drawRuledRemarks will occupy, for page-break decisions. */
export function measureRuledRemarks(ctx: FormDoc, label: string, value?: string, minRules = 2) {
  const { doc, margin, contentWidth } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const start = margin + doc.getTextWidth(label) + 2;
  const lines = value?.trim()
    ? (doc.splitTextToSize(value.trim(), margin + contentWidth - start - 2) as string[])
    : [];
  return Math.max(minRules, lines.length) * 6;
}

/** A tick box, optionally ticked, drawn with its top-left at (x, y). */
export function drawTickBox(ctx: FormDoc, x: number, y: number, size: number, ticked?: boolean) {
  const { doc } = ctx;
  doc.rect(x, y, size, size);
  if (!ticked) return;

  doc.setLineWidth(0.5);
  doc.line(x + size * 0.2, y + size * 0.52, x + size * 0.4, y + size * 0.78);
  doc.line(x + size * 0.4, y + size * 0.78, x + size * 0.82, y + size * 0.22);
  doc.setLineWidth(0.2);
}

/**
 * Three equal signing columns. Short labels sit beside their line with the
 * colons aligned; long ones stack above a full-width line, because inline would
 * squeeze the writing space down to a few millimetres.
 */
export function drawSignatureBlock(
  ctx: FormDoc,
  labels: string[],
  options: { anchorToFoot: boolean; layout?: 'auto' | 'stacked' }
): void {
  const { doc, margin, contentWidth, pageHeight } = ctx;
  const colWidth = contentWidth / labels.length;
  const gutter = 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const inlineLabelWidth = Math.max(...[...labels, 'Date'].map((l) => doc.getTextWidth(l))) + 2;
  const inlineLineLength = colWidth - gutter - (inlineLabelWidth + 3);

  // Short labels would fit inline, but a form that already stacks one block
  // can ask for the same treatment so its sections match.
  const MIN_INLINE_LINE = 25;
  const stacked = options.layout === 'stacked' || inlineLineLength < MIN_INLINE_LINE;

  const blockHeight = stacked ? 20 : 14;
  const footRoom = 10;
  const naturalY = ctx.y + SECTION_GAP * 2;
  const anchoredY = pageHeight - margin - blockHeight - footRoom;

  if (naturalY + blockHeight > pageHeight - margin) {
    doc.addPage();
    ctx.y = options.anchorToFoot ? anchoredY : margin;
  } else if (options.anchorToFoot) {
    ctx.y = Math.max(naturalY, anchoredY);
  } else {
    ctx.y = naturalY;
  }

  const top = ctx.y;

  if (stacked) {
    doc.setFontSize(8);
    const dateLabelWidth = doc.getTextWidth('Date') + 2;

    labels.forEach((label, i) => {
      const x = margin + i * colWidth;
      const lineEnd = x + colWidth - gutter;

      doc.text(`${label}:`, x, top);
      doc.line(x, top + 6, lineEnd, top + 6);

      doc.text('Date', x, top + 14);
      doc.text(':', x + dateLabelWidth, top + 14);
      doc.line(x + dateLabelWidth + 3, top + 15, lineEnd, top + 15);
    });

    ctx.y = top + 15;
  } else {
    const row = (rowLabels: string[], rowY: number) => {
      rowLabels.forEach((label, i) => {
        const x = margin + i * colWidth;
        doc.text(label, x, rowY);
        doc.text(':', x + inlineLabelWidth, rowY);
        doc.line(x + inlineLabelWidth + 3, rowY + 1, x + colWidth - gutter, rowY + 1);
      });
    };

    row(labels, top);
    row(labels.map(() => 'Date'), top + 10);
    ctx.y = top + 11;
  }
}

/** Start a new page when `height` would not fit below the cursor. */
export function ensureRoom(ctx: FormDoc, height: number): void {
  if (ctx.y + height > ctx.pageHeight - ctx.margin) {
    ctx.doc.addPage();
    ctx.y = ctx.margin;
  }
}

export interface TableColumn {
  header: string;
  /** Share of the content width. Shares are normalised, so they need not sum to 1. */
  width: number;
  align?: 'left' | 'center' | 'right';
}

/**
 * A bordered item table with a grey header row, cells that grow to fit wrapped
 * or multi-line text, and an optional total strip. Rows that would cross the
 * bottom margin move to a new page, which repeats the header so the columns
 * stay readable.
 */
export function drawItemTable(
  ctx: FormDoc,
  columns: TableColumn[],
  rows: string[][],
  options: { totalLabel?: string; totalValue?: string } = {}
): void {
  const { doc, margin, contentWidth } = ctx;

  const totalShare = columns.reduce((sum, c) => sum + c.width, 0);
  const colWidths = columns.map((c) => (c.width / totalShare) * contentWidth);
  const colX: number[] = [margin];
  colWidths.forEach((w, i) => colX.push(colX[i] + w));

  const headerHeight = 7;
  const lineHeight = 3.6;
  const padX = 1.5;
  const firstBaseline = 4.6;

  const drawHeaderRow = () => {
    columns.forEach((col, i) => {
      // doc.text() sets the non-stroking colour, so the fill has to be re-set
      // before every filled rect - otherwise each cell after the first inherits
      // the text colour and paints over its own label.
      doc.setFillColor(242, 242, 242);
      doc.rect(colX[i], ctx.y, colWidths[i], headerHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(col.header, colX[i] + colWidths[i] / 2, ctx.y + firstBaseline, { align: 'center' });
    });
    ctx.y += headerHeight;
  };

  drawHeaderRow();

  rows.forEach((cells) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    // splitTextToSize honours typed newlines as well as wrapping anything too
    // long, so a cell holding two lines comes back as two.
    const wrapped = cells.map((text, c) =>
      text ? (doc.splitTextToSize(text, colWidths[c] - padX * 2) as string[]) : []
    );
    const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));
    const rowHeight = Math.max(7, maxLines * lineHeight + 3);

    if (ctx.y + rowHeight > ctx.pageHeight - margin) {
      doc.addPage();
      ctx.y = margin;
      drawHeaderRow();
    }

    wrapped.forEach((lines, c) => {
      doc.rect(colX[c], ctx.y, colWidths[c], rowHeight);
      if (!lines.length) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const align = columns[c].align ?? 'left';
      const x =
        align === 'center'
          ? colX[c] + colWidths[c] / 2
          : align === 'right'
            ? colX[c] + colWidths[c] - padX
            : colX[c] + padX;
      doc.text(lines, x, ctx.y + firstBaseline, align === 'left' ? undefined : { align });
    });

    ctx.y += rowHeight;
  });

  if (options.totalLabel === undefined) return;

  // The total spans everything left of the final column, so the figure lands
  // under the prices it adds up.
  const lastIndex = columns.length - 1;
  const totalRowHeight = 7;
  ensureRoom(ctx, totalRowHeight);

  doc.setFillColor(242, 242, 242);
  doc.rect(colX[0], ctx.y, colX[lastIndex] - colX[0], totalRowHeight, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(options.totalLabel, colX[lastIndex] - padX, ctx.y + firstBaseline, { align: 'right' });

  doc.setFillColor(255, 255, 255);
  doc.rect(colX[lastIndex], ctx.y, colWidths[lastIndex], totalRowHeight, 'FD');
  doc.setTextColor(0, 0, 0);
  doc.text(options.totalValue ?? '', colX[lastIndex] + colWidths[lastIndex] - padX, ctx.y + firstBaseline, {
    align: 'right',
  });

  ctx.y += totalRowHeight;
}

/** Small grey italic footnote, e.g. the estimated-price caveat. */
export function drawFootnote(ctx: FormDoc, text: string): void {
  const { doc, margin, contentWidth } = ctx;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  const lines = doc.splitTextToSize(text, contentWidth) as string[];
  ctx.y += 3.6;
  doc.text(lines, margin, ctx.y);
  ctx.y += (lines.length - 1) * 3.6;
  doc.setTextColor(0, 0, 0);
}

/**
 * A row of tick-box options on one baseline, all sharing a column pitch wide
 * enough for the longest label so stacked rows line up under each other.
 */
export function drawTickOptions(
  ctx: FormDoc,
  startX: number,
  pitch: number,
  options: { label: string; ticked: boolean }[]
): void {
  const { doc } = ctx;
  const size = 3.6;
  const labelOffset = size + 2.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  options.forEach((option, i) => {
    const x = startX + i * pitch;
    drawTickBox(ctx, x, ctx.y - size + 0.6, size, option.ticked);
    doc.text(option.label, x + labelOffset, ctx.y);
  });
}

/** Pitch wide enough for the longest of `labels` plus its tick box. */
export function tickOptionPitch(ctx: FormDoc, labels: string[]): number {
  const { doc } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  return 3.6 + 2.5 + Math.max(...labels.map((l) => doc.getTextWidth(l))) + 10;
}
