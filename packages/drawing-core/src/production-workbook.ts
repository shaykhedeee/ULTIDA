import { deflateRawSync } from 'node:zlib';
import type { CutlistPart, EdgeBandingSummary, NestingSheet, ProductionSnapshotV1 } from './index.js';
import { calculateEdgeBandingSummary, nestPanels2D } from './index.js';
import type { DrawingCutlistAnalysisResult } from './drawing-cutlist-analyzer.js';

export interface ProductionWorkbookOptions {
  generatedAt?: Date;
  provenance?: string;
}

type CellValue = string | number | boolean | null | undefined;
type Sheet = { name: string; rows: CellValue[][]; widths?: number[]; freezeRows?: number; autoFilter?: boolean };

export interface DrawingCutlistWorkbookOptions {
  projectId?: string;
  generatedAt?: Date;
  provenance?: string;
}

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
  const freezeRows = Math.max(0, Math.floor(sheet.freezeRows ?? 0));
  const sheetViews = freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const autoFilter = sheet.autoFilter === false ? '' : `<autoFilter ref="${ref}"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${sheetViews}<cols>${cols}</cols><sheetData>${rows}</sheetData>${autoFilter}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
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

/** Draft workbook for the size-first cabinet maker. This output is intentionally
 * review-required and cannot be confused with an approved-scene production release. */
export function generateDrawingCutlistWorkbookXlsx(
  result: DrawingCutlistAnalysisResult,
  options: DrawingCutlistWorkbookOptions = {},
): Buffer {
  const generatedAt = options.generatedAt ?? new Date();
  const schedules = result.wardrobeBaySchedules ?? [];
  const stockWidthMm = result.sheetEstimates[0]?.sheetWidthMm ?? 2440;
  const stockHeightMm = result.sheetEstimates[0]?.sheetHeightMm ?? 1220;
  const draftParts: CutlistPart[] = result.panels.map((part) => ({
    id: part.partInstanceId || part.id,
    partInstanceId: part.partInstanceId || part.id,
    moduleId: part.moduleId,
    roomId: part.roomId,
    family: 'cabinet',
    partName: part.partName,
    lengthMm: part.lengthMm,
    widthMm: part.widthMm,
    thicknessMm: part.thicknessMm,
    edging: part.edgeSchedule.tapeType === 'NONE'
      ? 'none'
      : part.edgeSchedule.l1Mm > 0 && part.edgeSchedule.l2Mm > 0 && part.edgeSchedule.w1Mm > 0 && part.edgeSchedule.w2Mm > 0
        ? 'all_sides'
        : 'front_only',
    edgeSchedule: {
      l1Mm: part.edgeSchedule.l1Mm,
      l2Mm: part.edgeSchedule.l2Mm,
      w1Mm: part.edgeSchedule.w1Mm,
      w2Mm: part.edgeSchedule.w2Mm,
      tapeType: part.edgeSchedule.tapeType,
    },
    grainDirection: part.grainDirection,
    materialCode: part.materialCode,
    quantity: part.quantity,
    status: 'review_required',
    semanticType: part.semanticType,
    sourcePartId: part.id,
  }));
  // The size-entry analyzer currently supplies a standard-stock estimate. Run
  // the same grain-aware nest used in production, and label its stock rules as
  // assumptions so this draft cannot be mistaken for a released saw program.
  const nesting = nestPanels2D(draftParts, {
    sheetWidthMm: stockWidthMm,
    sheetHeightMm: stockHeightMm,
    kerfMm: 4,
    trimMm: 10,
    respectGrain: true,
  });
  const physicalLabelId = (part: DrawingCutlistAnalysisResult['panels'][number], occurrence: number) =>
    part.quantity > 1 ? `${part.partInstanceId || part.id}#${occurrence + 1}` : (part.partInstanceId || part.id);
  const labels = result.panels.flatMap((part) => Array.from({ length: part.quantity }, (_, occurrence) => ({
    labelId: physicalLabelId(part, occurrence),
    part,
  })));
  const panelById = new Map(result.panels.flatMap((part) => [[part.id, part], [part.partInstanceId, part]] as const));
  const boardGroups = new Map<string, { code: string; thicknessMm: number; panelCount: number; netAreaSqm: number }>();
  for (const part of result.panels) {
    const key = `${part.materialCode}::${part.thicknessMm}`;
    const group = boardGroups.get(key) ?? { code: part.materialCode, thicknessMm: part.thicknessMm, panelCount: 0, netAreaSqm: 0 };
    group.panelCount += part.quantity;
    group.netAreaSqm += part.lengthMm * part.widthMm * part.quantity / 1_000_000;
    boardGroups.set(key, group);
  }
  const boardRequirementRows: CellValue[][] = [...boardGroups.values()].sort((a, b) => a.code.localeCompare(b.code) || a.thicknessMm - b.thicknessMm).map((group) => {
    const matchingSheets = nesting.sheets.filter((sheet) => sheet.materialCode === group.code && sheet.thicknessMm === group.thicknessMm);
    const fullStockArea = matchingSheets.length * stockWidthMm * stockHeightMm / 1_000_000;
    const utilization = fullStockArea > 0 ? group.netAreaSqm / fullStockArea : 0;
    const areaEstimate = result.sheetEstimates.find((estimate) => estimate.materialCode === group.code && estimate.thicknessMm === group.thicknessMm);
    return [
      group.code, group.thicknessMm, group.panelCount, Math.round(group.netAreaSqm * 1000) / 1000,
      `${stockWidthMm} × ${stockHeightMm}`, areaEstimate?.estimatedSheets ?? 'TBC', matchingSheets.length,
      Math.round(utilization * 1000) / 10, Math.round((1 - utilization) * 1000) / 10,
      'Board estimate is from deterministic nesting using 4mm kerf, 10mm trim, and grain restrictions. Confirm supplier stock before purchase.',
    ];
  });
  const laminateGroups = new Map<string, { finishCode: string; face: string; faceCount: number; netAreaSqm: number; parts: Set<string> }>();
  for (const part of result.panels) {
    for (const finish of part.faceFinishes ?? []) {
      const key = `${finish.finishCode}::${finish.face}`;
      const group = laminateGroups.get(key) ?? { finishCode: finish.finishCode, face: finish.face, faceCount: 0, netAreaSqm: 0, parts: new Set<string>() };
      group.faceCount += part.quantity;
      group.netAreaSqm += finish.areaSqm;
      group.parts.add(part.partName);
      laminateGroups.set(key, group);
    }
  }
  const laminateRows: CellValue[][] = [...laminateGroups.values()].sort((a, b) => a.finishCode.localeCompare(b.finishCode) || a.face.localeCompare(b.face)).map((group) => [
    group.finishCode, group.face, group.faceCount, Math.round(group.netAreaSqm * 1000) / 1000,
    'Not supplied', 'Not calculated', [...group.parts].join(', '),
    'Net finished-face area only. Select supplier sheet size and account for grain, matching, and cutting waste before ordering.',
  ]);
  const scheduleRows: CellValue[][] = schedules.length
    ? schedules.map((bay) => [
      bay.bayId, bay.clearBayWidthMm, bay.drawerCount, bay.drawerFrontHeightMm,
      bay.drawerBankBottomMm, bay.drawerBankTopMm, bay.hangingClearHeightMm,
      bay.hangingClearBottomMm, bay.hangingClearTopMm, bay.remainingShelfZoneHeightMm,
      bay.shelfBottomElevationsMm.join('; '), bay.hangingRodElevationMm ?? 'TBC',
    ])
    : [['No standardized vertical-zone schedule supplied. Review internal layout before fabrication.']];
  const sheets: Sheet[] = [
    {
      name: 'Job summary', widths: [36, 60], autoFilter: false, rows: [
        ['Job summary field', 'Value'],
        ['Project ID', options.projectId ?? 'Not linked'],
        ['Cabinet / module', result.unitTitle],
        ['Room ID', result.roomId], ['Wall ID', result.wallId],
        ['Overall outside size (mm)', `${result.overallWidthMm} W × ${result.overallHeightMm} H × ${result.depthMm} D`],
        ['Source scene revision', 'None - size-entry draft'],
        ['Generated at (UTC)', generatedAt.toISOString()],
        ['Provenance', options.provenance ?? 'User-entered cabinet dimensions'],
        ['Status', 'REVIEW REQUIRED · NOT FOR CONSTRUCTION'],
        ['Panel count', result.summary.totalPanels], ['Unique panel rows', result.summary.uniqueParts],
        ['Net substrate area (m²)', result.summary.totalAreaSqm],
        ['Stock sheet layout count', nesting.sheets.length],
        ['Stock sheet utilization (%)', nesting.overallUtilizationPercentage],
        ['Stock size assumption', `${stockWidthMm} × ${stockHeightMm} mm; verify supplier stock`],
        ['Nesting assumptions', '4mm saw kerf · 10mm trim · grain-restricted rotation'],
        ['Laminate area (m²)', Math.round([...laminateGroups.values()].reduce((sum, group) => sum + group.netAreaSqm, 0) * 1000) / 1000],
        ['Edge banding (m)', result.summary.totalEdgeBandMeters],
        ['Hardware line items', result.hardware.length],
        ['Estimate note', 'Board counts use deterministic nesting on the stated assumed stock. Laminate is net face area; sheet count and waste are not calculated without a supplier sheet size.'],
        ['Release gate', 'Confirm site dimensions, bay widths, substrate and back-board specification, finishes, back mounting, hardware, edging, and joinery before fabrication.'],
      ],
    },
    {
      name: 'Internal layout', freezeRows: 1, widths: [18, 18, 16, 20, 20, 20, 20, 20, 20, 24, 28, 22], rows: [
        ['Bay ID', 'Clear width (mm)', 'Drawer count', 'Drawer pitch (mm)', 'Drawer bank bottom FFL (mm)', 'Drawer bank top FFL (mm)', 'Hanging clear (mm)', 'Hanging bottom FFL (mm)', 'Hanging top FFL (mm)', 'Upper remainder (mm)', 'Shelf bottoms FFL (mm)', 'Rod centre FFL (mm)'],
        ...scheduleRows,
      ],
    },
    {
      name: 'Cutting list', freezeRows: 1, widths: [32, 34, 32, 22, 18, 18, 24, 14, 14, 14, 10, 24, 22, 22, 14, 20, 18, 18, 18, 18, 20, 14, 32, 60, 24, 68], rows: [
        ['Panel ID', 'Source part ID', 'Panel name', 'Component', 'Room ID', 'Wall ID', 'Module ID', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Qty', 'Substrate code', 'Face A finish', 'Face B finish', 'Grain', '90° rotation allowed', 'L1 edge length (mm)', 'L2 edge length (mm)', 'W1 edge length (mm)', 'W2 edge length (mm)', 'Edgeband', 'Tape (mm)', 'Install elevations FFL (mm)', 'Notes', 'CNC operation status', 'Machining details'],
        ...result.panels.map((part) => [
          part.partInstanceId, part.id, part.partName, part.semanticType, part.roomId, result.wallId, part.moduleId,
          part.lengthMm, part.widthMm, part.thicknessMm, part.quantity, part.materialCode,
          part.faceFinishes?.find((finish) => finish.face === 'A')?.finishCode ?? 'TBC',
          part.faceFinishes?.find((finish) => finish.face === 'B')?.finishCode ?? 'TBC',
          part.grainDirection, part.grainDirection === 'none' ? 'Yes' : 'No',
          part.edgeSchedule.l1Mm, part.edgeSchedule.l2Mm, part.edgeSchedule.w1Mm, part.edgeSchedule.w2Mm,
          part.edgeSchedule.tapeType, part.edgeSchedule.tapeThicknessMm,
          part.installElevationsFromFloorMm?.join('; ') ?? 'TBC', part.notes ?? '',
          'NOT PROVIDED', 'No per-panel drilling, groove, or hardware machining record is attached to this size-entry input.',
        ]),
      ],
    },
    {
      name: 'Board requirements', freezeRows: 1, widths: [28, 16, 16, 20, 20, 18, 20, 18, 18, 68], rows: [
        ['Substrate code', 'Thickness (mm)', 'Panel count', 'Net panel area (m²)', 'Stock size (mm)', 'Area estimate (sheets)', 'Nesting sheets', 'Utilization (%)', 'Waste (%)', 'Basis / action'],
        ...boardRequirementRows,
      ],
    },
    {
      name: 'Laminate requirements', freezeRows: 1, widths: [32, 14, 16, 20, 24, 22, 60, 78], rows: [
        ['Finish code', 'Panel face', 'Face count', 'Net area (m²)', 'Supplier sheet size', 'Required sheets', 'Panels using finish', 'Basis / action'],
        ...(laminateRows.length ? laminateRows : [['TBC', 'TBC', 0, 0, 'Not supplied', 'Not calculated', 'No finish code on panel faces', 'Assign external and internal finish codes before material ordering.']]),
      ],
    },
    {
      name: 'Edgebanding', freezeRows: 1, widths: [28, 18, 22, 68], rows: [
        ['Tape specification', 'Thickness (mm)', 'Total length (m)', 'Application / basis'],
        ...result.edgeBanding.map((edge) => [edge.tapeType, edge.tapeThicknessMm, edge.totalMeters, edge.application]),
      ],
    },
    {
      name: 'Hardware', freezeRows: 1, widths: [40, 18, 18, 14, 28, 54], rows: [
        ['Item', 'Category', 'Specification', 'Quantity', 'Unit', 'Bay / notes'],
        ...result.hardware.map((item) => [item.name, item.category, item.specification, item.quantity, item.unit, [item.assignedBay, item.notes].filter(Boolean).join(' · ')]),
      ],
    },
    {
      name: 'Nesting', freezeRows: 1, widths: [34, 34, 28, 18, 18, 18, 18, 18, 14, 18, 18, 14, 24], rows: [
        ['Nesting sheet', 'Part ID', 'Panel label ID', 'Substrate code', 'Thickness (mm)', 'X (mm)', 'Y (mm)', 'Length (mm)', 'Width (mm)', 'Rotated 90°', 'Grain', 'Utilization (%)', 'Stock size (mm)'],
        ...nesting.sheets.flatMap((sheet) => sheet.placedPanels.map((placed) => {
          const sourcePart = panelById.get(placed.partId);
          return [
            sheet.sheetId, placed.partId, placed.partInstanceId, sheet.materialCode, sheet.thicknessMm,
            placed.xMm, placed.yMm, placed.lengthMm, placed.widthMm, placed.rotated ? 'Yes' : 'No',
            sourcePart?.grainDirection ?? 'unknown', sheet.utilizationPercentage,
            `${sheet.sheetWidthMm} × ${sheet.sheetHeightMm}`,
          ];
        })),
      ],
    },
    {
      name: 'Panel labels', freezeRows: 1, widths: [32, 30, 34, 22, 18, 18, 16, 16, 24, 14, 22, 18, 24, 50], rows: [
        ['Panel label ID', 'Barcode payload', 'Panel name', 'Component', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Qty', 'Substrate code', 'Grain', 'Face A finish', 'Face B finish', 'Nesting sheet', 'Status / handling'],
        ...labels.map(({ labelId, part }) => {
          const placement = nesting.sheets.flatMap((sheet) => sheet.placedPanels.map((placed) => ({ sheetId: sheet.sheetId, labelId: placed.partInstanceId }))).find((placed) => placed.labelId === labelId);
          return [
            labelId, labelId, part.partName, part.semanticType, part.lengthMm, part.widthMm, part.thicknessMm, 1,
            part.materialCode, part.grainDirection,
            part.faceFinishes?.find((finish) => finish.face === 'A')?.finishCode ?? 'TBC',
            part.faceFinishes?.find((finish) => finish.face === 'B')?.finishCode ?? 'TBC',
            placement?.sheetId ?? 'UNNESTED', 'Review-required size-entry draft; do not cut until released.',
          ];
        }),
      ],
    },
    {
      name: 'Audit', freezeRows: 1, widths: [36, 22, 100], rows: [
        ['Check', 'Status', 'Evidence / action'],
        ['Cutlist status', 'REVIEW REQUIRED', 'This manually entered cabinet is not a saved/approved scene and cannot authorize fabrication.'],
        ['Dimension source', 'CONFIRM', 'Check actual site opening, level, plumb, wall bow, fillers, clearances, and installation tolerance.'],
        ['Stock format', 'ASSUMED', `${stockWidthMm} × ${stockHeightMm}mm stock, 4mm kerf, and 10mm trim are used for this draft nesting. Confirm supplier and machine settings.`],
        ['Nesting', nesting.sheets.every((sheet) => sheet.placedPanels.length > 0) ? 'CALCULATED' : 'REVIEW REQUIRED', `${nesting.sheets.length} sheets calculated with grain rotation restrictions. Confirm the generated layout with the shop before cutting.`],
        ['Laminate stock', 'NOT CALCULATED', 'Net face area is shown. Sheet counts require the selected supplier sheet size, grain/match rules, and waste allowance.'],
        ['Internal layout', schedules.length ? 'SCHEDULED' : 'REVIEW REQUIRED', schedules.length ? 'Shelf, drawer, and hanger elevations are shared with the internal elevation preview.' : 'No standardized vertical schedule is present.'],
        ['CNC machining', 'NOT PROVIDED', 'No drilling, hinge-cup, groove, or connector coordinates are generated from this size-entry workbook. Add verified operation records before CNC use.'],
        ...result.auditIssues.map((issue) => [issue.code, issue.severity.toUpperCase(), issue.message]),
      ],
    },
  ];
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="1" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  return zip([
    { name: '[Content_Types].xml', content: contentTypes }, { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook }, { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/styles.xml', content: styles },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheet(sheet) })),
  ]);
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
  const boardGroups = new Map<string, { materialCode: string; thicknessMm: number; panelAreaSqm: number; sheets: NestingSheet[] }>();
  for (const part of snapshot.parts) {
    const key = `${part.materialCode}::${part.thicknessMm}`;
    const group = boardGroups.get(key) ?? { materialCode: part.materialCode, thicknessMm: part.thicknessMm, panelAreaSqm: 0, sheets: [] };
    group.panelAreaSqm += part.lengthMm * part.widthMm / 1_000_000;
    boardGroups.set(key, group);
  }
  for (const sheet of nesting.sheets) {
    const group = boardGroups.get(`${sheet.materialCode}::${sheet.thicknessMm}`);
    group?.sheets.push(sheet);
  }
  const boardRequirements = [...boardGroups.values()].sort((a, b) => a.materialCode.localeCompare(b.materialCode) || a.thicknessMm - b.thicknessMm).map((group) => {
    const stockAreaSqm = group.sheets.reduce((sum, sheet) => sum + sheet.sheetWidthMm * sheet.sheetHeightMm / 1_000_000, 0);
    const utilization = stockAreaSqm > 0 ? Math.round(group.panelAreaSqm / stockAreaSqm * 1000) / 10 : 0;
    const stock = group.sheets[0];
    const nestedIds = new Set(nesting.updatedParts.filter((part) => part.materialCode === group.materialCode && part.thicknessMm === group.thicknessMm && part.sheetId).map((part) => part.partInstanceId ?? part.id));
    const unplacedIds = snapshot.parts.filter((part) => part.materialCode === group.materialCode && part.thicknessMm === group.thicknessMm && !nestedIds.has(part.partInstanceId ?? part.id)).map((part) => part.partInstanceId ?? part.id);
    return [
      group.materialCode, group.thicknessMm, stock?.sheetWidthMm ?? snapshot.fabricationRules.sheetWidthMm,
      stock?.sheetHeightMm ?? snapshot.fabricationRules.sheetHeightMm, group.sheets.length,
      Math.round(group.panelAreaSqm * 1000) / 1000, Math.round(stockAreaSqm * 1000) / 1000,
      utilization, Math.round((100 - utilization) * 10) / 10,
      unplacedIds.length, unplacedIds.join('; ') || '-',
      group.sheets.map((sheet) => sheet.sheetId).join('; ') || 'UNNESTED', snapshot.sceneVersion,
    ] as CellValue[];
  });
  const nestingPlacements = nesting.sheets.flatMap((sheet) => sheet.placedPanels.map((panel) => [
    sheet.sheetId, panel.partInstanceId, panel.partName, sheet.materialCode, sheet.thicknessMm,
    panel.xMm, panel.yMm, panel.lengthMm, panel.widthMm, panel.rotated ? 'Yes' : 'No',
    snapshot.parts.find((part) => (part.partInstanceId ?? part.id) === panel.partInstanceId)?.grainDirection ?? 'unknown',
    sheet.utilizationPercentage, snapshot.sceneVersion,
  ] as CellValue[]));
  const totalBoardAreaSqm = nesting.sheets.reduce((sum, sheet) => sum + sheet.sheetWidthMm * sheet.sheetHeightMm / 1_000_000, 0);
  const totalUsedAreaSqm = nesting.sheets.reduce((sum, sheet) => sum + sheet.usedAreaSqm, 0);
  const overallBoardUtilization = totalBoardAreaSqm > 0 ? Math.round(totalUsedAreaSqm / totalBoardAreaSqm * 1000) / 10 : 0;

  const sheets: Sheet[] = [
    {
      name: 'Release summary', widths: [28, 48], rows: [
        ['Production release field', 'Value'],
        ['Project ID', snapshot.projectId], ['Scene revision', snapshot.sceneVersion], ['Snapshot status', snapshot.status],
        ['Generated at (UTC)', generatedAt.toISOString()], ['Provenance', provenance], ['Units', 'mm'],
        ['Panel count', snapshot.parts.length], ['Fabrication rules', snapshot.fabricationRules.version],
        ['Material / thickness groups', new Set(snapshot.parts.map((part) => `${part.materialCode}::${part.thicknessMm}`)).size],
        ['Nesting sheets', nesting.sheets.length], ['Overall stock utilization (%)', overallBoardUtilization],
        ['Overall stock waste (%)', Math.round((100 - overallBoardUtilization) * 10) / 10],
        ['Stock sheet', `${snapshot.fabricationRules.sheetWidthMm} x ${snapshot.fabricationRules.sheetHeightMm} mm`],
        ['Kerf / trim', `${snapshot.fabricationRules.kerfMm} mm / ${snapshot.fabricationRules.trimMm} mm`],
        ['Release rule', 'Only approved scene components are included. Do not alter dimensions without creating a new scene revision.'],
      ]
    },
    {
      name: 'Panel cutlist', freezeRows: 1, widths: [25, 25, 18, 18, 18, 18, 30, 13, 13, 14, 10, 24, 13, 16, 13, 13, 13, 13, 18, 18, 13, 13, 12, 20, 24, 68], rows: [
        ['Label ID', 'Source part ID', 'Room ID', 'Module ID', 'Family', 'Component', 'Part name', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Qty', 'Material code', 'Grain', 'Edge tape', 'L1 (mm)', 'L2 (mm)', 'W1 (mm)', 'W2 (mm)', 'Review status', 'Nesting sheet', 'X (mm)', 'Y (mm)', 'Rotated', 'Can rotate 90°', 'CNC operation status', 'Machining details'],
        ...snapshot.parts.map((part) => {
          const placement = nestedById.get(part.partInstanceId ?? part.id);
          return [part.partInstanceId, part.sourcePartId, part.roomId, part.moduleId, part.family, part.semanticType, part.partName, part.lengthMm, part.widthMm, part.thicknessMm, 1, part.materialCode, part.grainDirection, part.edgeSchedule?.tapeType ?? 'none', part.edgeSchedule?.l1Mm ?? 0, part.edgeSchedule?.l2Mm ?? 0, part.edgeSchedule?.w1Mm ?? 0, part.edgeSchedule?.w2Mm ?? 0, part.status, placement?.sheetId ?? 'UNNESTED', placement?.placedPos?.xMm ?? '', placement?.placedPos?.yMm ?? '', placement?.placedPos?.rotated ?? false, part.grainDirection === 'none' ? 'Yes' : 'No', 'NOT IN SNAPSHOT', 'No per-panel drilling, groove, or hardware machining record is attached to this scene snapshot.'];
        })
      ]
    },
    {
      name: 'Panel labels', freezeRows: 1, widths: [25, 28, 25, 18, 17, 17, 17, 22, 20], rows: [
        ['Label ID', 'Print name', 'Module ID', 'Room ID', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Material code', 'Barcode payload'],
        ...snapshot.parts.map((part) => [part.partInstanceId, part.partName, part.moduleId, part.roomId, part.lengthMm, part.widthMm, part.thicknessMm, part.materialCode, part.partInstanceId])
      ]
    },
    { name: 'Materials', freezeRows: 1, widths: [30, 18, 18, 24], rows: materialSummary(snapshot) },
    {
      name: 'Board requirements', freezeRows: 1, widths: [30, 16, 18, 18, 18, 22, 22, 18, 16, 18, 44, 56, 24], rows: [
        ['Substrate code', 'Thickness (mm)', 'Stock width (mm)', 'Stock length (mm)', 'Sheets required', 'Net panel area (m²)', 'Stock area (m²)', 'Utilization (%)', 'Waste (%)', 'Unplaced count', 'Unplaced component IDs', 'Sheet IDs', 'Scene revision'],
        ...boardRequirements,
      ],
    },
    {
      name: 'Laminate requirements', widths: [32, 22, 90], rows: [
        ['Status', 'Required finish-face data', 'Action'],
        ['NOT IN SNAPSHOT', 'Scene production snapshot currently carries substrate material codes only; separate face A/B laminate assignments and supplier sheet sizes are not authoritative here.', 'Assign and persist face finishes plus supplier stock dimensions before a laminate sheet quantity can be calculated. No laminate inventory or sheet count is inferred.'],
      ],
    },
    {
      name: 'Edgebanding', freezeRows: 1, widths: [30, 18, 22], rows: [
        ['Tape type', 'Thickness (mm)', 'Total length (m)'],
        ...edgeBanding.map((edge) => [edge.tapeType, edge.thicknessMm, edge.totalMeters])
      ]
    },
    {
      name: 'Hardware', freezeRows: 1, widths: [36, 18, 14, 14], rows: [
        ['Item', 'Category', 'Quantity', 'Unit'],
        ...snapshot.hardware.map((hardware) => [hardware.name, hardware.category, hardware.quantity, hardware.unit])
      ]
    },
    {
      name: 'Nesting', freezeRows: 1, widths: [35, 25, 16, 18, 18, 18, 18, 18, 18], rows: [
        ['Nesting sheet', 'Material code', 'Thickness (mm)', 'Stock width (mm)', 'Stock length (mm)', 'Used area (sqm)', 'Utilisation (%)', 'Panels placed', 'Scene revision'],
        ...nesting.sheets.map((sheet: NestingSheet) => [sheet.sheetId, sheet.materialCode, sheet.thicknessMm, sheet.sheetWidthMm, sheet.sheetHeightMm, sheet.usedAreaSqm, sheet.utilizationPercentage, sheet.placedPanels.length, snapshot.sceneVersion])
      ]
    },
    {
      name: 'Nesting layout', freezeRows: 1, widths: [35, 32, 34, 28, 16, 16, 16, 16, 16, 16, 18, 18, 24], rows: [
        ['Nesting sheet', 'Component ID', 'Panel name', 'Material code', 'Thickness (mm)', 'X (mm)', 'Y (mm)', 'Length (mm)', 'Width (mm)', 'Rotated 90°', 'Grain', 'Utilization (%)', 'Scene revision'],
        ...nestingPlacements,
      ],
    },
    {
      name: 'Audit', freezeRows: 1, widths: [34, 18, 80], rows: [
        ['Check', 'Result', 'Evidence'],
        ['Scene state', ['approved', 'locked'].includes(snapshot.status) ? 'PASS' : 'REVIEW REQUIRED', `Snapshot status: ${snapshot.status}`],
        ['Physical part identities', snapshot.parts.every((part) => Boolean(part.partInstanceId && part.sourcePartId)) ? 'PASS' : 'FAIL', 'Every panel label is a stable scene component ID.'],
        ['Nesting reconciliation', nesting.updatedParts.every((part) => Boolean(part.sheetId && part.placedPos)) ? 'PASS' : 'FAIL', `${nesting.sheets.length} deterministic stock sheets generated using ${snapshot.fabricationRules.kerfMm}mm kerf and ${snapshot.fabricationRules.trimMm}mm trim. Stock utilization ${overallBoardUtilization}%.`],
        ['Laminate requirements', 'NOT IN SNAPSHOT', 'Face laminate, supplier stock, and inventory are not represented by this production snapshot. No laminate quantities are asserted.'],
        ['Warnings', snapshot.warnings.length ? 'REVIEW REQUIRED' : 'PASS', snapshot.warnings.length ? snapshot.warnings.join(' | ') : 'No non-sheet production warnings.'],
        ['CNC machining', 'NOT IN SNAPSHOT', 'This scene snapshot does not carry per-panel drilling, hinge-cup, groove, or connector coordinates. Do not treat this workbook as a CNC program.'],
        ['Measurement authority', 'INFO', 'Use approved measured scene geometry only. This workbook does not infer dimensions from renders or reference images.'],
      ]
    },
  ];

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="1" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
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
