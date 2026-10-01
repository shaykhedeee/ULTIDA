import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasuredUnitParts, readDxfRectangles, type MeasuredUnit } from '../src/features/tools/measured-unit-cutlist';
import { DEFAULT_MATERIAL_PRESET } from '../src/features/tools/cutlist-optimizer';
const unit: MeasuredUnit = { id: 'unit-a', name: 'Wardrobe', widthMm: 914.4, heightMm: 2133.6, depthMm: 600, shelves: 2, doors: 2, backThicknessMm: 6 };
test('6 and 18 mm backs change depth deductions and keep the declared outer height', () => {
  const thin = buildMeasuredUnitParts(unit, DEFAULT_MATERIAL_PRESET);
  const thick = buildMeasuredUnitParts({ ...unit, backThicknessMm: 18 }, DEFAULT_MATERIAL_PRESET);
  assert.equal(thin.find(part => part.id.endsWith(':sides'))!.widthMm, 594);
  assert.equal(thick.find(part => part.id.endsWith(':sides'))!.widthMm, 582);
  assert.equal(thick.find(part => part.classification === 'back_panel')!.thicknessMm, 18);
  assert.equal(thin.find(part => part.id.endsWith(':sides'))!.lengthMm, 2133.6);
  assert.equal(thin.find(part => part.isExternal)!.materialCode, DEFAULT_MATERIAL_PRESET.carcassCorePly);
  assert.ok(thin.find(part => part.isExternal)!.externalLaminateCode);
});
test('multiple units have distinct part IDs and invalid anatomy is rejected', () => {
  const parts = [...buildMeasuredUnitParts(unit, DEFAULT_MATERIAL_PRESET), ...buildMeasuredUnitParts({ ...unit, id: 'unit-b' }, DEFAULT_MATERIAL_PRESET)];
  assert.equal(new Set(parts.map(part => part.partInstanceId)).size, parts.length);
  assert.throws(() => buildMeasuredUnitParts({ ...unit, depthMm: 12 }, DEFAULT_MATERIAL_PRESET), /do not fit/);
  assert.throws(() => buildMeasuredUnitParts({ ...unit, shelves: 1.5 }, DEFAULT_MATERIAL_PRESET), /Confirm/);
  assert.throws(() => buildMeasuredUnitParts({ ...unit, widthMm: 41 }, DEFAULT_MATERIAL_PRESET), /do not fit/);
});
test('DXF review requires explicit mm and accepts only closed rectangular outlines', () => {
  const dxf = '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nLWPOLYLINE\n8\nUNIT\n70\n1\n10\n0\n20\n0\n10\n900\n20\n0\n10\n900\n20\n2100\n10\n0\n20\n2100\n0\nEOF';
  assert.deepEqual(readDxfRectangles(dxf), [{ layer: 'UNIT', widthMm: 900, heightMm: 2100 }]);
  assert.throws(() => readDxfRectangles(dxf.replace('$INSUNITS', '$UNKNOWN')), /millimetres/);
  assert.throws(() => readDxfRectangles(dxf.replace('70\n1', '70\n0')), /No supported/);
});
