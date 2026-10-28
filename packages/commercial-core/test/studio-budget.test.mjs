import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, calculateStudioBudget, DEFAULT_STUDIO_MILESTONES } from '../dist/index.js';

test('calculateQuote maintains backwards compatibility', () => {
  const lines = [
    { id: '1', description: 'Base cabinet', category: 'modular', quantity: 2, unit: 'nos', unitRateInr: 10000, labourInr: 1000 },
    { id: '2', description: 'Optional light', category: 'electrical', quantity: 1, unit: 'nos', unitRateInr: 5000, optional: true },
  ];
  const res = calculateQuote(lines, { discountInr: 1000, marginRate: 0.2, gstRate: 0.18 });
  assert.equal(res.subtotalInr, 21000); // 2 * 10000 + 1000 labour = 21000
  assert.equal(res.discountInr, 1000);
  assert.equal(res.marginInr, 4000); // 20000 * 0.2
  assert.equal(res.taxableInr, 24000); // 20000 + 4000
  assert.equal(res.gstInr, 4320); // 24000 * 0.18
  assert.equal(res.grandTotalInr, 28320);
});

test('calculateStudioBudget computes room and trade breakdowns with markups and milestones', () => {
  const lines = [
    {
      id: 'l1',
      roomId: 'room-kitchen',
      roomName: 'Modular Kitchen',
      tradeCategory: 'modular_joinery',
      description: 'Marine ply base cabinets with soft-close Ebco tandem boxes',
      quantity: 12,
      unit: 'rft',
      vendorCostUnitInr: 3500,
      markupPercent: 20, // 20% studio markup
    },
    {
      id: 'l2',
      roomId: 'room-kitchen',
      roomName: 'Modular Kitchen',
      tradeCategory: 'appliances_and_fixtures',
      description: 'Franke double bowl quartz sink with swan neck tap',
      quantity: 1,
      unit: 'set',
      vendorCostUnitInr: 15000,
      markupPercent: 15,
    },
    {
      id: 'l3',
      roomId: 'room-master-bed',
      roomName: 'Master Bedroom',
      tradeCategory: 'modular_joinery',
      description: 'Floor-to-ceiling 3-door sliding wardrobe with Merino laminate',
      quantity: 56,
      unit: 'sqft',
      vendorCostUnitInr: 1800,
      markupPercent: 25,
    },
    {
      id: 'l4',
      roomId: 'room-master-bed',
      roomName: 'Master Bedroom',
      tradeCategory: 'electrical_and_lighting',
      description: 'COB warm white spotlights & cove profile led',
      quantity: 1,
      unit: 'lumpsum',
      vendorCostUnitInr: 12000,
      markupPercent: 20,
      optional: true, // Should not count towards active total
    }
  ];

  const report = calculateStudioBudget(lines, { discountInr: 5000, gstRate: 0.18 });

  // Kitchen: 12 * 3500 = 42000 cost. Markup 20% = 50400 client.
  // Sink: 1 * 15000 = 15000 cost. Markup 15% = 17250 client.
  // Master bed wardrobe: 56 * 1800 = 100800 cost. Markup 25% = 126000 client.
  // Optional lighting excluded.
  const expectedVendorCost = 42000 + 15000 + 100800; // 157800
  const expectedClientSubtotal = 50400 + 17250 + 126000; // 193650
  assert.equal(report.activeLineCount, 3);
  assert.equal(report.vendorCostTotalInr, expectedVendorCost);
  assert.equal(report.clientSubtotalInr, expectedClientSubtotal);
  assert.equal(report.grossMarginInr, expectedClientSubtotal - expectedVendorCost); // 35850

  // Taxable: 193650 - 5000 = 188650
  assert.equal(report.taxableInr, 188650);
  assert.equal(report.gstInr, Math.round(188650 * 0.18 * 100) / 100); // 33957

  // Check room summaries
  assert.equal(report.roomSummaries.length, 2);
  const kitchen = report.roomSummaries.find(r => r.roomId === 'room-kitchen');
  assert.ok(kitchen);
  assert.equal(kitchen.itemCount, 2);
  assert.equal(kitchen.vendorCostInr, 57000);
  assert.equal(kitchen.clientSubtotalInr, 67650);

  // Check milestones
  assert.equal(report.milestones.length, 4);
  const totalMilestoneAmount = report.milestones.reduce((s, m) => s + m.amountInr, 0);
  assert.ok(Math.abs(totalMilestoneAmount - report.clientGrandTotalInr) < 1);
});
