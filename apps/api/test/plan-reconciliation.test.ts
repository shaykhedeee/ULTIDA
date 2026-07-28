import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcilePlan, type CvTraceResult, type VisionSemanticResult } from '../src/plan/reconcile_plan.js';

const cv: CvTraceResult = {
  schema: 'PlanAnalysisResultV1.wallCandidates',
  sourceImageSize: { widthPx: 2400, heightPx: 1200 },
  corners: [],
  walls: [{
    id: 'wall-1', startCornerId: null, endCornerId: null,
    x1: 240, y1: 300, x2: 2160, y2: 300,
    thicknessPx: 18, lengthPx: 1920, confidence: 0.9,
  }],
};

function vision(walls: VisionSemanticResult['walls']): VisionSemanticResult {
  return { walls, rooms: [], openings: [], dimensionTextFindings: [] };
}

test('confirms a CV wall only when normalized vision evidence aligns geometrically', () => {
  const result = reconcilePlan(cv, vision([{
    approxStartPx: { x: 250, y: 304 }, approxEndPx: { x: 2150, y: 304 }, confidence: 0.92,
  }]));
  assert.equal(result.walls[0]?.confirmedByBothPasses, true);
});

test('does not falsely confirm a high-confidence vision wall at a different location', () => {
  const result = reconcilePlan(cv, vision([{
    approxStartPx: { x: 240, y: 600 }, approxEndPx: { x: 2160, y: 600 }, confidence: 0.99,
  }]));
  assert.equal(result.walls[0]?.confirmedByBothPasses, false);
  assert.match(result.reviewFlags.join(' '), /did not geometrically align/i);
});
