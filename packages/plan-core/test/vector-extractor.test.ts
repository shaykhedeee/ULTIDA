import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSvgVectorSegments,
  refineCornerSubPix,
  validateWallThicknessBounds,
  mergeCollinearSegments,
  findLowConfidenceClusters,
  crossCheckCalibrationDimensions,
} from '../dist/index.js';

test('extractSvgVectorSegments parses lines, rects, paths, and text dimensions', () => {
  const svg = `
    <svg viewBox="0 0 1000 800">
      <line x1="10" y1="20" x2="110" y2="20" stroke="#000" />
      <rect x="200" y="200" width="100" height="50" />
      <path d="M 400 300 L 500 300 H 600 V 400 Z" />
      <text x="300" y="300">3200 mm</text>
      <text x="450" y="450">4.5m</text>
    </svg>
  `;

  const result = extractSvgVectorSegments(svg);
  assert.ok(result.segments.length >= 6, `Expected at least 6 segments, got ${result.segments.length}`);
  assert.strictEqual(result.dimensions.length, 2);
  assert.strictEqual(result.dimensions[0].valueMm, 3200);
  assert.strictEqual(result.dimensions[1].valueMm, 4500);
  assert.ok(result.bounds.maxX >= 600);
});

test('refineCornerSubPix clusters junction points to sub-pixel floating centroids', () => {
  const points = [
    { x: 100.2, y: 200.1 },
    { x: 100.8, y: 199.7 },
    { x: 500.0, y: 500.0 },
  ];

  const refined = refineCornerSubPix(points, 5);
  assert.strictEqual(refined.length, 3);
  // First two points are clustered
  assert.strictEqual(refined[0].x, refined[1].x);
  assert.strictEqual(refined[0].y, refined[1].y);
  assert.strictEqual(refined[0].x, 100.5);
  assert.strictEqual(refined[0].y, 199.9);
  // Third point is untouched
  assert.strictEqual(refined[2].x, 500.0);
  assert.strictEqual(refined[2].y, 500.0);
});

test('validateWallThicknessBounds enforces 75mm - 300mm architectural standards', () => {
  const thin = validateWallThicknessBounds(50);
  assert.strictEqual(thin.valid, false);
  assert.strictEqual(thin.clampedMm, 115);
  assert.ok(thin.warning?.includes('75mm'));

  const thick = validateWallThicknessBounds(400);
  assert.strictEqual(thick.valid, false);
  assert.strictEqual(thick.clampedMm, 230);
  assert.ok(thick.warning?.includes('300mm'));

  const standard = validateWallThicknessBounds(230);
  assert.strictEqual(standard.valid, true);
  assert.strictEqual(standard.clampedMm, 230);
  assert.strictEqual(standard.warning, undefined);
});

test('mergeCollinearSegments merges contiguous segments along the same datum', () => {
  const walls = [
    { id: 'w1', geometry: { x1: 100, y1: 200, x2: 250, y2: 200 } },
    { id: 'w2', geometry: { x1: 240, y1: 200, x2: 400, y2: 200 } }, // overlaps w1
    { id: 'w3', geometry: { x1: 100, y1: 500, x2: 100, y2: 700 } }, // vertical wall
  ];

  const merged = mergeCollinearSegments(walls, 5, 20);
  assert.strictEqual(merged.length, 2);
  const horizontalWall = merged.find((w) => w.geometry.y1 === 200);
  assert.ok(horizontalWall);
  assert.strictEqual(horizontalWall.geometry.x1, 100);
  assert.strictEqual(horizontalWall.geometry.x2, 400);
});

test('findLowConfidenceClusters identifies spatial regions for re-detection', () => {
  const elements = [
    { id: 'e1', confidence: 0.65, geometry: { x1: 50, y1: 50, x2: 90, y2: 50 } },
    { id: 'e2', confidence: 0.60, geometry: { x1: 70, y1: 50, x2: 110, y2: 50 } },
    { id: 'e3', confidence: 0.95, geometry: { x1: 500, y1: 500, x2: 800, y2: 500 } },
  ];

  const clusters = findLowConfidenceClusters(elements, 0.75, 10);
  assert.strictEqual(clusters.length, 1);
  assert.strictEqual(clusters[0].elementIds.length, 2);
  assert.ok(clusters[0].elementIds.includes('e1'));
  assert.ok(clusters[0].elementIds.includes('e2'));
  assert.strictEqual(clusters[0].avgConfidence, 0.63);
});

test('crossCheckCalibrationDimensions flags drift between OCR text and calibrated pixels', () => {
  const elements = [
    {
      id: 'wall-1',
      label: 'Living North Wall',
      dimensionMm: 3000,
      geometry: { x1: 100, y1: 100, x2: 400, y2: 100 }, // 300 pixels
    },
  ];

  // If scale is 10mm per pixel: 300 * 10 = 3000mm. Drift is 0%.
  const noDrift = crossCheckCalibrationDimensions(elements, 10.0, 0.05);
  assert.strictEqual(noDrift.length, 0);

  // If scale is 12mm per pixel: 300 * 12 = 3600mm. Drift is 600mm / 3000mm = 20% (critical).
  const highDrift = crossCheckCalibrationDimensions(elements, 12.0, 0.05);
  assert.strictEqual(highDrift.length, 1);
  assert.strictEqual(highDrift[0].severity, 'critical');
  assert.strictEqual(highDrift[0].calibratedMm, 3600);
  assert.strictEqual(highDrift[0].ocrDimensionMm, 3000);
  assert.strictEqual(highDrift[0].deltaMm, 600);
});
