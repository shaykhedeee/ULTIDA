import assert from 'node:assert/strict';
import test from 'node:test';
import { optimizeGuillotineNesting, type NestingPart } from '../src/features/tools/cutlist-optimizer.ts';

test('Cutlist Optimizer: consolidates parts sharing identical laminate and substrate across different units and rooms', () => {
  const parts: NestingPart[] = [
    // Unit 1: Living Room TV Unit Shutter
    {
      id: 'tv-shutter-1',
      partInstanceId: 'TV-SHT-1',
      name: 'TV Console Shutter Left',
      roomName: 'Living Room',
      moduleName: '2400 TV Media Wall',
      classification: 'external_shutter',
      isExternal: true,
      lengthMm: 1200,
      widthMm: 450,
      thicknessMm: 18,
      quantity: 1,
      materialCode: 'hdhmr_18',
      materialName: '18mm Action TESA HDHMR',
      grainDirection: 'vertical',
      externalLaminateCode: 'merino-zerog-matte-sand',
      edgeBanding: { l1: '2mm', l2: '2mm', w1: '2mm', w2: '2mm', totalLinearMeters: 3.3 },
    },
    // Unit 2: Master Bedroom Wardrobe Shutter (SAME LAMINATE & CORE)
    {
      id: 'wd-shutter-1',
      partInstanceId: 'WD-SHT-1',
      name: 'Wardrobe Shutter Bay A',
      roomName: 'Master Bedroom',
      moduleName: 'Four-Door Wardrobe',
      classification: 'external_shutter',
      isExternal: true,
      lengthMm: 1200,
      widthMm: 500,
      thicknessMm: 18,
      quantity: 1,
      materialCode: 'hdhmr_18',
      materialName: '18mm Action TESA HDHMR',
      grainDirection: 'vertical',
      externalLaminateCode: 'merino-zerog-matte-sand',
      edgeBanding: { l1: '2mm', l2: '2mm', w1: '2mm', w2: '2mm', totalLinearMeters: 3.4 },
    },
    // Unit 3: Kitchen Base Shutter (DIFFERENT LAMINATE: White Gloss Acrylic)
    {
      id: 'kb-shutter-1',
      partInstanceId: 'KB-SHT-1',
      name: 'Kitchen Pot Drawer Front',
      roomName: 'Modular Kitchen',
      moduleName: '600 2-Pot Tandem Base',
      classification: 'external_shutter',
      isExternal: true,
      lengthMm: 596,
      widthMm: 370,
      thicknessMm: 18,
      quantity: 1,
      materialCode: 'hdhmr_18',
      materialName: '18mm Action TESA HDHMR',
      grainDirection: 'horizontal',
      externalLaminateCode: 'royale-acrylic-gloss-white',
      edgeBanding: { l1: '2mm', l2: '2mm', w1: '2mm', w2: '2mm', totalLinearMeters: 1.9 },
    },
  ];

  const result = optimizeGuillotineNesting(parts, {
    sheetWidthMm: 2440,
    sheetHeightMm: 1220,
    trimMm: 10,
    kerfMm: 4,
    allowGrainRotationForSolid: false,
  });

  // Verify:
  // Sheet 1 must contain BOTH TV-SHT-1 (Living Room) and WD-SHT-1 (Master Bedroom) because they share 'merino-zerog-matte-sand' on 18mm HDHMR!
  const sandSheets = result.sheets.filter((s) => s.placedPanels.some((p) => p.partRef.externalLaminateCode === 'merino-zerog-matte-sand'));
  assert.equal(sandSheets.length, 1);
  const placedIds = sandSheets[0].placedPanels.map((p) => p.partRef.partInstanceId);
  assert.ok(placedIds.includes('TV-SHT-1'), 'TV Console Shutter must be on shared sheet');
  assert.ok(placedIds.includes('WD-SHT-1'), 'Wardrobe Shutter must be on shared sheet');

  // Sheet 2 must isolate KB-SHT-1 because it uses 'royale-acrylic-gloss-white'
  const acrylicSheets = result.sheets.filter((s) => s.placedPanels.some((p) => p.partRef.externalLaminateCode === 'royale-acrylic-gloss-white'));
  assert.equal(acrylicSheets.length, 1);
  assert.equal(acrylicSheets[0].placedPanels[0].partRef.partInstanceId, 'KB-SHT-1');
});

test('grain-marked parts do not rotate unless rotation is enabled on the part itself', () => {
  const base: NestingPart = {
    id: 'grain-test', partInstanceId: 'GRAIN-1', name: 'Tall veneer panel', classification: 'external_shutter', isExternal: true,
    lengthMm: 800, widthMm: 450, thicknessMm: 18, quantity: 1, materialCode: 'plywood', grainDirection: 'vertical',
    edgeBanding: { l1: 'none', l2: 'none', w1: 'none', w2: 'none', totalLinearMeters: 0 },
  };
  const locked = optimizeGuillotineNesting([base], { sheetWidthMm: 500, sheetHeightMm: 900, trimMm: 10, kerfMm: 4, allowGrainRotationForSolid: true });
  assert.equal(locked.sheets.flatMap((sheet) => sheet.placedPanels).length, 0);
  assert.equal(locked.summary.unplacedParts[0]?.quantity, 1);

  const allowed = optimizeGuillotineNesting([{ ...base, grainRotationAllowed: true }], { sheetWidthMm: 500, sheetHeightMm: 900, trimMm: 10, kerfMm: 4, allowGrainRotationForSolid: true });
  assert.equal(allowed.summary.unplacedParts.length, 0);
  assert.equal(allowed.sheets.flatMap((sheet) => sheet.placedPanels)[0]?.rotated, true);
});

test('nesting rejects malformed part dimensions instead of manufacturing a fallback size', () => {
  const invalid: NestingPart = {
    id: 'bad', partInstanceId: 'BAD-1', name: 'Bad panel', classification: 'internal_carcass_gable', isExternal: false,
    lengthMm: 0, widthMm: 450, thicknessMm: 18, quantity: 1, materialCode: 'plywood', grainDirection: 'none',
    edgeBanding: { l1: 'none', l2: 'none', w1: 'none', w2: 'none', totalLinearMeters: 0 },
  };
  assert.throws(() => optimizeGuillotineNesting([invalid]), /non-positive or invalid dimension/);
  assert.throws(() => optimizeGuillotineNesting([{ ...invalid, lengthMm: 100, partInstanceId: 'SAME' }, { ...invalid, lengthMm: 100, partInstanceId: 'SAME' }]), /missing or duplicated/);
});

test('edge-band quantities follow the recorded edge schedule instead of part family guesses', () => {
  const part: NestingPart = {
    id: 'edge-test', partInstanceId: 'EDGE-1', name: 'Shelf', classification: 'internal_shelf_adj', isExternal: false,
    lengthMm: 1000, widthMm: 500, thicknessMm: 18, quantity: 2, materialCode: 'plywood', grainDirection: 'none',
    edgeBanding: { l1: '2.0mm PVC', l2: 'none', w1: '0.8mm PVC', w2: 'special 1mm ABS', totalLinearMeters: 99 },
  };
  const result = optimizeGuillotineNesting([part]);
  assert.equal(result.summary.edgeBandingRequirement.pvc2mmMeters, 2);
  assert.equal(result.summary.edgeBandingRequirement.pvc08mmMeters, 1);
  assert.equal(result.summary.edgeBandingRequirement.otherMeters, 1);
  assert.equal(result.summary.edgeBandingRequirement.totalMeters, 4);
});
