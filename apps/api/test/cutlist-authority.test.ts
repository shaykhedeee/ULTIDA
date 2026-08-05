import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCutlist } from '../src/index.ts';

test('cutlist requires exact scene.v1 module parts', () => {
  assert.throws(() => buildCutlist({ modules: [{ id: 'module-1' }], moduleParts: [], metadata: { status: 'approved' } } as any), /AUTHORITATIVE_MODULE_PARTS_REQUIRED/);
});

test('cutlist derives production rows from exact scene.v1 parts', () => {
  const result = buildCutlist({
    modules: [],
    moduleParts: [{ id: 'module-1-shutter-1', moduleId: 'module-1', roomId: 'living', semanticType: 'shutter', name: 'Front shutter', widthMm: 450, depthMm: 18, heightMm: 564 }],
    metadata: { status: 'approved' },
  } as any);
  assert.equal(result.partCount, 1);
  assert.equal(result.parts[0]?.id, 'module-1-shutter-1');
  assert.equal(result.parts[0]?.lengthMm, 450);
  assert.equal(result.parts[0]?.widthMm, 18);
  assert.equal(result.parts[0]?.thicknessMm, 564);
});
