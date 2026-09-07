import test from 'node:test';
import assert from 'node:assert/strict';
import { compileWardrobe } from '../src/compilers.js';

test('wardrobe compiles shutters, drawers, fillers, loft and lighting as independent production records', () => {
  const result = compileWardrobe({
    templateVersionId: 'wardrobe-v1',
    instanceId: 'wardrobe-certified',
    wall: { widthMm: 4200, heightMm: 3000, depthMm: 150 },
    parameters: {
      totalWidthMm: 3000,
      totalHeightMm: 2700,
      totalDepthMm: 600,
      shutterCount: 4,
      drawerCount: 3,
      drawerHeightMm: 180,
      leftFillerMm: 30,
      rightFillerMm: 50,
      includeLoft: true,
      loftHeightMm: 550,
      lighting: 'profile_led',
    },
  });

  assert.equal(result.valid, true);
  const byId = (suffix: string) => result.parts.find((part) => part.id === `wardrobe-certified-${suffix}`);

  assert.equal(result.parts.filter((part) => part.meta.semanticType === 'shutter').length, 4);
  assert.equal(result.parts.filter((part) => part.meta.semanticType === 'drawer').length, 3);
  assert.equal(byId('filler-left')?.meta.semanticType, 'filler');
  assert.equal(byId('filler-left')?.size.widthMm, 30);
  assert.equal(byId('filler-right')?.meta.semanticType, 'filler');
  assert.equal(byId('filler-right')?.size.widthMm, 50);
  assert.equal(byId('loft')?.meta.semanticType, 'loft');
  assert.equal(byId('loft')?.size.heightMm, 550);
  assert.equal(byId('led-channel')?.meta.semanticType, 'lighting_channel');
  assert.ok(result.parts.every((part) => part.meta.bom.sku), 'Every certified component needs a BOM identity.');
});
