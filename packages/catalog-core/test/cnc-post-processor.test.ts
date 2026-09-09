import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileCabinetCncPackage,
  generateHomagWoodWopMpr,
  generateBiesseCix,
} from '../dist/index.js';

test('compileCabinetCncPackage decomposes cabinet into System 32 and hinge panels', () => {
  const pkg = compileCabinetCncPackage(
    '600 2-Door Base Cabinet',
    'ULT-KB-600',
    600,
    560,
    750
  );

  assert.strictEqual(pkg.sku, 'ULT-KB-600');
  assert.ok(pkg.panels.length >= 4);

  const leftGable = pkg.panels.find((p) => p.panelId === 'GABLE_L');
  assert.ok(leftGable);
  assert.strictEqual(leftGable.lengthMm, 560);
  assert.strictEqual(leftGable.widthMm, 650);
  assert.strictEqual(leftGable.thicknessMm, 18);

  // System 32 and hinge holes present
  assert.ok(leftGable.holes.length > 5);
  const sys32Front = leftGable.holes.find((h) => h.xMm === 37);
  assert.ok(sys32Front);
  assert.strictEqual(sys32Front.diameterMm, 5.0);
  assert.strictEqual(sys32Front.depthMm, 13.0);

  // Back panel groove present
  assert.strictEqual(leftGable.grooves.length, 1);
  assert.strictEqual(leftGable.grooves[0].widthMm, 6.0);
  assert.strictEqual(leftGable.grooves[0].depthMm, 8.0);
});

test('generateHomagWoodWopMpr produces valid WoodWOP 4.0 machine syntax', () => {
  const pkg = compileCabinetCncPackage('600 Base', 'ULT-KB-600', 600, 560, 750);
  const leftGable = pkg.panels.find((p) => p.panelId === 'GABLE_L')!;
  const mpr = generateHomagWoodWopMpr(leftGable);

  assert.ok(mpr.includes('[H'));
  assert.ok(mpr.includes('VERSION="4.0"'));
  assert.ok(mpr.includes('_BSX=560.00'));
  assert.ok(mpr.includes('_BSY=650.00'));
  assert.ok(mpr.includes('_BSZ=18.00'));
  assert.ok(mpr.includes('\\BohrVert\\'));
  assert.ok(mpr.includes('XA=37.00'));
  assert.ok(mpr.includes('DU=5.00'));
  assert.ok(mpr.includes('\\Nuten\\'));
  assert.ok(mpr.includes('BR=6.00'));
});

test('generateBiesseCix produces valid Biesse CID3 macro code', () => {
  const pkg = compileCabinetCncPackage('600 Base', 'ULT-KB-600', 600, 560, 750);
  const shutter = pkg.panels.find((p) => p.panelId === 'SHUTTER_1')!;
  const cix = generateBiesseCix(shutter);

  assert.ok(cix.includes('BEGIN ID CID3'));
  assert.ok(cix.includes('PARAM,NAME=PRG'));
  assert.ok(cix.includes('NAME=PANEL'));
  assert.ok(cix.includes('PARAM,NAME=T,VALUE=18.00'));
  assert.ok(cix.includes('NAME=BG'));
  assert.ok(cix.includes('PARAM,NAME=D,VALUE=35.00'));
  assert.ok(cix.includes('PARAM,NAME=DP,VALUE=12.50'));
});
