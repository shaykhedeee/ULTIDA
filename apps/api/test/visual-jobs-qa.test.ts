import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { renderScenePerspectiveArtifacts } from '@ultida/render-pipeline';
import { evaluateRenderImageQA } from '../src/visual-jobs';

const SCENE: any = {
  schema: 'scene.v1', units: 'mm', coordinateSystem: 'right-handed-z-up', projectId: 'project-1', floorPlanVersionId: 'plan-1',
  floors: [{ id: 'floor-1', name: 'Ground', elevationMm: 0, heightMm: 2700 }],
  spaces: [{ id: 'space-1', floorId: 'floor-1', name: 'Living', type: 'living' }],
  rooms: [{ id: 'room-1', spaceId: 'space-1', name: 'Living', type: 'living', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 }], confidence: 1 }],
  walls: [{ id: 'wall-1', floorId: 'floor-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: ['space-1'], confidence: 1 }],
  openings: [{ id: 'door-1', wallId: 'wall-1', kind: 'door', offsetMm: 1000, widthMm: 900, heightMm: 2100, sillHeightMm: 0, confidence: 1 }],
  fixedFixtures: [], modules: [], materials: [], lighting: [],
  cameras: [{ id: 'camera-1', name: 'Corner', position: { xMm: 2000, yMm: 1700, zMm: -3500 }, target: { xMm: 2000, yMm: 1100, zMm: 1200 }, lensMm: 35 }],
  constraints: [], unresolvedDetections: [], metadata: { branch: 'main', status: 'approved', changeReason: 'fixture', schemaVersion: 'scene.v1', designVersion: 'design-1' },
};

test('live render QA blocks an image whose measured door count differs from the approved scene', async () => {
  const artifacts = renderScenePerspectiveArtifacts(SCENE, { width: 160, height: 120 });
  const alteredWithoutDoorEvidence = await sharp({
    create: { width: 160, height: 120, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).png().toBuffer();

  const qa = await evaluateRenderImageQA(SCENE, artifacts, alteredWithoutDoorEvidence);
  assert.ok(qa.issues.some((issue) => issue.message === 'Door count mismatch: expected 1, found 0.'));
  assert.ok(qa.issues.some((issue) => issue.severity === 'blocking'));
});

test('live render QA accepts the deterministic edge raster that produced its technical evidence', async () => {
  const artifacts = renderScenePerspectiveArtifacts(SCENE, { width: 160, height: 120 });
  const qa = await evaluateRenderImageQA(SCENE, artifacts, artifacts.edgeMap.url);
  assert.equal(qa.issues.filter((issue) => issue.severity === 'blocking').length, 0, JSON.stringify(qa));
});
