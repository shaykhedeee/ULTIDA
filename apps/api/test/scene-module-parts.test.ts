import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileStoredModuleForScene } from '../src/scene-module-parts.js';

const walls = [{ id: 'wall-a', worldStart: { xMm: 0, yMm: 0 }, worldEnd: { xMm: 3600, yMm: 0 }, heightMm: 2700 }];

test('compiles a persisted TV module into exact cabinet parts', () => {
  const result = compileStoredModuleForScene({
    id: 'tv-1', space_id: 'living-1', category: 'tv-unit', template_id: 'tv-1800',
    config_json: { family: 'tv-unit', widthMm: 1800, depthMm: 400, heightMm: 600 },
    position_json: { wallId: 'wall-a', xMm: 200, yMm: 0, rotationDeg: 0, anchor: 'wall' },
  }, walls);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.module.id, 'tv-1');
  assert.ok(result.parts.length > 3);
  assert.equal(result.parts[0]?.moduleId, 'tv-1');
  assert.ok(result.parts.some((part) => part.semanticType === 'shutter'));
});

test('carries configured profile glass and adaptive shutters into a detailed scene composition', () => {
  const result = compileStoredModuleForScene({
    id: 'crockery-1', space_id: 'living-1', category: 'crockery', template_id: 'crockery-wall',
    config_json: {
      family: 'crockery', widthMm: 2500, depthMm: 420, heightMm: 2400,
      configuration: { shutterCount: 5, glassProfile: true, drawerCount: 2, lighting: 'shelf-led' },
    },
    position_json: { wallId: 'wall-a', xMm: 300, yMm: 0, rotationDeg: 0, anchor: 'wall' },
  }, walls);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.parts.some((part) => part.name.includes('Profile Glass Display Door')));
  assert.ok(result.parts.some((part) => part.semanticType === 'lighting_channel'));
  assert.equal(result.module.widthMm, 2500);
});

test('does not invent parts for a non-panel furniture family', () => {
  const result = compileStoredModuleForScene({
    id: 'sofa-1', space_id: 'living-1', category: 'sofa', template_id: 'sofa-2200',
    config_json: { family: 'sofa', widthMm: 2200, depthMm: 900, heightMm: 850 },
    position_json: { wallId: 'wall-a', xMm: 0, yMm: 0, rotationDeg: 0, anchor: 'wall' },
  }, walls);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.parts.length, 0);
});

test('compiles a hydraulic storage bed into traceable panels and hardware', () => {
  const result = compileStoredModuleForScene({
    id: 'bed-1', space_id: 'bedroom-1', category: 'bed', template_id: 'bed-1800-extended-headboard',
    config_json: {
      family: 'bed', widthMm: 1800, depthMm: 2100, heightMm: 1200,
      parameters: { archetype: 'extended_headboard', platformHeightMm: 450, headboardHeightMm: 1200 },
    },
    position_json: { wallId: 'wall-a', xMm: 500, yMm: 0, rotationDeg: 0, anchor: 'wall' },
  }, walls);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.parts.length >= 10);
  assert.ok(result.parts.some((part) => part.name === 'Hydraulic Bed Deck Left'));
  assert.ok(result.parts.some((part) => part.name === 'Extended Headboard Left Wing'));
  assert.ok(result.parts.some((part) => part.semanticType === 'hardware'));
  assert.ok(result.parts.every((part) => part.moduleId === 'bed-1' && part.roomId === 'bedroom-1'));
});
