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
