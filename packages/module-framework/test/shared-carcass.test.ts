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

const wall = { widthMm: 4200, heightMm: 2700, depthMm: 150 };

test('every shared furniture compiler emits two explicit carcass side panels', () => {
  const cases = [
    ['wardrobe', compileWardrobe, { totalWidthMm: 1800, totalHeightMm: 2400, totalDepthMm: 600 }],
    ['crockery', compileCrockery, { totalWidthMm: 1800, totalHeightMm: 2100, totalDepthMm: 450 }],
    ['study', compileStudy, { totalWidthMm: 1500, totalHeightMm: 1800, totalDepthMm: 550 }],
    ['pooja', compilePooja, { totalWidthMm: 1200, totalHeightMm: 2100, totalDepthMm: 400 }],
    ['kitchen', compileKitchen, { totalWidthMm: 2400, baseHeightMm: 900, totalDepthMm: 600, upperHeightMm: 720 }],
    ['bed', compileBed, { totalWidthMm: 1800, totalHeightMm: 1100, totalDepthMm: 2100 }],
    ['utility', compileUtility, { totalWidthMm: 1200, totalHeightMm: 2100, totalDepthMm: 600 }],
  ] as const;

  for (const [family, compile, parameters] of cases) {
    const result = compile({ templateVersionId: `test-${family}-v1`, instanceId: `${family}-test`, parameters, wall });
    assert.equal(result.valid, true, `${family} should compile in the certification envelope`);
    const sides = result.parts.filter((part) => /carcass (left|right) side panel/i.test(part.name));
    assert.equal(sides.length, 2, `${family} must emit left and right side panels`);
    assert.deepEqual(sides.map((part) => part.size.widthMm), [18, 18], `${family} side panels must use carcass thickness`);
  }
});
