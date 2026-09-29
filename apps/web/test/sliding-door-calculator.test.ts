import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateSlidingDoorDeductions,
  SLIDING_HARDWARE_PRESETS,
} from '../src/features/tools/sliding-door-calculator.ts';

test('Sliding Door Calculator: accurately computes 2-door wardrobe shutter and infill dimensions', () => {
  // Example from domain rules:
  // Opening: 1800W x 2400H, 2 doors, 30mm overlap, 50mm track deduction
  // 4-sided frame with 35mm side stile deduction, 50mm top/bottom rail deduction
  const result = calculateSlidingDoorDeductions({
    openingWidthMm: 1800,
    openingHeightMm: 2400,
    doorCount: 2,
    hardwarePresetId: 'hafele-aluflex-45', // Dh = 50, O = 35, frame stiles 35/rails 50
    customOverlapMm: 30, // Override overlap to 30mm for example check
    customHeightDeductionMm: 50,
    isProfileFrame: true,
    sideProfileAllowanceMm: 35,
    topProfileAllowanceMm: 50,
    bottomProfileAllowanceMm: 50,
    materialType: 'hdhmr_18',
  });

  // 1. Finished Shutter Width = (1800 + 30) / 2 = 915 mm
  assert.equal(result.finishedShutterWidthMm, 915);

  // 2. Finished Shutter Height = 2400 - 50 = 2350 mm
  assert.equal(result.finishedShutterHeightMm, 2350);

  // 3. Infill Panel Width = 915 - 35 - 35 = 845 mm
  assert.equal(result.infillWidthMm, 845);

  // 4. Infill Panel Height = 2350 - 50 - 50 = 2250 mm
  assert.equal(result.infillHeightMm, 2250);

  // 5. Generates 2 cutlist parts
  assert.equal(result.cutlistParts.length, 2);
  assert.equal(result.cutlistParts[0].lengthMm, 2250);
  assert.equal(result.cutlistParts[0].widthMm, 845);
  assert.equal(result.cutlistParts[0].thicknessMm, 18);
  assert.equal(result.cutlistParts[0].grainDirection, 'vertical');

  // 6. Weight calculation: (0.845 * 2.25) * 0.018 * 850 = ~29.1 kg (< 80kg capacity)
  assert.ok(result.weightPerDoorKg > 25 && result.weightPerDoorKg < 35);
  assert.equal(result.weightCapacityStatus, 'safe');
});

test('Sliding Door Calculator: computes direct board shutter without frame profile deductions', () => {
  const result = calculateSlidingDoorDeductions({
    openingWidthMm: 2400,
    openingHeightMm: 2100,
    doorCount: 3,
    hardwarePresetId: 'hafele-classic-50', // direct board, Dh = 50, O = 30
    materialType: 'plywood_18',
  });

  // Total with 2 overlaps: 2400 + (2 * 30) = 2460. Width per door = 2460 / 3 = 820 mm
  assert.equal(result.finishedShutterWidthMm, 820);
  assert.equal(result.finishedShutterHeightMm, 2050); // 2100 - 50
  assert.equal(result.infillWidthMm, 820);
  assert.equal(result.infillHeightMm, 2050);
  assert.equal(result.isProfileFrame, false);
  assert.equal(result.cutlistParts.length, 3);
  assert.match(result.cutlistParts[0].edgeBanding.l1, /2.0mm PVC/);
});

test('sliding calculator rejects missing, impossible, and unknown inputs instead of clamping dimensions', () => {
  const base = { openingWidthMm: 1800, openingHeightMm: 2400, doorCount: 2, hardwarePresetId: 'hafele-aluflex-45', materialType: 'hdhmr_18' as const };
  assert.throws(() => calculateSlidingDoorDeductions({ ...base, openingWidthMm: 0 }), /measured positive clear opening width/);
  assert.throws(() => calculateSlidingDoorDeductions({ ...base, openingHeightMm: 25 }), /Track deduction.*less than the measured opening height/);
  assert.throws(() => calculateSlidingDoorDeductions({ ...base, hardwarePresetId: 'unknown' }), /Unknown sliding hardware preset/);
  assert.throws(() => calculateSlidingDoorDeductions({ ...base, materialType: 'glass_fluted_8', isProfileFrame: false }), /require a profile-frame system/);
});

test('glass and mirror infill do not receive a wood laminate or woodgrain assignment', () => {
  const result = calculateSlidingDoorDeductions({ openingWidthMm: 1800, openingHeightMm: 2400, doorCount: 2, hardwarePresetId: 'ebco-slim-profile-glass', materialType: 'glass_fluted_8', decorativeLaminateCode: 'should-not-apply' });
  assert.equal(result.cutlistParts[0].grainDirection, 'none');
  assert.equal(result.cutlistParts[0].externalLaminateCode, undefined);
  const gasket = result.hardwareChecklist.find((item) => item.name.includes('Gasket'));
  assert.equal(gasket?.unit, 'm');
  assert.ok((gasket?.quantity ?? 0) > 0);
});
