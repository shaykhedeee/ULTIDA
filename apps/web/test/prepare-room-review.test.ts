import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRoomReview } from '../src/features/spaces/prepare-room-review';
test('review waits for saved room approval and its exact compiled scene', async () => {
  const calls: string[] = [];
  const result = await prepareRoomReview({ save: async () => { calls.push('save'); return { id: 'room' }; }, approve: async room => { calls.push(`approve:${room.id}`); return true; }, compile: async room => { calls.push(`compile:${room.id}`); return 'scene-1'; } });
  assert.equal(result, 'scene-1'); assert.deepEqual(calls, ['save', 'approve:room', 'compile:room']);
});
test('failed save or approval never permits compilation or review navigation', async () => {
  for (const saved of [null, { id: 'room' }]) {
    let compiled = false;
    assert.equal(await prepareRoomReview({ save: async () => saved, approve: async () => false, compile: async () => { compiled = true; return 'invalid'; } }), null);
    assert.equal(compiled, false);
  }
});
