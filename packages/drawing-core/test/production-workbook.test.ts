import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { analyze2DDrawingsToCutlist, buildProductionSnapshot, generateDrawingCutlistWorkbookXlsx, generateProductionWorkbookXlsx } from '../src/index.ts';

function unzipEntries(archive: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  let cursor = 0;
  while (cursor + 30 <= archive.length && archive.readUInt32LE(cursor) === 0x04034b50) {
    const compressedSize = archive.readUInt32LE(cursor + 18);
    const nameLength = archive.readUInt16LE(cursor + 26);
    const extraLength = archive.readUInt16LE(cursor + 28);
    const nameStart = cursor + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString('utf8');
    entries.set(name, inflateRawSync(archive.subarray(dataStart, dataStart + compressedSize)).toString('utf8'));
    cursor = dataStart + compressedSize;
  }
  return entries;
}

test('production workbook contains scene-linked panels, labels, nesting and audit sheets', () => {
  const snapshot = buildProductionSnapshot({
    projectId: 'project-c1301', modules: [{ id: 'cabinet-1', family: 'kitchen-base' }],
    moduleParts: [
      { id: 'cabinet-1-left', moduleId: 'cabinet-1', roomId: 'kitchen', semanticType: 'carcass', name: 'Carcass left', widthMm: 560, depthMm: 18, heightMm: 720, position: { xMm: 0, yMm: 0 }, materialId: 'HDHMR-18' },
      { id: 'cabinet-1-shutter', moduleId: 'cabinet-1', roomId: 'kitchen', semanticType: 'shutter', name: 'Shutter', widthMm: 296, depthMm: 18, heightMm: 716, position: { xMm: 0, yMm: 0 }, materialId: 'LMT-WHITE' },
      { id: 'cabinet-1-hinge', moduleId: 'cabinet-1', roomId: 'kitchen', semanticType: 'hardware', name: 'Soft-close hinge', widthMm: 35, depthMm: 10, heightMm: 90, position: { xMm: 0, yMm: 0 } },
    ], metadata: { status: 'approved', designVersion: 'scene-c1301' },
  } as any);

  const workbook = generateProductionWorkbookXlsx(snapshot, { generatedAt: new Date('2026-09-08T00:00:00.000Z'), provenance: 'Approved site measurement record C1301' });
  assert.equal(workbook.subarray(0, 2).toString('utf8'), 'PK');
  const files = unzipEntries(workbook);
  assert.match(files.get('xl/styles.xml') ?? '', /cellStyle name="Normal"/);
  assert.match(files.get('xl/workbook.xml') ?? '', /Panel cutlist/);
  assert.match(files.get('xl/workbook.xml') ?? '', /Panel labels/);
  assert.match(files.get('xl/workbook.xml') ?? '', /Board requirements/);
  assert.match(files.get('xl/workbook.xml') ?? '', /Laminate requirements/);
  assert.match(files.get('xl/workbook.xml') ?? '', /Nesting layout/);
  assert.match(files.get('xl/workbook.xml') ?? '', /Audit/);
  const panelSheet = [...files.entries()].find(([, content]) => content.includes('cabinet-1-left'))?.[1] ?? '';
  assert.match(panelSheet, /cabinet-1-left/);
  assert.match(panelSheet, /HDHMR-18/);
  assert.match([...files.values()].join('\n'), /Approved site measurement record C1301/);
  assert.match([...files.values()].join('\n'), /Soft-close hinge/);
  const allSheets = [...files.values()].join('\n');
  assert.match(allSheets, /Overall stock utilization/);
  assert.match(allSheets, /NOT IN SNAPSHOT/);
  assert.match(allSheets, /cabinet-1-left/);
  assert.match(allSheets, /Nesting layout/);
  assert.match(allSheets, /Can rotate 90°/);
  assert.match(allSheets, /CNC operation status/);
  assert.match(allSheets, /NOT IN SNAPSHOT/);
});

test('size-entry cabinet workbook carries the shared wardrobe schedule, finish takeoff, and draft release gate', () => {
  const analysis = analyze2DDrawingsToCutlist({
    unitId: 'wardrobe-3x7', unitTitle: '3ft × 7ft Wardrobe', roomId: 'bedroom-1',
    overallWidthMm: 914, overallHeightMm: 2134, depthMm: 610, plinthHeightMm: 100,
    carcassCoreMaterial: 'HDHMR-18', externalFinishCodeA: 'EXT-OAK', internalFinishCode: 'INT-WHITE',
    backPanelMaterial: 'PLY-BACK-06', backPanelThicknessMm: 6,
    bays: [{
      id: 'bay-1', widthMm: 878, type: 'drawers', drawerCount: 3, drawerFrontHeightMm: 200,
      hasHangingRod: true, hangingClearHeightMm: 1050, shelvesInRemainderZone: 1,
      shelvesCount: 1, adjustableShelvesCount: 0,
    }],
  });
  const xlsx = generateDrawingCutlistWorkbookXlsx(analysis, {
    projectId: 'project-1', generatedAt: new Date('2026-09-30T00:00:00.000Z'),
    provenance: 'User-entered dimensions pending site confirmation',
  });
  assert.equal(xlsx.subarray(0, 2).toString('utf8'), 'PK');
  const files = unzipEntries(xlsx);
  const workbook = files.get('xl/workbook.xml') ?? '';
  for (const sheet of [
    'Job summary', 'Internal layout', 'Cutting list', 'Board requirements',
    'Laminate requirements', 'Edgebanding', 'Hardware', 'Nesting', 'Panel labels', 'Audit',
  ]) {
    assert.ok(workbook.includes(sheet), `workbook should include ${sheet}`);
  }
  const allSheets = [...files.values()].join('\n');
  assert.match(allSheets, /1050/);
  assert.match(allSheets, /200/);
  assert.match(allSheets, /EXT-OAK/);
  assert.match(allSheets, /INT-WHITE/);
  assert.match(allSheets, /PLY-BACK-06/);
  assert.match(allSheets, /REVIEW REQUIRED/);
  assert.match(allSheets, /NOT FOR CONSTRUCTION/);
  assert.match(allSheets, /L1 edge length \(mm\)/);
  assert.match(allSheets, /W2 edge length \(mm\)/);
  assert.match(allSheets, /Machining details/);
  assert.match(allSheets, /No per-panel drilling, groove, or hardware machining record/);
  assert.match(allSheets, /Nesting sheet/);
  assert.match(allSheets, /Board estimate is from deterministic nesting/);
  assert.match(allSheets, /wardrobe-3x7-B1-DF#1/);
  assert.match(allSheets, /wardrobe-3x7-B1-DF#2/);
  assert.match(allSheets, /2440/);
  assert.match(allSheets, /1220/);

  const structuralBack = analyze2DDrawingsToCutlist({
    unitId: 'wardrobe-structural-back', overallWidthMm: 914, overallHeightMm: 2134, depthMm: 610,
    plinthHeightMm: 100, carcassCoreMaterial: 'HDHMR-18', backPanelMaterial: 'HDHMR-18-BACK',
    backPanelThicknessMm: 18, backPanelMount: 'overlay-structural',
    bays: [{ id: 'B1', widthMm: 878, type: 'wardrobe-shelves', shelvesCount: 2 }],
  });
  const structuralWorkbook = generateDrawingCutlistWorkbookXlsx(structuralBack);
  const structuralFiles = unzipEntries(structuralWorkbook);
  const structuralText = [...structuralFiles.values()].join('\n');
  assert.match(structuralText, /18mm Structural Back Panel \(Overlay\)/);
  assert.match(structuralText, /HDHMR-18-BACK/);
});
