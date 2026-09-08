import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileBed,
  compileCrockery,
  compileKitchen,
  compilePooja,
  compileStudy,
  compileUtility,
  compileWardrobe,
} from '../src/compilers.js';
import type { TemplateCompileResult } from '../src/types.js';

const wall = { widthMm: 4200, heightMm: 3000, depthMm: 150 };

type FamilyCase = {
  family: string;
  compile: (input: any) => TemplateCompileResult;
  sizes: Array<Record<string, number>>;
  carcassGroups: Array<{ idPrefix: string; depthMm: (parameters: Record<string, number>) => number }>;
};

const cases: FamilyCase[] = [
  { family: 'wardrobe', compile: compileWardrobe, sizes: [{ totalWidthMm: 1200, totalHeightMm: 2100, totalDepthMm: 550 }, { totalWidthMm: 1800, totalHeightMm: 2400, totalDepthMm: 600 }, { totalWidthMm: 3000, totalHeightMm: 2700, totalDepthMm: 650 }], carcassGroups: [{ idPrefix: '', depthMm: (p) => p.totalDepthMm }] },
  { family: 'crockery', compile: compileCrockery, sizes: [{ totalWidthMm: 1200, totalHeightMm: 1500, totalDepthMm: 350 }, { totalWidthMm: 1800, totalHeightMm: 2100, totalDepthMm: 450 }, { totalWidthMm: 3000, totalHeightMm: 2400, totalDepthMm: 600 }], carcassGroups: [{ idPrefix: '', depthMm: (p) => p.totalDepthMm }] },
  { family: 'study', compile: compileStudy, sizes: [{ totalWidthMm: 900, totalHeightMm: 1200, totalDepthMm: 400 }, { totalWidthMm: 1500, totalHeightMm: 1800, totalDepthMm: 550 }, { totalWidthMm: 3000, totalHeightMm: 2400, totalDepthMm: 650 }], carcassGroups: [{ idPrefix: '', depthMm: (p) => p.totalDepthMm }] },
  { family: 'pooja', compile: compilePooja, sizes: [{ totalWidthMm: 600, totalHeightMm: 1500, totalDepthMm: 300 }, { totalWidthMm: 1200, totalHeightMm: 2100, totalDepthMm: 400 }, { totalWidthMm: 2400, totalHeightMm: 2600, totalDepthMm: 500 }], carcassGroups: [{ idPrefix: '', depthMm: (p) => p.totalDepthMm }] },
  { family: 'kitchen', compile: compileKitchen, sizes: [{ totalWidthMm: 1200, baseHeightMm: 850, totalDepthMm: 600, upperHeightMm: 600 }, { totalWidthMm: 2400, baseHeightMm: 900, totalDepthMm: 600, upperHeightMm: 720 }, { totalWidthMm: 3600, baseHeightMm: 900, totalDepthMm: 650, upperHeightMm: 900 }], carcassGroups: [{ idPrefix: 'base', depthMm: (p) => p.totalDepthMm }, { idPrefix: 'upper', depthMm: (p) => p.totalDepthMm - 300 }] },
  { family: 'bed', compile: compileBed, sizes: [{ totalWidthMm: 1200, totalHeightMm: 900, totalDepthMm: 1900 }, { totalWidthMm: 1800, totalHeightMm: 1100, totalDepthMm: 2100 }, { totalWidthMm: 2400, totalHeightMm: 1400, totalDepthMm: 2200 }], carcassGroups: [{ idPrefix: '', depthMm: (p) => p.totalDepthMm }] },
  { family: 'utility', compile: compileUtility, sizes: [{ totalWidthMm: 600, totalHeightMm: 1800, totalDepthMm: 450 }, { totalWidthMm: 1200, totalHeightMm: 2100, totalDepthMm: 600 }, { totalWidthMm: 2400, totalHeightMm: 2400, totalDepthMm: 650 }], carcassGroups: [{ idPrefix: '', depthMm: (p) => p.totalDepthMm }] },
];

test('every carcass zone emits exactly one left and right side panel at min, nominal, and max sizes', () => {
  for (const familyCase of cases) {
    for (const [sizeIndex, parameters] of familyCase.sizes.entries()) {
      const instanceId = `${familyCase.family}-size-${sizeIndex + 1}`;
      const result = familyCase.compile({ templateVersionId: `test-${instanceId}-v1`, instanceId, parameters, wall });
      assert.equal(result.valid, true, `${familyCase.family} size ${sizeIndex + 1} should compile in the certification envelope`);

      for (const group of familyCase.carcassGroups) {
        const prefix = `${instanceId}-${group.idPrefix ? `${group.idPrefix}-` : ''}carcass-`;
        const left = result.parts.filter((part) => part.id === `${prefix}left`);
        const right = result.parts.filter((part) => part.id === `${prefix}right`);
        assert.equal(left.length, 1, `${familyCase.family} size ${sizeIndex + 1} must emit exactly one carcass-left panel for ${group.idPrefix || 'main'} carcass`);
        assert.equal(right.length, 1, `${familyCase.family} size ${sizeIndex + 1} must emit exactly one carcass-right panel for ${group.idPrefix || 'main'} carcass`);

        for (const [side, part] of [['left', left[0]], ['right', right[0]]] as const) {
          assert.equal(part.meta.semanticType, 'carcass', `${familyCase.family} ${side} side must be carcass geometry`);
          assert.equal(part.anchor.face, side, `${familyCase.family} ${side} side must use the matching anchor face`);
          assert.equal(part.size.depthMm, group.depthMm(parameters), `${familyCase.family} ${side} side must run the declared carcass depth`);
          assert.equal(part.meta.bom.sku, 'CARCASS-SIDE-18MM');
          assert.equal(part.meta.bom.qty, 1);
          assert.equal(part.meta.bom.lengthMm, group.depthMm(parameters));
          assert.equal(part.meta.drawing.layer, 'A-MOD-CARCASS');
        }
      }
    }
  }
});
