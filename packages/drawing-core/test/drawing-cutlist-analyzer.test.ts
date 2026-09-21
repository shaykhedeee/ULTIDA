import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyze2DDrawingsToCutlist,
  calculateHingesPerDoor,
  extractDrawingCutlistFromScene,
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
        widthMm: 780,
        type: 'drawers',
        drawerCount: 3,
        shutterType: 'single-door',
      },
      {
        id: 'bay-2',
        widthMm: 780,
        type: 'wardrobe-hanging',
        shelvesCount: 1,
        adjustableShelvesCount: 2,
        hasHangingRod: true,
        shutterType: 'double-door',
      },
      {
        id: 'bay-3',
        widthMm: 780,
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
  assert.equal(backPanel.thicknessMm, 9, 'Back panel should be 9mm thick');

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
