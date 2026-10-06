import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDrawingProjection, generateWallElevationsSvg, exportWallElevationToDxf } from '../src/index.js';

const scene: any = {
  schema: 'scene.v1', units: 'mm', projectId: 'project', floorPlanVersionId: 'plan',
  metadata: { status: 'approved' }, rooms: [], materials: [],
  walls: [{ id: 'wall', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, heightMm: 2700, thicknessMm: 150 }],
  modules: [{ id: 'loft', roomId: 'room', family: 'wardrobe', widthMm: 1200, depthMm: 600, heightMm: 500, position: { xMm: 0, yMm: 0, zMm: 2100 }, rotationDeg: 0 }],
  openings: [{ id: 'window', kind: 'window', wallId: 'wall', offsetMm: 1800, widthMm: 1200, heightMm: 1200, sillHeightMm: 900 }],
};
test('drawing projection preserves loft mounting and window sill heights', () => {
  const projection = buildDrawingProjection(scene);
  assert.equal(projection.modules[0].zMm, 2100);
  assert.equal(projection.openings[0].sillHeightMm, 900);
  const svg = generateWallElevationsSvg(scene, 'wall');
  assert.match(svg, /data-module-id="loft" x="0" y="100"/);
  assert.match(svg, /data-opening-id="window" x="1800" y="600"/);
});
test('DXF outlines retain the same floor datum as saved 3D geometry', () => {
  const dxf = exportWallElevationToDxf(scene, 'wall');
  assert.ok(dxf.includes('8\r\nA-MOD\r\n10\r\n0\r\n20\r\n2100\r\n'));
  assert.ok(dxf.includes('8\r\nA-OPENING\r\n10\r\n1800\r\n20\r\n900\r\n'));
});
