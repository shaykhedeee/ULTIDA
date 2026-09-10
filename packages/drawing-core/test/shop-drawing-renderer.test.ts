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
