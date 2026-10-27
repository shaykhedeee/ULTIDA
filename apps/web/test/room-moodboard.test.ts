import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoomMoodboard } from '../src/components/design/room-moodboard';
const assignment = { id: 'a', project_id: 'p', target_kind: 'module', target_id: 'm', module_instance_id: 'm', material_id: 'finish', semantic_slot: 'shutter', revision: 1, status: 'approved' };
const input = { projectId: 'p', roomId: 'r', modules: [{ id: 'm', roomId: 'r', label: 'Base' }], materials: [{ id: 'finish', name: 'Oak', code: 'internal-id', brand: 'Merino', metadata: { supplierCode: '14149', sourceUrl: 'https://www.merinolaminates.com/' } }], assignments: [assignment] };
test('board carries saved material and supplier identities', () => {
  const board = buildRoomMoodboard(input);
  assert.equal(board.items[0]?.materialId, 'finish');
  assert.equal(board.items[0]?.code, '14149');
  assert.equal(board.items[0]?.skuVerified, true);
});
test('newer rejected revision cannot expose old approved finish', () => {
  assert.equal(buildRoomMoodboard({ ...input, assignments: [...input.assignments, { ...assignment, revision: 2, status: 'rejected' }] }).items.length, 0);
});
test('brand name and internal code are not source verification', () => {
  assert.equal(buildRoomMoodboard({ ...input, materials: [{ ...input.materials[0]!, metadata: {} }] }).items[0]?.skuVerified, false);
});
test('other project and room assignments never leak into board', () => {
  assert.equal(buildRoomMoodboard({ ...input, projectId: 'other' }).items.length, 0);
  assert.equal(buildRoomMoodboard({ ...input, roomId: 'other' }).items.length, 0);
});
test('part overrides remain distinct from whole-module assignments', () => {
  const board = buildRoomMoodboard({ ...input, assignments: [assignment, { ...assignment, id: 'b', target_kind: 'part', target_id: 'drawer-front', revision: 2 }] });
  assert.equal(board.items.length, 2);
  assert.equal(board.items.some(item => item.targetId === 'drawer-front'), true);
});
