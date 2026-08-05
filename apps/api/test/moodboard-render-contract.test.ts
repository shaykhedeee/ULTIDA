import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileRenderBrief } from '@ultida/agent-core';
import { getCatalogVault, listCatalog } from '@ultida/catalog-core';
import { SceneV1Schema } from '@ultida/scene-core';

const scene = SceneV1Schema.parse({
  schema: 'scene.v1', units: 'mm', coordinateSystem: 'right-handed-z-up', projectId: 'project-1', floorPlanVersionId: 'plan-1',
  floors: [{ id: 'floor-1', name: 'Ground', elevationMm: 0, heightMm: 2700 }],
  spaces: [{ id: 'living-1', floorId: 'floor-1', name: 'Living', type: 'living' }],
  rooms: [{ id: 'living-1', spaceId: 'living-1', name: 'Living', type: 'living', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 }], confidence: 1 }],
  walls: [{ id: 'wall-1', floorId: 'floor-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: ['living-1'], confidence: 1 }],
  openings: [], fixedFixtures: [],
  modules: [{ id: 'crockery-1', roomId: 'living-1', family: 'crockery', widthMm: 1800, depthMm: 450, heightMm: 2400, position: { xMm: 1100, yMm: 0 }, rotationDeg: 0, anchor: 'wall', materialId: 'mat-shutter', confidence: 1 }],
  moduleParts: [
    { id: 'crockery-1-shutter-1', moduleId: 'crockery-1', roomId: 'living-1', semanticType: 'shutter', name: 'Profile Glass Shutter 1', widthMm: 450, depthMm: 18, heightMm: 900, position: { xMm: 1100, yMm: 0, zMm: 1200 }, rotationDeg: 0, materialId: 'mat-shutter', confidence: 1 },
    { id: 'crockery-1-drawer-1', moduleId: 'crockery-1', roomId: 'living-1', semanticType: 'drawer', name: 'Base Drawer 1', widthMm: 900, depthMm: 400, heightMm: 180, position: { xMm: 1100, yMm: 0, zMm: 110 }, rotationDeg: 0, materialId: 'mat-shutter', confidence: 1 },
    { id: 'crockery-1-led', moduleId: 'crockery-1', roomId: 'living-1', semanticType: 'lighting_channel', name: 'Shelf LED', widthMm: 900, depthMm: 12, heightMm: 12, position: { xMm: 1100, yMm: 100, zMm: 1600 }, rotationDeg: 0, materialId: 'mat-led', confidence: 1 },
  ],
  materials: [{ id: 'mat-shutter', name: 'Ivory Matte Laminate', code: 'IV-01' }, { id: 'mat-led', name: 'Warm LED', code: 'LED-3000' }],
  lighting: [], cameras: [], constraints: [], unresolvedDetections: [], metadata: { branch: 'main', status: 'approved', changeReason: 'fixture', schemaVersion: 'scene.v1', designVersion: 'design-1' },
});

test('catalog vault exposes finished crockery compositions and room filters', () => {
  const vault = getCatalogVault();
  const tvUnits = vault.modules.filter((module) => module.family === 'tv-unit');
  const crockeryUnits = vault.modules.filter((module) => module.family === 'crockery');
  assert.equal(tvUnits.length, 10);
  assert.equal(crockeryUnits.length, 5);
  assert.ok(crockeryUnits.some((module) => module.id === 'crockery-1800'));
  assert.ok(tvUnits.every((module) => module.materialSlots.includes('shutter')));
  assert.ok(listCatalog('dining').some((module) => module.family === 'crockery'));
  assert.ok(vault.presets.some((preset) => preset.id === 'preset-tv-profile-glass'));
});

test('scene-linked render brief includes persisted cabinet part facts', () => {
  const brief = compileRenderBrief({ scene, sceneVersionId: 'scene-1', roomId: 'living-1', style: 'Warm contemporary', quality: 'review' });
  assert.ok(brief.geometryFacts.some((fact) => fact.includes('Profile Glass Shutter 1')));
  assert.ok(brief.geometryFacts.some((fact) => fact.includes('Base Drawer 1')));
  assert.ok(brief.geometryFacts.some((fact) => fact.includes('Shelf LED')));
  assert.match(brief.positivePrompt, /shutter and drawer counts/);
});
