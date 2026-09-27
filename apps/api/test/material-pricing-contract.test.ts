import assert from 'node:assert/strict';
import test from 'node:test';
import { MaterialLibraryItemV1Schema } from '@ultida/contracts';

test('material library contract preserves a missing price unit as unverified', () => {
  const parsed = MaterialLibraryItemV1Schema.parse({ name: 'Sample laminate', code: 'LAM-01', category: 'laminate' });
  assert.equal(parsed.pricingUnit, undefined);
});

test('material library contract retains an explicitly selected pricing unit', () => {
  const parsed = MaterialLibraryItemV1Schema.parse({ name: 'Board', code: 'BOARD-01', category: 'laminate', unitCost: 3200, pricingUnit: 'sheet' });
  assert.equal(parsed.pricingUnit, 'sheet');
});
