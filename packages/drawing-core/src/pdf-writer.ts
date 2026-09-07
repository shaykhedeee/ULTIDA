import { PassThrough, type Writable } from 'node:stream';

export interface PageSize {
  width: number;
  height: number;
}

export const PAGE_SIZES: Record<string, PageSize> = {
  A4_PORTRAIT: { width: 595.28, height: 841.89 },
  A4_LANDSCAPE: { width: 841.89, height: 595.28 },
  A3_LANDSCAPE: { width: 1190.55, height: 841.89 },
};

export function formatDualMm(mm: number): string {
  if (!Number.isFinite(mm)) return '0 mm [0"]';
  const roundedMm = Math.round(mm);
  const totalInches = mm / 25.4;
  const feet = Math.floor(totalInches / 12);
  const remInches = totalInches - feet * 12;
  const wholeInches = Math.floor(remInches);
  const fraction = remInches - wholeInches;

  const eighths = Math.round(fraction * 8);
  let inchVal = wholeInches;
  let fracStr = '';

  if (eighths === 8) {
    inchVal += 1;
  } else if (eighths === 7) {
    fracStr = '⅞';
  } else if (eighths === 6) {
    fracStr = '¾';
  } else if (eighths === 5) {
    fracStr = '⅝';
  } else if (eighths === 4) {
    fracStr = '½';
  } else if (eighths === 3) {
    fracStr = '⅜';
  } else if (eighths === 2) {
    fracStr = '¼';
  } else if (eighths === 1) {
    fracStr = '⅛';
  }

  let finalFeet = feet;
  if (inchVal === 12) {
    finalFeet += 1;
    inchVal = 0;
  }

  const inchDisplay = inchVal === 0 && fracStr ? fracStr : `${inchVal}${fracStr}`;
  if (finalFeet === 0) {
    return `${roundedMm} mm [${inchDisplay}"]`;
  }
  return `${roundedMm} mm [${finalFeet}' ${inchDisplay}"]`;
}

export function parseHexColor(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

interface PdfPage {
  width: number;
  height: number;
  ops: string[];
}

export interface PdfWriterOptions {
  size?: 'A4' | 'A3';
  layout?: 'portrait' | 'landscape';
  margin?: number;
  info?: {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
  };
}

export class PdfWriter {
  private pages: PdfPage[] = [];
  private currentPageIndex = -1;
  private currentFont: 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique' | 'Courier' = 'Helvetica';
  private currentFontSize = 10;
  private currentFillColor: [number, number, number] = [0, 0, 0];
  private currentStrokeColor: [number, number, number] = [0, 0, 0];
  private currentLineWidth = 1;
  private currentDashPattern: number[] | null = null;
  private info: Record<string, string>;
  private defaultWidth: number;
  private defaultHeight: number;
  private margin: number;
  private pipedStreams: Writable[] = [];

  constructor(options: PdfWriterOptions = {}) {
    const isLandscape = options.layout === 'landscape';
    const isA3 = options.size === 'A3';
    if (isA3) {
      this.defaultWidth = isLandscape ? PAGE_SIZES.A3_LANDSCAPE.width : PAGE_SIZES.A3_LANDSCAPE.height;
      this.defaultHeight = isLandscape ? PAGE_SIZES.A3_LANDSCAPE.height : PAGE_SIZES.A3_LANDSCAPE.width;
    } else {
      this.defaultWidth = isLandscape ? PAGE_SIZES.A4_LANDSCAPE.width : PAGE_SIZES.A4_PORTRAIT.width;
      this.defaultHeight = isLandscape ? PAGE_SIZES.A4_LANDSCAPE.height : PAGE_SIZES.A4_PORTRAIT.height;
    }
    this.margin = options.margin ?? 24;
    this.info = {
      Title: options.info?.Title ?? 'ULTIDA Production Document',
      Author: options.info?.Author ?? 'ULTIDA Architectural OS',
      Subject: options.info?.Subject ?? 'Architectural CAD Execution Dossier',
      Creator: options.info?.Creator ?? 'ULTIDA CAD Engine',
    };
    this.addPage({ size: options.size, layout: options.layout });
  }

  public get pageWidth(): number {
    return this.currentPage?.width ?? this.defaultWidth;
  }

  public get pageHeight(): number {
    return this.currentPage?.height ?? this.defaultHeight;
  }

  public get pageCount(): number {
    return this.pages.length;
  }

  private get currentPage(): PdfPage | undefined {
    return this.pages[this.currentPageIndex];
  }

  public pipe(stream: Writable): this {
    this.pipedStreams.push(stream);
    return this;
  }

  public addPage(options: { size?: 'A4' | 'A3'; layout?: 'portrait' | 'landscape'; margin?: number } = {}): this {
    const isLandscape = options.layout === 'landscape';
    const isA3 = options.size === 'A3';
    let width = this.defaultWidth;
    let height = this.defaultHeight;
    if (isA3) {
      width = isLandscape ? PAGE_SIZES.A3_LANDSCAPE.width : PAGE_SIZES.A3_LANDSCAPE.height;
      height = isLandscape ? PAGE_SIZES.A3_LANDSCAPE.height : PAGE_SIZES.A3_LANDSCAPE.width;
    } else if (options.layout) {
      width = isLandscape ? PAGE_SIZES.A4_LANDSCAPE.width : PAGE_SIZES.A4_PORTRAIT.width;
      height = isLandscape ? PAGE_SIZES.A4_LANDSCAPE.height : PAGE_SIZES.A4_PORTRAIT.height;
    }

    const page: PdfPage = {
      width,
      height,
      ops: [],
    };
    this.pages.push(page);
    this.currentPageIndex = this.pages.length - 1;
    return this;
  }

  // Convert top-left (x, y) to PDF bottom-left (x, pageHeight - y)
  private toPdfY(y: number): number {
    return this.pageHeight - y;
  }

  public font(fontName: string): this {
    if (fontName.toLowerCase().includes('bold')) {
      this.currentFont = 'Helvetica-Bold';
    } else if (fontName.toLowerCase().includes('oblique') || fontName.toLowerCase().includes('italic')) {
      this.currentFont = 'Helvetica-Oblique';
    } else if (fontName.toLowerCase().includes('courier')) {
      this.currentFont = 'Courier';
    } else {
      this.currentFont = 'Helvetica';
    }
    return this;
  }

  public fontSize(size: number): this {
    this.currentFontSize = Math.max(1, size);
    return this;
  }

  public fillColor(color: string | [number, number, number]): this {
    const rgb = typeof color === 'string' ? parseHexColor(color) : color;
    this.currentFillColor = rgb;
    this.currentPage?.ops.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`);
    return this;
  }

  public strokeColor(color: string | [number, number, number]): this {
    const rgb = typeof color === 'string' ? parseHexColor(color) : color;
    this.currentStrokeColor = rgb;
    this.currentPage?.ops.push(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} RG`);
    return this;
  }

  public fillOpacity(_opacity: number): this {
    return this;
  }

  public lineWidth(width: number): this {
    this.currentLineWidth = Math.max(0.1, width);
    this.currentPage?.ops.push(`${this.currentLineWidth.toFixed(2)} w`);
    return this;
  }

  public dash(length: number, options: { space?: number } = {}): this {
    const space = options.space ?? length;
    this.currentDashPattern = [length, space];
    this.currentPage?.ops.push(`[${length} ${space}] 0 d`);
    return this;
  }

  public undash(): this {
    this.currentDashPattern = null;
    this.currentPage?.ops.push('[] 0 d');
    return this;
  }

  public save(): this {
    this.currentPage?.ops.push('q');
    return this;
  }

  public restore(): this {
    this.currentPage?.ops.push('Q');
    return this;
  }

  public moveTo(x: number, y: number): this {
    this.currentPage?.ops.push(`${x.toFixed(2)} ${this.toPdfY(y).toFixed(2)} m`);
    return this;
  }

  public lineTo(x: number, y: number): this {
    this.currentPage?.ops.push(`${x.toFixed(2)} ${this.toPdfY(y).toFixed(2)} l`);
    return this;
  }

  public line(x1: number, y1: number, x2: number, y2: number): this {
    this.moveTo(x1, y1);
    this.lineTo(x2, y2);
    this.stroke();
    return this;
  }

  public stroke(color?: string | [number, number, number]): this {
    if (color) this.strokeColor(color);
    this.currentPage?.ops.push('S');
    return this;
  }

  public fill(color?: string | [number, number, number]): this {
    if (color) this.fillColor(color);
    this.currentPage?.ops.push('f');
    return this;
  }

  public fillAndStroke(fillColor?: string, strokeColor?: string): this {
    if (fillColor) this.fillColor(fillColor);
    if (strokeColor) this.strokeColor(strokeColor);
    this.currentPage?.ops.push('B');
    return this;
  }

  public rect(x: number, y: number, width: number, height: number): this {
    const pdfY = this.toPdfY(y + height);
    this.currentPage?.ops.push(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
    return this;
  }

  public roundedRect(x: number, y: number, width: number, height: number, radius = 4): this {
    const r = Math.min(radius, width / 2, height / 2);
    const k = 0.552284749831 * r;
    const x0 = x;
    const x1 = x + r;
    const x2 = x + width - r;
    const x3 = x + width;
    const y0 = y;
    const y1 = y + r;
    const y2 = y + height - r;
    const y3 = y + height;

    this.moveTo(x1, y0);
    this.lineTo(x2, y0);
    this.bezierCurveTo(x2 + k, y0, x3, y1 - k, x3, y1);
    this.lineTo(x3, y2);
    this.bezierCurveTo(x3, y2 + k, x2 + k, y3, x2, y3);
    this.lineTo(x1, y3);
    this.bezierCurveTo(x1 - k, y3, x0, y2 + k, x0, y2);
    this.lineTo(x0, y1);
    this.bezierCurveTo(x0, y1 - k, x1 - k, y0, x1, y0);
    this.currentPage?.ops.push('h');
    return this;
  }

  private bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this {
    this.currentPage?.ops.push(
      `${cp1x.toFixed(2)} ${this.toPdfY(cp1y).toFixed(2)} ${cp2x.toFixed(2)} ${this.toPdfY(cp2y).toFixed(2)} ${x.toFixed(2)} ${this.toPdfY(y).toFixed(2)} c`
    );
    return this;
  }

  private escapePdfText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
  }

  private approxTextWidth(text: string, fontSize: number, isBold: boolean): number {
    const avgCharWidth = (isBold ? 0.56 : 0.52) * fontSize;
    return text.length * avgCharWidth;
  }

  public text(
    text: string,
    x: number,
    y: number,
    options: {
      width?: number;
      align?: 'left' | 'center' | 'right';
      continued?: boolean;
      lineGap?: number;
      height?: number;
    } = {}
  ): this {
    if (text === undefined || text === null) return this;
    const fontRef = this.currentFont === 'Helvetica-Bold' ? '/F2' : this.currentFont === 'Helvetica-Oblique' ? '/F3' : this.currentFont === 'Courier' ? '/F4' : '/F1';
    const isBold = this.currentFont === 'Helvetica-Bold';
    const maxWidth = options.width;
    const align = options.align ?? 'left';
    const lineGap = options.lineGap ?? 2;
    const lineHeight = this.currentFontSize * 1.15 + lineGap;

    const rawLines = String(text).split('\n');
    const wrappedLines: string[] = [];

    for (const rawLine of rawLines) {
      if (!maxWidth || maxWidth <= 0) {
        wrappedLines.push(rawLine);
        continue;
      }
      const words = rawLine.split(' ');
      let cur = '';
      for (const word of words) {
        const test = cur ? `${cur} ${word}` : word;
        if (this.approxTextWidth(test, this.currentFontSize, isBold) <= maxWidth) {
          cur = test;
        } else {
          if (cur) wrappedLines.push(cur);
          cur = word;
        }
      }
      if (cur) wrappedLines.push(cur);
      if (!rawLine && words.length === 1 && !words[0]) wrappedLines.push('');
    }

    let cursorY = y;
    for (const line of wrappedLines) {
      let lineX = x;
      const lineWidth = this.approxTextWidth(line, this.currentFontSize, isBold);
      if (align === 'center' && maxWidth) {
        lineX = x + Math.max(0, (maxWidth - lineWidth) / 2);
      } else if (align === 'right' && maxWidth) {
        lineX = x + Math.max(0, maxWidth - lineWidth);
      }

      const baselineY = this.toPdfY(cursorY + this.currentFontSize * 0.82);
      const escaped = this.escapePdfText(line);

      this.currentPage?.ops.push(
        `BT ${fontRef} ${this.currentFontSize.toFixed(1)} Tf 1 0 0 1 ${lineX.toFixed(2)} ${baselineY.toFixed(2)} Tm (${escaped}) Tj ET`
      );
      cursorY += lineHeight;
    }

    return this;
  }

  public drawTable(
    x: number,
    y: number,
    headers: string[],
    rows: string[][],
    colWidths: number[],
    options: {
      headerBg?: string;
      headerColor?: string;
      rowAltBg?: string;
      borderColor?: string;
      fontSize?: number;
      cellPadding?: number;
    } = {}
  ): number {
    const headerBg = options.headerBg ?? '#1c1917';
    const headerColor = options.headerColor ?? '#ffffff';
    const rowAltBg = options.rowAltBg ?? '#f9fafb';
    const borderColor = options.borderColor ?? '#e5e7eb';
    const fSize = options.fontSize ?? 8;
    const padding = options.cellPadding ?? 5;
    const headerHeight = fSize + padding * 2 + 2;
    const rowHeight = fSize + padding * 2;
    const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);

    let curY = y;

    // Header row
    this.rect(x, curY, totalWidth, headerHeight).fillColor(headerBg).fill();
    this.font('Helvetica-Bold').fontSize(fSize).fillColor(headerColor);
    let colX = x;
    for (let c = 0; c < headers.length; c++) {
      const w = colWidths[c];
      this.text(headers[c], colX + padding, curY + padding, { width: w - padding * 2 });
      colX += w;
    }
    curY += headerHeight;

    // Rows
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (r % 2 === 1 && rowAltBg) {
        this.rect(x, curY, totalWidth, rowHeight).fillColor(rowAltBg).fill();
      }
      this.rect(x, curY, totalWidth, rowHeight).lineWidth(0.4).strokeColor(borderColor).stroke();

      this.font('Helvetica').fontSize(fSize).fillColor('#1f2937');
      colX = x;
      for (let c = 0; c < row.length; c++) {
        const w = colWidths[c];
        const cellText = String(row[c] ?? '');
        this.text(cellText, colX + padding, curY + padding, { width: w - padding * 2 });
        colX += w;
      }
      curY += rowHeight;
    }

    // Outer table border
    this.rect(x, y, totalWidth, curY - y).lineWidth(0.8).strokeColor('#374151').stroke();
    return curY;
  }

  public toBuffer(): Buffer {
    const chunks: string[] = [];
    chunks.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    const objects: string[] = [];
    const offsets: number[] = [];

    const addObject = (content: string): number => {
      const objNum = objects.length + 1;
      objects.push(content);
      return objNum;
    };

    // 1. Catalog
    const catalogObj = addObject('');

    // 2. Pages object
    const pagesObj = addObject('');

    // 3. Fonts
    const f1Obj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2Obj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const f3Obj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
    const f4Obj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');

    const pageObjNums: number[] = [];

    // Create Page and Content objects
    for (const page of this.pages) {
      const streamContent = page.ops.join('\n');
      const streamBytes = Buffer.from(streamContent, 'utf-8');
      const contentObj = addObject(
        `<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream`
      );

      const pageObj = addObject(
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${f1Obj} 0 R /F2 ${f2Obj} 0 R /F3 ${f3Obj} 0 R /F4 ${f4Obj} 0 R >> >> >>`
      );
      pageObjNums.push(pageObj);
    }

    // Fill Catalog and Pages
    objects[catalogObj - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;

    // 4. Info object
    const infoEntries = Object.entries(this.info)
      .map(([k, v]) => `/${k} (${this.escapePdfText(v)})`)
      .join(' ');
    const infoObj = addObject(`<< ${infoEntries} /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);

    // Build the final PDF binary stream
    let byteOffset = Buffer.byteLength(chunks[0], 'utf-8');
    for (let i = 0; i < objects.length; i++) {
      offsets.push(byteOffset);
      const str = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
      chunks.push(str);
      byteOffset += Buffer.byteLength(str, 'utf-8');
    }

    // XRef Table
    const startXref = byteOffset;
    chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    for (const offset of offsets) {
      chunks.push(`${offset.toString().padStart(10, '0')} 00000 n \n`);
    }

    // Trailer
    chunks.push(
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R /Info ${infoObj} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`
    );

    return Buffer.from(chunks.join(''), 'utf-8');
  }

  public end(): void {
    const buffer = this.toBuffer();
    for (const stream of this.pipedStreams) {
      stream.write(buffer);
      stream.end();
    }
  }
}
