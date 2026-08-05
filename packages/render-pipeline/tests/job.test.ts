import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeRenderJob, type RenderJobInput } from '../src/job.js';
import { renderBaseArtifacts, renderScenePerspectiveArtifacts } from '../src/base-render.js';

const BOXES = [
  { id: 'room-1', kind: 'room' as const, x1: 0, y1: 0, x2: 4000, y2: 3000, materialId: 'mat-floor' },
  { id: 'tv-1', kind: 'module' as const, x1: 1500, y1: 500, x2: 3500, y2: 900, materialId: 'mat-tv' },
  { id: 'door-1', kind: 'opening' as const, x1: 0, y1: 0, x2: 0, y2: 0 },
];

const VALID_PNG = renderBaseArtifacts({ boxes: BOXES, width: 64, height: 64 }).rgb.url.split(',')[1];
const QA_EVIDENCE = {
  wallEdgesAligned: true,
  openingCountMatches: true,
  measuredDoorCount: 1,
  measuredWindowCount: 0,
  focalModuleVisible: true,
  cameraSimilarityMm: 10,
  measuredObjectIds: ['tv-1'],
  measuredMaterialRegionIds: ['mat-tv'],
  cabinetDivisionCount: 0,
};

const PERSPECTIVE_SCENE: any = {
  schema: 'scene.v1', units: 'mm', coordinateSystem: 'right-handed-z-up', projectId: 'proj-1', floorPlanVersionId: 'plan-1',
  floors: [{ id: 'floor-1', name: 'Ground', elevationMm: 0, heightMm: 2700 }],
  spaces: [{ id: 'space-1', floorId: 'floor-1', name: 'Living', type: 'living' }],
  rooms: [{ id: 'room-1', spaceId: 'space-1', name: 'Living', type: 'living', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 }], confidence: 1 }],
  walls: [{ id: 'wall-1', floorId: 'floor-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: ['space-1'], confidence: 1 }],
  openings: [{ id: 'door-1', wallId: 'wall-1', kind: 'door', offsetMm: 1000, widthMm: 900, heightMm: 2100, sillHeightMm: 0, confidence: 1 }],
  fixedFixtures: [], modules: [{ id: 'tv-1', roomId: 'room-1', family: 'tv_unit', widthMm: 1800, depthMm: 400, heightMm: 600, position: { xMm: 1400, yMm: 500 }, rotationDeg: 0, anchor: 'floor', materialId: 'mat-tv', confidence: 1 }],
  materials: [{ id: 'mat-tv', name: 'Oak', code: 'OAK-01' }], lighting: [],
  cameras: [{ id: 'camera-1', name: 'Corner', position: { xMm: 2000, yMm: 1700, zMm: -3500 }, target: { xMm: 2000, yMm: 1100, zMm: 1200 }, lensMm: 35 }],
  constraints: [], unresolvedDetections: [], metadata: { branch: 'main', status: 'approved', changeReason: 'fixture', schemaVersion: 'scene.v1', designVersion: 'design-1' },
};

function providerWithPng() {
  return {
    createVisualProposal: async () => ({
      status: 'succeeded',
      synthetic: false,
      provider: 'cloudflare',
      model: '@cf/flux-2-klein-4b',
      image: { encoding: 'base64', data: VALID_PNG, mimeType: 'image/png' },
      sourceSceneVersionId: 'scene-1',
      operation: 'enhance',
      attemptedProviders: ['cloudflare'],
    }),
    pollTaskStatus: async () => ({ status: 'running' }),
  };
}

function makeInput(overrides: Partial<RenderJobInput> = {}): RenderJobInput {
  return {
    projectId: 'proj-1',
    sceneVersionId: 'scene-1',
    floorPlanVersionId: 'plan-1',
    options: { room: 'living', renderType: 'photoreal_render', quality: 'review', aspectRatio: '16:9', geometryLock: 'strict', styleIntensity: 0.4, sourceSceneId: 'scene-1' },
    sceneBoxes: BOXES,
    sceneSummary: ['1 room, tv module'],
    roomDimensions: [{ id: 'room-1', name: 'Living', widthMm: 4000, depthMm: 3000, heightMm: 2700 }],
    moduleDimensions: [{ id: 'tv-1', name: 'TV Unit', widthMm: 2000, depthMm: 400, heightMm: 600, materialId: 'mat-tv' }],
    materialReferences: [{ id: 'mat-tv', code: 'MAT-TV', name: 'TV Material' }],
    cameraFacts: ['Camera at origin, 50 degree field of view'],
    promptVersion: 'v1',
    gateway: providerWithPng(),
    storage: { store: async () => ({ path: 'store/test.png', url: 'file://store/test.png' }) },
    qaMeasurement: QA_EVIDENCE,
    ...overrides,
  };
}

test('blocked readiness does not invoke the provider', async () => {
  let invoked = false;
  const res = await executeRenderJob(makeInput({
    gateway: { createVisualProposal: async () => { invoked = true; throw new Error('should not run'); }, pollTaskStatus: async () => ({ status: 'running' }) },
    readinessOverride: { ready: false, blockingCount: 1, warningCount: 0, issues: [{ code: 'SCALE_UNVERIFIED', severity: 'blocking', message: 'Scale not verified.', entityIds: [] }] },
  }));
  assert.equal(invoked, false);
  assert.equal(res.record.state, 'failed');
  assert.equal(res.record.failure?.code, 'RENDER_BLOCKED');
});

test('valid image plus QA evidence completes with actual provider provenance', async () => {
  const res = await executeRenderJob(makeInput());
  assert.equal(res.proof.status, 'succeeded');
  assert.equal(res.record.state, 'completed');
  assert.equal(res.record.provider, 'cloudflare');
  assert.equal(res.record.model, '@cf/flux-2-klein-4b');
  assert.match(res.record.baseHash ?? '', /^[a-f0-9]{64}$/);
  assert.match(res.record.outputHash ?? '', /^[a-f0-9]{64}$/);
  assert.ok(res.record.artifacts.some((artifact) => artifact.type === 'photoreal_render'));
});

test('provider-not-configured remains an explicit terminal failure', async () => {
  const res = await executeRenderJob(makeInput({
    gateway: { createVisualProposal: async () => ({ status: 'provider_not_configured' }), pollTaskStatus: async () => ({ status: 'running' }) },
  }));
  assert.equal(res.proof.status, 'provider_not_configured');
  assert.equal(res.record.failure?.code, 'IMAGE_PROVIDER_NOT_CONFIGURED');
  assert.equal(res.record.failure?.retryable, false);
});

test('invalid image bytes are rejected even when the MIME type claims PNG', async () => {
  const res = await executeRenderJob(makeInput({
    gateway: {
      createVisualProposal: async () => ({ status: 'succeeded', provider: 'cloudflare', model: '@cf/flux', image: { encoding: 'base64', data: Buffer.from('not a png').toString('base64'), mimeType: 'image/png' } }),
      pollTaskStatus: async () => ({ status: 'running' }),
    },
  }));
  assert.equal(res.proof.status, 'invalid_image');
  assert.equal(res.record.failure?.code, 'INVALID_IMAGE');
});

test('storage failure is captured after valid provider output', async () => {
  const res = await executeRenderJob(makeInput({ storage: { store: async () => { throw new Error('Storage unavailable'); } } }));
  assert.equal(res.proof.status, 'failed');
  assert.equal(res.record.failure?.code, 'STORAGE_FAILURE');
});

test('missing QA evidence requires review instead of a clean completion', async () => {
  const res = await executeRenderJob(makeInput({ qaMeasurement: undefined }));
  assert.equal(res.record.state, 'completed_with_warnings');
  assert.equal(res.record.qaResult?.issues[0]?.kind, 'qa_evidence_unavailable');
});

test('deterministic base render hash remains stable for identical scene input', async () => {
  const first = await executeRenderJob(makeInput());
  const second = await executeRenderJob(makeInput());
  assert.equal(first.proof.baseHash, second.proof.baseHash);
  assert.ok(first.proof.latencyMs >= 0);
  assert.ok(second.proof.latencyMs >= 0);
});

test('perspective scene renderer derives a stable base and masks from wall openings and module geometry', () => {
  const first = renderScenePerspectiveArtifacts(PERSPECTIVE_SCENE, { width: 160, height: 120, cameraId: 'camera-1' });
  const second = renderScenePerspectiveArtifacts(PERSPECTIVE_SCENE, { width: 160, height: 120, cameraId: 'camera-1' });
  assert.match(first.baseHash, /^[a-f0-9]{64}$/);
  assert.equal(first.baseHash, second.baseHash);
  assert.equal(first.objectMasks[0]?.id, 'tv-1');
  assert.equal(first.materialRegions[0]?.materialId, 'mat-tv');
});

test('render jobs choose the perspective scene renderer when an approved scene is supplied', async () => {
  const res = await executeRenderJob(makeInput({ scene: PERSPECTIVE_SCENE, sceneBoxes: undefined, cameraId: 'camera-1' }));
  assert.equal(res.proof.status, 'succeeded');
  assert.equal(res.record.state, 'completed');
  assert.equal(res.artifacts.objectMasks[0]?.id, 'tv-1');
});

test('version lineage remains intact in the persisted record', async () => {
  const res = await executeRenderJob(makeInput({ floorPlanVersionId: 'plan-v1', layoutVersionId: 'layout-v1', moduleSnapshotId: 'module-v1', materialVersionId: 'materials-v1' }));
  assert.equal(res.record.planVersionId, 'plan-v1');
  assert.equal(res.record.layoutVersionId, 'layout-v1');
  assert.equal(res.record.moduleSnapshotId, 'module-v1');
  assert.equal(res.record.materialVersionId, 'materials-v1');
});
