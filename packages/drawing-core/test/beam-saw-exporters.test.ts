import test from 'node:test';
import assert from 'node:assert/strict';
import { packLaminateRecipeSheets, type LaminateRecipePanelInput } from '../src/laminate-aware-nesting.js';
import {
  exportHomagCutRitePtx,
  exportBiesseOptiPlanningXml,
  nestLinearProfiles,
  type LinearProfilePieceInput,
} from '../src/beam-saw-exporters.js';

test('exportHomagCutRitePtx formats compliant ASCII file for Homag / Holzma beam saws', () => {
  const panels: LaminateRecipePanelInput[] = [
    {
      partId: 'P1',
      moduleId: 'M1',
      moduleTitle: 'Base 2-Drawer 600',
      partLabel: 'Carcass Left Side',
      coreSubstrate: 'HDHMR',
      thicknessMm: 18,
      frontLaminateSku: 'MER-SF-101',
      backLinerSku: 'LINER-0.8',
      finishedLengthMm: 720,
      finishedWidthMm: 560,
      edgeTopMm: 0.8,
      edgeBottomMm: 0.8,
      edgeLeftMm: 2.0,
      edgeRightMm: 0,
      grainDirection: 'vertical',
      quantity: 2,
    },
    {
      partId: 'P2',
      moduleId: 'M1',
      moduleTitle: 'Base 2-Drawer 600',
      partLabel: 'Bottom Deck',
      coreSubstrate: 'HDHMR',
      thicknessMm: 18,
      frontLaminateSku: 'MER-SF-101',
      backLinerSku: 'LINER-0.8',
      finishedLengthMm: 564,
      finishedWidthMm: 560,
      edgeTopMm: 2.0,
      edgeBottomMm: 0,
      edgeLeftMm: 0,
      edgeRightMm: 0,
      grainDirection: 'none',
      quantity: 1,
    },
  ];

  const nesting = packLaminateRecipeSheets(panels);
  const ptx = exportHomagCutRitePtx(nesting, { jobName: 'JOB_PENTHOUSE_102' });

  assert.ok(ptx.includes('[HEADER]'));
  assert.ok(ptx.includes('JOB=JOB_PENTHOUSE_102'));
  assert.ok(ptx.includes('[BOARDS]'));
  assert.ok(ptx.includes('BOARD_DEF;CODE='));
  assert.ok(ptx.includes('MAT=HDHMR'));
  assert.ok(ptx.includes('[PARTS]'));
  assert.ok(ptx.includes('PART_DEF;ID=P1-1'));
  assert.ok(ptx.includes('[PATTERNS]'));
  assert.ok(ptx.includes('PATTERN_START;SHEET_ID=SHT-01'));
  assert.ok(ptx.includes('CUT;PART_ID='));
});

test('exportBiesseOptiPlanningXml outputs valid XML schema for Biesse Selco beam saws', () => {
  const panels: LaminateRecipePanelInput[] = [
    {
      partId: 'P1',
      moduleId: 'M1',
      moduleTitle: 'Wall Unit 900',
      partLabel: 'Wall Top Deck',
      coreSubstrate: 'PLY_BWP',
      thicknessMm: 18,
      frontLaminateSku: 'MER-SF-202',
      backLinerSku: 'LINER-0.8',
      finishedLengthMm: 864,
      finishedWidthMm: 330,
      edgeTopMm: 2,
      edgeBottomMm: 0,
      edgeLeftMm: 0,
      edgeRightMm: 0,
      grainDirection: 'none',
      quantity: 1,
    },
  ];

  const nesting = packLaminateRecipeSheets(panels);
  const xml = exportBiesseOptiPlanningXml(nesting, { jobName: 'BIESSE_TEST_01' });

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<OptiPlanning version="4.2" job="BIESSE_TEST_01"'));
  assert.ok(xml.includes('<StockSheets>'));
  assert.ok(xml.includes('<Stock id="PLY_BWP__18mm__FACE:MER-SF-202__BACK:LINER-0.8"'));
  assert.ok(xml.includes('<CuttingLayouts>'));
  assert.ok(xml.includes('<Layout id="SHT-01"'));
  assert.ok(xml.includes('</OptiPlanning>'));
});

test('nestLinearProfiles optimizes 3000mm aluminium Gola and sliding profiles with kerf', () => {
  const pieces: LinearProfilePieceInput[] = [
    { pieceId: 'G1', profileType: 'gola_j', requiredLengthMm: 1200, label: 'Kitchen Base Run A' },
    { pieceId: 'G2', profileType: 'gola_j', requiredLengthMm: 1500, label: 'Kitchen Base Run B' },
    { pieceId: 'G3', profileType: 'gola_j', requiredLengthMm: 800, label: 'Kitchen Island' },
    { pieceId: 'G4', profileType: 'gola_c', requiredLengthMm: 1200, label: 'Kitchen Mid-Drawer' },
    { pieceId: 'G5', profileType: 'gola_c', requiredLengthMm: 1500, label: 'Kitchen Mid-Drawer B' },
  ];

  const results = nestLinearProfiles(pieces, { standardBarLengthMm: 3000, sawKerfMm: 4 });

  assert.strictEqual(results.length, 2, 'Should group into gola_j and gola_c');
  const golaJ = results.find((r) => r.profileType === 'gola_j');
  assert.ok(golaJ);
  // Total pieces = 3: 1500 + 1200 + 800.
  // Bar 1 can take 1500 + 4 + 1200 = 2704mm (<=3000). Remaining 800 goes to Bar 2.
  assert.strictEqual(golaJ.totalBarsRequired, 2);
  assert.strictEqual(golaJ.totalPiecesPlaced, 3);
  assert.ok(golaJ.averageUtilizationPercent > 50);

  const golaC = results.find((r) => r.profileType === 'gola_c');
  assert.ok(golaC);
  // Total pieces = 2: 1500 + 4 + 1200 = 2704mm <= 3000mm => fits in 1 bar!
  assert.strictEqual(golaC.totalBarsRequired, 1);
  assert.strictEqual(golaC.totalPiecesPlaced, 2);
  assert.strictEqual(golaC.bars[0].wasteLengthMm, 3000 - 2704);
});
