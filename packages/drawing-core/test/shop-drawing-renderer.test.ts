import test from 'node:test';
import assert from 'node:assert/strict';
import { generateArchitecturalShopSheetSvg, generateWallElevationSvg } from '../src/index.js';
import type { SceneV1 } from '../src/scene-types.js';

const sampleKitchenScene: SceneV1 = {
  schema: 'scene.v1',
  units: 'mm',
  projectId: 'sachin-residence-01',
  floorPlanVersionId: 'plan-01',
  coordinateSystem: 'right-handed-z-up',
  walls: [
    { id: 'wall-a', start: { xMm: 0, yMm: 0 }, end: { xMm: 2552, yMm: 0 }, thicknessMm: 150, heightMm: 2718 },
  ],
  openings: [
    { id: 'window-a', wallId: 'wall-a', kind: 'window', offsetMm: 1600, widthMm: 750, heightMm: 900, sillHeightMm: 1100 },
  ],
  modules: [
    { id: 'kit-base-1', family: 'kitchen-base', widthMm: 2552, depthMm: 560, heightMm: 850, position: { xMm: 0, yMm: 0 } },
    { id: 'kit-wall-1', family: 'kitchen-wall', widthMm: 2552, depthMm: 300, heightMm: 670, position: { xMm: 0, yMm: 0, zMm: 1450 } },
    { id: 'kit-loft-1', family: 'loft', widthMm: 2552, depthMm: 450, heightMm: 558, position: { xMm: 0, yMm: 0, zMm: 2120 } }
  ],
  metadata: { status: 'approved', designVersion: '02' },
};

const sampleWardrobeScene: SceneV1 = {
  schema: 'scene.v1',
  units: 'mm',
  projectId: 'sachin-residence-01',
  floorPlanVersionId: 'plan-01',
  coordinateSystem: 'right-handed-z-up',
  walls: [
    { id: 'wall-mbr', start: { xMm: 0, yMm: 0 }, end: { xMm: 3090, yMm: 0 }, thicknessMm: 150, heightMm: 2725 },
  ],
  modules: [
    { id: 'wardrobe-mbr', family: 'wardrobe', widthMm: 3090, depthMm: 580, heightMm: 2675, position: { xMm: 0, yMm: 0 } },
  ],
  metadata: { status: 'approved', designVersion: '02' },
};

test('generateArchitecturalShopSheetSvg renders full external elevation with carcass and laminate legends', () => {
  const svg = generateArchitecturalShopSheetSvg(sampleKitchenScene, 'wall-a', {
    viewMode: 'external',
    unitTitle: 'KITCHEN WALL-A EXTERNAL:',
    clientName: 'MR.SACHIN & MRS.SAMMITHA',
    projectName: 'B-307, SAMSUDHI',
    laminateA: 'VIRGO MICA-6344 SF',
    laminateB: 'VIRGO MICA-1409 SHG',
    carcassCoreMaterial: 'PLYWOOD - BWP-710 GRADE',
    measurementStatus: 'measured',
    provenance: 'Approved site measurement survey S-11',
  });

  // Basic SVG assertions
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(svg.includes('<svg width="1200" height="750"'));

  // Header Banner
  assert.ok(svg.includes('KITCHEN WALL-A EXTERNAL:'));
  assert.ok(svg.includes('MEASURED GEOMETRY'));
  assert.ok(svg.includes('Approved site measurement survey S-11'));
  assert.ok(svg.includes('UNITS: MM'));

  // Top View Plan
  assert.ok(svg.includes('TOP VIEW'));
  assert.ok(svg.includes('pattern id="diagonalHatch"'));

  // Casework External Elements
  assert.ok(svg.includes('GRANITE 40mm'));
  assert.ok(svg.includes('GOLA PROFILE'));
  assert.ok(svg.includes('CUTLERY INLET'));
  assert.ok(svg.includes('CUP AND SAUCER INLET'));
  assert.ok(svg.includes('THALLI INLET'));
  assert.ok(svg.includes('PROFILE SHUTTER WITH BLACK FLUTED GLASS'));
  assert.ok(svg.includes('SKIRTING 100mm'));
  assert.ok(svg.includes('FALSE CEILING FILLER 50mm'));

  // Persisted wall openings remain visible and are scheduled from scene data.
  assert.ok(svg.includes('data-opening-id="window-a"'));
  assert.ok(svg.includes('WINDOW 750W × 900H · SILL 1100'));
  assert.ok(svg.includes('OPENING SCHEDULE'));

  // Carcass & Laminate Legend Box
  assert.ok(svg.includes('LEGEND'));
  assert.ok(svg.includes('CARCASS'));
  assert.ok(svg.includes('560+20MM'));
  assert.ok(svg.includes('300+20MM'));
  assert.ok(svg.includes('450+20MM'));
  assert.ok(svg.includes('PLYWOOD - BWP-710 GRADE'));
  assert.ok(svg.includes('LAMINATE'));
  assert.ok(svg.includes('VIRGO MICA-6344 SF'));
  assert.ok(svg.includes('VIRGO MICA-1409 SHG'));

  // Title Block
  assert.ok(svg.includes('MR.SACHIN &amp; MRS.SAMMITHA') || svg.includes('MR.SACHIN'));
  assert.ok(svg.includes('B-307, SAMSUDHI'));
  assert.ok(svg.includes('APPROVED FOR PRODUCTION'));
  assert.ok(svg.includes('WALL wall-a'));
  assert.ok(svg.includes('UNITS: MM · DO NOT SCALE'));
  assert.ok(svg.includes('PROVENANCE: Approved site measurement survey S-11'));
});

test('generateArchitecturalShopSheetSvg marks unverified geometry as non-construction data', () => {
  const svg = generateArchitecturalShopSheetSvg(sampleKitchenScene, 'wall-a');

  assert.ok(svg.includes('NOT FOR CONSTRUCTION — REVIEW REQUIRED'));
  assert.ok(svg.includes('UNVERIFIED GEOMETRY · DO NOT SCALE DRAWING'));
  assert.ok(svg.includes('CLIENT NOT ASSIGNED'));
  assert.ok(svg.includes('FINISH TO BE CONFIRMED'));
});

test('generateArchitecturalShopSheetSvg renders internal joinery section with System 32 and shelf notations', () => {
  const svg = generateArchitecturalShopSheetSvg(sampleWardrobeScene, 'wall-mbr', {
    viewMode: 'internal',
    unitTitle: 'MBR WARDROBE INTERNAL:',
    clientName: 'MR.SACHIN & MRS.SAMMITHA',
    projectName: 'B-307, SAMSUDHI',
    carcassCoreMaterial: 'PLYWOOD - MR-303 GRADE',
  });

  // Internal Joinery notations
  assert.ok(svg.includes('MBR WARDROBE INTERNAL:'));
  assert.ok(svg.includes('HANGER SPACE 1050mm'));
  assert.ok(svg.includes('LOCKABLE CASH DRAWER'));
  assert.ok(svg.includes('SAREE ORGANIZER DRAWER'));
  assert.ok(svg.includes('FS: FIXED SHELF'));
  assert.ok(svg.includes('AS: ADJUSTABLE SHELF'));
  assert.ok(svg.includes('EQ: EQUAL DISTANCE'));
  assert.ok(svg.includes('PLYWOOD - MR-303 GRADE'));
});

test('generateWallElevationSvg delegates cleanly to shop-sheet renderer when requested', () => {
  const svg = generateWallElevationSvg(sampleKitchenScene, 'wall-a', {
    viewMode: 'shop-sheet',
    unitTitle: 'KITCHEN WORKSHOP DRAWING',
  });
  assert.ok(svg.includes('TOP VIEW'));
  assert.ok(svg.includes('CARCASS'));
  assert.ok(svg.includes('LAMINATE'));
});

/**
 * A shop drawing is a manufacturing instruction. The renderer used to fall
 * back to three invented kitchen modules whenever a scene had no casework on
 * the target wall, producing a fully dimensioned sheet for cabinets nobody had
 * specified. A workshop could cut from that sheet. These tests keep the
 * renderer honest about the difference between "nothing specified" and
 * "here is what to build".
 */
const emptyWallScene: SceneV1 = {
  schema: 'scene.v1',
  units: 'mm',
  projectId: 'empty-wall-01',
  floorPlanVersionId: 'plan-01',
  coordinateSystem: 'right-handed-z-up',
  walls: [
    { id: 'wall-empty', start: { xMm: 0, yMm: 0 }, end: { xMm: 3400, yMm: 0 }, thicknessMm: 150, heightMm: 2700 },
  ],
  modules: [],
  metadata: { status: 'approved', designVersion: '01' },
};

test('a wall with no approved casework yields an explicit empty sheet, not invented cabinets', () => {
  const svg = generateArchitecturalShopSheetSvg(emptyWallScene, 'wall-empty', { measurementStatus: 'measured' });
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'it must still be a valid sheet');
  assert.match(svg, /NO MODULES PLACED/, 'the sheet must say plainly that nothing is specified');
  assert.match(svg, /NOT FOR CONSTRUCTION/, 'an empty sheet can never be construction-ready');
});

test('an empty sheet never fabricates module geometry', () => {
  const svg = generateArchitecturalShopSheetSvg(emptyWallScene, 'wall-empty', { measurementStatus: 'measured' });
  // The old fallback invented a 850mm base, a 670mm wall unit and a 558mm loft.
  assert.doesNotMatch(svg, /kitchen-base/i, 'no casework family may be invented');
  assert.doesNotMatch(svg, /\b670\b/, 'no invented wall-unit height may appear');
  assert.doesNotMatch(svg, /\b558\b/, 'no invented loft height may appear');
});

test('an empty sheet still reports the measured shell that is on record', () => {
  const svg = generateArchitecturalShopSheetSvg(emptyWallScene, 'wall-empty', { measurementStatus: 'measured' });
  assert.match(svg, /3400 mm long/, 'the real measured wall length must be stated');
  assert.match(svg, /2700 mm high/, 'the real measured wall height must be stated');
  assert.match(svg, /wall-empty/, 'the sheet must identify which wall it describes');
});

test('a wall that does carry casework is unaffected by the empty-sheet path', () => {
  const svg = generateArchitecturalShopSheetSvg(sampleKitchenScene, 'wall-a', { measurementStatus: 'measured' });
  assert.doesNotMatch(svg, /NO MODULES PLACED/);
  assert.ok(svg.includes('<svg width="1200" height="750"'));
});
