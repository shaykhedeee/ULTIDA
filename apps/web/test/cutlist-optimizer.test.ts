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
