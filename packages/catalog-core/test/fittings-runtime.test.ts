import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_FITTINGS, checkFittingCompatibility } from '../src/fittings/verified-hardware.js';

test('fitting compatibility rejects nonphysical and nonfinite measurements', () => {
  const runner = STARTER_FITTINGS.find(f => f.id === 'hettich-9099124')!;
  for (const invalid of [NaN, Infinity, -1, 0]) {
    assert.equal(checkFittingCompatibility(runner, {
      kind: 'drawer_runner', cabinetInternalDepthMm: 500,
      drawerSideThicknessMm: invalid, drawerLoadKg: 10, nominalRunnerLengthMm: 450,
    }).compatible, false);
  }
});
