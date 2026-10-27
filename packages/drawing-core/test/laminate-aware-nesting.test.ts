import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { packLaminateRecipeSheets } from '../src/laminate-aware-nesting.js';

describe('Laminate-Recipe-Aware 2D Guillotine Sheet Nesting', () => {
  it('separates incompatible core/laminate recipes, deducts 4-edge banding, locks woodgrain, and tracks reusable offcuts', () => {
    const result = packLaminateRecipeSheets([
      {
        partId: 'SHT-1',
        moduleId: 'WD-2600',
        moduleTitle: 'Equal-Shutter Wardrobe',
        partLabel: 'Wardrobe Shutter Leaf',
        coreSubstrate: 'Action TESA 18mm HDHMR Pro',
        thicknessMm: 18,
        frontLaminateSku: '14149-RS Alameda Oak Dune',
        backLinerSku: '21091-MR Frosty White Liner 0.8mm',
        finishedLengthMm: 2100,
        finishedWidthMm: 497,
        edgeTopMm: 2,
        edgeBottomMm: 2,
        edgeLeftMm: 2,
        edgeRightMm: 2,
        grainDirection: 'vertical',
        quantity: 2,
      },
      {
        partId: 'SINK-GBL',
        moduleId: 'KS-900',
        moduleTitle: '900 Waterproof Sink Base',
        partLabel: 'Sink Base Gable',
        coreSubstrate: 'CenturyPly 18mm Sainik 710 IS:710 BWP',
        thicknessMm: 18,
        frontLaminateSku: '21091-MR Frosty White Liner 0.8mm',
        backLinerSku: '21091-MR Frosty White Liner 0.8mm',
        finishedLengthMm: 750,
        finishedWidthMm: 580,
        edgeTopMm: 0.8,
        edgeBottomMm: 0.8,
        edgeLeftMm: 0.8,
        edgeRightMm: 2,
        grainDirection: 'none',
        quantity: 2,
      },
    ]);

    assert.equal(result.recipeGroups.length, 2);
    assert.equal(result.totalPartsPlaced, 4);
    assert.equal(result.totalSheets, 2);

    const oakSheet = result.sheets[0];
    assert.equal(oakSheet.placements[0].cutLengthMm, 2096); // 2100 - (2 + 2)
    assert.equal(oakSheet.placements[0].cutWidthMm, 493); // 497 - (2 + 2)
    assert.equal(oakSheet.placements[0].rotated90, false); // grain locked
    assert.equal(oakSheet.placements[0].stickerEdgeMap, '[T:2EB | B:2EB | L:2EB | R:2EB]');
    assert.ok(result.totalReusableOffcutAreaSqm > 0);
  });
});
