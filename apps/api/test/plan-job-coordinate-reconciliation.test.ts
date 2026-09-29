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

test('attaches positioned OCR evidence to its nearby unmeasured dimension and keeps it review-only', () => {
  const proposals = __test__.attachPositionedOcrToDimensions([
    { kind: 'dimension', confidence: 0.62, source: 'detector', note: 'Wall span', geometry: { x1: 100, y1: 300, x2: 900, y2: 300 } },
    { kind: 'dimension', confidence: 0.8, source: 'detector', note: 'Already measured', geometry: { x1: 100, y1: 500, x2: 900, y2: 500, valueMm: 4200 } },
    { kind: 'wall', confidence: 0.9, source: 'detector', note: 'Wall', geometry: { x1: 100, y1: 300, x2: 900, y2: 300 } },
  ], [{ originalText: '3600 mm', valueMm: 3600, x: 480, y: 310, source: 'ocr' }]);

  assert.equal(proposals[0].geometry.valueMm, 3600);
  assert.equal(proposals[0].geometry.ocrX, 480);
  assert.equal(proposals[0].geometry.ocrY, 310);
  assert.equal(proposals[0].source, 'ocr');
  assert.match(proposals[0].note ?? '', /Confirm the reading before using it to calibrate/);
  assert.equal(proposals[1].geometry.valueMm, 4200);
  assert.equal(proposals[2].geometry.valueMm, undefined);
});

test('leaves OCR dimension association unresolved when a label is equally close to two lines', () => {
  const proposals = __test__.attachPositionedOcrToDimensions([
    { kind: 'dimension', confidence: 0.7, geometry: { x1: 100, y1: 300, x2: 900, y2: 300 } },
    { kind: 'dimension', confidence: 0.7, geometry: { x1: 100, y1: 310, x2: 900, y2: 310 } },
  ], [{ originalText: '3600 mm', valueMm: 3600, x: 500, y: 305, source: 'ocr' }]);
  assert.equal(proposals[0].geometry.valueMm, undefined);
  assert.equal(proposals[1].geometry.valueMm, undefined);
});

test('shows unmatched OCR as a located review annotation instead of dropping or calibrating it', () => {
  const proposals = __test__.addUnmatchedOcrAnnotations([
    { kind: 'wall', geometry: { x1: 0, y1: 0, x2: 400, y2: 0 }, source: 'detector' },
  ], [{ originalText: '12 ft', valueMm: 3658, x: 510, y: 830, source: 'ocr' }]);
  const annotation = proposals.find((proposal) => proposal.kind === 'dimension');
  assert.deepEqual(annotation?.geometry, { valueMm: 3658, x: 510, y: 830 });
  assert.equal(annotation?.source, 'ocr');
  assert.equal(annotation?.status, 'needs_review');
  assert.match(annotation?.note ?? '', /does not calibrate or define wall geometry/);
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
