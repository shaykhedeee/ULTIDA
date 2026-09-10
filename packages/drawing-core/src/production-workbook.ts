import { deflateRawSync } from 'node:zlib';
import type { EdgeBandingSummary, NestingSheet, ProductionSnapshotV1 } from './index.js';
import { calculateEdgeBandingSummary, nestPanels2D } from './index.js';

export interface ProductionWorkbookOptions {
  generatedAt?: Date;
  provenance?: string;
}

type CellValue = string | number | boolean | null | undefined;
type Sheet = { name: string; rows: CellValue[][]; widths?: number[] };

const xml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const columnName = (index: number) => {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

function cell(value: CellValue, reference: string, header = false): string {
  const style = header ? ' s="1"' : '';
  if (value === null || value === undefined || value === '') return `<c r="${reference}"${style}/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"${style}><v>${value}</v></c>`;
  if (typeof value === 'boolean') return `<c r="${reference}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function worksheet(sheet: Sheet): string {
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const widths = sheet.widths ?? Array.from({ length: maxColumns }, () => 16);
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(64, Math.max(10, width))}" customWidth="1"/>`).join('');
  const rows = sheet.rows.map((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const cells = row.map((value, columnIndex) => cell(value, `${columnName(columnIndex)}${rowIndex + 1}`, isHeader)).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const ref = `A1:${columnName(maxColumns - 1)}${Math.max(1, sheet.rows.length)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rows}</sheetData><autoFilter ref="${ref}"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ name: string; content: string }>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const original = Buffer.from(file.content, 'utf8');
    const compressed = deflateRawSync(original);
    const crc = crc32(original);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(original.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, name, compressed);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt16LE(0, 12);
    directory.writeUInt16LE(0, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(original.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt16LE(0, 30);
    directory.writeUInt16LE(0, 32);
    directory.writeUInt16LE(0, 34);
    directory.writeUInt16LE(0, 36);
    directory.writeUInt32LE(0, 38);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + compressed.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, ...central, end]);
}

function materialSummary(snapshot: ProductionSnapshotV1): CellValue[][] {
  const grouped = new Map<string, { thickness: number; count: number; areaSqm: number }>();
  for (const part of snapshot.parts) {
    const key = `${part.materialCode} | ${part.thicknessMm}mm`;
    const item = grouped.get(key) ?? { thickness: part.thicknessMm, count: 0, areaSqm: 0 };
    item.count += 1;
    item.areaSqm += part.lengthMm * part.widthMm / 1_000_000;
    grouped.set(key, item);
  }
  return [['Material code', 'Thickness (mm)', 'Physical panels', 'Net panel area (sqm)'], ...[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key.split(' | ')[0], item.thickness, item.count, Math.round(item.areaSqm * 1000) / 1000])];
}

/**
 * Produces a standards-compliant XLSX production workbook from exact scene parts.
 * No module bounding boxes or example quantities are substituted into the file.
 */
export function generateProductionWorkbookXlsx(snapshot: ProductionSnapshotV1, options: ProductionWorkbookOptions = {}): Buffer {
  const generatedAt = options.generatedAt ?? new Date();
  const provenance = options.provenance ?? `Approved scene ${snapshot.sceneVersion}`;
  const nesting = nestPanels2D(snapshot.parts, snapshot.fabricationRules.sheetWidthMm, snapshot.fabricationRules.sheetHeightMm, snapshot.fabricationRules.kerfMm, snapshot.fabricationRules.trimMm);
  const nestedById = new Map(nesting.updatedParts.map((part) => [part.partInstanceId ?? part.id, part]));
  const edgeBanding: EdgeBandingSummary[] = calculateEdgeBandingSummary(snapshot.parts);

  const sheets: Sheet[] = [
    {
      name: 'Release summary', widths: [28, 48], rows: [
        ['Production release field', 'Value'],
        ['Project ID', snapshot.projectId], ['Scene revision', snapshot.sceneVersion], ['Snapshot status', snapshot.status],
        ['Generated at (UTC)', generatedAt.toISOString()], ['Provenance', provenance], ['Units', 'mm'],
        ['Panel count', snapshot.parts.length], ['Fabrication rules', snapshot.fabricationRules.version],
        ['Stock sheet', `${snapshot.fabricationRules.sheetWidthMm} x ${snapshot.fabricationRules.sheetHeightMm} mm`],
        ['Kerf / trim', `${snapshot.fabricationRules.kerfMm} mm / ${snapshot.fabricationRules.trimMm} mm`],
        ['Release rule', 'Only approved scene components are included. Do not alter dimensions without creating a new scene revision.'],
      ]
    },
    {
      name: 'Panel cutlist', widths: [25, 25, 18, 18, 18, 18, 30, 13, 13, 14, 10, 24, 13, 16, 13, 13, 13, 13, 18, 18, 13, 13, 12], rows: [
        ['Label ID', 'Source part ID', 'Room ID', 'Module ID', 'Family', 'Component', 'Part name', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Qty', 'Material code', 'Grain', 'Edge tape', 'L1 (mm)', 'L2 (mm)', 'W1 (mm)', 'W2 (mm)', 'Review status', 'Nesting sheet', 'X (mm)', 'Y (mm)', 'Rotated'],
        ...snapshot.parts.map((part) => {
          const placement = nestedById.get(part.partInstanceId ?? part.id);
          return [part.partInstanceId, part.sourcePartId, part.roomId, part.moduleId, part.family, part.semanticType, part.partName, part.lengthMm, part.widthMm, part.thicknessMm, 1, part.materialCode, part.grainDirection, part.edgeSchedule?.tapeType ?? 'none', part.edgeSchedule?.l1Mm ?? 0, part.edgeSchedule?.l2Mm ?? 0, part.edgeSchedule?.w1Mm ?? 0, part.edgeSchedule?.w2Mm ?? 0, part.status, placement?.sheetId ?? 'UNNESTED', placement?.placedPos?.xMm ?? '', placement?.placedPos?.yMm ?? '', placement?.placedPos?.rotated ?? false];
        })
      ]
    },
    {
      name: 'Panel labels', widths: [25, 28, 25, 18, 17, 17, 17, 22, 20], rows: [
        ['Label ID', 'Print name', 'Module ID', 'Room ID', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Material code', 'Barcode payload'],
        ...snapshot.parts.map((part) => [part.partInstanceId, part.partName, part.moduleId, part.roomId, part.lengthMm, part.widthMm, part.thicknessMm, part.materialCode, part.partInstanceId])
      ]
    },
    { name: 'Materials', widths: [30, 18, 18, 24], rows: materialSummary(snapshot) },
    {
      name: 'Edgebanding', widths: [30, 18, 22], rows: [
        ['Tape type', 'Thickness (mm)', 'Total length (m)'],
        ...edgeBanding.map((edge) => [edge.tapeType, edge.thicknessMm, edge.totalMeters])
      ]
    },
    {
      name: 'Hardware', widths: [36, 18, 14, 14], rows: [
        ['Item', 'Category', 'Quantity', 'Unit'],
        ...snapshot.hardware.map((hardware) => [hardware.name, hardware.category, hardware.quantity, hardware.unit])
      ]
    },
    {
      name: 'Nesting', widths: [35, 25, 16, 18, 18, 18, 18, 18, 18], rows: [
        ['Nesting sheet', 'Material code', 'Thickness (mm)', 'Stock width (mm)', 'Stock length (mm)', 'Used area (sqm)', 'Utilisation (%)', 'Panels placed', 'Scene revision'],
        ...nesting.sheets.map((sheet: NestingSheet) => [sheet.sheetId, sheet.materialCode, sheet.thicknessMm, sheet.sheetWidthMm, sheet.sheetHeightMm, sheet.usedAreaSqm, sheet.utilizationPercentage, sheet.placedPanels.length, snapshot.sceneVersion])
      ]
    },
    {
      name: 'Audit', widths: [34, 18, 80], rows: [
        ['Check', 'Result', 'Evidence'],
        ['Scene state', ['approved', 'locked'].includes(snapshot.status) ? 'PASS' : 'REVIEW REQUIRED', `Snapshot status: ${snapshot.status}`],
        ['Physical part identities', snapshot.parts.every((part) => Boolean(part.partInstanceId && part.sourcePartId)) ? 'PASS' : 'FAIL', 'Every panel label is a stable scene component ID.'],
        ['Nesting reconciliation', nesting.updatedParts.every((part) => Boolean(part.sheetId && part.placedPos)) ? 'PASS' : 'FAIL', `${nesting.sheets.length} deterministic stock sheets generated using ${snapshot.fabricationRules.kerfMm}mm kerf and ${snapshot.fabricationRules.trimMm}mm trim.`],
        ['Warnings', snapshot.warnings.length ? 'REVIEW REQUIRED' : 'PASS', snapshot.warnings.length ? snapshot.warnings.join(' | ') : 'No non-sheet production warnings.'],
        ['Measurement authority', 'INFO', 'Use approved measured scene geometry only. This workbook does not infer dimensions from renders or reference images.'],
      ]
    },
  ];

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="1" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  return zip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/styles.xml', content: styles },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheet(sheet) })),
  ]);
}
