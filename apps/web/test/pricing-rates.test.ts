import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import {
  DEFAULT_PRICING_RATES,
  getPricingRates,
  savePricingRates,
  resetPricingRates,
  mmToSqft,
  estimateWardrobeUnitCost,
  type PricingRateCard,
} from '../src/lib/pricing-rates.ts';

// Mock localStorage for node test runner
const memoryStorage = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, val: string) => memoryStorage.set(key, val),
    removeItem: (key: string) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear(),
  },
  dispatchEvent: () => true,
};

test('Pricing Rate Card Store: provides authoritative default pricing rates', () => {
  memoryStorage.clear();
  const rates = getPricingRates();
  assert.equal(rates.carcassMaterials.hdhmr, 95);
  assert.equal(rates.carcassMaterials.marineBwp, 125);
  assert.equal(rates.shutterFinishes.glossAcrylic, 180);
  assert.equal(rates.shutterFinishes.matteLaminate, 85);
  assert.equal(rates.commercial.gstRatePercent, 18);
  assert.equal(rates.commercial.studioMarkupPercent, 15);
});

test('Pricing Rate Card Store: persists and restores custom rates from localStorage', () => {
  memoryStorage.clear();
  const custom: PricingRateCard = {
    ...DEFAULT_PRICING_RATES,
    carcassMaterials: {
      ...DEFAULT_PRICING_RATES.carcassMaterials,
      hdhmr: 110,
    },
    commercial: {
      studioMarkupPercent: 20,
      gstRatePercent: 18,
    },
  };

  savePricingRates(custom);
  const restored = getPricingRates();
  assert.equal(restored.carcassMaterials.hdhmr, 110);
  assert.equal(restored.commercial.studioMarkupPercent, 20);
});

test('Pricing Rate Card Store: resets rates to factory defaults on resetPricingRates', () => {
  memoryStorage.clear();
  const custom: PricingRateCard = {
    ...DEFAULT_PRICING_RATES,
    carcassMaterials: {
      ...DEFAULT_PRICING_RATES.carcassMaterials,
      hdhmr: 250,
    },
  };
  savePricingRates(custom);
  assert.equal(getPricingRates().carcassMaterials.hdhmr, 250);

  const reset = resetPricingRates();
  assert.equal(reset.carcassMaterials.hdhmr, 95);
  assert.equal(getPricingRates().carcassMaterials.hdhmr, 95);
});

test('Pricing Calculations: correctly calculates square footage from millimetres', () => {
  // 1000mm x 1000mm = 1m² = ~10.7639 sq.ft
  const sqft = mmToSqft(1000, 1000);
  assert.equal(Math.round(sqft * 10) / 10, 10.8);

  // Standard sheet: 2440 x 1220 = 2.9768 m² = ~32.04 sq.ft
  const sheetSqft = mmToSqft(2440, 1220);
  assert.equal(Math.round(sheetSqft), 32);
});

test('Pricing Calculations: accurately computes wardrobe unit estimates with taxes and margins', () => {
  const estimate = estimateWardrobeUnitCost(2400, 2400, 600, 'matteLaminate', 'hdhmr');
  assert.ok(estimate.carcassCost > 0);
  assert.ok(estimate.shutterCost > 0);
  assert.ok(estimate.hardwareCost > 0);
  assert.ok(estimate.laborCost > 0);
  assert.equal(estimate.subtotal, estimate.carcassCost + estimate.shutterCost + estimate.hardwareCost + estimate.laborCost);
  assert.equal(estimate.markup, Math.round((estimate.subtotal * 15) / 100));
  assert.equal(estimate.grandTotal, estimate.subtotal + estimate.markup + estimate.cgst + estimate.sgst);
});

test('Pricing Calculations: accurately computes live cutlist cost rollup from sheet count, edge-banding, and hardware BOM', async () => {
  const { calculateCutlistCostRollup } = await import('../src/lib/pricing-rates.ts');
  const rollup = calculateCutlistCostRollup({
    sheetCount: 5,
    edgeBandingLinearMeters: 45.5,
    hardwareItems: [
      { name: 'Soft-Close Hinge', category: 'hinge', quantity: 8 },
      { name: 'Tandembox Drawer Runner Set', category: 'slide', quantity: 2 },
    ],
  });

  assert.equal(rollup.sheetCount, 5);
  assert.ok(rollup.totalSqft > 0, 'Total sq.ft must be positive');
  assert.ok(rollup.carcassBoardCost > 0, 'Carcass board cost must be calculated');
  assert.ok(rollup.edgeBandingCost > 0, 'Edge banding cost must be calculated');
  assert.ok(rollup.hardwareBOMCost > 0, 'Hardware BOM cost must be calculated');
  assert.ok(rollup.laborSubtotal > 0, 'Labor subtotal must be calculated');
  assert.equal(rollup.manufacturingSubtotal, rollup.boardCostSubtotal + rollup.edgeBandingCost + rollup.hardwareBOMCost + rollup.laborSubtotal);
  assert.equal(rollup.taxableTotal, rollup.manufacturingSubtotal + rollup.studioMarkup);
  assert.equal(rollup.estimatedGrandTotal, rollup.taxableTotal + rollup.totalGst);
  assert.ok(rollup.costPerSqft > 0, 'Cost per sq.ft must be positive');
  assert.equal(rollup.pricingVerification.verified, false, 'rate-card-only totals are estimates, not supplier-verified pricing');
  assert.equal(rollup.pricingWarnings.length, 2);
  assert.ok(rollup.pricingWarnings.every((warning) => /rate-card estimate/i.test(warning)));
});

test('Pricing Safety Guard: normalizeMaterialUnitCost rejects unspecified unitCost as sheet price and requires explicit unit', async () => {
  const { normalizeMaterialUnitCost, calculateCutlistCostRollup } = await import('../src/lib/pricing-rates.ts');

  // 1. Explicit 'sqft' rate works directly
  const sqftNorm = normalizeMaterialUnitCost({ name: 'Action TESA HDHMR', unitCost: 95, pricingUnit: 'sqft' });
  assert.equal(sqftNorm.isValid, true);
  assert.equal(sqftNorm.ratePerSqft, 95);
  assert.ok(sqftNorm.ratePerSheet > 3000, 'Sheet rate should be 95 * ~32 sqft');

  // 2. Explicit 'sheet' rate converts to rate per sq.ft
  const sheetNorm = normalizeMaterialUnitCost({ name: 'Marine Ply 8x4', unitCost: 3200, pricingUnit: 'sheet' }, 2440, 1220);
  assert.equal(sheetNorm.isValid, true);
  assert.equal(sheetNorm.ratePerSheet, 3200);
  // ~3200 / 32.04 = ~99.87 / sq.ft
  assert.ok(sheetNorm.ratePerSqft >= 99 && sheetNorm.ratePerSqft <= 101);

  // 3. Unspecified pricing unit is flagged as invalid and never assumed to be sheet price!
  const ambiguous = normalizeMaterialUnitCost({ name: 'Mystery Laminate', unitCost: 1800, pricingUnit: null });
  assert.equal(ambiguous.isValid, false);
  assert.match(ambiguous.warning ?? '', /unspecified pricing unit/);
  assert.match(ambiguous.warning ?? '', /cannot safely be treated as a price per sheet/);

  // 4. Rollup surfaces warnings when unverified pricing units are supplied
  const rollupWithWarning = calculateCutlistCostRollup({
    sheetCount: 4,
    edgeBandingLinearMeters: 20,
    carcassMaterialCost: { name: 'Ambiguous Ply', unitCost: 2400, pricingUnit: undefined },
  });
  assert.equal(rollupWithWarning.pricingVerification.verified, false);
  assert.equal(rollupWithWarning.pricingWarnings.length, 2);
  assert.ok(rollupWithWarning.pricingWarnings.some((warning) => /cannot safely be treated as a price per sheet/.test(warning)));
});

test('Pricing Verification: supplier material costs flow through only with explicit area units', async () => {
  const { calculateCutlistCostRollup } = await import('../src/lib/pricing-rates.ts');
  const rollup = calculateCutlistCostRollup({
    sheetCount: 2,
    edgeBandingLinearMeters: 0,
    carcassMaterialCost: { name: 'Board', unitCost: 3200, pricingUnit: 'sheet' },
    shutterFinishCost: { name: 'Laminate', unitCost: 95, pricingUnit: 'sqft' },
  });
  assert.equal(rollup.pricingVerification.verified, true);
  assert.deepEqual(rollup.pricingWarnings, []);
});

