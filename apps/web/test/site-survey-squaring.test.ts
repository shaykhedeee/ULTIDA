import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseFlexibleDimensionToMm,
  feetInches,
  toMm,
  parseFeetInches,
  verifyPythagoreanSquaring,
} from '../src/lib/site-survey.ts';

test('Site Survey: parses imperial feet and inches correctly into canonical millimetres', () => {
  // 10' 6" = 10 * 304.8 + 6 * 25.4 = 3048 + 152.4 = 3200.4 mm -> 3200 mm
  const mm1 = parseFlexibleDimensionToMm("10' 6\"");
  assert.equal(mm1, 3200);

  // 12ft
  const mm2 = parseFlexibleDimensionToMm("12ft");
  assert.equal(mm2, 3658);

  // 14' 0"
  const mm3 = parseFlexibleDimensionToMm("14' 0\"");
  assert.equal(mm3, 4267);
});

test('Site Survey: parses metric dimensions correctly into canonical millimetres', () => {
  assert.equal(parseFlexibleDimensionToMm("4200"), 4200);
  assert.equal(parseFlexibleDimensionToMm("3.6m"), 3600);
  assert.equal(parseFlexibleDimensionToMm("360cm"), 3600);
  assert.equal(parseFlexibleDimensionToMm("2400mm"), 2400);
});

test('Site Survey: formats millimetres back into feet and inches', () => {
  assert.equal(feetInches(3048), "10' 0\"");
  assert.equal(feetInches(609.6), "2' 0\"");
});

test('Site Survey: accurately verifies Pythagorean 90° squaring cross-checks', () => {
  const wallA = 4000;
  const wallB = 3000;
  // 3-4-5 right triangle -> hypot(4000, 3000) = 5000mm

  // Test case 1: Perfect square (measured 5002mm -> diff 2mm <= 5mm)
  const auditPerfect = verifyPythagoreanSquaring(wallA, wallB, 5002);
  assert.equal(auditPerfect.theoreticalDiagonalMm, 5000);
  assert.equal(auditPerfect.squaringDiffMm, 2);
  assert.equal(auditPerfect.level, 'perfect');

  // Test case 2: Minor site undulation (measured 5012mm -> diff 12mm <= 15mm)
  const auditMinor = verifyPythagoreanSquaring(wallA, wallB, 5012);
  assert.equal(auditMinor.squaringDiffMm, 12);
  assert.equal(auditMinor.level, 'minor');

  // Test case 3: Severe out of square (measured 5035mm -> diff 35mm > 15mm)
  const auditSevere = verifyPythagoreanSquaring(wallA, wallB, 5035);
  assert.equal(auditSevere.squaringDiffMm, 35);
  assert.equal(auditSevere.level, 'severe');
});
