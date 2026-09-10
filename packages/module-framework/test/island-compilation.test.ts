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

for (const islandType of ['kitchen', 'dressing']) {
  for (const [width, depth, height] of [[600, 600, 600], [1800, 900, 850], [3600, 1200, 1100]]) {
    test(`${islandType} island ${width}×${depth}×${height}: every part fits the declared finished envelope`, () => {
      const result = compileIsland({ templateVersionId: 'island-test', wall: { widthMm: 4000, heightMm: 2700, depthMm: 150 },
        parameters: { islandType, totalWidthMm: width, totalDepthMm: depth, totalHeightMm: height, drawerCount: 3 } });
      assert.equal(result.valid, true, result.blockingViolations.join(' '));
      for (const part of result.parts) {
        for (const [axis, dimension, limit] of [['xMm', 'widthMm', width], ['yMm', 'depthMm', depth], ['zMm', 'heightMm', height]] as const) {
          assert.ok(Number.isFinite(part.size[dimension]) && part.size[dimension] > 0, `${part.id}: positive ${dimension}`);
          assert.ok(part.transform[axis] >= -0.001 && part.transform[axis] + part.size[dimension] <= limit + 0.001, `${part.id}: ${axis} outside ${limit}`);
        }
      }
      if (islandType === 'kitchen') {
        const legs = result.parts.filter((part) => part.id.includes('waterfall-'));
        assert.equal(legs.length, 2);
        for (const leg of legs) {
          assert.equal(leg.meta.bom.widthMm, leg.size.heightMm);
          assert.equal(leg.meta.bom.lengthMm, leg.size.depthMm);
          assert.equal(leg.meta.bom.thicknessMm, leg.size.widthMm);
        }
        const left = result.parts.find((part) => part.id.endsWith('carcass-left'))!;
        assert.equal(left.transform.xMm, 40);
      }
    });
  }
}

test('island rejects malformed dimensions and unbounded drawer loops before emitting parts', () => {
  const defaults = { totalWidthMm: 1800, totalDepthMm: 900, totalHeightMm: 850 };
  for (const overrides of [
    { totalWidthMm: NaN }, { totalHeightMm: Infinity }, { totalDepthMm: 0 },
    { overhangMm: 950 }, { overhangMm: NaN }, { overhangMm: -1 },
    { islandType: 'dressing', drawerCount: Infinity }, { islandType: 'dressing', drawerCount: 2.5 },
    { islandType: 'dressing', drawerCount: 100000 }, { totalWidthMm: 4500 },
  ]) {
    const result = compileIsland({ templateVersionId: 'island-test', wall: { widthMm: 4000, heightMm: 2700, depthMm: 150 }, parameters: { ...defaults, ...overrides } });
    assert.equal(result.valid, false, JSON.stringify(overrides));
    assert.equal(result.parts.length, 0);
    assert.ok(result.blockingViolations.length);
  }
});
