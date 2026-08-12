import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionSnapshot, nestPanels2D } from '../src/index.ts';

test('production snapshot separates panel thickness from its visible height', () => {
  const snapshot = buildProductionSnapshot({
    projectId: 'project-1', modules: [{ id: 'module-1', family: 'crockery-unit' }],
    moduleParts: [{ id: 'door-1', moduleId: 'module-1', roomId: 'dining', semanticType: 'shutter', name: 'Glass door surround', widthMm: 420, depthMm: 18, heightMm: 1200, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'laminate-1', confidence: 1 }],
    metadata: { status: 'approved', designVersion: 'scene-7' },
  } as any);
  assert.deepEqual({ lengthMm: snapshot.parts[0].lengthMm, widthMm: snapshot.parts[0].widthMm, thicknessMm: snapshot.parts[0].thicknessMm }, { lengthMm: 1200, widthMm: 420, thicknessMm: 18 });
});

test('nesting fails clearly when a panel cannot fit the trimmed stock sheet', () => {
  assert.throws(() => nestPanels2D([{ id: 'oversize', moduleId: 'm1', family: 'wardrobe', partName: 'Oversize panel', lengthMm: 2500, widthMm: 600, thicknessMm: 18, edging: 'none', materialCode: 'ply', quantity: 1, status: 'review_required' }]), /PANEL_EXCEEDS_USABLE_SHEET/);
});
