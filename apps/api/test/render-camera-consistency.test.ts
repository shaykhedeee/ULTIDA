import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRenderBrief } from '@ultida/agent-core';

/**
 * The conditioning images sent to the image provider are projected from a
 * saved scene camera. The prompt text sent alongside them states a lens and an
 * eye height. If those two disagree, the provider is told the horizon is in one
 * place while being shown depth and edge maps that put it somewhere else, and
 * it learns to distrust the geometry it was supposed to preserve.
 *
 * The render route used to hardcode `{ lensMm: 24, eyeHeightMm: 1500 }` while
 * the base pass rendered from `scene.cameras[0]`, so this contradiction was
 * present on every render. These tests lock in that the brief describes the
 * camera the images actually came from.
 */

const scene: any = {
  schema: 'scene.v1', units: 'mm', coordinateSystem: 'right-handed-z-up', projectId: 'project-1', floorPlanVersionId: 'plan-1',
  floors: [{ id: 'floor-1', name: 'Ground', elevationMm: 0, heightMm: 2700, surfaces: [] }],
  spaces: [{ id: 'space-1', floorId: 'floor-1', name: 'Living', type: 'living' }],
  rooms: [{ id: 'room-1', spaceId: 'space-1', name: 'Living', type: 'living', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 }], confidence: 1 }],
  walls: [{ id: 'wall-1', floorId: 'floor-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: ['space-1'], confidence: 1 }],
  openings: [],
  fixedFixtures: [],
  modules: [{ id: 'mod-1', roomId: 'room-1', family: 'tv-unit', widthMm: 2400, depthMm: 450, heightMm: 2100, position: { xMm: 800, yMm: 100, zMm: 0 }, rotationDeg: 0 }],
  moduleParts: [],
  materials: [],
  lighting: [],
  cameras: [
    { id: 'camera-corner', name: 'Corner', position: { xMm: 2000, yMm: 1700, zMm: 1650 }, target: { xMm: 2000, yMm: 1100, zMm: 1200 }, lensMm: 35 },
    { id: 'camera-eye', name: 'Eye level', position: { xMm: 500, yMm: 2400, zMm: 1200 }, target: { xMm: 2000, yMm: 0, zMm: 1100 }, lensMm: 28 },
  ],
  constraints: [], unresolvedDetections: [],
  metadata: { branch: 'main', status: 'approved', changeReason: 'fixture', schemaVersion: 'scene.v1', designVersion: 'design-1' },
};

/** Mirrors the camera resolution performed in createVisualJob. */
function resolveCamera(sceneInput: any, cameraId?: string) {
  const camera = cameraId
    ? sceneInput.cameras.find((candidate: any) => candidate.id === cameraId)
    : sceneInput.cameras[0];
  if (!camera) return undefined;
  return {
    view: 'wide-corner' as const,
    lensMm: camera.lensMm,
    eyeHeightMm: Math.min(2400, Math.max(600, Math.round(camera.position.zMm))),
  };
}

test('the brief states the lens of the camera that renders the conditioning images', () => {
  const brief = compileRenderBrief({
    scene, sceneVersionId: 'scene-v1', roomId: 'room-1', style: 'warm contemporary',
    camera: resolveCamera(scene),
  });
  assert.equal(brief.camera.lensMm, 35, 'the first saved camera uses a 35mm lens');
  assert.match(brief.positivePrompt, /35 mm lens/);
  assert.doesNotMatch(brief.positivePrompt, /24 mm lens/, 'the hardcoded 24mm default must not reappear');
});

test('eye height comes from the camera position, not a constant', () => {
  const brief = compileRenderBrief({
    scene, sceneVersionId: 'scene-v1', roomId: 'room-1', style: 'warm contemporary',
    camera: resolveCamera(scene),
  });
  assert.equal(brief.camera.eyeHeightMm, 1650);
  assert.match(brief.positivePrompt, /eye height 1650 mm/);
});

test('selecting a different saved camera changes the stated camera facts', () => {
  const brief = compileRenderBrief({
    scene, sceneVersionId: 'scene-v1', roomId: 'room-1', style: 'warm contemporary',
    camera: resolveCamera(scene, 'camera-eye'),
  });
  assert.equal(brief.camera.lensMm, 28);
  assert.equal(brief.camera.eyeHeightMm, 1200);
  assert.match(brief.positivePrompt, /28 mm lens/);
});

test('an unknown camera id resolves to nothing so the job can reject it', () => {
  assert.equal(resolveCamera(scene, 'camera-missing'), undefined);
});

test('eye height is clamped into the contract range for a low or high camera', () => {
  const low = structuredClone(scene);
  low.cameras[0].position.zMm = 120;
  assert.equal(resolveCamera(low)!.eyeHeightMm, 600);
  const high = structuredClone(scene);
  high.cameras[0].position.zMm = 9000;
  assert.equal(resolveCamera(high)!.eyeHeightMm, 2400);
});

test('module dimensions still reach the prompt as immutable facts', () => {
  const brief = compileRenderBrief({
    scene, sceneVersionId: 'scene-v1', roomId: 'room-1', style: 'warm contemporary',
    camera: resolveCamera(scene),
  });
  assert.match(brief.positivePrompt, /2400 x 450 x 2100 mm/, 'furniture must be described at its measured size');
  assert.match(brief.negativePrompt, /Do not change cabinetry dimensions/);
});
