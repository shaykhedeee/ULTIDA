import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoomDesignInputs } from '../src/room-design-inputs.js';

const schedule = { wallId: 'wall-a', approvedUsableWidthMm: 3000, leftClearanceMm: 0, rightClearanceMm: 0, bays: [{ id: 'bay-a', offsetMm: 0, widthMm: 3000, keepOut: false }], confirmed: false };
const floor = { id: 'floor-a', roomId: 'room-a', materialVersionId: 'oak-v1', regionPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 }, { xMm: 3000, yMm: 3000 }], elevationMm: 0, buildUpThicknessMm: 12, substrate: 'screed' };
const input = { compositionSchedules: [schedule], floorSurfaces: [floor] };

test('saved room drafts preserve explicit unconfirmed state and do not share mutable inputs', () => {
  const saved = parseRoomDesignInputs(input, 'room-a', new Set(['wall-a']));
  assert.equal(saved.compositionSchedules[0].confirmed, false);
  saved.floorSurfaces[0].materialVersionId = 'stone-v2';
  assert.equal(floor.materialVersionId, 'oak-v1');
});
test('room inputs reject another room floor and another room wall', () => {
  assert.throws(() => parseRoomDesignInputs(input, 'room-b', new Set(['wall-a'])), /belonging to this room/);
  assert.throws(() => parseRoomDesignInputs(input, 'room-a', new Set(['wall-b'])), /belonging to this room/);
});
test('invalid measurements and duplicate wall records cannot be saved', () => {
  assert.throws(() => parseRoomDesignInputs({ ...input, compositionSchedules: [{ ...schedule, approvedUsableWidthMm: 0 }] }, 'room-a', new Set(['wall-a'])));
  assert.throws(() => parseRoomDesignInputs({ ...input, compositionSchedules: [schedule, schedule] }, 'room-a', new Set(['wall-a'])), /unique identity/);
});
