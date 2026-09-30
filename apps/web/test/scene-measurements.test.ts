import test from 'node:test';
import assert from 'node:assert/strict';
import { measuredRoomAreaSqm, measuredRoomCeilingHeightMm } from '../src/features/scene/scene-measurements.ts';

test('3D room area is calculated from persisted millimetre boundary', () => {
  assert.equal(measuredRoomAreaSqm([
    { xMm: 1000, yMm: 2000 }, { xMm: 5000, yMm: 2000 },
    { xMm: 5000, yMm: 5000 }, { xMm: 1000, yMm: 5000 },
  ]), 12);
});

test('ceiling height is shown only when saved walls provide a consistent measured value', () => {
  assert.equal(measuredRoomCeilingHeightMm('r1', 1, [{ heightMm: 2800 }, { heightMm: 2800 }]), 2800);
  assert.equal(measuredRoomCeilingHeightMm('r1', 1, [{ heightMm: 2800 }, { heightMm: 3000 }]), null);
  assert.equal(measuredRoomCeilingHeightMm('r1', 2, [{ heightMm: 2800 }]), null);
  assert.equal(measuredRoomCeilingHeightMm('r1', 2, [{ heightMm: 2800, spaceIds: ['r1'] }]), 2800);
});
