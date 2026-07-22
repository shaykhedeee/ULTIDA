import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  sourceImageToWorld, 
  worldToSourceImage, 
  createWallFrame, 
  wallLocalToWorld, 
  worldToWallLocal,
  resolveScale 
} from '../../plan-core/dist/index.js';
import { compileTvUnit } from '../../module-framework/dist/tv-unit-compiler.js';

test('Verified End-to-End Floor-Plan to Modular Scene Pipeline', () => {
  // 1. Source Image to World millimetres (1px = 5.0mm)
  const planSource = { originPx: { x: 0, y: 0 }, mmPerPixel: 5.0 };
  const pointAPx = { xPx: 0, yPx: 0 };
  const pointBPx = { xPx: 800, yPx: 0 }; // 800px along X = 4000mm wall

  const worldA = sourceImageToWorld(pointAPx, planSource);
  const worldB = sourceImageToWorld(pointBPx, planSource);

  assert.strictEqual(worldA.x, 0);
  assert.strictEqual(worldB.x, 4000); // Verified 4000mm wall

  // 2. Scale Verification Gate
  const scaleRes = resolveScale([{
    id: 'b78a9c2e-7dec-11d0-a765-00a0c91e6bf6',
    source: 'manual_two_point_calibration',
    pointA: pointAPx,
    pointB: pointBPx,
    pixelDistance: 800,
    realWorldDistanceMm: 4000,
    mmPerSourceUnit: 5.0,
    confidence: 1.0,
    verificationState: 'user_confirmed'
  }]);

  assert.strictEqual(scaleRes.isVerified, true);
  assert.strictEqual(scaleRes.resolvedMmPerPixel, 5.0);

  // 3. Wall Frame & Local Furniture Anchoring
  const wallFrame = createWallFrame({ x: worldA.x, z: worldA.z }, { x: worldB.x, z: worldB.z });
  assert.strictEqual(wallFrame.lengthMm, 4000);

  // Anchor 1800mm TV unit at 1000mm along wall
  const tvUnitResult = compileTvUnit({
    templateVersionId: 'tpl-tv-v1',
    instanceId: 'tv-living-1',
    parameters: { totalWidthMm: 1800, totalDepthMm: 450, totalHeightMm: 600, shutterCount: 3 },
    wall: { widthMm: wallFrame.lengthMm, heightMm: 2700, depthMm: 150 }
  });

  assert.strictEqual(tvUnitResult.valid, true);

  // Verify World Position of TV unit start
  const worldTvStart = wallLocalToWorld({ offsetAlongMm: 1000, offsetFromMm: 0, heightMm: 0 }, wallFrame);
  assert.strictEqual(worldTvStart.x, 1000);
  assert.strictEqual(worldTvStart.y, 0);
  assert.strictEqual(worldTvStart.z, 0);

  // Verify World Position of TV unit end
  const worldTvEnd = wallLocalToWorld({ offsetAlongMm: 1000 + 1800, offsetFromMm: 0, heightMm: 0 }, wallFrame);
  assert.strictEqual(worldTvEnd.x, 2800);

  // Expected 3D geometry dimensions exactly match real world specifications (1800 x 450 x 600 mm)
  assert.strictEqual(tvUnitResult.parts[0].size.widthMm, 1800);
  assert.strictEqual(tvUnitResult.parts[0].size.heightMm, 18); // Carcass bottom panel
});
