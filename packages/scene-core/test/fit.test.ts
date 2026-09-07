import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileModuleFit } from '../src/index.ts';

test('finds a free measured wall segment around an opening', () => {
  const result = reconcileModuleFit({
    wallLengthMm: 3000,
    moduleWidthMm: 1200,
    keepOuts: [{ id: 'door-1', offsetMm: 1400, widthMm: 900 }],
  });
  assert.equal(result.fits, true);
  assert.equal(result.suggestedOffsetMm, 0);
  assert.deepEqual(result.availableSegments, [
    { startMm: 0, endMm: 1400, widthMm: 1400 },
    { startMm: 2300, endMm: 3000, widthMm: 700 },
  ]);
});

test('rejects a requested placement that crosses an opening keep-out', () => {
  const result = reconcileModuleFit({
    wallLengthMm: 3000,
    moduleWidthMm: 1200,
    moduleOffsetMm: 1100,
    keepOuts: [{ id: 'window-1', offsetMm: 1400, widthMm: 900 }],
  });
  assert.equal(result.fits, false);
  assert.match(result.issues.join(' '), /keep-out zone/);
});

test('rejects a module wider than every measured segment', () => {
  const result = reconcileModuleFit({
    wallLengthMm: 3000,
    moduleWidthMm: 1501,
    keepOuts: [{ offsetMm: 1400, widthMm: 900 }],
  });
  assert.equal(result.fits, false);
  assert.match(result.issues.join(' '), /No measured wall segment/);
});

test('honours explicit wall clearances', () => {
  const result = reconcileModuleFit({ wallLengthMm: 2000, moduleWidthMm: 800, leftClearanceMm: 100, rightClearanceMm: 100 });
  assert.equal(result.fits, true);
  assert.equal(result.suggestedOffsetMm, 100);
  assert.equal(result.availableSegments[0]?.widthMm, 1800);
});
