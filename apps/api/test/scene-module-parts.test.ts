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

test('unit appearance survives compilation without changing measured parts', () => {
  const base = { id: 'crockery-style', space_id: 'dining-1', category: 'crockery', template_id: 'crockery-1800', config_json: { family: 'crockery', widthMm: 1800, depthMm: 450, heightMm: 2400 }, position_json: { wallId: 'wall-a', xMm: 0, yMm: 0, rotationDeg: 0, anchor: 'wall' } };
  const plain = compileStoredModuleForScene(base, walls);
  const styled = compileStoredModuleForScene({ ...base, config_json: { ...base.config_json, designIntent: { version: 1, style: 'Warm oak and black glass', palette: [], referenceAssetIds: ['studio-crockery-warm-oak'] } } }, walls);
  assert.ok(plain.ok && styled.ok);
  if (!plain.ok || !styled.ok) return;
  assert.deepEqual(styled.parts, plain.parts);
  assert.equal(styled.module.designIntent?.referenceAssetIds[0], 'studio-crockery-warm-oak');
  assert.equal(styled.module.widthMm, 1800);
  const bad = compileStoredModuleForScene({ ...base, config_json: { ...base.config_json, designIntent: { version: 9 } } }, walls);
  assert.equal(bad.ok, false);
});

test('loft remains inside measured ceiling and uses the saved height and mounting level', () => {
  const unit = { id: 'loft-unit', space_id: 'bedroom', category: 'wardrobe', template_id: 'wardrobe-1800', config_json: { family: 'wardrobe', widthMm: 1800, depthMm: 600, heightMm: 2400, configuration: { includeLoft: true, loftHeightMm: 450 } }, position_json: { wallId: 'wall-a', xMm: 0, yMm: 0, rotationDeg: 0, zMm: 100 } };
  const result = compileStoredModuleForScene(unit, walls);
  assert.ok(result.ok); if (!result.ok) return;
  const loft = result.parts.find(part => part.semanticType === 'loft');
  assert.ok(loft); assert.equal(loft.heightMm, 450); assert.equal(loft.zMm, 2050);
  const tall = compileStoredModuleForScene({ ...unit, position_json: { ...unit.position_json, zMm: 400 } }, walls);
  assert.equal(tall.ok, false); if (!tall.ok) assert.equal(tall.code, 'MODULE_EXCEEDS_HEIGHT');
  const unknown = compileStoredModuleForScene(unit, [{ ...walls[0], heightMm: 0 }]);
  assert.equal(unknown.ok, false); if (!unknown.ok) assert.equal(unknown.code, 'ROOM_CEILING_UNCONFIRMED');
});

test('new scene geometry uses positive plan yaw while untagged scenes retain the legacy transform', () => {
  const unit = {
    id: 'rotated-wardrobe', space_id: 'bedroom', category: 'wardrobe', template_id: 'wardrobe-1800',
    config_json: { family: 'wardrobe', widthMm: 1800, depthMm: 600, heightMm: 2400 },
    position_json: { wallId: 'wall-a', xMm: 1000, yMm: 200, rotationDeg: 0 },
  };
  const baseline = compileStoredModuleForScene(unit, walls);
  assert.ok(baseline.ok);
  if (!baseline.ok) return;
  for (const angle of [0, 90, 180, 270]) {
    for (const convention of ['legacy-negative-plan-yaw', 'plan-positive-yaw-v2'] as const) {
      const rotated = compileStoredModuleForScene({ ...unit, position_json: { ...unit.position_json, rotationDeg: angle } }, walls, convention);
      assert.ok(rotated.ok);
      if (!rotated.ok) continue;
      for (const part of baseline.parts) {
        const transformed = rotated.parts.find((candidate) => candidate.id === part.id);
        assert.ok(transformed, `missing ${part.id}`);
        if (!transformed) continue;
        const localX = part.xMm - 1000; const localY = part.yMm - 200;
        const signedAngle = (convention === 'plan-positive-yaw-v2' ? angle : -angle) * Math.PI / 180;
        const expectedX = 1000 + localX * Math.cos(signedAngle) - localY * Math.sin(signedAngle);
        const expectedY = 200 + localX * Math.sin(signedAngle) + localY * Math.cos(signedAngle);
        assert.ok(Math.abs(transformed.xMm - expectedX) < 1e-6, `${convention} ${angle}° X transform for ${part.id}`);
        assert.ok(Math.abs(transformed.yMm - expectedY) < 1e-6, `${convention} ${angle}° Y transform for ${part.id}`);
      }
    }
  }
});
