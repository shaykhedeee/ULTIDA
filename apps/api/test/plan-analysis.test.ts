import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFile, reconcileToElements, UNSUPPORTED_FORMATS, type PlanElementDraft } from '../src/plan-analysis-service.js';
import { PlanVisionOutputSchema, normalizeVisionOutput } from '@ultida/agent-core';

test('classifyFile routes known formats correctly', () => {
  assert.equal(classifyFile('plan.png', 'image/png'), 'raster');
  assert.equal(classifyFile('plan.jpg', 'image/jpeg'), 'raster');
  assert.equal(classifyFile('plan.webp', 'image/webp'), 'raster');
  assert.equal(classifyFile('plan.PDF', 'application/pdf'), 'pdf');
  assert.equal(classifyFile('plan.svg', 'image/svg+xml'), 'vector');
  assert.equal(classifyFile('plan.dxf', 'application/dxf'), 'vector');
  assert.equal(classifyFile('plan.dwg', 'application/octet-stream'), 'unsupported');
  assert.equal(classifyFile('plan.tiff', 'image/tiff'), 'unsupported');
});

test('UNSUPPORTED_FORMATS enumerates excluded types', () => {
  for (const f of ['dwg', 'tiff', 'iges', 'step', 'password-protected-pdf']) {
    assert.ok(UNSUPPORTED_FORMATS.includes(f), `expected ${f} in unsupported list`);
  }
});

// Build a minimal (provider-shaped) raw output and normalize it.
function rawSample(overrides: Record<string, unknown> = {}) {
  return normalizeVisionOutput(
    PlanVisionOutputSchema.parse({
      documentType: 'plan',
      orientation: 'north_up',
      unitSuggestion: 'mm',
      roomCandidates: [{ id: 'r1', confidence: 0.9, polygon: [[100, 100], [400, 100], [400, 300], [100, 300]], label: 'Living' }],
      wallCandidates: [{ id: 'w1', confidence: 0.85, x1: 100, y1: 100, x2: 400, y2: 100 }],
      doorCandidates: [{ id: 'd1', confidence: 0.8, x: 250, y: 100, width: 36 }],
      windowCandidates: [{ id: 'win1', confidence: 0.7, x: 200, y: 100, width: 60, height: 40 }],
      dimensionCandidates: [{ id: 'dim1', confidence: 0.6, x1: 100, y1: 350, x2: 400, y2: 350, valueMm: 3800 }],
      columnCandidates: [],
      beamCandidates: [],
      shaftCandidates: [],
      stairCandidates: [],
      fixedFixtures: [],
      services: [],
      annotations: [],
      uncertainRegions: [],
      assumptions: ['No printed scale found'],
      warnings: [],
      ...overrides,
    })
  );
}

test('PlanVisionOutputSchema + normalize accepts a well-formed vision result', () => {
  const out = rawSample();
  assert.equal(out.documentType, 'plan');
  assert.equal(out.roomCandidates[0].id, 'r1');
  assert.equal(out.wallCandidates[0].id, 'w1');
  assert.equal(out.dimensionCandidates[0].valueMm, 3800);
});

test('normalize tolerates provider field aliasing (points instead of polygon, p1/p2 instead of x1/y1)', () => {
  const out = normalizeVisionOutput(
    PlanVisionOutputSchema.parse({
      roomCandidates: [{ points: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
      wallCandidates: [{ p1: [0, 0], p2: [10, 10] }],
      dimensionCandidates: [{ value: 4200 }],
    })
  );
  assert.equal(out.roomCandidates[0].polygon.length, 4);
  assert.equal(out.wallCandidates[0].x1, 0);
  assert.equal(out.wallCandidates[0].x2, 10);
  assert.equal(out.dimensionCandidates[0].valueMm, 4200);
  // ids auto-assigned when missing
  assert.ok(out.wallCandidates[0].id.startsWith('c'));
});

test('normalize coerces object assumptions/warnings to strings', () => {
  const out = normalizeVisionOutput(
    PlanVisionOutputSchema.parse({
      assumptions: [{ reason: 'inferred', detail: 'x' }],
      warnings: [{ code: 'ROTATED' }],
    })
  );
  assert.equal(typeof out.assumptions[0], 'string');
  assert.equal(typeof out.warnings[0], 'string');
});

test('reconcileToElements tags AI walls as mixed when a CV wall is nearby', () => {
  const ai = rawSample();
  const cv = { widthPx: 1000, heightPx: 1000, walls: [{ x1: 100, y1: 100, x2: 400, y2: 100, thicknessPx: 12 }] };
  const { elements } = reconcileToElements(ai, cv, '');
  const wall = elements.find((e) => e.kind === 'wall') as PlanElementDraft;
  assert.equal(wall.source, 'mixed');
  assert.equal(wall.geometry.x1, 100);
  assert.equal(wall.geometry.x2, 400);
});

test('reconcileToElements keeps AI-only source when no CV wall matches', () => {
  const ai = rawSample({ wallCandidates: [{ id: 'w1', confidence: 0.7, x1: 500, y1: 500, x2: 800, y2: 500 }] });
  const { elements } = reconcileToElements(ai, { widthPx: 1000, heightPx: 1000, walls: [] }, '');
  assert.equal(elements.find((e) => e.kind === 'wall')!.source, 'ai');
});

test('reconcileToElements notes OCR presence when dimension lacks value', () => {
  const ai = rawSample({ dimensionCandidates: [{ id: 'dim1', confidence: 0.5, x1: 100, y1: 350, x2: 400, y2: 350 }] });
  const { elements, issues } = reconcileToElements(ai, null, '3800 mm written here');
  const dim = elements.find((e) => e.kind === 'dimension')!;
  assert.ok(!('valueMm' in dim.geometry) || dim.geometry.valueMm === undefined);
  assert.ok((dim.note ?? '').includes('OCR'));
});

test('reconcileToElements turns a warning into a review issue', () => {
  const ai = rawSample({ warnings: ['Drawing rotated 90 degrees — verify orientation'] });
  const { issues } = reconcileToElements(ai, null, '');
  assert.ok(issues.some((i) => i.question.includes('rotated')));
});
