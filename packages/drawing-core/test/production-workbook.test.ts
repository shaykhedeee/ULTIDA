import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { buildProductionSnapshot, generateProductionWorkbookXlsx } from '../src/index.ts';

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
  assert.match(files.get('xl/workbook.xml') ?? '', /Panel cutlist/);
  assert.match(files.get('xl/workbook.xml') ?? '', /Panel labels/);
  assert.match(files.get('xl/workbook.xml') ?? '', /Audit/);
  const panelSheet = [...files.entries()].find(([, content]) => content.includes('cabinet-1-left'))?.[1] ?? '';
  assert.match(panelSheet, /cabinet-1-left/);
  assert.match(panelSheet, /HDHMR-18/);
  assert.match([...files.values()].join('\n'), /Approved site measurement record C1301/);
  assert.match([...files.values()].join('\n'), /Soft-close hinge/);
});
