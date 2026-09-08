import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reconcileBays,
  type CompositionScheduleV1,
  type Wall,
  type Opening,
} from '../../../packages/scene-compiler/src/index.ts';

test('bay reconciliation: exact match between bay total and approved usable wall passes with no issues', () => {
  const wall: Wall = {
    id: 'wall-A',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 3000, yMm: 0 },
  };

  const schedule: CompositionScheduleV1 = {
    wallId: 'wall-A',
    approvedUsableWidthMm: 2900,
    leftClearanceMm: 50,
    rightClearanceMm: 50,
    bays: [
      { id: 'bay-1', offsetMm: 0, widthMm: 900, keepOut: false },
      { id: 'bay-2', offsetMm: 900, widthMm: 900, keepOut: false },
      { id: 'bay-3', offsetMm: 1800, widthMm: 900, keepOut: false },
      { id: 'filler-1', offsetMm: 2700, widthMm: 200, keepOut: false },
    ],
    confirmed: true,
  };

  const result = reconcileBays(schedule, wall, [], []);
  assert.equal(result.valid, true);
  assert.equal(result.blocking, false);
  assert.equal(result.bayTotalMm, 2900);
  assert.equal(result.deltaMm, 0);
  assert.equal(result.issues.length, 0);
});

test('bay reconciliation: 20mm mismatch surfaces exact blocker message format inline', () => {
  const wall: Wall = {
    id: 'wall-A',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 3100, yMm: 0 },
  };

  // Approved usable wall: 3000mm. Bays sum to 2980mm (20mm unresolved gap)
  const schedule: CompositionScheduleV1 = {
    wallId: 'wall-A',
    approvedUsableWidthMm: 3000,
    leftClearanceMm: 50,
    rightClearanceMm: 50,
    bays: [
      { id: 'bay-1', offsetMm: 0, widthMm: 1000, keepOut: false },
      { id: 'bay-2', offsetMm: 1000, widthMm: 1000, keepOut: false },
      { id: 'bay-3', offsetMm: 2000, widthMm: 980, keepOut: false },
    ],
    confirmed: true,
  };

  const result = reconcileBays(schedule, wall, [], []);
  assert.equal(result.valid, false);
  assert.equal(result.blocking, true);
  assert.equal(result.bayTotalMm, 2980);
  assert.equal(result.deltaMm, 20);

  const mismatchIssue = result.issues.find((i) => i.code === 'BAY_TOTAL_MISMATCH');
  assert.ok(mismatchIssue, 'Expected BAY_TOTAL_MISMATCH issue');
  assert.equal(
    mismatchIssue?.message,
    'Bay total is 2,980mm but approved usable wall is 3,000mm. 20mm unresolved gap requires filler or dimension confirmation.'
  );
});

test('bay reconciliation: adding 20mm filler resolves mismatch immediately', () => {
  const wall: Wall = {
    id: 'wall-A',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 3100, yMm: 0 },
  };

  const schedule: CompositionScheduleV1 = {
    wallId: 'wall-A',
    approvedUsableWidthMm: 3000,
    leftClearanceMm: 50,
    rightClearanceMm: 50,
    bays: [
      { id: 'bay-1', offsetMm: 0, widthMm: 1000, keepOut: false },
      { id: 'bay-2', offsetMm: 1000, widthMm: 1000, keepOut: false },
      { id: 'bay-3', offsetMm: 2000, widthMm: 980, keepOut: false },
      { id: 'filler-end', offsetMm: 2980, widthMm: 20, keepOut: false },
    ],
    confirmed: true,
  };

  const result = reconcileBays(schedule, wall, [], []);
  assert.equal(result.valid, true);
  assert.equal(result.blocking, false);
  assert.equal(result.bayTotalMm, 3000);
  assert.equal(result.deltaMm, 0);
  assert.equal(result.issues.length, 0);
});

test('bay reconciliation: keep-out bay matching measured door opening validates successfully', () => {
  const wall: Wall = {
    id: 'wall-A',
    start: { xMm: 0, yMm: 0 },
    end: { xMm: 3000, yMm: 0 },
  };

  const openings: Opening[] = [
    {
      id: 'door-1',
      wallId: 'wall-A',
      kind: 'door',
      offsetMm: 1200,
      widthMm: 900,
    },
  ];

  const schedule: CompositionScheduleV1 = {
    wallId: 'wall-A',
    approvedUsableWidthMm: 3000,
    leftClearanceMm: 0,
    rightClearanceMm: 0,
    bays: [
      { id: 'bay-1', offsetMm: 0, widthMm: 1200, keepOut: false },
      { id: 'keep-out-door-1', offsetMm: 1200, widthMm: 900, keepOut: true },
      { id: 'bay-2', offsetMm: 2100, widthMm: 900, keepOut: false },
    ],
    confirmed: true,
  };

  const result = reconcileBays(schedule, wall, openings, []);
  assert.equal(result.valid, true);
  assert.equal(result.blocking, false);
  assert.equal(result.bayTotalMm, 3000);
});
