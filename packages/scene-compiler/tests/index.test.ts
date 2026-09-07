import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRenderReadiness, compileScene, compileSceneV1, reconcileBays, reconcileCatalogPlacement, SceneCompilationError } from '../src/index.ts';

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
  scene.compositions = [{ id: 'composition-1', wallId: plan.walls[0].id, usableWidthMm: 1200, leftClearanceMm: 0, rightClearanceMm: 0, bays: [{ id: 'bay-1', moduleId: 'module-1', widthMm: 1200, offsetMm: 0, keepOut: false }], fillers: [], confirmed: true }];
  assert.equal(checkRenderReadiness(scene).ready, true);
});

test('catalog placement uses the bay reconciler and stays a visual draft until scene confirmation', () => {
  const pending = reconcileCatalogPlacement({
    wallId: 'wall-1', wallLengthMm: 3000,
    openings: [{ id: 'door-1', wallId: 'wall-1', kind: 'door', offsetMm: 1000, widthMm: 900 }],
    module: { id: 'catalog-module', widthMm: 900, position: { xMm: 0, yMm: 0 } },
    offsetMm: 0,
  });
  assert.equal(pending.geometryValid, true);
  assert.equal(pending.productionCertified, false);
  assert.ok(pending.reconciliation.issues.some((issue) => issue.code === 'SCHEDULE_UNCONFIRMED'));

  const blocked = reconcileCatalogPlacement({
    wallId: 'wall-1', wallLengthMm: 3000,
    openings: [{ id: 'door-1', wallId: 'wall-1', kind: 'door', offsetMm: 1000, widthMm: 900 }],
    module: { id: 'catalog-module', widthMm: 1200, position: { xMm: 800, yMm: 0 } },
    offsetMm: 800,
  });
  assert.equal(blocked.geometryValid, false);
  assert.ok(blocked.reconciliation.issues.some((issue) => issue.code === 'MODULE_KEEP_OUT_CONFLICT'));
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
  scene.compositions = [{ id: 'composition-1', wallId: plan.walls[0].id, usableWidthMm: 1200, leftClearanceMm: 0, rightClearanceMm: 0, bays: [{ id: 'bay-1', moduleId: 'module-1', widthMm: 1200, offsetMm: 900, keepOut: false }], fillers: [], confirmed: true }];
  const readiness = checkRenderReadiness(scene);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.issues.some((issue) => issue.code === 'MODULE_KEEP_OUT_CONFLICT'));
});

test('blocks a schedule when a bay width no longer matches the resized module envelope', () => {
  const scene = compileSceneV1({
    projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan,
    modules: [{ id: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', widthMm: 1400, depthMm: 400, heightMm: 600, xMm: 0, yMm: 0, rotationDeg: 0 }],
    moduleParts: [{ id: 'module-1-panel', moduleId: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', semanticType: 'side-panel', name: 'Side panel', widthMm: 1400, depthMm: 18, heightMm: 600, xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }],
  });
  scene.compositions = [{ id: 'composition-1', wallId: plan.walls[0].id, usableWidthMm: 1200, leftClearanceMm: 0, rightClearanceMm: 0, bays: [{ id: 'bay-1', moduleId: 'module-1', widthMm: 1200, offsetMm: 0, keepOut: false }], fillers: [], confirmed: true }];
  const readiness = checkRenderReadiness(scene);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.issues.some((issue) => issue.code === 'BAY_MODULE_WIDTH_MISMATCH'));
});

const measuredWall = { id: 'wall-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 3000, yMm: 0 } };

test('blocks the exact unresolved bay total with the production message', () => {
  const result = reconcileBays({
    wallId: 'wall-1', approvedUsableWidthMm: 3000, leftClearanceMm: 0, rightClearanceMm: 0,
    bays: [{ id: 'bay-1', offsetMm: 0, widthMm: 2980, keepOut: false }], confirmed: true,
  }, measuredWall, [], []);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.code, 'BAY_TOTAL_MISMATCH');
  assert.equal(result.issues[0]?.message, 'Bay total is 2,980mm but approved usable wall is 3,000mm. 20mm unresolved gap requires filler or dimension confirmation.');
});

test('blocks a module placed over a measured door keep-out', () => {
  const result = reconcileBays({
    wallId: 'wall-1', approvedUsableWidthMm: 3000, leftClearanceMm: 0, rightClearanceMm: 0,
    bays: [{ id: 'bay-1', offsetMm: 0, widthMm: 1200, moduleId: 'module-1', keepOut: false }, { id: 'bay-2', offsetMm: 1200, widthMm: 1800, keepOut: false }], confirmed: true,
  }, measuredWall, [{ id: 'door-1', wallId: 'wall-1', offsetMm: 900, widthMm: 900, kind: 'door' }], [{ id: 'module-1', widthMm: 1200, position: { xMm: 800, yMm: 0, zMm: 0 } }]);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'MODULE_KEEP_OUT_CONFLICT'));
});

test('blocks an unconfirmed schedule even when its dimensions reconcile', () => {
  const result = reconcileBays({
    wallId: 'wall-1', approvedUsableWidthMm: 3000, leftClearanceMm: 0, rightClearanceMm: 0,
    bays: [{ id: 'bay-1', offsetMm: 0, widthMm: 3000, keepOut: false }], confirmed: false,
  }, measuredWall, [], []);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'SCHEDULE_UNCONFIRMED'));
});

test('accepts a confirmed schedule that exactly fits the measured wall', () => {
  const result = reconcileBays({
    wallId: 'wall-1', approvedUsableWidthMm: 3000, leftClearanceMm: 0, rightClearanceMm: 0,
    bays: [{ id: 'bay-1', offsetMm: 0, widthMm: 1000, keepOut: false }, { id: 'bay-2', offsetMm: 1000, widthMm: 2000, keepOut: false }], confirmed: true,
  }, measuredWall, [], []);
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test('compileSceneV1 persists only a reconciled composition schedule', () => {
  const scene = compileSceneV1({
    projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan,
    modules: [{ id: 'module-1', roomId: plan.spaces[0].id, family: 'tv-unit', widthMm: 1200, depthMm: 400, heightMm: 600, xMm: 0, yMm: 0, rotationDeg: 0 }],
    compositionSchedules: [{ wallId: plan.walls[0].id, approvedUsableWidthMm: 1200, leftClearanceMm: 0, rightClearanceMm: 0, bays: [{ id: 'bay-1', offsetMm: 0, widthMm: 1200, moduleId: 'module-1', keepOut: false }], confirmed: true }],
  });
  assert.equal(scene.compositions[0]?.approvedUsableWidthMm, 1200);
  assert.equal(scene.compositions[0]?.bays[0]?.keepOut, false);
});

test('floor surface material changes stay isolated to their authored room', () => {
  const secondRoomId = 'b8c4f9c1-390d-4cf3-bf95-3ce6e2d64b23';
  const secondSpaceId = 'b8c4f9c1-390d-4cf3-bf95-3ce6e2d64b23';
  const twoRoomPlan = {
    ...plan,
    spaces: [
      ...plan.spaces,
      { id: secondSpaceId, sourcePolygon: [{ x: 4200, y: 0 }, { x: 7200, y: 0 }, { x: 7200, y: 3000 }, { x: 4200, y: 0 }], worldPolygon: [{ xMm: 4200, yMm: 0 }, { xMm: 7200, yMm: 0 }, { xMm: 7200, yMm: 3000 }, { xMm: 4200, yMm: 0 }], roomType: 'bedroom', ceilingHeightMm: 2700, wallRefs: [], openingRefs: [], verification: 'verified' },
    ],
  };
  const surface = (id: string, roomId: string, materialVersionId: string, x: number) => ({
    id, roomId, materialVersionId, regionPolygon: [{ xMm: x, yMm: 0 }, { xMm: x + 2000, yMm: 0 }, { xMm: x + 2000, yMm: 2000 }, { xMm: x, yMm: 0 }], elevationMm: 0, buildUpThicknessMm: 12, substrate: 'screed',
    tile: { widthMm: 600, lengthMm: 600, groutWidthMm: 2, groutColor: 'grey', originX: x, originY: 0, angleDeg: 0, pattern: 'grid' as const },
  });
  const scene = compileSceneV1({ projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan: twoRoomPlan, floorSurfaces: [surface('floor-living', plan.spaces[0].id, 'mat-marble-v1', 0), surface('floor-bedroom', secondRoomId, 'mat-wood-v1', 4200)] } as any);
  const surfaces = scene.floors[0]?.surfaces ?? [];
  const changed = surfaces.map((item: any) => item.roomId === plan.spaces[0].id ? { ...item, materialVersionId: 'mat-stone-v2' } : item);
  assert.equal(changed.find((item: any) => item.roomId === secondRoomId)?.materialVersionId, 'mat-wood-v1');
});
