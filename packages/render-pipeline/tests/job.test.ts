import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeRenderJob, type RenderJobInput } from '../src/job.js';
import { renderBaseArtifacts } from '../src/base-render.js';

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

test('version lineage remains intact in the persisted record', async () => {
  const res = await executeRenderJob(makeInput({ floorPlanVersionId: 'plan-v1', layoutVersionId: 'layout-v1', moduleSnapshotId: 'module-v1', materialVersionId: 'materials-v1' }));
  assert.equal(res.record.planVersionId, 'plan-v1');
  assert.equal(res.record.layoutVersionId, 'layout-v1');
  assert.equal(res.record.moduleSnapshotId, 'module-v1');
  assert.equal(res.record.materialVersionId, 'materials-v1');
});
