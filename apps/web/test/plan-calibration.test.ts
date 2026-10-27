import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  createFreshPlanCalibrationState,
  requireConfirmedScale,
  SCALE_NOT_CONFIRMED_MESSAGE,
  parseCalibrationInputToMm,
  evaluateSecondDimensionVerification,
  computeGuidedPlanWorkflowSteps,
  COMMON_CALIBRATION_PRESETS_MM,
} from '../src/components/plan/plan-calibration.ts';

test('a freshly uploaded plan has no scale until calibration evidence is supplied', () => {
  const state = createFreshPlanCalibrationState();
  assert.equal(state.scale, null);

  const compileGate = requireConfirmedScale(state.scale, 'Plan compilation');
  assert.equal(compileGate.allowed, false);
  if (compileGate.allowed) return;
  assert.equal(compileGate.code, 'SCALE_NOT_CONFIRMED');
  assert.ok(compileGate.message.startsWith(SCALE_NOT_CONFIRMED_MESSAGE));
  assert.match(compileGate.message, /Plan compilation cannot continue/);

  const exportGate = requireConfirmedScale(state.scale, 'Plan export');
  assert.equal(exportGate.allowed, false);
  if (exportGate.allowed) return;
  assert.match(exportGate.message, /Scale not confirmed/);
  assert.match(exportGate.message, /Plan export cannot continue/);
});

test('only a positive measured scale unlocks downstream dimension work', () => {
  const result = requireConfirmedScale({ mmPerPixel: 12.5 }, 'Plan compilation');
  assert.equal(result.allowed, true);
  if (!result.allowed) return;
  assert.equal(result.scale.mmPerPixel, 12.5);
  assert.equal(requireConfirmedScale({ mmPerPixel: 0 }, 'Plan compilation').allowed, false);
});

test('parseCalibrationInputToMm supports mm, cm, m, and feet-inches and rejects empty/zero inputs', () => {
  assert.equal(parseCalibrationInputToMm('', 'mm'), null);
  assert.equal(parseCalibrationInputToMm('0', 'mm'), null);
  assert.equal(parseCalibrationInputToMm('3050', 'mm'), 3050);
  assert.equal(parseCalibrationInputToMm('305', 'cm'), 3050);
  assert.equal(parseCalibrationInputToMm('3.05', 'm'), 3050);
  assert.equal(parseCalibrationInputToMm(`10'0"`), 3048);
  assert.equal( parseCalibrationInputToMm(`10'6"`), 3200);
  assert.ok(COMMON_CALIBRATION_PRESETS_MM.length >= 5);
});

test('evaluateSecondDimensionVerification classifies <=2% as verified, 2-5% as advisory, and >5% as blocking', () => {
  const verified = evaluateSecondDimensionVerification({
    printedMm: 3000,
    measuredPixels: 303,
    mmPerPixel: 10,
  });
  assert.equal(verified.status, 'verified');
  assert.equal(verified.productionReady, true);

  const advisory = evaluateSecondDimensionVerification({
    printedMm: 3000,
    measuredPixels: 310,
    mmPerPixel: 10,
  });
  assert.equal(advisory.status, 'advisory');
  assert.equal(advisory.productionReady, true);

  const blocking = evaluateSecondDimensionVerification({
    printedMm: 3000,
    measuredPixels: 330,
    mmPerPixel: 10,
  });
  assert.equal(blocking.status, 'blocking');
  assert.equal(blocking.productionReady, false);
});

test('computeGuidedPlanWorkflowSteps tracks 6-step progression and flags unreviewed inferred geometry', () => {
  const steps = computeGuidedPlanWorkflowSteps({
    hasSourceFile: true,
    isCalibrated: true,
    secondReferenceVerified: true,
    totalWalls: 8,
    totalRooms: 3,
    unreviewedCount: 2,
    isApproved: false,
  });
  assert.equal(steps.length, 6);
  assert.equal(steps[0].status, 'complete');
  assert.equal(steps[1].badgeText, '2-Ref Verified');
  assert.equal(steps[3].status, 'attention');
  assert.equal(steps[3].badgeText, '2 needs review');
});

test('PlanReviewWorkspace removes prefilled 1000mm calibration input and keeps synthesized/derived walls in needs_review', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const workspaceSource = readFileSync(
    join(here, '../src/components/plan/PlanReviewWorkspace.tsx'),
    'utf8',
  );
  assert.ok(workspaceSource.includes("const [knownMmInput, setKnownMmInput] = useState('')"));
  assert.ok(!workspaceSource.includes("const [knownMmInput, setKnownMmInput] = useState('1000')"));
  assert.ok(
    workspaceSource.includes(
      "status: w.status === 'accepted' ? ('accepted' as const) : ('needs_review' as const)",
    ),
  );
  assert.ok(
    workspaceSource.includes(
      "Inferred from room boundary; verify against visible source drawing before Final Production.",
    ),
  );
});
