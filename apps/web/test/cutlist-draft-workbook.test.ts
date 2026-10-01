import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildMeasuredUnitParts, type MeasuredUnit } from '../src/features/tools/measured-unit-cutlist';
import { optimizeGuillotineNesting, DEFAULT_MATERIAL_PRESET, exportCutlistToCsv } from '../src/features/tools/cutlist-optimizer';
import { buildCutlistDraftWorkbook } from '../src/features/tools/cutlist-draft-workbook';
import { readCutlistDraft } from '../src/features/tools/cutlist-draft';
test('workbook preserves physical labels, mixed backing stock and separate finish estimates', () => {
  const unit: MeasuredUnit = { id: 'one', name: 'Unit A', widthMm: 600, depthMm: 500, heightMm: 900, backThicknessMm: 6, doors: 2, shelves: 1 };
  const second = { ...unit, id: 'two', name: 'Unit B', backThicknessMm: 18 as const };
  const parts = [...buildMeasuredUnitParts(unit, { ...DEFAULT_MATERIAL_PRESET, externalDecorativeLaminate: 'Oak' }), ...buildMeasuredUnitParts(second, { ...DEFAULT_MATERIAL_PRESET, externalDecorativeLaminate: 'Blue' })];
  const result = optimizeGuillotineNesting(parts);
  assert.equal(result.summary.laminateRequirement.externalDecorativeSheets, 2);
  assert.ok(result.summary.laminateRequirement.byFinish?.some(finish => finish.finishCode === 'Blue'));
  const bytes = buildCutlistDraftWorkbook(result, [unit, second], 'Client <A>');
  const files = unzipSync(bytes);
  assert.equal(Object.keys(files).filter(name => /^xl\/worksheets\//.test(name)).length, 7);
  const cells = Object.values(files).map(strFromU8).join('\n');
  assert.match(cells, /NOT FOR CONSTRUCTION/);
  assert.match(cells, /6mm backing plywood/);
  assert.match(cells, /18mm backing plywood/);
  for (const sheet of result.sheets) for (const panel of sheet.placedPanels) assert.ok(cells.includes(panel.id));
  const csv = exportCutlistToCsv(result, 'draft');
  assert.doesNotMatch(csv, /Backing Plywood Board \(9mm\)/);
  assert.match(csv, /NOT FOR CONSTRUCTION/);
  const restored = readCutlistDraft(JSON.stringify({ version: 1, title: 'Draft', parts, units: [unit, second] }));
  assert.equal(restored.parts.length, parts.length);
  assert.throws(() => readCutlistDraft(JSON.stringify({ version: 1, title: 'bad', units: [], parts: [{ lengthMm: 0 }] })), /invalid panels/);
});

test('draft recovery retains stock, kerf and trim and rejects malformed settings', () => {
  const draft = { version: 1, title: 'Custom stock', parts: [], units: [], settings: { sheetSizePreset: '8x6', kerfMm: 3.2, trimMm: 15 } };
  assert.deepEqual(readCutlistDraft(JSON.stringify(draft)).settings, draft.settings);
  assert.throws(() => readCutlistDraft(JSON.stringify({ ...draft, settings: { ...draft.settings, kerfMm: -1 } })), /invalid nesting settings/);
});
