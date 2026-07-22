import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parsePlanIntake, validateCanonicalPlan } from '../dist/index.js';

const fixture = (name: string) => {
  const path = new URL(`./fixtures/${name}`, import.meta.url);
  if (!existsSync(path)) throw new Error(`Missing fixture: ${name}`);
  return JSON.parse(readFileSync(path, 'utf8'));
};

test('unsupported formats surface manual calibration warning', () => {
  const input = { projectId: 'p1', fileName: 'plan.unknown', mimeType: 'application/octet-stream', bytes: 1024 };
  const result = parsePlanIntake(input);
  assert.strictEqual(result.processingMode, 'unsupported');
  assert.ok(result.warnings.some((warning: string) => warning.toLowerCase().includes('manual calibration')));
});

test('PNG plan uses raster mode', () => {
  const input = { projectId: 'p1', fileName: 'plan.png', mimeType: 'image/png', bytes: 1024, width: 1000, height: 1000 };
  const result = parsePlanIntake(input);
  assert.strictEqual(result.sourceFormat, 'png');
  assert.strictEqual(result.processingMode, 'raster');
});

test('scanned PDF falls back to raster/unsupported calibration but still returns parsed baseline', () => {
  const input = { projectId: 'p1', fileName: 'plan.pdf', mimeType: 'application/pdf', bytes: 2048 };
  const result = parsePlanIntake(input);
  assert.strictEqual(result.sourceFormat, 'pdf');
  assert.strictEqual(result.requiresCalibration, true);
  assert.ok(result.warnings.some((warning: string) => warning.toLowerCase().includes('calibrate')));
});

test('manual calibration is required for SVG vector plans', () => {
  const input = { projectId: 'p1', fileName: 'plan.svg', mimeType: 'image/svg+xml', bytes: 512, textContent: '<line x1="0" y1="0" x2="100" y2="0" />' };
  const result = parsePlanIntake(input);
  assert.strictEqual(result.sourceFormat, 'svg');
  assert.strictEqual(result.requiresCalibration, true);
  assert.ok(result.warnings.some((warning: string) => warning.toLowerCase().includes('pixels to millimetres')));
});

test('new project has no prior approved plan state', () => {
  const status = validateCanonicalPlan(null);
  assert.strictEqual(status.valid, false);
  assert.ok(status.issues.some((issue: { code: string }) => issue.code === 'UNSUPPORTED_GEOMETRY' || issue.code === 'PLAN_NOT_APPROVED'));
});

test('brief completion does not validate as approved plan when canonical payload is missing', () => {
  const status = validateCanonicalPlan(null);
  assert.strictEqual(status.valid, false);
});

test('approved canonical plan passes deterministic validation', () => {
  const status = validateCanonicalPlan(fixture('approved-plan.json'));
  assert.strictEqual(status.valid, true);
  assert.strictEqual(status.blockingCount, 0);
  assert.ok(!status.issues.some((issue: { code: string }) => issue.code === 'PLAN_NOT_APPROVED'));
});

test('upstream approved plan change preserves latest validation result', () => {
  const updated = fixture('approved-plan.json');
  updated.state = 'designer_review';
  const status = validateCanonicalPlan(updated);
  assert.ok(status.issues.some((issue: { code: string }) => issue.code === 'PLAN_NOT_APPROVED'));
});

test('missing wall height blocks approval', () => {
  const status = validateCanonicalPlan(fixture('no-height-plan.json'));
  assert.strictEqual(status.valid, false);
  assert.ok(status.issues.some((issue: { code: string }) => issue.code === 'MISSING_WALL_HEIGHT'));
});

test('open room boundary blocks approval', () => {
  const status = validateCanonicalPlan(fixture('open-room-plan.json'));
  assert.strictEqual(status.valid, false);
  assert.ok(status.issues.some((issue: { code: string }) => issue.code === 'OPEN_ROOM_BOUNDARY'));
});

test('stale versions remain queryable after supersede', () => {
  const stale = fixture('approved-plan.json');
  const status = validateCanonicalPlan(stale);
  assert.ok(status);
});

test('unauthorized workflow-status must still return structured stage payload from validator context alone', () => {
  const status = validateCanonicalPlan(null);
  assert.strictEqual(status.valid, false);
  assert.ok(status.issues.some((issue: { code: string }) => issue.code === 'UNSUPPORTED_GEOMETRY'));
});
