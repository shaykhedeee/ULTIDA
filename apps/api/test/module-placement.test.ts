import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalPlanModel } from '@ultida/plan-core';
import { prepareModulePlacement } from '../src/module-edit.js';
import { invalidateModuleOutputs } from '../src/module-output-invalidation.js';

const plan = { ceilingHeightMm: 2700, scale: { verified: true }, spaces: [{ id: 'room-a', wallRefs: ['wall-a'] }],
  walls: [{ id: 'wall-a', worldStart: { xMm: 0, yMm: 0 }, worldEnd: { xMm: 4000, yMm: 0 }, heightMm: 2700 }], openings: [] } as unknown as CanonicalPlanModel;
const module = { id: 'island-a', space_id: 'space-record-a', category: 'kitchen-base', template_id: 'kit-island-waterfall-1800',
  config_json: { widthMm: 1725, depthMm: 925, heightMm: 875 }, position_json: { wallId: 'wall-a', offsetMm: 1000 } };

test('live placement preparation compiles the actual island template and preserves custom dimensions', () => {
  const result = prepareModulePlacement(module, plan, 'room-a', []);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.candidate.config_json, module.config_json);
  assert.equal(result.candidate.position_json.xMm, 1000);
  assert.ok(result.partCount > 0);
});
test('placement rejects uncalibrated plans, another room wall, and door overlap', () => {
  const cases = [
    [ { ...plan, scale: undefined }, 'room-a', 'PLAN_SCALE_NOT_CONFIRMED' ],
    [ plan, 'room-b', 'MODULE_WALL_ROOM_MISMATCH' ],
    [ { ...plan, openings: [{ id: 'door', wallId: 'wall-a', offsetMm: 1100, widthMm: 900, heightMm: 2100 }] }, 'room-a', 'MODULE_BLOCKS_DOOR' ],
  ] as const;
  for (const [input, room, code] of cases) {
    const result = prepareModulePlacement(module, input as CanonicalPlanModel, room, []);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
  }
});

test('placement uses canonical room association when explicit wall refs are missing and rejects temporary edges', () => {
  const associated = { ...plan, spaces: [{ ...plan.spaces[0], wallRefs: [] }], walls: [{ ...plan.walls[0], adjacentSpaces: ['room-a'] }] } as CanonicalPlanModel;
  assert.equal(prepareModulePlacement(module, associated, 'room-a', []).ok, true);
  const synthetic = { ...module, position_json: { wallId: 'room-a:edge:1', offsetMm: 1000 } };
  const rejected = prepareModulePlacement(synthetic, associated, 'room-a', []);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.code, 'MODULE_WALL_ROOM_MISMATCH');
});

test('placement checks the complete rotated module footprint against an explicit room polygon', () => {
  const roomPolygon = [
    { xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 },
    { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 },
  ];
  const measuredRoom = { ...plan, spaces: [{ ...plan.spaces[0], worldPolygon: roomPolygon }] } as CanonicalPlanModel;
  const inside = prepareModulePlacement(module, measuredRoom, 'room-a', []);
  assert.equal(inside.ok, true);

  const shallowRoom = { ...plan, spaces: [{ ...plan.spaces[0], worldPolygon: [
    { xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 500 },
    { xMm: 0, yMm: 500 }, { xMm: 0, yMm: 0 },
  ] }] } as CanonicalPlanModel;
  const outside = prepareModulePlacement(module, shallowRoom, 'room-a', []);
  assert.equal(outside.ok, false);
  if (!outside.ok) assert.equal(outside.code, 'MODULE_OUTSIDE_ROOM');

  // All four module corners are inside this concave room, but one side crosses
  // the notch. Edge reconciliation must catch that case too.
  const notchedRoom = { ...plan, spaces: [{ ...plan.spaces[0], worldPolygon: [
    { xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 },
    { xMm: 2500, yMm: 3000 }, { xMm: 2500, yMm: 800 }, { xMm: 1500, yMm: 800 },
    { xMm: 1500, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 },
  ] }] } as CanonicalPlanModel;
  const crossingNotch = prepareModulePlacement(module, notchedRoom, 'room-a', []);
  assert.equal(crossingNotch.ok, false);
  if (!crossingNotch.ok) assert.equal(crossingNotch.code, 'MODULE_OUTSIDE_ROOM');
});

test('placement checks oriented footprints of modules anchored to different walls', () => {
  const crossWallUnit = {
    id: 'corner-unit', space_id: module.space_id, category: 'kitchen-base',
    config_json: { widthMm: 1000, depthMm: 600, heightMm: 900 },
    position_json: { wallId: 'wall-b', offsetMm: 0, xMm: 2500, yMm: 0, zMm: 0, rotationDeg: 90, anchor: 'wall' },
  };
  const colliding = prepareModulePlacement(module, plan, 'room-a', [crossWallUnit]);
  assert.equal(colliding.ok, false);
  if (!colliding.ok) assert.equal(colliding.code, 'MODULE_OVERLAP');

  const clearUnit = { ...crossWallUnit, position_json: { ...crossWallUnit.position_json, xMm: 3500 } };
  const clear = prepareModulePlacement(module, plan, 'room-a', [clearUnit]);
  assert.equal(clear.ok, true);
});
test('module output invalidation covers scenes, artifacts and quotes and fails closed', async () => {
  for (const failure of [null, 'artifacts']) {
    const visited: string[] = [];
    const client = { from(table: string) { visited.push(table); const query = { update: () => query, eq: () => query, in: () => query, then(resolve: (value: unknown) => void) { resolve({ error: table === failure ? { message: 'offline' } : null }); } }; return query; } };
    const error = await invalidateModuleOutputs(client, 'project-a');
    if (failure) { assert.match(error!, /No module change was saved/); assert.deepEqual(visited, ['scene_versions', 'artifacts']); }
    else { assert.equal(error, null); assert.deepEqual(visited, ['scene_versions', 'artifacts', 'quotes']); }
  }
});
