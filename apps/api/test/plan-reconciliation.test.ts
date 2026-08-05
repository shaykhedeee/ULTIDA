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

test('records independent CV evidence for an editable room proposal without approving its geometry', () => {
  const square: CvTraceResult = {
    ...cv,
    walls: [
      { ...cv.walls[0]!, id: 'north', x1: 240, y1: 300, x2: 2160, y2: 300, lengthPx: 1920 },
      { ...cv.walls[0]!, id: 'east', x1: 2160, y1: 300, x2: 2160, y2: 1020, lengthPx: 720 },
      { ...cv.walls[0]!, id: 'south', x1: 2160, y1: 1020, x2: 240, y2: 1020, lengthPx: 1920 },
      { ...cv.walls[0]!, id: 'west', x1: 240, y1: 1020, x2: 240, y2: 300, lengthPx: 720 },
    ],
  };
  const result = reconcilePlan(square, {
    walls: [],
    openings: [],
    dimensionTextFindings: [],
    rooms: [{
      label: 'Living Room', roomType: 'living', confidence: 0.94,
      approxPolygonPx: [{ x: 240, y: 300 }, { x: 2160, y: 300 }, { x: 2160, y: 1020 }, { x: 240, y: 1020 }],
    }],
  });
  assert.deepEqual(result.rooms[0]?.boundaryWallIds.sort(), ['east', 'north', 'south', 'west']);
  assert.equal(result.rooms[0]?.boundaryEvidence.status, 'candidate');
  assert.equal(result.requiresDesignerReview, true);
});
