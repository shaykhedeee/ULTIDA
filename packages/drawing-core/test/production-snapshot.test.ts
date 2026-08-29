import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionSnapshot, generateProductionLabelsSvg, generateProductionNestingSvg, nestPanels2D } from '../src/index.ts';

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

test('production labels and nesting remain linked to physical scene part identities', () => {
  const snapshot = buildProductionSnapshot({
    projectId: 'project-1', modules: [{ id: 'module-1', family: 'tv-unit' }],
    moduleParts: [{ id: 'panel-1', moduleId: 'module-1', roomId: 'living', semanticType: 'panel', name: 'TV back panel', widthMm: 900, depthMm: 18, heightMm: 1200, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0, materialId: 'oak', confidence: 1 }],
    metadata: { status: 'locked', designVersion: 'scene-9' },
  } as any);
  const labels = generateProductionLabelsSvg(snapshot);
  const nesting = generateProductionNestingSvg(snapshot);
  assert.match(labels, /panel-1/);
  assert.match(labels, /1200 x 900 x 18 mm/);
  assert.match(nesting, /panel-1/);
  assert.match(nesting, /oak 18 mm/);
});
