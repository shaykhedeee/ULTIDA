import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRoomSceneModules } from '../src/lib/room-scene-selection.ts';

const saved = [{ id: 'wardrobe', space_id: 'bedroom' }, { id: 'island', space_id: 'kitchen' }];
test('preparation preserves the saved room and module identity', () => {
  assert.deepEqual(selectRoomSceneModules(saved, ['wardrobe']), { roomId: 'bedroom', moduleInstanceIds: ['wardrobe'] });
  assert.equal(saved[1].space_id, 'kitchen');
});
test('explicit room preparation excludes furniture in other rooms', () => {
  assert.deepEqual(selectRoomSceneModules(saved, [], 'kitchen'), { roomId: 'kitchen', moduleInstanceIds: ['island'] });
});
test('mixed-room selection cannot be silently reassigned', () => {
  assert.throws(() => selectRoomSceneModules(saved, ['wardrobe', 'island']), /Choose one room/);
  assert.throws(() => selectRoomSceneModules(saved, ['island'], 'bedroom'), /different rooms/);
});
test('missing or unsaved furniture cannot enter preparation', () => {
  assert.throws(() => selectRoomSceneModules(saved, ['draft']), /not saved/);
  assert.throws(() => selectRoomSceneModules([], [], 'bedroom'), /Place and save/);
  assert.throws(() => selectRoomSceneModules([{ id: 'orphan', space_id: null }], ['orphan']), /Assign/);
});
