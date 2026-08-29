import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileTvUnit } from '../src/tv-unit-compiler.js';

test('valid TV-unit compilation generates complete part list', () => {
  const result = compileTvUnit({
    templateVersionId: 'tpl-tv-v1',
    instanceId: 'tv-living-1',
    parameters: {
      totalWidthMm: 1800,
      totalDepthMm: 450,
      totalHeightMm: 600,
      baseType: 'floating',
      floorClearanceMm: 200,
      shutterCount: 3,
      lighting: 'profile_led'
    },
    wall: { widthMm: 3000, heightMm: 2700, depthMm: 150 }
  });

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blockingViolations.length, 0);
  assert.ok(result.parts.length >= 7); // Carcass bottom, top, back, 3 shutters, LED channel, hardware
});

test('wall-fit failure detects dimension overflow', () => {
  const result = compileTvUnit({
    templateVersionId: 'tpl-tv-v1',
    instanceId: 'tv-oversized-1',
    parameters: {
      totalWidthMm: 3500, // Exceeds 3000mm wall
      totalDepthMm: 450,
      totalHeightMm: 600
    },
    wall: { widthMm: 3000, heightMm: 2700, depthMm: 150 }
  });

  assert.strictEqual(result.valid, false);
  assert.ok(result.blockingViolations.some(v => v.includes('exceeds wall width')));
});

test('equal shutter distribution calculates precise shutter widths and gaps', () => {
  const result = compileTvUnit({
    templateVersionId: 'tpl-tv-v1',
    instanceId: 'tv-shutters-1',
    parameters: {
      totalWidthMm: 1500,
      totalDepthMm: 450,
      totalHeightMm: 600,
      shutterCount: 3,
      fingerGrooveGapMm: 30
    },
    wall: { widthMm: 3000, heightMm: 2700, depthMm: 150 }
  });

  const shutters = result.parts.filter(p => p.meta.semanticType === 'shutter');
  assert.strictEqual(shutters.length, 3);

  // Total width 1500 - (2 * 30 gap) = 1440. Each shutter = 1440 / 3 = 480mm
  assert.strictEqual(shutters[0].size.widthMm, 480);
  assert.strictEqual(shutters[1].size.widthMm, 480);
  assert.strictEqual(shutters[2].size.widthMm, 480);

  // Transforms along X
  assert.strictEqual(shutters[0].transform.xMm, 0);
  assert.strictEqual(shutters[1].transform.xMm, 480 + 30); // 510mm
  assert.strictEqual(shutters[2].transform.xMm, (480 + 30) * 2); // 1020mm
});

test('TV wall archetypes compile distinct production assemblies', () => {
  const base = {
    templateVersionId: 'tpl-tv-wall-v1',
    wall: { widthMm: 4200, heightMm: 2700, depthMm: 150 },
    parameters: { totalWidthMm: 3000, totalDepthMm: 450, totalHeightMm: 2400, lighting: 'profile_led' as const },
  };
  const study = compileTvUnit({ ...base, instanceId: 'tv-study', parameters: { ...base.parameters, family: 'tv_plus_study' } });
  const crockery = compileTvUnit({ ...base, instanceId: 'tv-crockery', parameters: { ...base.parameters, family: 'tv_plus_crockery' } });
  const partition = compileTvUnit({ ...base, instanceId: 'tv-partition', parameters: { ...base.parameters, family: 'tv_plus_partition' } });

  assert.ok(study.parts.some((part) => part.name.includes('Study Worktop')));
  assert.ok(crockery.parts.filter((part) => part.name.includes('Profile Glass Display Shutter')).length >= 2);
  assert.ok(partition.parts.some((part) => part.name.includes('Partition Slat')));
  assert.notEqual(study.parts.length, crockery.parts.length);
});

test('loft fillers compiled when overhead storage is enabled', () => {
  const result = compileTvUnit({
    templateVersionId: 'tpl-tv-v1',
    instanceId: 'tv-loft-1',
    parameters: {
      totalWidthMm: 1800,
      totalDepthMm: 450,
      totalHeightMm: 600,
      overheadStorage: true,
      loftFillerMm: 50
    },
    wall: { widthMm: 3000, heightMm: 2700, depthMm: 150 }
  });

  const filler = result.parts.find(p => p.meta.semanticType === 'filler');
  assert.ok(filler);
  assert.strictEqual(filler.size.heightMm, 50);
  assert.strictEqual(filler.size.widthMm, 1800);
});

test('profile glass compiles aluminium frame and glass insert', () => {
  const result = compileTvUnit({
    templateVersionId: 'tpl-tv-v1',
    instanceId: 'tv-glass-1',
    parameters: {
      totalWidthMm: 1800,
      totalDepthMm: 450,
      totalHeightMm: 600,
      shutterCount: 3,
      profileGlassOption: true
    },
    wall: { widthMm: 3000, heightMm: 2700, depthMm: 150 }
  });

  const profile = result.parts.find(p => p.meta.semanticType === 'profile');
  const glass = result.parts.find(p => p.meta.semanticType === 'glass');

  assert.ok(profile);
  assert.ok(glass);
  assert.strictEqual(profile.name.includes('Aluminium Frame'), true);
  assert.strictEqual(glass.meta.materialSlot.code, 'GLASS-GREY');
});

test('lighting placement compiles under-carcass LED lighting channel', () => {
  const result = compileTvUnit({
    templateVersionId: 'tpl-tv-v1',
    instanceId: 'tv-led-1',
    parameters: {
      totalWidthMm: 1800,
      totalDepthMm: 450,
      totalHeightMm: 600,
      lighting: 'profile_led'
    },
    wall: { widthMm: 3000, heightMm: 2700, depthMm: 150 }
  });

  const led = result.parts.find(p => p.meta.semanticType === 'lighting_channel');
  assert.ok(led);
  assert.strictEqual(led.size.widthMm, 1800);
});

test('full-height TV wall compiles a feature field, low storage and glass display as distinct parts', () => {
  const result = compileTvUnit({
    templateVersionId: 'tpl-tv-wall-v1',
    instanceId: 'tv-full-wall-1',
    parameters: {
      totalWidthMm: 3000,
      totalDepthMm: 450,
      totalHeightMm: 2400,
      profileGlassOption: true,
      lighting: 'profile_led',
      shutterCount: 5,
    },
    wall: { widthMm: 3200, heightMm: 0, depthMm: 150 },
  });

  assert.equal(result.valid, true);
  assert.ok(result.parts.some((part) => part.name === 'TV Feature Back Panel'));
  assert.ok(result.parts.some((part) => part.name === 'TV Service and Cable Recess'));
  assert.ok(result.parts.some((part) => part.name === 'Profile Glass Display Shutter'));
  assert.ok(result.parts.some((part) => part.meta.semanticType === 'lighting_channel'));
});

test('deterministic part output produces identical results for identical parameters', () => {
  const input = {
    templateVersionId: 'tpl-tv-v1',
    instanceId: 'tv-det-1',
    parameters: { totalWidthMm: 2000, totalDepthMm: 450, totalHeightMm: 600, shutterCount: 4 },
    wall: { widthMm: 3000, heightMm: 2700, depthMm: 150 }
  };

  const res1 = compileTvUnit(input);
  const res2 = compileTvUnit(input);

  assert.deepStrictEqual(res1, res2);
});
