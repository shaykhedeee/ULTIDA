import test from 'node:test';
import assert from 'node:assert/strict';
import { nestPanels2D } from '../src/index.ts';
const panel = (id: string, lengthMm: number, widthMm: number, quantity = 1) => ({ id, partInstanceId: id, partName: id, moduleId: 'm', materialCode: 'ply', thicknessMm: 18, lengthMm, widthMm, quantity, grainDirection: 'none' } as any);
test('largest first packs large panel and offcut onto one sheet', () => {
 const result = nestPanels2D([panel('large', 1000,600),panel('small',400,400)],1000,1000,0,0);
 assert.equal(result.totalSheets,1);
});
test('physical rows carry matching placement metadata without changing source', () => {
 const source = [panel('shelf',400,300,2)];
 const result = nestPanels2D(source,1000,1000,0,0);
 assert.equal(result.updatedParts.length,2);
 assert.deepEqual(result.updatedParts.map(p=>p.partInstanceId),['shelf#1','shelf#2']);
 for (const part of result.updatedParts) {
  assert.equal(part.quantity,1);
  const sheet = result.sheets.find(s=>s.sheetId===part.sheetId)!;
  const placed = sheet.placedPanels.find(p=>p.partInstanceId===part.partInstanceId)!;
  assert.deepEqual(part.placedPos,{xMm:placed.xMm,yMm:placed.yMm,rotated:placed.rotated});
 }
 assert.equal(source[0].sheetId,undefined);
});
