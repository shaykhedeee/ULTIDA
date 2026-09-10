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
test('module output invalidation covers scenes, artifacts and quotes and fails closed', async () => {
  for (const failure of [null, 'artifacts']) {
    const visited: string[] = [];
    const client = { from(table: string) { visited.push(table); const query = { update: () => query, eq: () => query, in: () => query, then(resolve: (value: unknown) => void) { resolve({ error: table === failure ? { message: 'offline' } : null }); } }; return query; } };
    const error = await invalidateModuleOutputs(client, 'project-a');
    if (failure) { assert.match(error!, /No module change was saved/); assert.deepEqual(visited, ['scene_versions', 'artifacts']); }
    else { assert.equal(error, null); assert.deepEqual(visited, ['scene_versions', 'artifacts', 'quotes']); }
  }
});
