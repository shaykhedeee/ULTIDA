import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyze2DDrawingsToCutlist,
  cabinetDimensionToMm,
  calculateHingesPerDoor,
  extractDrawingCutlistFromScene,
  generateDrawingCutlistSvg,
  DRAWING_CUTLIST_PRESETS,
} from '../src/drawing-cutlist-analyzer.js';
import type { SceneV1 } from '../src/scene-types.js';

test('calculateHingesPerDoor returns correct standard hinge counts', () => {
  assert.equal(calculateHingesPerDoor(800), 2);
  assert.equal(calculateHingesPerDoor(1500), 3);
  assert.equal(calculateHingesPerDoor(1950), 4);
  assert.equal(calculateHingesPerDoor(2400), 5);
});

test('analyze2DDrawingsToCutlist produces complete carcass anatomy and hardware job list from 2D drawing input', () => {
  const result = analyze2DDrawingsToCutlist({
    unitId: 'wardrobe-mbr-01',
    unitTitle: 'Master Bedroom 3-Bay Wardrobe',
    roomId: 'master-bedroom',
    wallId: 'wall-north',
    overallWidthMm: 2400,
    overallHeightMm: 2400,
    depthMm: 580,
    plinthHeightMm: 100,
    loftHeightMm: 0,
    dummyFillerLeftMm: 30,
    dummyFillerRightMm: 30,
    bays: [
      {
        id: 'bay-1',
        widthMm: 756,
        type: 'drawers',
        drawerCount: 3,
        shutterType: 'single-door',
      },
      {
        id: 'bay-2',
        widthMm: 756,
        type: 'wardrobe-hanging',
        shelvesCount: 1,
        adjustableShelvesCount: 2,
        hasHangingRod: true,
        shutterType: 'double-door',
      },
      {
        id: 'bay-3',
        widthMm: 756,
        type: 'wardrobe-shelves',
        shelvesCount: 1,
        adjustableShelvesCount: 3,
        shutterType: 'double-door',
      },
    ],
  });

  // Verify Summary
  assert.ok(result.summary.totalPanels > 15, 'Should have more than 15 total panels');
  assert.ok(result.summary.materialsCount >= 3, 'Should track carcass, laminate, and back panel materials');
  assert.ok(result.summary.totalEdgeBandMeters > 10, 'Should calculate edge banding meters');
  assert.ok(result.summary.estimatedSheetsTotal >= 3, 'Should estimate sheet counts');

  // Verify Carcass Anatomy
  const leftGable = result.panels.find((p) => p.semanticType === 'carcass_gable' && p.partName.includes('Left'));
  assert.ok(leftGable, 'Left gable should exist');
  assert.equal(leftGable.lengthMm, 2300, 'Gable height should be 2400 - 100 plinth = 2300mm');
  assert.equal(leftGable.widthMm, 580, 'Gable depth should match carcass depth');

  const bottomPanel = result.panels.find((p) => p.semanticType === 'carcass_top_bottom' && p.partName.includes('Bottom'));
  assert.ok(bottomPanel, 'Bottom base panel should exist');
  // 2400 overall - 60 fillers - 36 gables = 2304
  assert.equal(bottomPanel.lengthMm, 2304);

  const backPanel = result.panels.find((p) => p.semanticType === 'back_panel');
  assert.ok(backPanel, 'Back panel should exist');
  assert.equal(backPanel.thicknessMm, 6, 'Default back board is explicit 6mm captured plywood');

  // Verify Dummy Fillers
  const fillers = result.panels.filter((p) => p.semanticType === 'dummy_filler');
  assert.equal(fillers.length, 2, 'Should have left and right dummy fillers');

  // Verify Shutters
  const shutters = result.panels.filter((p) => p.semanticType === 'shutter');
  assert.ok(shutters.length >= 3, 'Should have external shutters for all bays');

  // Verify Drawers in Bay 1
  const fascias = result.panels.filter((p) => p.semanticType === 'drawer_fascia');
  assert.equal(fascias.length, 1, 'Should generate 1 drawer fascia entry');
  assert.equal(fascias[0].quantity, 3, 'Should have 3 drawer fascias');
  const drawerSides = result.panels.filter((p) => p.semanticType === 'drawer_side');

  assert.equal(drawerSides.length, 1, 'Should have 1 drawer side entry (qty 6)');
  assert.equal(drawerSides[0].quantity, 6);

  // Verify Hardware Job List
  const hinges = result.hardware.find((h) => h.category === 'hinge');
  assert.ok(hinges, 'Hinges should be calculated');
  assert.ok(hinges.quantity >= 10, 'Should have at least 10 hinges for large wardrobe shutters');

  const slides = result.hardware.find((h) => h.category === 'slide');
  assert.ok(slides, 'Drawer slides should be in hardware list');
  assert.equal(slides.quantity, 3, 'Should have 3 pairs of drawer runners');

  const shelfPins = result.hardware.find((h) => h.name.includes('Shelf Support Pins'));
  assert.ok(shelfPins, 'System 32 shelf pins should be present');
  assert.ok(shelfPins.quantity >= 20, 'Should have pins for 5 adjustable shelves * 4 = 20');

  const plinthLegs = result.hardware.find((h) => h.category === 'leg');
  assert.ok(plinthLegs, 'Plinth leveling legs should be included');
});

test('3ft x 7ft wardrobe inputs convert to mm and make separate core, internal/external laminate, and 6mm back schedules', () => {
  const widthMm = cabinetDimensionToMm(3, 'ft');
  const heightMm = cabinetDimensionToMm(7, 'ft');
  const depthMm = cabinetDimensionToMm(2, 'ft');
  const result = analyze2DDrawingsToCutlist({
    unitId: 'custom-3x7', unitTitle: 'Custom 3ft × 7ft wardrobe',
    overallWidthMm: widthMm, overallHeightMm: heightMm, depthMm,
    plinthHeightMm: 100, carcassThicknessMm: 18,
    backPanelThicknessMm: 6, backPanelMount: 'captured-groove',
    backPanelMaterial: 'PLY-BACK-06', carcassCoreMaterial: 'HDHMR-18',
    shutterCoreMaterial: 'HDHMR-18', externalFinishCodeA: 'LAM-EXT-OAK',
    internalFinishCode: 'LAM-INT-WHITE',
    bays: [{ id: 'bay-1', widthMm: Math.round(widthMm) - 2 * 18, type: 'wardrobe-shelves', shelvesCount: 1, adjustableShelvesCount: 3, hasHangingRod: true, shutterType: 'double-door' }],
  });
  assert.equal(result.overallWidthMm, 914);
  assert.equal(result.overallHeightMm, 2134);
  assert.equal(result.depthMm, 610);
  assert.equal(result.panels.find((panel) => panel.semanticType === 'back_panel')?.thicknessMm, 6);
  assert.equal(result.panels.find((panel) => panel.semanticType === 'carcass_gable')?.materialCode, 'HDHMR-18');
  assert.ok(result.laminateTakeoff.some((finish) => finish.finishCode === 'LAM-EXT-OAK'));
  assert.ok(result.laminateTakeoff.some((finish) => finish.finishCode === 'LAM-INT-WHITE'));
  assert.ok(result.panels.find((panel) => panel.semanticType === 'shutter')?.faceFinishes?.some((finish) => finish.finishCode === 'LAM-INT-WHITE'));
});

test('18mm structural back changes the carcass cut depth and back panel dimensions', () => {
  const result = analyze2DDrawingsToCutlist({
    overallWidthMm: 1200, overallHeightMm: 2100, depthMm: 600,
    backPanelThicknessMm: 18, backPanelMount: 'overlay-structural',
    bays: [{ widthMm: 1164, type: 'wardrobe-shelves', shelvesCount: 1, adjustableShelvesCount: 1 }],
  });
  const gable = result.panels.find((panel) => panel.semanticType === 'carcass_gable');
  const back = result.panels.find((panel) => panel.semanticType === 'back_panel');
  assert.equal(gable?.widthMm, 582, 'the carcass depth is reduced by the structural back thickness');
  assert.equal(back?.thicknessMm, 18);
  assert.equal(back?.widthMm, 1200, 'overlay back spans the cabinet outside width');
  assert.match(back?.notes ?? '', /members are shortened by 18mm/i);
});

test('invalid cabinet dimensions and inconsistent bay arithmetic block cutlist generation', () => {
  assert.throws(() => analyze2DDrawingsToCutlist({ overallWidthMm: 0, overallHeightMm: 2100, depthMm: 600, bays: [{ widthMm: 564 }] }), /positive measured dimension/i);
  assert.throws(() => analyze2DDrawingsToCutlist({ overallWidthMm: 1200, overallHeightMm: 2100, depthMm: 600, bays: [{ widthMm: 500 }] }), /Bay schedule is unresolved/i);
  assert.throws(() => analyze2DDrawingsToCutlist({ overallWidthMm: 1200, overallHeightMm: 2100, depthMm: 600, backPanelThicknessMm: 9, bays: [{ widthMm: 1164 }] }), /Choose a 6mm captured-groove back or an 18mm overlay structural back/i);
});

test('cabinet dimension conversion rejects missing or non-positive sizes', () => {
  assert.equal(cabinetDimensionToMm(3, 'ft'), 914.4000000000001);
  assert.throws(() => cabinetDimensionToMm(0, 'ft'), /positive finite/i);
  assert.throws(() => cabinetDimensionToMm(Number.NaN, 'mm'), /positive finite/i);
});

test('wardrobe standard schedule shares 1050mm hanging clearance and 200mm drawer pitch with cutlist and elevation', async () => {
  const input = {
    unitId: 'wardrobe-standard-3x7', overallWidthMm: 914, overallHeightMm: 2134, depthMm: 610,
    plinthHeightMm: 100, carcassThicknessMm: 18, backPanelThicknessMm: 6,
    bays: [{
      id: 'bay-1', widthMm: 878, type: 'drawers' as const, drawerCount: 3,
      drawerFrontHeightMm: 200, hasHangingRod: true, hangingClearHeightMm: 1050,
      shelvesInRemainderZone: 1, shelvesCount: 1, adjustableShelvesCount: 0, shutterType: 'double-door' as const,
    }],
  };
  const result = analyze2DDrawingsToCutlist(input);
  const schedule = result.wardrobeBaySchedules[0]!;
  assert.equal(schedule.drawerBankBottomMm, 118);
  assert.equal(schedule.drawerBankTopMm, 718);
  assert.equal(schedule.hangingClearHeightMm, 1050);
  assert.equal(schedule.hangingClearTopMm, 1768);
  assert.deepEqual(schedule.shelfBottomElevationsMm, [1768, 1942]);
  assert.equal(schedule.remainingShelfZoneHeightMm, 330);
  const drawerFaces = result.panels.find((panel) => panel.semanticType === 'drawer_fascia')!;
  assert.equal(drawerFaces.widthMm, 196, '200mm nominal pitch less 2mm top/bottom reveal');
  assert.deepEqual(drawerFaces.installElevationsFromFloorMm, [120, 320, 520]);
  const shelf = result.panels.find((panel) => panel.semanticType === 'shelf_fixed')!;
  assert.equal(shelf.quantity, 2);
  assert.deepEqual(shelf.installElevationsFromFloorMm, [1768, 1942]);
  const { generateDrawingCutlistSvg } = await import('../src/drawing-cutlist-analyzer.js');
  const svg = generateDrawingCutlistSvg(input, 'internal');
  assert.match(svg, /1050 mm CLEAR/);
  assert.match(svg, /200 PITCH/);
  assert.match(svg, /FINISH \/ CONSTRUCTION LEGEND/);
  assert.match(svg, /DIMENSIONED DRAFT/);
});

test('wardrobe vertical schedule blocks zones that exceed the measured cabinet height', () => {
  assert.throws(() => analyze2DDrawingsToCutlist({
    overallWidthMm: 914, overallHeightMm: 1700, depthMm: 610, plinthHeightMm: 100,
    bays: [{ widthMm: 878, type: 'drawers', drawerCount: 3, drawerFrontHeightMm: 200, hangingClearHeightMm: 1050, shelvesInRemainderZone: 1 }],
  }), /does not have enough clear height/i);
});

test('extractDrawingCutlistFromScene derives valid input from a SceneV1', () => {
  const mockScene: SceneV1 = {
    schema: 'scene.v1',
    units: 'mm',
    projectId: 'proj-01',
    floorPlanVersionId: 'plan-01',
    walls: [
      { id: 'wall-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 3000, yMm: 0 }, heightMm: 2700 },
    ],
    modules: [
      { id: 'mod-1', family: 'wardrobe-4-door', widthMm: 2400, depthMm: 580, heightMm: 2400, position: { xMm: 0, yMm: 0 }, roomId: 'master-bed' },
    ],
    metadata: { status: 'approved', designVersion: '01' },
  };

  const input = extractDrawingCutlistFromScene(mockScene, 'wall-1');
  assert.equal(input.overallWidthMm, 2400);
  assert.equal(input.overallHeightMm, 2400);
  assert.equal(input.depthMm, 580);
  assert.ok(input.bays.length >= 3, 'Should automatically divide into bays');

  const result = analyze2DDrawingsToCutlist(input);
  assert.ok(result.panels.length > 10, 'Derived scene cutlist should contain panels');
  assert.ok(result.hardware.length > 3, 'Derived scene cutlist should contain hardware');
});

test('generateDrawingCutlistSvg renders valid architectural SVG for both external elevation and carcass section', () => {
  const preset = DRAWING_CUTLIST_PRESETS.wardrobe_4door;

  // View mode: both
  const svgBoth = generateDrawingCutlistSvg(preset, 'both');
  assert.ok(svgBoth.includes('<svg'), 'SVG should have opening tag');
  assert.ok(svgBoth.includes('EXTERNAL ELEVATION'), 'Should have External Elevation title');
  assert.ok(svgBoth.includes('INTERNAL CARCASS SECTION'), 'Should have Internal Carcass Section title');
  assert.ok(svgBoth.includes('SYSTEM 32'), 'Should include System 32 annotations');
  assert.ok(svgBoth.includes('PLINTH 100mm'), 'Should include plinth annotation');
  assert.ok(svgBoth.includes('FILLER 30mm'), 'Should include dummy filler annotation');
  assert.ok(svgBoth.includes('circle'), 'Should include System 32 boring dots');

  // View mode: external only
  const svgExt = generateDrawingCutlistSvg(preset, 'external');
  assert.ok(svgExt.includes('EXTERNAL ELEVATION'));
  assert.ok(!svgExt.includes('INTERNAL CARCASS SECTION'));

  // View mode: internal only
  const svgInt = generateDrawingCutlistSvg(preset, 'internal');
  assert.ok(svgInt.includes('INTERNAL CARCASS SECTION'));
  assert.ok(!svgInt.includes('EXTERNAL ELEVATION'));
});

test('all DRAWING_CUTLIST_PRESETS analyze cleanly into verified panels and hardware', () => {
  const presetKeys = ['wardrobe_4door', 'kitchen_base', 'tv_console', 'crockery_unit'] as const;

  for (const key of presetKeys) {
    const preset = DRAWING_CUTLIST_PRESETS[key];
    assert.ok(preset, `Preset ${key} should exist`);
    const analysis = analyze2DDrawingsToCutlist(preset);
    assert.ok(analysis.panels.length > 5, `Preset ${key} should generate panels`);
    assert.ok(analysis.hardware.length > 2, `Preset ${key} should generate hardware items`);
    assert.ok(analysis.summary.estimatedSheetsTotal >= 1, `Preset ${key} should calculate sheet count`);
    assert.ok(analysis.sheetEstimates.length >= 1, `Preset ${key} should have sheet estimates`);
  }
});

