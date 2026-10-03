import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('saved scene viewer cannot append sample villa architecture', () => {
  const source = readFileSync(new URL('../src/features/scene/SceneStudio.tsx', import.meta.url), 'utf8');
  const liveViewer = source.slice(source.indexOf('export function SceneStudio'));
  for (const fabricatedObject of ['DEFAULT_VILLA_STOREYS', 'DEFAULT_VILLA_VOIDS', 'multiStoreyGroup', 'stairGroup', 'chandelierGroup', "'level-first'", "'level-terrace'"]) {
    assert.ok(!liveViewer.includes(fabricatedObject), `Saved viewer must not introduce ${fabricatedObject}`);
  }
  assert.ok(liveViewer.includes('addWallSegments(wallsGroup, scene, wallsVisible)'));
  assert.ok(liveViewer.includes('createCompiledModuleMeshes'));
  assert.ok(!liveViewer.includes('Sharma-Residence'));
});
