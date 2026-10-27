import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFIED_HARDWARE_REGISTRY,
  validateHardwareCompatibility,
  recommendVerifiedHardwareForModule,
  BARE_BONES_FINISH_FAMILIES,
  VENDOR_APPROVED_LAMINATES,
  IKEA_INDIA_RETAIL_CATALOG,
  computePreMillCutDimensions,
  assertRetailIsNotCutlistPart,
  verifySupplierAssetRedistribution,
  solveEqualShutterWallFit,
  proposeModularRuns,
  runAiManufacturingPreflight,
  buildUnderCabinetLedDetail,
} from '../src/index.js';

describe('ULTIDA v4.0 Catalog, Hardware, Wall-Divider & Preflight Intelligence', () => {
  it('validates Ebco E-Soft Linear Hinge 3D (105°, Ø35mm cup, 14–22mm shutter thickness, ≤600mm width)', () => {
    assert.ok(VERIFIED_HARDWARE_REGISTRY.length >= 10);

    // Valid 18mm × 500mm × 2100mm wardrobe shutter
    const valid = validateHardwareCompatibility(
      {
        shutterThicknessMm: 18,
        shutterWidthMm: 500,
        shutterHeightMm: 2100,
        internalCarcassDepthMm: 560,
      },
      'ebco-esoft-linear-hinge-3d-105',
    );
    assert.equal(valid.compatible, true);
    assert.equal(valid.recommendedHingeCountPerShutter, 4);

    // Rejects 12mm thin shutter (<14mm) and 25mm thick shutter (>22mm)
    const tooThin = validateHardwareCompatibility(
      {
        shutterThicknessMm: 12,
        shutterWidthMm: 450,
        shutterHeightMm: 720,
        internalCarcassDepthMm: 550,
      },
      'ebco-esoft-linear-hinge-3d-105',
    );
    assert.equal(tooThin.compatible, false);
    assert.ok(tooThin.issues.some((i) => i.code === 'SHUTTER_TOO_THIN'));

    const tooThickAndWide = validateHardwareCompatibility(
      {
        shutterThicknessMm: 25,
        shutterWidthMm: 750,
        shutterHeightMm: 2100,
        internalCarcassDepthMm: 560,
      },
      'ebco-esoft-linear-hinge-3d-105',
    );
    assert.equal(tooThickAndWide.compatible, false);
    assert.ok(tooThickAndWide.issues.some((i) => i.code === 'SHUTTER_TOO_THICK'));
    assert.ok(
      tooThickAndWide.issues.some((i) => i.code === 'SHUTTER_WIDTH_EXCEEDS_HINGE_LIMIT'),
    );
  });

  it('validates Hettich Quadro V6 Silent System internal carcass depth & load ratings', () => {
    const shallowCarcass = validateHardwareCompatibility(
      {
        moduleCategory: 'drawer_unit',
        shutterThicknessMm: 18,
        shutterWidthMm: 600,
        shutterHeightMm: 200,
        internalCarcassDepthMm: 480,
        expectedDrawerLoadKg: 25,
      },
      'hettich-quadro-v6-500-silent',
    );
    assert.equal(shallowCarcass.compatible, false);
    assert.ok(
      shallowCarcass.issues.some((i) => i.code === 'CARCASS_DEPTH_INSUFFICIENT_FOR_RUNNER'),
    );

    const rec = recommendVerifiedHardwareForModule({
      moduleCategory: 'drawer_unit',
      shutterThicknessMm: 18,
      shutterWidthMm: 600,
      shutterHeightMm: 200,
      internalCarcassDepthMm: 480,
      expectedDrawerLoadKg: 25,
    });
    assert.equal(rec.primaryFitting.id, 'hettich-quadro-v6-450-silent');
    assert.equal(rec.validation.compatible, true);
  });

  it('enforces the 8 Bare-Bones Finish Families, Pre-Mill Edge Deduction, and IKEA Retail Cutlist Guardrail', () => {
    assert.equal(BARE_BONES_FINISH_FAMILIES.length, 8);
    assert.ok(
      VENDOR_APPROVED_LAMINATES.some((item) => item.skuCode === '14149-RS' && item.brand === 'Merino'),
    );
    assert.equal(IKEA_INDIA_RETAIL_CATALOG.length, 9);

    // 720 × 497mm finished shutter with 2mm PVC on all 4 edges -> 716 × 493mm pre-mill cut
    const cut = computePreMillCutDimensions({
      finishedLengthMm: 720,
      finishedWidthMm: 497,
      edgeTopMm: 2,
      edgeBottomMm: 2,
      edgeLeftMm: 2,
      edgeRightMm: 2,
    });
    assert.equal(cut.preMillCutLengthMm, 716);
    assert.equal(cut.preMillCutWidthMm, 493);
    assert.equal(cut.stickerEdgeMap, '[T:2EB | B:2EB | L:2EB | R:2EB]');

    // Retail guardrail must block IKEA SKUs from generating raw plywood cutlists
    const billy = IKEA_INDIA_RETAIL_CATALOG[0];
    assert.throws(() => assertRetailIsNotCutlistPart(billy), /ULTIDA_RETAIL_CUTLIST_GUARDRAIL/);

    // Supplier asset rights check
    const rawCadCheck = verifySupplierAssetRedistribution({
      supplierName: 'Hettich',
      assetType: 'raw_vendor_cad_or_scan',
      hasExplicitWrittenLicense: false,
    });
    assert.equal(rawCadCheck.allowed, false);
  });

  it('solves 2600mm wall equal-shutter division and generates 3 constrained modular run options', () => {
    const withFillers = solveEqualShutterWallFit({
      wallWidthMm: 2600,
      totalHeightMm: 2700,
      depthMm: 600,
      leftScribingFillerMm: 50,
      rightScribingFillerMm: 50,
    });
    assert.equal(withFillers.equalShutterCount, 5);
    assert.equal(withFillers.nominalShutterWidthMm, 500);
    assert.equal(withFillers.finishedShutterWidthMm, 497);
    assert.equal(withFillers.lowerUnitHeightMm, 2100);
    assert.equal(withFillers.topLoftHeightMm, 600);
    assert.equal(withFillers.carcassBays.length, 3); // 1000mm 2-door + 1000mm 2-door + 500mm 1-door
    assert.equal(withFillers.engineeringCheckPassed, true);

    const zeroFiller = solveEqualShutterWallFit({
      wallWidthMm: 2600,
      totalHeightMm: 2100,
      depthMm: 600,
      leftScribingFillerMm: 0,
      rightScribingFillerMm: 0,
    });
    assert.equal(zeroFiller.equalShutterCount, 5);
    assert.equal(zeroFiller.nominalShutterWidthMm, 520);
    assert.equal(zeroFiller.finishedShutterWidthMm, 517);

    const withCurvedDisplay = solveEqualShutterWallFit({
      wallWidthMm: 2600,
      totalHeightMm: 2700,
      depthMm: 600,
      leftScribingFillerMm: 50,
      rightScribingFillerMm: 0,
      openDisplayEndShelfWidthMm: 350,
    });
    assert.equal(withCurvedDisplay.equalShutterCount, 4);
    assert.equal(withCurvedDisplay.nominalShutterWidthMm, 550);
    assert.equal(withCurvedDisplay.carcassBays.length, 3); // 1100 + 1100 + 350 curved display

    const wardrobeRuns = proposeModularRuns({
      wallWidthMm: 2600,
      wallHeightMm: 2700,
      roomType: 'wardrobe',
    });
    assert.equal(wardrobeRuns.length, 3);
  });

  it('runs AI manufacturing preflight and builds the 5-step Under-Cabinet LED Execution Schedule', () => {
    const preflight = runAiManufacturingPreflight([
      {
        id: 'm1',
        title: '800mm Single-Door Base Unit',
        category: 'base',
        widthMm: 800,
        heightMm: 750,
        depthMm: 600,
        shutterCount: 1,
        isCornerAdjacent: true,
        hasCornerScribingFiller: false,
      },
      {
        id: 'm2',
        title: '900mm Overhead Wall Unit',
        category: 'wall',
        widthMm: 900,
        heightMm: 720,
        depthMm: 350,
        shutterCount: 2,
        hasUnderCabinetLedStrip: true,
        hasConcealedLedDriverCavity: false,
      },
    ]);

    assert.equal(preflight.factoryReady, false);
    assert.equal(preflight.blockingCount, 2);
    assert.equal(preflight.warningCount, 1);
    assert.equal(preflight.normalizedModules[0].shutterCount, 2);
    assert.equal(preflight.normalizedModules[0].hasCornerScribingFiller, true);
    assert.equal(preflight.normalizedModules[1].ledGrooveWidthMm, 18);
    assert.equal(preflight.normalizedModules[1].ledGrooveDepthMm, 8);

    const ledDetail = buildUnderCabinetLedDetail({ wallRunWidthMm: 2700 });
    assert.equal(ledDetail.cncGrooveWidthMm, 18);
    assert.equal(ledDetail.cncGrooveDepthMm, 8);
    assert.equal(ledDetail.frontSetbackMm, 60);
    assert.equal(ledDetail.wallPointElevationFflMm, 2050);
    assert.equal(ledDetail.switchElevationFflMm, 1050);
    assert.equal(ledDetail.steps.length, 5);
  });
});
