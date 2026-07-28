import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileStoredModuleForScene } from '../src/scene-module-parts.js';

const walls = [{ id: 'wall-a', worldStart: { xMm: 0, yMm: 0 }, worldEnd: { xMm: 3600, yMm: 0 }, heightMm: 2700 }];

test('compiles a persisted TV module into exact cabinet parts', () => {
  const result = compileStoredModuleForScene({
    id: 'tv-1', space_id: 'living-1', category: 'tv-unit', template_id: 'tv-1800',
    config_json: { family: 'tv-unit', widthMm: 1800, depthMm: 400, heightMm: 600 },
    position_json: { wallId: 'wall-a', xMm: 200, yMm: 0, rotationDeg: 0, anchor: 'wall' },
  }, walls);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.module.id, 'tv-1');
  assert.ok(result.parts.length > 3);
  assert.equal(result.parts[0]?.moduleId, 'tv-1');
  assert.ok(result.parts.some((part) => part.semanticType === 'shutter'));
});

test('does not invent parts for a non-panel furniture family', () => {
  const result = compileStoredModuleForScene({
    id: 'sofa-1', space_id: 'living-1', category: 'sofa', template_id: 'sofa-2200',
    config_json: { family: 'sofa', widthMm: 2200, depthMm: 900, heightMm: 850 },
    position_json: { wallId: 'wall-a', xMm: 0, yMm: 0, rotationDeg: 0, anchor: 'wall' },
  }, walls);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.parts.length, 0);
});
