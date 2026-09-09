import test from 'node:test';
import assert from 'node:assert/strict';
import { compileIsland, COMPILER_REGISTRY } from '../src/compilers.js';

test('Kitchen breakfast island compiles double-sided carcass, waterfall stone slabs, and cantilever overhang brackets', () => {
  const result = compileIsland({
    templateVersionId: 'kit-island-waterfall-1800',
    instanceId: 'isl-kitchen-1',
    wall: { widthMm: 4500, heightMm: 3000, depthMm: 150 },
    parameters: {
      totalWidthMm: 1800,
      totalDepthMm: 900,
      totalHeightMm: 850,
      overhangMm: 300,
    },
  });

  assert.equal(result.valid, true);
  assert.ok(result.parts.length >= 8);

  const topSlab = result.parts.find((p) => p.id === 'isl-kitchen-1-countertop-top');
  assert.ok(topSlab, 'Top slab exists');
  assert.equal(topSlab.meta.semanticType, 'countertop');
  assert.equal(topSlab.meta.bom.unit, 'sqm');
  assert.equal(topSlab.size.heightMm, 40);

  const leftWaterfall = result.parts.find((p) => p.id === 'isl-kitchen-1-countertop-waterfall-left');
  const rightWaterfall = result.parts.find((p) => p.id === 'isl-kitchen-1-countertop-waterfall-right');
  assert.ok(leftWaterfall && rightWaterfall, 'Both waterfall mitred legs exist');
  assert.equal(leftWaterfall.meta.bom.unit, 'sqm');

  const overhang = result.parts.find((p) => p.id === 'isl-kitchen-1-overhang-supports');
  assert.ok(overhang, 'Overhang support cleats exist');
  assert.equal(overhang.meta.semanticType, 'hardware');

  const spine = result.parts.find((p) => p.id === 'isl-kitchen-1-island-divider');
  assert.ok(spine, 'Double-sided carcass dividing spine exists');
});

test('Walk-in dressing island compiles ultra-clear glass top reveal and velvet jewellery organizers', () => {
  const result = compileIsland({
    templateVersionId: 'wardrobe-island-jewellery-900',
    instanceId: 'isl-wardrobe-1',
    wall: { widthMm: 3600, heightMm: 2800, depthMm: 150 },
    parameters: {
      islandType: 'dressing',
      totalWidthMm: 900,
      totalDepthMm: 900,
      totalHeightMm: 850,
      drawerCount: 3,
    },
  });

  assert.equal(result.valid, true);

  const glass = result.parts.find((p) => p.id === 'isl-wardrobe-1-glass-top');
  assert.ok(glass, 'Glass top exists');
  assert.equal(glass.meta.semanticType, 'glass');
  assert.equal(glass.meta.bom.sku, 'GLASS-TOP-TOUGHENED-10MM');

  const profile = result.parts.find((p) => p.id === 'isl-wardrobe-1-glass-reveal-profile');
  assert.ok(profile, 'Reveal lip profile exists');

  const velvetOrganizers = result.parts.filter((p) => p.name.includes('Jewellery & Watch Organiser'));
  assert.equal(velvetOrganizers.length, 2, 'Two velvet-lined jewellery organiser trays created');

  const tandemDrawers = result.parts.filter((p) => p.name.includes('Soft-Close Tandem Drawer'));
  assert.ok(tandemDrawers.length >= 4, 'Lower tandem drawers created');
});

test('COMPILER_REGISTRY contains island compiler', () => {
  assert.ok(typeof COMPILER_REGISTRY.island === 'function');
});
