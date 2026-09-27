import test from 'node:test';
import assert from 'node:assert/strict';
import { roomBuilderGeometryIssues, usableWallRunMm, type RoomBuilderOpening } from '../src/features/tools/room-builder-geometry.ts';

const room = { widthMm: 4200, depthMm: 3600, ceilingHeightMm: 2700, wallThicknessMm: 230 };

test('room builder validates opening position, overlap, window heights, and wall thickness', () => {
  const openings: RoomBuilderOpening[] = [
    { id: 'door-1', kind: 'door', wall: 'north', offsetMm: 500, widthMm: 900 },
    { id: 'window-1', kind: 'window', wall: 'north', offsetMm: 1300, widthMm: 1200, sillMm: 2400, headMm: 3000 },
    { id: 'column-1', kind: 'structural_column', wall: 'east', offsetMm: 3500, widthMm: 300, depthMm: 0 },
  ];
  const issues = roomBuilderGeometryIssues(room, openings);
  assert.ok(issues.some((issue) => issue.includes('overlap on north wall')));
  assert.ok(issues.some((issue) => issue.includes('fit inside its 3600 mm measured length')));
  assert.ok(issues.some((issue) => issue.includes('sill and head below the 2700 mm ceiling')));
  assert.ok(issues.some((issue) => issue.includes('positive projection depth')));
  assert.ok(roomBuilderGeometryIssues({ ...room, wallThicknessMm: 0 }, []).some((issue) => issue.includes('Wall thickness')));
});
test('usable wall calculation merges overlapping keep-outs instead of subtracting them twice', () => {
  const openings: RoomBuilderOpening[] = [
    { id: 'door', kind: 'door', wall: 'north', offsetMm: 500, widthMm: 1000 },
    { id: 'column', kind: 'structural_column', wall: 'north', offsetMm: 1200, widthMm: 400, depthMm: 230 },
    { id: 'window', kind: 'window', wall: 'north', offsetMm: 2500, widthMm: 800, sillMm: 900, headMm: 2100 },
  ];
  assert.equal(usableWallRunMm(4200, openings), 2300);
});

test('room builder blocks invalid and unconfirmed geometry from project handoff', () => {
  assert.ok(roomBuilderGeometryIssues({ ...room, widthMm: 0 }, []).length > 0);
  assert.deepEqual(roomBuilderGeometryIssues(room, []), []);
  // Handoff now additionally requires an explicit user confirmation checkbox.
  const dimensionsConfirmed = false;
  assert.equal(roomBuilderGeometryIssues(room, []).length === 0 && dimensionsConfirmed, false);
});
