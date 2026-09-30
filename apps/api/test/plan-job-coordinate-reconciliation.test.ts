import assert from 'node:assert/strict';
import { test } from 'node:test';
import { __test__ } from '../src/plan-jobs.js';
import { isPlanVisionProviderConfigured } from '../src/plan-analyzer.js';

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

test('AI-assisted analysis is the default while local-only mode remains explicit', () => {
  assert.equal(__test__.normalizePlanAnalysisMode(undefined), 'assisted');
  assert.equal(__test__.normalizePlanAnalysisMode('offline'), 'offline');
  assert.equal(__test__.normalizePlanAnalysisMode('assisted'), 'assisted');
  assert.equal(__test__.normalizePlanAnalysisMode('anything-else'), 'assisted');
});

test('plan AI readiness matches providers accepted by the analyzer', () => {
  assert.equal(isPlanVisionProviderConfigured({}), false);
  assert.equal(isPlanVisionProviderConfigured({ CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_AI_TOKEN: 'token' }), true);
  assert.equal(isPlanVisionProviderConfigured({ CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_AI_TOKEN: 'token', CLOUDFLARE_VISION_MODEL: '' }), true);
  assert.equal(isPlanVisionProviderConfigured({ GEMINI_API_KEY: 'key' }), true);
  assert.equal(isPlanVisionProviderConfigured({ GOOGLE_AI_STUDIO_KEY_2: 'key' }), true);
});

test('analysis results disclose AI success, local fallback, and explicit local-only provenance', () => {
  assert.deepEqual(__test__.analysisProvenance('assisted', 'gemini'), { analysisMode: 'assisted', analysisSource: 'ai_assisted', analysisProvider: 'gemini' });
  assert.deepEqual(__test__.analysisProvenance('assisted', 'intake-parser'), { analysisMode: 'assisted', analysisSource: 'local_fallback', analysisProvider: null });
  assert.deepEqual(__test__.analysisProvenance('offline', undefined), { analysisMode: 'offline', analysisSource: 'local', analysisProvider: null });
});

test('offline review preserves unknown opening gaps without calling them doors', () => {
  const proposals = __test__.supplementSparseVisionProposals([], {
    schema: 'PlanAnalysisResultV1.wallCandidates',
    sourceImageSize: { widthPx: 1000, heightPx: 800 }, corners: [],
    walls: [{ id: 'w1', startCornerId: null, endCornerId: null, x1: 100, y1: 100, x2: 900, y2: 100, thicknessPx: null, lengthPx: 800, confidence: 0.8 }],
    openings: [{ betweenWallIds: ['w1', 'w1'], approxCenterPx: { x: 500, y: 100 }, approxWidthPx: 80, kindHint: 'unknown', confidence: 0.48, note: 'Wall gap; symbol is not clear.' }],
  });
  const gap = proposals.find((proposal) => proposal.kind === 'opening');
  assert.equal(gap?.geometry.kind, 2);
  assert.match(gap?.note ?? '', /Confirm door, window, or reject/);
});

test('offline OCR labels rooms and furniture text without claiming measured furniture footprints', () => {
  const cv = {
    schema: 'PlanAnalysisResultV1.wallCandidates' as const,
    sourceImageSize: { widthPx: 1000, heightPx: 800 }, corners: [], walls: [],
    rooms: [{ id: 'r1', label: 'Room 1', x: 100, y: 100, width: 400, height: 300, confidence: 0.5 }],
  };
  const proposals = __test__.addOfflinePlanLabels([
    { kind: 'room', confidence: 0.45, geometry: { x: 100, y: 125, width: 400, height: 375 }, note: 'Room 1 candidate.' },
  ], cv, [
    { text: 'BALCONY', x: 300, y: 250, width: 80, height: 20 },
    { text: 'SOFA', x: 350, y: 320, width: 42, height: 18 },
  ]);
  const room = proposals.find((proposal) => proposal.kind === 'room');
  const furniture = proposals.find((proposal) => proposal.kind === 'fixture');
  assert.match(room?.note ?? '', /Balcony.*OCR room label/);
  assert.equal(furniture?.source, 'ocr');
  assert.match(furniture?.note ?? '', /footprint is not measured/);
  assert.equal(furniture?.geometry.x, 350);
  assert.equal(furniture?.geometry.width, 42);
});

test('offline room candidates preserve traced boundary vertices instead of only their bounding box', () => {
  const proposals = __test__.supplementSparseVisionProposals([], {
    schema: 'PlanAnalysisResultV1.wallCandidates',
    sourceImageSize: { widthPx: 1000, heightPx: 800 }, corners: [], walls: [],
    rooms: [{ id: 'r1', x: 100, y: 100, width: 300, height: 200, polygon: [[100, 120], [400, 100], [380, 300], [120, 280]], confidence: 0.61 }],
  });
  const room = proposals.find((proposal) => proposal.kind === 'room');
  assert.equal(room?.geometry.vertex0X, 100);
  assert.equal(room?.geometry.vertex1X, 400);
  assert.equal(room?.geometry.vertex2Y, 375);
});

test('wall-only trace evidence does not become a fabricated room bounding box', () => {
  const proposals = __test__.supplementSparseVisionProposals([], {
    schema: 'PlanAnalysisResultV1.wallCandidates',
    sourceImageSize: { widthPx: 1000, heightPx: 800 },
    corners: [],
    walls: [
      { id: 'w1', startCornerId: null, endCornerId: null, x1: 100, y1: 100, x2: 900, y2: 100, thicknessPx: null, lengthPx: 800, confidence: 0.8 },
      { id: 'w2', startCornerId: null, endCornerId: null, x1: 900, y1: 100, x2: 900, y2: 700, thicknessPx: null, lengthPx: 600, confidence: 0.8 },
      { id: 'w3', startCornerId: null, endCornerId: null, x1: 900, y1: 700, x2: 100, y2: 700, thicknessPx: null, lengthPx: 800, confidence: 0.8 },
      { id: 'w4', startCornerId: null, endCornerId: null, x1: 100, y1: 700, x2: 100, y2: 100, thicknessPx: null, lengthPx: 600, confidence: 0.8 },
    ],
    rooms: [],
  });
  assert.equal(proposals.filter((proposal) => proposal.kind === 'room').length, 0);
  assert.equal(proposals.filter((proposal) => proposal.kind === 'wall').length, 4);
});
