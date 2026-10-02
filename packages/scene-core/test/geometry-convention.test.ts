import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SCENE_GEOMETRY_CONVENTION, SceneV1Schema, scenePlanYawRadians, rotateScenePlanPoint } from '../src/index.js';

test('untagged scene.v1 retains legacy negative plan yaw and v2 uses positive plan yaw', () => {
  assert.equal(DEFAULT_SCENE_GEOMETRY_CONVENTION, 'legacy-negative-plan-yaw');
  assert.ok(Math.abs(scenePlanYawRadians(90) + Math.PI / 2) < 1e-10);
  assert.ok(Math.abs(scenePlanYawRadians(90, 'plan-positive-yaw-v2') - Math.PI / 2) < 1e-10);
  const positive = rotateScenePlanPoint(100, 0, 90, 'plan-positive-yaw-v2');
  const legacy = rotateScenePlanPoint(100, 0, 90);
  assert.ok(Math.abs(positive.xMm) < 1e-9 && Math.abs(positive.yMm - 100) < 1e-9);
  assert.ok(Math.abs(legacy.xMm) < 1e-9 && Math.abs(legacy.yMm + 100) < 1e-9);
});

test('scene.v1 accepts older metadata without rewriting its persisted geometry version', () => {
  const oldScene = {
    schema: 'scene.v1', units: 'mm', coordinateSystem: 'right-handed-z-up', projectId: 'p', floorPlanVersionId: 'plan',
    floors: [{ id: 'floor', name: 'Ground', elevationMm: 0, heightMm: 2700 }], spaces: [], rooms: [], walls: [], openings: [],
    fixedFixtures: [], modules: [], moduleParts: [], materials: [], lighting: [], cameras: [], constraints: [], unresolvedDetections: [],
    metadata: { branch: 'main', status: 'draft', changeReason: 'old scene', schemaVersion: 'scene.v1', designVersion: '1' },
  };
  const parsed = SceneV1Schema.parse(oldScene);
  assert.equal(parsed.metadata.geometryConvention, undefined);
  assert.equal(scenePlanYawRadians(90, parsed.metadata.geometryConvention), -Math.PI / 2);
});
