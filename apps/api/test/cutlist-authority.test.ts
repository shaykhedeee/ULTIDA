import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCutlist } from '../src/index.ts';

test('cutlist requires exact scene.v1 module parts', () => {
  assert.throws(() => buildCutlist({ modules: [{ id: 'module-1' }], moduleParts: [], metadata: { status: 'approved' } } as any), /AUTHORITATIVE_MODULE_PARTS_REQUIRED/);
});

test('cutlist derives production rows from exact scene.v1 parts', () => {
  const result = buildCutlist({
    projectId: 'project-1', modules: [{ id: 'module-1', family: 'tv-unit' }],
    moduleParts: [{ id: 'module-1-shutter-1', moduleId: 'module-1', roomId: 'living', semanticType: 'shutter', name: 'Front shutter', widthMm: 450, depthMm: 18, heightMm: 564, materialId: 'mat-oak' }],
    metadata: { status: 'approved', designVersion: 'scene-1' },
  } as any);
  assert.equal(result.partCount, 1);
  assert.equal(result.parts[0]?.id, 'module-1-shutter-1');
  assert.equal(result.parts[0]?.partInstanceId, 'module-1-shutter-1');
  assert.equal(result.parts[0]?.lengthMm, 564);
  assert.equal(result.parts[0]?.widthMm, 450);
  assert.equal(result.parts[0]?.thicknessMm, 18);
  assert.equal(result.parts[0]?.edgeSchedule?.tapeType, '2mm PVC');
  assert.equal(result.nesting[0]?.placedPanels[0]?.partInstanceId, 'module-1-shutter-1');
  assert.equal(result.fabricationRules.backPanelThicknessMm, 6);
});

test('cutlist keeps every identical scene component as a traceable physical part', () => {
  const result = buildCutlist({
    projectId: 'project-1', modules: [{ id: 'module-1', family: 'wardrobe' }],
    moduleParts: [
      { id: 'shelf-1', moduleId: 'module-1', roomId: 'bedroom', semanticType: 'shelf', name: 'Shelf 1', widthMm: 800, depthMm: 500, heightMm: 18, materialId: 'ply-18' },
      { id: 'shelf-2', moduleId: 'module-1', roomId: 'bedroom', semanticType: 'shelf', name: 'Shelf 2', widthMm: 800, depthMm: 500, heightMm: 18, materialId: 'ply-18' },
    ],
    metadata: { status: 'locked', designVersion: 'scene-2' },
  } as any);
  assert.deepEqual(result.parts.map((part) => part.partInstanceId), ['shelf-1', 'shelf-2']);
  assert.deepEqual(result.nesting.flatMap((sheet) => sheet.placedPanels.map((panel) => panel.partInstanceId)).sort(), ['shelf-1', 'shelf-2']);
});
