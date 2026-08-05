import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRenderReadiness, compileSceneV1, SceneCompilationError } from '../src/index.ts';

const plan: any = {
  schemaVersion: 'plan.v1',
  source: { schemaVersion: 'plan.v1', sourceAssetId: '2f1c44f3-0a75-4546-b8a3-5a3dd154db14', sourceType: 'manual', sourceWidth: 4000, sourceHeight: 3000, sourceRotation: 0, coordinateSystem: 'millimetres', scaleResolution: 'verified_dimension', verifiedDimensionMm: 4000, scaleObservations: [] },
  state: 'approved', ceilingHeightMm: 2700,
  spaces: [{ id: 'a8c4f9c1-390d-4cf3-bf95-3ce6e2d64b22', sourcePolygon: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 0 }], worldPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 0 }], roomType: 'living', ceilingHeightMm: 2700, wallRefs: [], openingRefs: [], verification: 'verified' }],
  walls: [{ id: 'b8c4f9c1-390d-4cf3-bf95-3ce6e2d64b22', sourceStart: { x: 0, y: 0 }, sourceEnd: { x: 4000, y: 0 }, worldStart: { xMm: 0, yMm: 0 }, worldEnd: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700, adjacentSpaces: [], verification: 'verified' }],
  openings: [], columns: [], beams: [], servicePoints: [], annotations: [], issues: [], assumptions: [], validation: { isValid: true, blockingIssueCount: 0, issues: [] },
};

test('compiles approved canonical geometry without inventing walls or rooms', () => {
  const scene = compileSceneV1({ projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan });
  assert.equal(scene.rooms.length, 1);
  assert.equal(scene.walls[0].heightMm, 2700);
  assert.equal(scene.cameras[0].lensMm, 35);
  assert.deepEqual(scene.moduleParts, []);
});

test('preserves exact compiled cabinet parts separately from module envelopes', () => {
  const scene = compileSceneV1({
    projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan,
    modules: [{ id: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', widthMm: 1800, depthMm: 400, heightMm: 600, xMm: 100, yMm: 0, rotationDeg: 0 }],
    moduleParts: [{ id: 'module-1-shutter-1', moduleId: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', semanticType: 'shutter', name: 'Front shutter', widthMm: 450, depthMm: 18, heightMm: 564, xMm: 100, yMm: 0, zMm: 18, rotationDeg: 0, materialId: 'mat-shutter' }],
  });
  assert.equal(scene.modules.length, 1);
  assert.equal(scene.moduleParts.length, 1);
  assert.equal(scene.moduleParts[0]?.semanticType, 'shutter');
  assert.equal(checkRenderReadiness(scene).ready, true);
});

test('rejects a plan that has not been approved', () => {
  assert.throws(() => compileSceneV1({ projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan: { ...plan, state: 'designer_review' } }), SceneCompilationError);
});
