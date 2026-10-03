import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { tracePlanBuffer } from '../src/fast-wall-tracer.js';
import { toCvTraceResult } from '../src/wall-tracer.js';

const PROOF_IMG = new URL('../../../floorplan analyser/ultida-flow-kit/proof/test_floorplan_input.png', import.meta.url);

test('grayscale scans retain the same wall evidence as neutral RGB scans', async () => {
  const source = await readFile(PROOF_IMG);
  const gray = await sharp(source).greyscale().png().toBuffer();
  const rgb = await sharp(gray).toColourspace('srgb').png().toBuffer();
  const [grayTrace, rgbTrace] = await Promise.all([tracePlanBuffer(gray), tracePlanBuffer(rgb)]);
  assert.deepEqual(grayTrace.walls, rgbTrace.walls);
  assert.deepEqual(grayTrace.openings, rgbTrace.openings);
});

test('EXIF-rotated photos use the upright dimensions and match physically rotated evidence', async () => {
  const source = await readFile(PROOF_IMG);
  const photo = await sharp(source).jpeg({ quality: 100 }).withMetadata({ orientation: 6 }).toBuffer();
  const upright = await sharp(photo).rotate().png().toBuffer();
  const [photoTrace, uprightTrace] = await Promise.all([tracePlanBuffer(photo), tracePlanBuffer(upright)]);
  assert.equal(photoTrace.widthPx, uprightTrace.widthPx);
  assert.equal(photoTrace.heightPx, uprightTrace.heightPx);
  assert.equal(photoTrace.wallCount, uprightTrace.wallCount);
  // Sharp may rotate before/after resampling depending on input encoding;
  // permit one source pixel of raster rounding, never an axis/scale change.
  photoTrace.walls.forEach((wall, index) => {
    const other = uprightTrace.walls[index];
    for (const key of ['x1', 'y1', 'x2', 'y2'] as const) assert.ok(Math.abs(wall[key] - other[key]) <= 1, `${key} differs beyond raster rounding`);
  });
});

test('fast-wall-tracer extracts walls, openings and rooms within a bounded time without Python', async () => {
  const buffer = await readFile(PROOF_IMG);
  const t0 = Date.now();
  const result = await tracePlanBuffer(buffer);
  const elapsed = Date.now() - t0;

  console.log(`  [fast-wall-tracer] extracted ${result.wallCount} walls, ${result.openingCount} openings, ${result.rooms.length} rooms in ${elapsed}ms`);

  // Keep a generous bound so shared/CI runners do not make this timing check flaky.
  assert.ok(elapsed < 1000, `Tracer should complete in <1000ms, took ${elapsed}ms`);

  // Assert dimension fidelity
  assert.equal(result.widthPx, 900);
  assert.equal(result.heightPx, 600);

  // Assert walls detected
  assert.ok(result.wallCount >= 4, `Expected at least 4 perimeter walls, got ${result.wallCount}`);
  for (const w of result.walls) {
    assert.ok(Number.isFinite(w.x1) && Number.isFinite(w.y1));
    assert.ok(Number.isFinite(w.x2) && Number.isFinite(w.y2));
    assert.ok(Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 10, 'Wall length should be > 10px');
  }

  // Assert parallel thickness was measured
  const wallsWithThickness = result.walls.filter((w) => typeof w.thicknessPx === 'number' && w.thicknessPx > 0);
  assert.ok(wallsWithThickness.length >= 2, 'Expected at least 2 walls with measured thickness');

  // Assert openings detected
  assert.ok(Array.isArray(result.openings));
  assert.ok(result.openings!.length >= 1, 'Expected at least 1 opening between wall segments');

  // Assert corners detected
  assert.ok(result.corners.length >= 4, 'Expected corner nodes');

  // Assert interior rooms detected
  assert.ok(result.rooms.length >= 1, 'Expected at least 1 room boundary');
  for (const room of result.rooms) {
    assert.ok(room.width > 20 && room.height > 20, 'Room must have positive dimensions');
    assert.ok(room.polygon.length >= 3, 'Room polygon must have at least 3 points');
  }
});

test('wall count and normalized total length converge across 4x resolution variants', async () => {
  const source = await readFile(PROOF_IMG);
  const variants = await Promise.all([0.25, 1, 4].map(async (factor) => {
    const buffer = await sharp(source)
      .resize({ width: Math.round(900 * factor), height: Math.round(600 * factor) })
      .png()
      .toBuffer();
    const result = await tracePlanBuffer(buffer);
    const totalLength = result.walls.reduce((sum, wall) => sum + Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), 0);
    return { result, normalizedLength: totalLength / Math.max(result.widthPx, result.heightPx) };
  }));

  const wallCounts = variants.map(({ result }) => result.wallCount);
  assert.ok(wallCounts.every((count) => count === wallCounts[0]), `Wall count diverged by resolution: ${wallCounts.join(', ')}`);
  const normalizedLengths = variants.map(({ normalizedLength }) => normalizedLength);
  const mean = normalizedLengths.reduce((sum, length) => sum + length, 0) / normalizedLengths.length;
  const spread = (Math.max(...normalizedLengths) - Math.min(...normalizedLengths)) / mean;
  assert.ok(spread <= 0.05, `Normalized detected wall length diverged by ${(spread * 100).toFixed(1)}%`);
});

test('native trace maps stable wall and opening identities into the reconciliation contract', async () => {
  const trace = await tracePlanBuffer(await readFile(PROOF_IMG));
  const mapped = toCvTraceResult(trace);
  assert.equal(mapped.schema, 'PlanAnalysisResultV1.wallCandidates');
  assert.ok(mapped.walls.length >= 4);
  assert.ok(mapped.walls.every((wall) => wall.id && wall.startCornerId && wall.endCornerId));
  assert.ok(mapped.openings?.length);
  assert.ok(mapped.openings.every((opening) => opening.betweenWallIds.every((wallId) => mapped.walls.some((wall) => wall.id === wallId))));
  assert.ok(mapped.rooms?.length, 'detected enclosed regions remain available for explicit review');
});
