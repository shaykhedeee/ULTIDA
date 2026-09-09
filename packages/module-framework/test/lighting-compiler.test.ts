import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IndianModularCatalog, type CatalogModule } from '../../catalog-core/src/index.js';
import {
  compileLightingElements,
  compileTvUnit,
  compileWardrobe,
  compileCrockery,
  compileStudy,
  compilePooja,
  compileKitchen,
  compileBed,
  compileUtility,
  compileFreestandingLighting,
  TemplateCompileInput,
  TemplateCompileResult,
} from '../src/index.js';

function getCompilerForCatalogModule(mod: CatalogModule): (input: TemplateCompileInput) => TemplateCompileResult {
  switch (mod.family) {
    case 'tv-unit':
      return compileTvUnit;
    case 'wardrobe':
      return compileWardrobe;
    case 'crockery':
      return compileCrockery;
    case 'study':
      return compileStudy;
    case 'pooja':
      return compilePooja;
    case 'kitchen-base':
    case 'kitchen-wall':
    case 'kitchen-tall':
    case 'kitchen-corner':
      return compileKitchen;
    case 'bed':
      return compileBed;
    case 'utility':
    case 'storage':
      return compileUtility;
    case 'freestanding-lighting':
    case 'lighting':
      return compileFreestandingLighting;
    default:
      return compileUtility;
  }
}

test('freestanding luminaires compile valid lighting anchors and fixture metadata', () => {
  const floorLamp = compileFreestandingLighting({
    templateVersionId: 'tpl-fsl-1',
    instanceId: 'lamp-floor-1',
    family: 'freestanding-lighting',
    tags: ['floor-lamp', 'brass', '3000k'],
    materialSlots: ['metal', 'lighting'],
    parameters: {
      totalWidthMm: 450,
      totalDepthMm: 1200,
      totalHeightMm: 2100,
      tags: ['floor-lamp', 'brass', '3000k'],
      materialSlots: ['metal', 'lighting'],
    },
    wall: { widthMm: 4000, heightMm: 3000, depthMm: 150 },
  });

  assert.strictEqual(floorLamp.valid, true);
  const floorAnchor = floorLamp.parts.find(
    (p) => p.kind === 'lighting_anchor' || p.meta.semanticType === 'lighting_anchor'
  );
  assert.ok(floorAnchor, 'Floor lamp must emit a lighting anchor');
  assert.strictEqual(floorAnchor?.fixtureType, 'spot');
  assert.strictEqual(floorAnchor?.colorTemperatureK, 3000);
  assert.ok(floorAnchor?.positionMm, 'Must have 3D position');
  assert.ok(floorAnchor?.bom?.sku, 'Must have BOM SKU');

  const pendant = compileFreestandingLighting({
    templateVersionId: 'tpl-fsl-2',
    instanceId: 'lamp-pnd-1',
    family: 'freestanding-lighting',
    tags: ['pendant', 'smoked-glass', '3000k'],
    materialSlots: ['glass', 'lighting'],
    parameters: {
      totalWidthMm: 400,
      totalDepthMm: 400,
      totalHeightMm: 1500,
      tags: ['pendant', 'smoked-glass', '3000k'],
      materialSlots: ['glass', 'lighting'],
    },
    wall: { widthMm: 4000, heightMm: 3000, depthMm: 150 },
  });

  const pendantAnchor = pendant.parts.find(
    (p) => p.kind === 'lighting_anchor' || p.meta.semanticType === 'lighting_anchor'
  );
  assert.ok(pendantAnchor, 'Pendant must emit a lighting anchor');
  assert.strictEqual(pendantAnchor?.fixtureType, 'pendant');
  assert.strictEqual(pendantAnchor?.anchor.face, 'top');
});

test('property test: every catalog entry declaring materialSlots: [lighting] produces at least one lighting_anchor', () => {
  const lightingModules = IndianModularCatalog.filter((m) => m.materialSlots.includes('lighting'));
  assert.ok(lightingModules.length >= 20, `Expected at least 20 catalog items declaring lighting, found ${lightingModules.length}`);

  for (const mod of lightingModules) {
    const compiler = getCompilerForCatalogModule(mod);
    const input: TemplateCompileInput = {
      templateVersionId: `tpl-${mod.id}`,
      instanceId: `inst-${mod.id}`,
      family: mod.family,
      category: mod.family,
      tags: mod.tags,
      materialSlots: mod.materialSlots,
      parameters: {
        totalWidthMm: mod.widthMm,
        totalDepthMm: mod.depthMm,
        totalHeightMm: mod.heightMm,
        widthMm: mod.widthMm,
        depthMm: mod.depthMm,
        heightMm: mod.heightMm,
        tags: mod.tags,
        materialSlots: mod.materialSlots,
        name: mod.name,
        description: mod.description,
        lighting: 'profile_led',
        profileGlassOption: true,
      },
      wall: { widthMm: Math.max(4000, mod.widthMm + 500), heightMm: Math.max(3000, mod.heightMm + 200), depthMm: 150 },
    };

    const result = compiler(input);
    assert.strictEqual(result.valid, true, `Module ${mod.id} failed compilation: ${result.blockingViolations.join(', ')}`);

    const lightingAnchors = result.parts.filter(
      (p) => p.kind === 'lighting_anchor' || p.meta.semanticType === 'lighting_anchor'
    );
    assert.ok(
      lightingAnchors.length > 0,
      `Module ${mod.id} (family: ${mod.family}) declared lighting slot but produced 0 lighting_anchor parts`
    );

    for (const anchor of lightingAnchors) {
      assert.ok(anchor.id, `Anchor in ${mod.id} must have an id`);
      assert.ok(anchor.positionMm, `Anchor ${anchor.id} in ${mod.id} must have positionMm`);
      assert.strictEqual(typeof anchor.positionMm.xMm, 'number');
      assert.strictEqual(typeof anchor.positionMm.yMm, 'number');
      assert.strictEqual(typeof anchor.positionMm.zMm, 'number');

      assert.ok(
        ['led-strip', 'downlight', 'spot', 'pendant'].includes(anchor.fixtureType!),
        `Anchor ${anchor.id} in ${mod.id} has invalid fixtureType: ${anchor.fixtureType}`
      );

      assert.ok(
        typeof anchor.colorTemperatureK === 'number' && anchor.colorTemperatureK >= 2000,
        `Anchor ${anchor.id} in ${mod.id} has invalid colorTemperatureK: ${anchor.colorTemperatureK}`
      );

      if (anchor.fixtureType === 'led-strip') {
        assert.ok(
          typeof anchor.lengthMm === 'number' && anchor.lengthMm > 0,
          `LED strip anchor ${anchor.id} in ${mod.id} must have positive lengthMm`
        );
      }

      assert.ok(anchor.bom, `Anchor ${anchor.id} in ${mod.id} must have bom`);
      assert.ok(anchor.bom.sku, `Anchor ${anchor.id} in ${mod.id} must have bom.sku`);
      assert.ok(anchor.bom.qty > 0, `Anchor ${anchor.id} in ${mod.id} must have positive bom.qty`);
      assert.ok(
        ['m', 'pc'].includes(anchor.bom.unit),
        `Anchor ${anchor.id} in ${mod.id} must have unit 'm' or 'pc', got '${anchor.bom.unit}'`
      );
    }
  }
});
