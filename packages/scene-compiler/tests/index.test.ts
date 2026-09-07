import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRenderReadiness, compileScene, compileSceneV1, SceneCompilationError } from '../src/index.ts';

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

test('preserves a fallback module mounting elevation in the canonical scene', () => {
  const scene = compileSceneV1({
    projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan,
    modules: [{ id: 'module-raised', roomId: plan.spaces[0].id, family: 'sofa', widthMm: 1800, depthMm: 800, heightMm: 700, xMm: 100, yMm: 200, zMm: 350, rotationDeg: 0 }],
  });
  assert.equal(scene.modules[0]?.position.zMm, 350);
  const graph = compileScene(scene);
  assert.equal(graph.nodes.find((node) => node.sourceId === 'module-raised')?.positionMm?.zMm, 350);
});

test('rejects a plan that has not been approved', () => {
  assert.throws(() => compileSceneV1({ projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan: { ...plan, state: 'designer_review' } }), SceneCompilationError);
});

test('certifies a composition only when bays reconcile with measured wall keep-outs', () => {
  const scene = compileSceneV1({
    projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan: {
      ...plan,
      openings: [{ id: '1b8c4f3e-25e6-4c4b-8d45-4a5bbf2f9a01', wallId: plan.walls[0].id, type: 'door', offsetMm: 2600, widthMm: 900, heightMm: 2100, confidence: 1 }],
    },
    modules: [{ id: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', widthMm: 1200, depthMm: 400, heightMm: 600, xMm: 0, yMm: 0, rotationDeg: 0 }],
    moduleParts: [{ id: 'module-1-panel', moduleId: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', semanticType: 'side-panel', name: 'Side panel', widthMm: 1200, depthMm: 18, heightMm: 600, xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }],
  });
  scene.compositions = [{ id: 'composition-1', wallId: plan.walls[0].id, usableWidthMm: 1200, leftClearanceMm: 0, rightClearanceMm: 0, bays: [{ id: 'bay-1', moduleId: 'module-1', widthMm: 1200, offsetMm: 0 }], fillers: [], confirmed: true }];
  assert.equal(checkRenderReadiness(scene).ready, true);
});

test('blocks a composition bay that overlaps a measured opening', () => {
  const scene = compileSceneV1({
    projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan: {
      ...plan,
      openings: [{ id: '2c9d5e4f-36f7-4d5c-9e56-5b6ccf3a0b12', wallId: plan.walls[0].id, type: 'fixed', offsetMm: 1000, widthMm: 1000, sillMm: 900, headMm: 2100, confidence: 1 }],
    },
    modules: [{ id: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', widthMm: 1200, depthMm: 400, heightMm: 600, xMm: 900, yMm: 0, rotationDeg: 0 }],
    moduleParts: [{ id: 'module-1-panel', moduleId: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', semanticType: 'side-panel', name: 'Side panel', widthMm: 1200, depthMm: 18, heightMm: 600, xMm: 900, yMm: 0, zMm: 0, rotationDeg: 0 }],
  });
  scene.compositions = [{ id: 'composition-1', wallId: plan.walls[0].id, usableWidthMm: 1200, leftClearanceMm: 0, rightClearanceMm: 0, bays: [{ id: 'bay-1', moduleId: 'module-1', widthMm: 1200, offsetMm: 900 }], fillers: [], confirmed: true }];
  const readiness = checkRenderReadiness(scene);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.issues.some((issue) => issue.code === 'BAY_KEEP_OUT_CONFLICT'));
});

test('blocks a schedule when a bay width no longer matches the resized module envelope', () => {
  const scene = compileSceneV1({
    projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan,
    modules: [{ id: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', widthMm: 1400, depthMm: 400, heightMm: 600, xMm: 0, yMm: 0, rotationDeg: 0 }],
    moduleParts: [{ id: 'module-1-panel', moduleId: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', semanticType: 'side-panel', name: 'Side panel', widthMm: 1400, depthMm: 18, heightMm: 600, xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }],
  });
  scene.compositions = [{ id: 'composition-1', wallId: plan.walls[0].id, usableWidthMm: 1200, leftClearanceMm: 0, rightClearanceMm: 0, bays: [{ id: 'bay-1', moduleId: 'module-1', widthMm: 1200, offsetMm: 0 }], fillers: [], confirmed: true }];
  const readiness = checkRenderReadiness(scene);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.issues.some((issue) => issue.code === 'BAY_MODULE_WIDTH_MISMATCH'));
});
