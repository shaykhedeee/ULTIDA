import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneMaterialAssignments, sceneDefaultMaterialSlots } from '../src/scene-material-assignments.js';
const row = { target_kind: 'room', target_id: 'kitchen', semantic_slot: 'wall', material_id: 'oak', revision: 1, status: 'approved' };
test('explicit room finish wins over a newer project default', () => {
  const defaults = sceneDefaultMaterialSlots([{ ...row, target_kind: 'semantic_slot', target_id: 'p', material_id: 'global', revision: 10 }, row]);
  assert.equal(defaults.get('wall'), 'oak');
});
test('room finishes cannot leak across compiled rooms', () => {
  assert.equal(sceneMaterialAssignments([row], 'bedroom', new Set(), new Map()).length, 0);
  assert.equal(sceneMaterialAssignments([row], 'kitchen', new Set(), new Map()).length, 1);
});
test('latest revoked assignment blocks old approved finish', () => {
  assert.equal(sceneMaterialAssignments([{ ...row, revision: 2, status: 'rejected' }, row], 'kitchen', new Set(), new Map()).length, 0);
});
test('module and exact part overrides have independent identities', () => {
  const rows = [{ ...row, target_kind: 'part', target_id: 'front', module_instance_id: 'm', semantic_slot: 'shutter' }, { ...row, target_kind: 'module', target_id: 'm', module_instance_id: 'm', semantic_slot: 'shutter' }];
  assert.equal(sceneMaterialAssignments(rows, 'kitchen', new Set(['m']), new Map([['front', 'm']])).length, 2);
  assert.equal(sceneMaterialAssignments(rows, 'kitchen', new Set(['other']), new Map([['front', 'm']])).length, 0);
  assert.equal(sceneMaterialAssignments(rows, 'kitchen', new Set(['m', 'other']), new Map([['front', 'other']])).length, 1);
});
