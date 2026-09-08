import assert from 'node:assert/strict';
import { test } from 'node:test';
import { __test__ } from '../src/plan-jobs.js';

test('maps normalized vision coordinates into the CV source pixel space', () => {
  const vision = __test__.visionProposalsToSemantic([
    { kind: 'opening', confidence: 0.9, note: 'Entry door', geometry: { x: 500, y: 250, width: 100, kind: 0 } },
    { kind: 'dimension', confidence: 0.9, note: '4200 mm', geometry: { x1: 100, y1: 200, x2: 900, y2: 200, valueMm: 4200 } },
  ], { widthPx: 2400, heightPx: 1200 });

  assert.deepEqual(vision.openings[0]?.approxCenterPx, { x: 1200, y: 300 });
  assert.equal(vision.openings[0]?.approxWidthPx, 240);
  assert.equal(vision.dimensionTextFindings[0]?.parsedMm, 4200);
  assert.deepEqual(vision.dimensionTextFindings[0]?.approxPositionPx, { x: 240, y: 240 });
});

test('does not preserve a legacy sparse result as a reviewable floor plan', () => {
  assert.equal(__test__.hasReviewablePlanCoverage({ proposals: [
    { kind: 'wall' },
  ] }), false);
  assert.equal(__test__.hasReviewablePlanCoverage({ proposals: [
    { kind: 'room' },
    { kind: 'wall' }, { kind: 'wall' }, { kind: 'wall' }, { kind: 'wall' },
    { kind: 'opening' },
  ] }), true);
});
