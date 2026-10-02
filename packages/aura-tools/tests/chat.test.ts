import test from 'node:test';
import assert from 'node:assert/strict';
import { planAuraMessage } from '../src/chat.js';

test('AURA maps floor-plan requests to a non-mutating analysis plan', () => {
  const plan = planAuraMessage('Please analyse this floor plan and detect the walls.');
  assert.equal(plan.intent, 'analyze_floor_plan');
  assert.equal(plan.tool?.id, 'analyze_plan');
  assert.equal(plan.safety.mutates, false);
  assert.equal(plan.safety.geometryAuthority, 'scene.v1');
});

test('AURA maps laminate requests to an approval-gated proposal', () => {
  const plan = planAuraMessage('Change the selected TV unit laminate to sage green.');
  assert.equal(plan.intent, 'change_material');
  assert.equal(plan.tool?.id, 'change_laminate');
  assert.equal(plan.safety.requiresApproval, true);
});

test('AURA asks for clarification instead of guessing unknown requests', () => {
  const plan = planAuraMessage('Make it better.');
  assert.equal(plan.intent, 'unknown');
  assert.ok(plan.clarification?.includes('inspect the project'));
  assert.equal(plan.tool, null);
});
import { selectModulesWithinRun } from '../src/run-selection.js';

test('kitchen proposals never exceed a measured run and retain the unresolved remainder', () => {
  const result = selectModulesWithinRun([{ widthMm: 900 }, { widthMm: 900 }, { widthMm: 600 }], 1200);
  assert.deepEqual(result.modules, [{ widthMm: 900 }]);
  assert.equal(result.unfilledWidthMm, 300);
  assert.throws(() => selectModulesWithinRun([], NaN), /AURA_RUN_WIDTH_REQUIRED/);
});

test('unsupported furniture requests never become unrelated TV unit proposals', () => {
  for (const message of ['configure wardrobe', 'build crockery module', 'suggest pooja module']) {
    assert.equal(planAuraMessage(message).tool, null);
  }
  assert.equal(planAuraMessage('configure a tv unit').tool?.id, 'generate_tv_unit');
});
