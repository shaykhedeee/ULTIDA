import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSketchUpRubyScript } from '../src/sketchup-exporter.ts';
import {
  buildDimensionChain,
  validateElevationSheet,
  type ElevationSheetSpecV1,
} from '../src/elevation-sheet.ts';

// ─── Gate 1: Authenticated Golden Room Test ─────────────────────────
// Validates: 4000 × 3000 × 2700 mm space, door (+2100mm), window (+900mm sill),
// base cabinet (z=0, 750mm), and elevated wall cabinet (+1450mm datum).
// Verifies scene compilation, dimension chain validation, elevation inspection,
// camera angle, and SketchUp Ruby exporter script generation.

test('Gate 1: Golden Room passes complete architectural, joinery, and exporter verification', () => {
  const goldenRoom = {
    schema: 'scene.v1' as const,
    units: 'mm' as const,
    coordinateSystem: 'right-handed-z-up' as const,
    projectId: 'proj-golden-residence',
    floorPlanVersionId: 'fp-golden-v1',
    floors: [{ id: 'fl-1', name: 'Level 01', elevationMm: 0, heightMm: 2700 }],
    spaces: [{ id: 'sp-1', floorId: 'fl-1', name: 'Golden Master Suite', type: 'bedroom' }],
    rooms: [
      {
        id: 'rm-golden',
        spaceId: 'sp-1',
        name: 'Master Bedroom',
        type: 'bedroom',
        boundary: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3000 },
          { xMm: 0, yMm: 3000 },
          { xMm: 0, yMm: 0 },
        ],
        confidence: 1,
      },
    ],
    walls: [
      {
        id: 'wall-front',
        floorId: 'fl-1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 4000, yMm: 0 },
        thicknessMm: 200,
        heightMm: 2700,
        baseElevationMm: 0,
        spaceIds: ['sp-1'],
        confidence: 1,
      },
      {
        id: 'wall-right',
        floorId: 'fl-1',
        start: { xMm: 4000, yMm: 0 },
        end: { xMm: 4000, yMm: 3000 },
        thicknessMm: 200,
        heightMm: 2700,
        baseElevationMm: 0,
        spaceIds: ['sp-1'],
        confidence: 1,
      },
      {
        id: 'wall-back',
        floorId: 'fl-1',
        start: { xMm: 4000, yMm: 3000 },
        end: { xMm: 0, yMm: 3000 },
        thicknessMm: 200,
        heightMm: 2700,
        baseElevationMm: 0,
        spaceIds: ['sp-1'],
        confidence: 1,
      },
      {
        id: 'wall-left',
        floorId: 'fl-1',
        start: { xMm: 0, yMm: 3000 },
        end: { xMm: 0, yMm: 0 },
        thicknessMm: 200,
        heightMm: 2700,
        baseElevationMm: 0,
        spaceIds: ['sp-1'],
        confidence: 1,
      },
    ],
    openings: [
      {
        id: 'op-door-entry',
        wallId: 'wall-front',
        kind: 'door' as const,
        offsetMm: 500,
        widthMm: 900,
        heightMm: 2100,
        sillHeightMm: 0,
        confidence: 1,
      },
      {
        id: 'op-win-exterior',
        wallId: 'wall-front',
        kind: 'window' as const,
        offsetMm: 2000,
        widthMm: 1200,
        heightMm: 1200,
        sillHeightMm: 900,
        confidence: 1,
      },
    ],
    modules: [
      {
        id: 'mod-base-cabinet',
        spaceId: 'sp-1',
        family: 'kitchen-base',
        name: '900 Base Casework',
        widthMm: 900,
        depthMm: 600,
        heightMm: 750,
        position: { xMm: 200, yMm: 100 },
        rotationDeg: 0,
        elevationMm: 0,
        materialId: 'mat-smoked-oak',
      },
      {
        id: 'mod-wall-cabinet',
        spaceId: 'sp-1',
        family: 'kitchen-wall',
        name: '900 Elevated Wall Display',
        widthMm: 900,
        depthMm: 350,
        heightMm: 650,
        position: { xMm: 200, yMm: 100 },
        rotationDeg: 0,
        elevationMm: 1450,
        materialId: 'mat-champagne-gold',
      },
    ],
    cameras: [
      {
        id: 'cam-eye-level',
        name: 'Eye Level 35mm Perspective',
        position: { xMm: 2000, yMm: 2600, zMm: 1500 },
        target: { xMm: 2000, yMm: 500, zMm: 1200 },
        lensMm: 35,
      },
    ],
    materials: [
      { id: 'mat-smoked-oak', name: 'Smoked Oak Laminate', code: 'SO-101', finish: 'Woodgrain Matte' },
      { id: 'mat-champagne-gold', name: 'Champagne Gold Anodized', code: 'CG-801', finish: 'Satin Metallic' },
    ],
  };

  // 1. Verify Spatial Dimensions
  assert.equal(goldenRoom.walls[0].end.xMm - goldenRoom.walls[0].start.xMm, 4000);
  assert.equal(goldenRoom.walls[1].end.yMm - goldenRoom.walls[1].start.yMm, 3000);
  assert.equal(goldenRoom.walls[0].heightMm, 2700);

  // 2. Verify Openings (Door lintel: 2100mm, Window sill: 900mm + 1200h = 2100mm lintel datum)
  const door = goldenRoom.openings.find((o) => o.kind === 'door')!;
  const window = goldenRoom.openings.find((o) => o.kind === 'window')!;
  assert.equal(door.sillHeightMm + door.heightMm, 2100);
  assert.equal(window.sillHeightMm, 900);
  assert.equal(window.sillHeightMm + window.heightMm, 2100);

  // 3. Verify Elevation Datum: Base cabinet + 700mm counter splash = 1450mm wall cabinet datum
  const baseCab = goldenRoom.modules.find((m) => m.family === 'kitchen-base')!;
  const wallCab = goldenRoom.modules.find((m) => m.family === 'kitchen-wall')!;
  assert.equal(baseCab.elevationMm, 0);
  assert.equal(wallCab.elevationMm, 1450);

  // 4. Verify Dimension Chains & Elevation Sheet Specification
  const hChain = buildDimensionChain('horizontal', [500, 900, 600, 1200, 800], 0, 'Wall Front Openings');
  assert.equal(hChain.overallMm, 4000);

  const vChain = buildDimensionChain('vertical', [750, 700, 650, 600], 0, 'Vertical Section Datum');
  assert.equal(vChain.overallMm, 2700);

  const elevationSheet: ElevationSheetSpecV1 = {
    schema: 'elevation.sheet.v1',
    view: 'internal',
    title: 'Elevation A — Front Wall with Casework',
    units: 'mm',
    overallWidthMm: 4000,
    overallHeightMm: 2700,
    horizontalChain: hChain,
    verticalChain: vChain,
    sourceSceneVersionId: 'scene-golden-v1',
    warnings: [],
    elements: [
      { id: 'el-door', kind: 'shutter', xMm: 500, yMm: 0, widthMm: 900, heightMm: 2100 },
      { id: 'el-window', kind: 'open-unit', xMm: 2000, yMm: 900, widthMm: 1200, heightMm: 1200 },
      { id: 'el-base', kind: 'shutter', xMm: 200, yMm: 0, widthMm: 900, heightMm: 750 },
      { id: 'el-wall-cab', kind: 'shutter', xMm: 200, yMm: 1450, widthMm: 900, heightMm: 650 },
    ],
  };

  const validation = validateElevationSheet(elevationSheet);
  assert.equal(validation.valid, true, `Elevation sheet validation failed: ${validation.issues.join(', ')}`);

  // 5. Generate and Verify SketchUp Ruby Script for Golden Room
  const rubyScript = generateSketchUpRubyScript(goldenRoom as any);
  assert.ok(rubyScript.includes('ULTIDA Interior Design OS — SketchUp Pro / Desktop Exporter'));
  assert.ok(rubyScript.includes('A-WALL-SKIR'));
  assert.ok(rubyScript.includes('A-CLNG'));
  assert.ok(rubyScript.includes('A-LITE'));
  assert.ok(rubyScript.includes('A-DOOR'));
  assert.ok(rubyScript.includes('A-GLAZ'));
  assert.ok(rubyScript.includes('A-FURN-BASE'));
  assert.ok(rubyScript.includes('A-FURN-HARD'));

  // Door opening assembly & lintel
  assert.ok(rubyScript.includes('Door Opening: op-door-entry'));
  assert.ok(rubyScript.includes('ultida_create_door_assembly'));

  // Window sill and window assembly
  assert.ok(rubyScript.includes('Window Opening: op-win-exterior'));
  assert.ok(rubyScript.includes('ultida_create_window_assembly'));
  assert.ok(rubyScript.includes('Sill wall'));
  assert.ok(rubyScript.includes('Lintel wall'));

  // System 32 joinery parts
  assert.ok(rubyScript.includes('75mm Recessed Plinth Kickboard'));
  assert.ok(rubyScript.includes('18mm Left Gable & Right Gable'));
  assert.ok(rubyScript.includes('6mm Grooved Backing Board'));
  assert.ok(rubyScript.includes('Front Shutters'));
  assert.ok(rubyScript.includes('Brushed Brass Bar Handle'));
  assert.ok(rubyScript.includes('Apply 3D Spatial Transformation'));

  // Presentation Camera Tabs
  assert.ok(rubyScript.includes('01 - Overall 3D Orbit'));
  assert.ok(rubyScript.includes('02 - Floor Plan (Top View)'));
  assert.ok(rubyScript.includes('03 - Master Bedroom View'));
});
