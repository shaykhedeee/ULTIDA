import assert from 'node:assert/strict';
import test from 'node:test';
import { roomBuilderGeometryIssues, roomDraftToPlanGeometry } from '../src/features/tools/room-builder-geometry.ts';

test('room draft transfer preserves cardinal wall offsets and measured door/window heights', () => {
  const geometry = roomDraftToPlanGeometry({
    roomId: 'room-a', originX: 1000, originY: 2000, widthMm: 4200, depthMm: 3300,
    ceilingHeightMm: 2700, wallThicknessMm: 150,
    openings: [
      { id: 'door-a', kind: 'door', wall: 'south', offsetMm: 450, widthMm: 900, heightMm: 2100 },
      { id: 'window-a', kind: 'window', wall: 'west', offsetMm: 600, widthMm: 1500, sillMm: 900, headMm: 2100 },
      { id: 'column-a', kind: 'structural_column', wall: 'east', offsetMm: 1200, widthMm: 300, depthMm: 250 },
    ],
  });

  assert.deepEqual(geometry.walls.map((wall) => wall.id), ['room-a:edge:1', 'room-a:edge:2', 'room-a:edge:3', 'room-a:edge:4']);
  assert.deepEqual(geometry.walls[2], { id: 'room-a:edge:3', start: { xMm: 5200, yMm: 5300 }, end: { xMm: 1000, yMm: 5300 }, heightMm: 2700, thicknessMm: 150, isExterior: false });
  assert.equal(geometry.openings[0].wallId, 'room-a:edge:3');
  assert.equal(geometry.openings[0].offsetAlongWallMm, 2850);
  assert.equal(geometry.openings[0].heightMm, 2100);
  assert.equal(geometry.openings[1].wallId, 'room-a:edge:4');
  assert.equal(geometry.openings[1].offsetAlongWallMm, 1200);
  assert.equal(geometry.openings[1].heightMm, 1200);
  assert.deepEqual(geometry.columns[0], {
    id: 'column-a', position: { xMm: 5075, yMm: 3350 }, sizeMm: { width: 250, depth: 300 },
  });
});

test('room builder blocks doors without a measured height', () => {
  const issues = roomBuilderGeometryIssues(
    { widthMm: 4200, depthMm: 3300, ceilingHeightMm: 2700, wallThicknessMm: 150 },
    [{ id: 'door-a', kind: 'door', wall: 'north', offsetMm: 0, widthMm: 900, heightMm: 0 }],
  );
  assert.ok(issues.some((issue) => issue.includes('measured positive height')));
});
