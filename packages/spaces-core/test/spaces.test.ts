import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveSpaceGeometry, computeSpaceReadiness, canApproveSpaces,
  computeUsableWallLength, editSplitRoom, editMergeRooms, editAddWall, editAddOpening, editAddColumn,
  deriveFragment, polygonsOverlap, type CanonicalPlanFragment, type WallDeduction
} from '../src/index.js';

// 4000 x 3000 mm room (12 m²) with two walls of 4000 and 3000.
const plan: CanonicalPlanFragment = {
  ceilingHeightMm: 2700,
  walls: [
    { id: 'w1', worldGeometry: { start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 } } },
    { id: 'w2', worldGeometry: { start: { xMm: 4000, yMm: 0 }, end: { xMm: 4000, yMm: 3000 } } },
    { id: 'w3', worldGeometry: { start: { xMm: 4000, yMm: 3000 }, end: { xMm: 0, yMm: 3000 } } },
    { id: 'w4', worldGeometry: { start: { xMm: 0, yMm: 3000 }, end: { xMm: 0, yMm: 0 } } },
  ],
  rooms: [
    { id: 'r1', worldGeometry: { polygon: [ { xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 } ] }, areaSqm: 12, name: 'Living', type: 'living', ceilingHeightMm: 2700 },
  ],
  openings: [
    { id: 'd1', wallId: 'w1', offsetAlongWallMm: 1000, kind: 'door', widthMm: 900 },
    { id: 'win1', wallId: 'w2', offsetAlongWallMm: 500, kind: 'window', widthMm: 1200 },
  ],
  services: [],
  obstacles: [
    { id: 'col1', kind: 'column', positionMm: { xMm: 200, yMm: 200 } },
  ],
};

test('rooms load from approved plan (deriveSpaceGeometry)', () => {
  const geo = deriveSpaceGeometry(plan, 'r1', 'fpv-1');
  assert.ok(geo, 'geometry derived');
  assert.equal(geo!.spaceId, 'r1');
  assert.equal(geo!.floorPlanVersionId, 'fpv-1');
  assert.equal(geo!.areaSqm, 12);
  assert.equal(geo!.usableWalls.length, 4); // 4 bounding walls
});

test('dimensions remain correct (area + bounding box)', () => {
  const geo = deriveSpaceGeometry(plan, 'r1', 'fpv-1')!;
  assert.equal(geo.areaSqm, 12);
  assert.equal(geo.boundingBox.widthMm, 4000);
  assert.equal(geo.boundingBox.depthMm, 3000);
  // perimeter 2*(4000+3000) = 14000
  assert.equal(geo.perimeterMm, 14000);
});

test('usable-wall calculation subtracts openings, columns, shafts, curtain, AC, fixtures, clearances', () => {
  const roomWalls = [
    { id: 'w1', lengthMm: 4000 },
    { id: 'w2', lengthMm: 3000 },
    { id: 'w3', lengthMm: 4000 },
    { id: 'w4', lengthMm: 3000 },
  ];
  const deductions: WallDeduction[] = [
    { id: 'd1', kind: 'opening', widthMm: 900, clearanceMm: 150 },       // 900 + 300 = 1200
    { id: 'win1', kind: 'opening', widthMm: 1200, clearanceMm: 100 },     // 1200 + 200 = 1400
    { id: 'col1', kind: 'column', widthMm: 300, clearanceMm: 200 },       // 300 + 400 = 700
    { id: 'shaft1', kind: 'shaft', widthMm: 600, clearanceMm: 150 },      // 600 + 300 = 900
    { id: 'curtain1', kind: 'curtain_zone', widthMm: 200, clearanceMm: 100 }, // 200+200=400
    { id: 'ac1', kind: 'ac_restriction', widthMm: 0, clearanceMm: 300 },  // 0 + 600 = 600
    { id: 'fix1', kind: 'fixed_fixture', widthMm: 500, clearanceMm: 150 },// 500 + 300 = 800
  ];
  const res = computeUsableWallLength(roomWalls, deductions);
  // total = 14000; sum deductions = 1200+1400+700+900+400+600+800 = 6000
  assert.equal(res.totalWallMm, 14000);
  assert.equal(res.deductionsMm, 6000);
  assert.equal(res.usableWallMm, 8000);
  assert.equal(res.breakdown.length, 7);
});

test('usable-wall never negative', () => {
  const res = computeUsableWallLength([{ id: 'w1', lengthMm: 1000 }], [
    { id: 'big', kind: 'opening', widthMm: 5000, clearanceMm: 1000 },
  ]);
  assert.equal(res.usableWallMm, 0);
});

test("split and merge rooms produce derived fragments (no mutation of source)", () => {
  const polyA = [ { xMm: 0, yMm: 0 }, { xMm: 2000, yMm: 0 }, { xMm: 2000, yMm: 3000 }, { xMm: 0, yMm: 3000 } ];
  const polyB = [ { xMm: 2000, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 2000, yMm: 3000 } ];
  const split = editSplitRoom(plan, "r1", polyA, polyB);
  assert.equal(split.fragment.rooms.length, 2);
  assert.equal(split.fragment.rooms[0].id, "r1-a");
  assert.equal(split.fragment.rooms[1].id, "r1-b");
  assert.equal(split.derivedVersionId.startsWith("approved:"), true);
  // Source must be untouched
  assert.equal(plan.rooms.length, 1);

  const merged = editMergeRooms(split.fragment, ["r1-a", "r1-b"], plan.rooms[0].worldGeometry.polygon);
  assert.equal(merged.fragment.rooms.length, 1);
  assert.equal(merged.fragment.rooms[0].id.startsWith("merged-"), true);
  assert.equal(Math.round(merged.fragment.rooms[0].areaSqm), 12);
});

test("persistence: structural edit creates a new derived plan version id", () => {
  const f = deriveFragment(plan, "spaces-edit");
  assert.equal(f.derivedFromVersionId, "approved");
  const added = editAddWall(f, { id: "w5", worldGeometry: { start: { xMm: 100, yMm: 100 }, end: { xMm: 900, yMm: 100 } } });
  assert.equal(added.fragment.walls.length, plan.walls.length + 1);
  assert.match(added.derivedVersionId, /approved:.+/);
  const withOpening = editAddOpening(plan, { id: "d2", wallId: "w3", offsetAlongWallMm: 200, kind: "door", widthMm: 800 });
  assert.equal(withOpening.fragment.openings.length, plan.openings.length + 1);
  const withCol = editAddColumn(plan, { id: "col2", kind: "column", positionMm: { xMm: 500, yMm: 500 } });
  assert.equal(withCol.fragment.obstacles!.length, plan.obstacles!.length + 1);
});

test("refresh restoration: re-deriving from the same source is idempotent", () => {
  const a = deriveSpaceGeometry(plan, "r1", "fpv-1")!;
  const b = deriveSpaceGeometry(plan, "r1", "fpv-1")!;
  assert.equal(a.areaSqm, b.areaSqm);
  assert.equal(a.usableWalls.length, b.usableWalls.length);
  assert.equal(a.perimeterMm, b.perimeterMm);
});

test("invalid overlap: two overlapping room polygons are detected", () => {
  const a = [ { xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 } ];
  const b = [ { xMm: 2000, yMm: 1500 }, { xMm: 6000, yMm: 1500 }, { xMm: 6000, yMm: 5000 }, { xMm: 2000, yMm: 5000 } ];
  const disjoint = [ { xMm: 5000, yMm: 5000 }, { xMm: 6000, yMm: 5000 }, { xMm: 6000, yMm: 6000 }, { xMm: 5000, yMm: 6000 } ];
  assert.equal(polygonsOverlap(a, b), true);
  assert.equal(polygonsOverlap(a, disjoint), false);
});

test("stage readiness: blocks until geometry, height, requirements, and no critical issues", () => {
  const geo = deriveSpaceGeometry(plan, "r1", "fpv-1");
  const ready = computeSpaceReadiness(geo, true, []);
  assert.equal(ready.ready, true);
  const blocked = computeSpaceReadiness(geo, false, []);
  assert.equal(blocked.ready, false);
  assert.ok(blocked.blockingReasons.some((r) => /requirements/i.test(r)));
  const withIssue = computeSpaceReadiness(geo, true, [{ code: "OPEN_BOUNDARY", severity: "critical", entityId: "r1" }]);
  assert.equal(withIssue.ready, false);

  const results = [ready, blocked];
  const approveAll = canApproveSpaces(results);
  assert.equal(approveAll.approved, false);
  assert.deepEqual(approveAll.blockedRooms, ["r1"]);
  const approveOk = canApproveSpaces([ready, ready]);
  assert.equal(approveOk.approved, true);
  assert.equal(approveOk.readyRooms, 2);
});

