import assert from 'node:assert/strict';
import test from 'node:test';
import { createFreshPlanCalibrationState, requireConfirmedScale, SCALE_NOT_CONFIRMED_MESSAGE } from '../src/components/plan/plan-calibration.ts';

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
