import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  sourceImageToWorld, 
  worldToSourceImage, 
  createWallFrame, 
  wallLocalToWorld, 
  worldToWallLocal, 
  convertToMm, 
  convertFromMm 
} from '../src/coordinate-system.js';
import { resolveScale, type ScaleObservation } from '../src/scale-engine.js';

test('Unit conversions', () => {
  assert.strictEqual(convertToMm(10, 'cm'), 100);
  assert.strictEqual(convertToMm(2, 'm'), 2000);
  assert.strictEqual(convertToMm(1, 'in'), 25.4);
  assert.strictEqual(convertFromMm(3048, 'ft'), 10);
});

test('Source image to world coordinate transformation', () => {
  const planSource = {
    originPx: { x: 100, y: 100 },
    mmPerPixel: 10.0, // 1px = 10mm
    rotationRad: 0
  };

  const worldPt = sourceImageToWorld({ xPx: 200, yPx: 300 }, planSource);
  assert.strictEqual(worldPt.x, 1000); // (200-100)*10
  assert.strictEqual(worldPt.z, 2000); // (300-100)*10

  const pixelPt = worldToSourceImage(worldPt, planSource);
  assert.strictEqual(pixelPt.xPx, 200);
  assert.strictEqual(pixelPt.yPx, 300);
});

test('Wall local frame transformation', () => {
  const start = { x: 0, z: 0 };
  const end = { x: 4000, z: 0 }; // 4m horizontal wall along X
  const frame = createWallFrame(start, end, 0);

  assert.strictEqual(frame.lengthMm, 4000);
  assert.strictEqual(frame.tangent.x, 1);
  assert.strictEqual(frame.tangent.z, 0);

  // Place object 1000mm along wall, 200mm into room, 500mm height
  const worldPt = wallLocalToWorld({ offsetAlongMm: 1000, offsetFromMm: 200, heightMm: 500 }, frame);
  assert.strictEqual(worldPt.x, 1000);
  assert.strictEqual(worldPt.y, 500);
  assert.strictEqual(worldPt.z, 200); // Default interior normal is (-tz, tx) -> (0, -1)

  const localPt = worldToWallLocal(worldPt, frame);
  assert.strictEqual(localPt.offsetAlongMm, 1000);
  assert.strictEqual(localPt.offsetFromMm, 200);
  assert.strictEqual(localPt.heightMm, 500);
});

test('Scale resolution engine verification gate', () => {
  const obs1: ScaleObservation = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    source: 'manual_two_point_calibration',
    pointA: { xPx: 0, yPx: 0 },
    pointB: { xPx: 100, yPx: 0 },
    pixelDistance: 100,
    realWorldDistanceMm: 1000,
    mmPerSourceUnit: 10.0,
    confidence: 1.0,
    verificationState: 'user_confirmed'
  };

  const res = resolveScale([obs1]);
  assert.strictEqual(res.isVerified, true);
  assert.strictEqual(res.resolvedMmPerPixel, 10.0);
});
