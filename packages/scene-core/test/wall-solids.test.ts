import assert from 'node:assert/strict';
import test from 'node:test';
import { wallSolids } from '../src/wall-solids.js';

test('stacked door and transom retain both voids and the measured wall between them', () => {
  const openings = [
    { offsetMm: 1000, widthMm: 900, sillHeightMm: 0, heightMm: 2100 },
    { offsetMm: 1000, widthMm: 900, sillHeightMm: 2200, heightMm: 300 },
  ];
  const solids = wallSolids(4000, 2700, openings);
  const middle = solids.filter(solid => solid.startMm === 1000 && solid.endMm === 1900);
  assert.deepEqual(middle, [
    { startMm: 1000, endMm: 1900, bottomMm: 2100, heightMm: 100 },
    { startMm: 1000, endMm: 1900, bottomMm: 2500, heightMm: 200 },
  ]);
  const area = solids.reduce((sum, solid) => sum + (solid.endMm - solid.startMm) * solid.heightMm, 0);
  assert.equal(area, 4000 * 2700 - 900 * 2400);
  assert.deepEqual(wallSolids(4000, 2700, [...openings].reverse()), solids);
});

test('overlapping opening rectangles are subtracted once', () => {
  const solids = wallSolids(4000, 2700, [
    { offsetMm: 1000, widthMm: 1000, sillHeightMm: 500, heightMm: 1000 },
    { offsetMm: 1500, widthMm: 1000, sillHeightMm: 1000, heightMm: 1000 },
  ]);
  const area = solids.reduce((sum, solid) => sum + (solid.endMm - solid.startMm) * solid.heightMm, 0);
  assert.equal(area, 4000 * 2700 - (2 * 1000 * 1000 - 500 * 500));
});

test('no opening preserves the whole wall and invalid opening dimensions are rejected', () => {
  assert.deepEqual(wallSolids(4000, 2700, []), [{ startMm: 0, endMm: 4000, bottomMm: 0, heightMm: 2700 }]);
  for (const opening of [
    { offsetMm: 3500, widthMm: 900, sillHeightMm: 0, heightMm: 2100 },
    { offsetMm: 1000, widthMm: 900, sillHeightMm: 2200, heightMm: 600 },
    { offsetMm: NaN, widthMm: 900, sillHeightMm: 0, heightMm: 2100 },
  ]) assert.throws(() => wallSolids(4000, 2700, [opening]), /Opening geometry/);
});
