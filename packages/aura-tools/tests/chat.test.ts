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
