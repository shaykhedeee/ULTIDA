import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRenderGeometryContract } from '../src/visual-jobs.ts';

const scene: any = {
  schema: 'scene.v1', units: 'mm', coordinateSystem: 'right-handed-z-up', projectId: 'project-1', floorPlanVersionId: 'plan-1',
  floors: [{ id: 'floor-1', name: 'Ground', elevationMm: 0, heightMm: 2700, surfaces: [{ id: 'finish-1', roomId: 'room-1', materialVersionId: 'tile-v1', regionPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }], elevationMm: 0, buildUpThicknessMm: 20, substrate: 'screed', skirting: { heightMm: 100, profile: 'flush', doorwayExclusions: [{ startMm: 0, endMm: 900 }] } }] }],
  spaces: [{ id: 'space-1', floorId: 'floor-1', name: 'Living', type: 'living' }],
  rooms: [{ id: 'room-1', spaceId: 'space-1', name: 'Living', type: 'living', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 }], confidence: 1 }],
  walls: [{ id: 'wall-1', floorId: 'floor-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: ['space-1'], confidence: 1 }],
  openings: [{ id: 'window-1', wallId: 'wall-1', kind: 'window', offsetMm: 1200, widthMm: 1200, heightMm: 1000, sillHeightMm: 900, confidence: 1 }],
  fixedFixtures: [], modules: [], moduleParts: [], materials: [], lighting: [], cameras: [{ id: 'camera-1', name: 'Corner', position: { xMm: 2000, yMm: 1700, zMm: -3500 }, target: { xMm: 2000, yMm: 1100, zMm: 1200 }, lensMm: 35 }], constraints: [], unresolvedDetections: [], metadata: { branch: 'main', status: 'approved', changeReason: 'fixture', schemaVersion: 'scene.v1', designVersion: 'design-1' },
};

test('render geometry contract names windows, sill heights and skirting from the approved scene', () => {
  const contract = compileRenderGeometryContract(scene, 'room-1');
  assert.equal(contract.valid, true);
  assert.match(contract.prompt, /window-1/);
  assert.match(contract.prompt, /sill 900mm/);
  assert.match(contract.prompt, /skirting/);
  assert.match(contract.negativePrompt, /sill height/i);
});

test('render geometry contract rejects a window whose head exceeds its measured wall', () => {
  const invalid = structuredClone(scene);
  invalid.openings[0].sillHeightMm = 1900;
  const contract = compileRenderGeometryContract(invalid, 'room-1');
  assert.equal(contract.valid, false);
  assert.match(contract.issues.join(' '), /exceeds measured wall height/);
});
