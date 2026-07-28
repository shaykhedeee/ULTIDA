import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveModuleWallAnchor } from '../src/module-anchor.js';

const wall = [{ id: 'wall-a', worldStart: { xMm: 100, yMm: 200 }, worldEnd: { xMm: 4100, yMm: 200 } }];

test('derives canonical module coordinates and rotation from a real wall anchor', () => {
  const result = resolveModuleWallAnchor(wall, { wallId: 'wall-a', offsetMm: 500 }, 1800);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.anchor, { wallId: 'wall-a', offsetMm: 500, xMm: 600, yMm: 200, zMm: 0, rotationDeg: 0, anchor: 'wall' });
});

test('rejects a module that would extend past the measured wall', () => {
  const result = resolveModuleWallAnchor(wall, { wallId: 'wall-a', offsetMm: 2500 }, 1800);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'MODULE_EXCEEDS_WALL');
});
