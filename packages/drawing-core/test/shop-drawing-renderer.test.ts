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

test('external mode never fabricates cabinet details when scene parts are missing', () => {
  const svg = generateArchitecturalShopSheetSvg(sampleKitchenScene, 'wall-a', {
    viewMode: 'external',
    measurementStatus: 'measured',
  });
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(svg, /COMPILED COMPONENT GEOMETRY REQUIRED/);
  assert.match(svg, /NOT FOR CONSTRUCTION/);
  assert.doesNotMatch(svg, /GRANITE 40mm|GOLA PROFILE|SKIRTING 100mm|FALSE CEILING FILLER 50mm/);
});

test('legacy presentation elevations mark unverified geometry as non-construction data', () => {
  const svg = generateArchitecturalShopSheetSvg(sampleKitchenScene, 'wall-a', { viewMode: 'external' });

  assert.match(svg, /NOT FOR CONSTRUCTION/);
  assert.match(svg, /COMPILED COMPONENT GEOMETRY REQUIRED/);
});

test('internal mode refuses assumed wardrobe zones when compiled parts are missing', () => {
  const svg = generateArchitecturalShopSheetSvg(sampleWardrobeScene, 'wall-mbr', {
    viewMode: 'internal',
    unitTitle: 'MBR WARDROBE INTERNAL:',
    clientName: 'MR.SACHIN & MRS.SAMMITHA',
    projectName: 'B-307, SAMSUDHI',
    carcassCoreMaterial: 'PLYWOOD - MR-303 GRADE',
  });

  assert.match(svg, /COMPILED COMPONENT GEOMETRY REQUIRED/);
  assert.doesNotMatch(svg, /HANGER SPACE 1050|LOCKABLE CASH DRAWER|SAREE ORGANIZER DRAWER/);
});

test('shop-sheet mode uses the scene-derived cutlist elevation and refuses missing parts', () => {
  const svg = generateWallElevationSvg(sampleKitchenScene, 'wall-a', {
    viewMode: 'shop-sheet',
    unitTitle: 'KITCHEN WORKSHOP DRAWING',
  });
  assert.match(svg, /COMPILED COMPONENT GEOMETRY REQUIRED/);
  assert.match(svg, /NOT FOR CONSTRUCTION/);
});

test('fabrication elevation uses exact scene part IDs and cutlist dimensions', () => {
  const scene: SceneV1 = {
    ...sampleKitchenScene,
    modules: [{ id: 'kit-base-1', family: 'kitchen-base', roomId: 'kitchen-1', widthMm: 1200, depthMm: 560, heightMm: 850, position: { xMm: 0, yMm: 0, zMm: 0 }, rotationDeg: 0 }],
    walls: [{ ...sampleKitchenScene.walls[0]!, spaceIds: ['kitchen-1'] }],
    moduleParts: [
      { id: 'kit-base-1-left-side', moduleId: 'kit-base-1', roomId: 'kitchen-1', semanticType: 'carcass', name: 'Left side panel', widthMm: 18, depthMm: 560, heightMm: 814, position: { xMm: 0, yMm: 0, zMm: 18 }, rotationDeg: 0, materialId: 'mat-carcass' },
      { id: 'kit-base-1-shutter-1', moduleId: 'kit-base-1', roomId: 'kitchen-1', semanticType: 'shutter', name: 'Door front', widthMm: 564, depthMm: 18, heightMm: 700, position: { xMm: 18, yMm: 0, zMm: 100 }, rotationDeg: 0, materialId: 'mat-shutter' },
    ],
    materials: [{ id: 'mat-carcass', name: 'Warm oak', code: 'OAK-18' }, { id: 'mat-shutter', name: 'Ivory matte', code: 'IV-09' }],
  };
  const svg = generateArchitecturalShopSheetSvg(scene, 'wall-a', {
    viewMode: 'fabrication', measurementStatus: 'measured',
    productionParts: [
      { id: 'kit-base-1-left-side', sourcePartId: 'kit-base-1-left-side', moduleId: 'kit-base-1', partName: 'Left side panel', semanticType: 'carcass', lengthMm: 814, widthMm: 560, thicknessMm: 18, materialCode: 'OAK-18', quantity: 1, status: 'review_required' },
      { id: 'kit-base-1-shutter-1', sourcePartId: 'kit-base-1-shutter-1', moduleId: 'kit-base-1', partName: 'Door front', semanticType: 'shutter', lengthMm: 700, widthMm: 564, thicknessMm: 18, materialCode: 'IV-09', quantity: 1, status: 'review_required' },
    ],
  });
  assert.match(svg, /data-part-id="kit-base-1-left-side"/);
  assert.match(svg, /data-part-id="kit-base-1-shutter-1"/);
  assert.match(svg, /814×560×18 · QTY 1/);
  assert.match(svg, /700×564×18 · QTY 1/);
  assert.match(svg, /OAK-18 · GRAIN/);
  assert.match(svg, /IV-09 · GRAIN/);
  assert.match(svg, /data-opening-id="window-a"/);
  assert.match(svg, /NOT FOR CONSTRUCTION/);
  assert.doesNotMatch(svg, /HANGER SPACE 1050|SKIRTING 100mm|FALSE CEILING FILLER 50mm/);
  const external = generateArchitecturalShopSheetSvg(scene, 'wall-a', { viewMode: 'external' });
  const internal = generateArchitecturalShopSheetSvg(scene, 'wall-a', { viewMode: 'internal' });
  assert.match(external, /data-part-id="kit-base-1-shutter-1"/);
  assert.doesNotMatch(external, /data-part-id="kit-base-1-left-side"/);
  assert.match(internal, /data-part-id="kit-base-1-left-side"/);
  assert.doesNotMatch(internal, /data-part-id="kit-base-1-shutter-1"/);
});

test('certified part schedule cannot silently omit component rows from the elevation', () => {
  const scene: SceneV1 = {
    ...sampleWardrobeScene,
    moduleParts: [{ id: 'wardrobe-shelf-1', moduleId: 'wardrobe-mbr', semanticType: 'shelf', name: 'Shelf 1', widthMm: 564, depthMm: 544, heightMm: 18, position: { xMm: 18, yMm: 0, zMm: 1200 } }],
  };
  const svg = generateArchitecturalShopSheetSvg(scene, 'wall-mbr', {
    viewMode: 'fabrication',
    productionParts: [{ id: 'different-id', sourcePartId: 'missing-scene-part', moduleId: 'wardrobe-mbr', partName: 'Unknown panel', lengthMm: 564, widthMm: 544, thicknessMm: 18, materialCode: 'OAK', quantity: 1, status: 'review_required' }],
  });
  assert.match(svg, /CUTLIST \/ SCENE COMPONENT MISMATCH/);
  assert.match(svg, /1 cutlist row\(s\) do not map to a compiled component ID/);
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
  assert.match(svg, /<svg[^>]*width="1200" height="750"/);
});
