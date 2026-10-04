import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVendorPurchaseOrders, calculateQuote } from '../src/index.ts';

test('calculateQuote calculates taxable, GST, and totals accurately', () => {
  const quote = calculateQuote(
    [
      { id: '1', description: 'Wardrobe Carcass', category: 'Joinery', quantity: 2, unit: 'units', unitRateInr: 15000, labourInr: 3000 },
      { id: '2', description: 'LED Profile', category: 'Electrical', quantity: 10, unit: 'm', unitRateInr: 500 },
    ],
    { marginRate: 0.15, gstRate: 0.18 }
  );

  assert.equal(quote.subtotalInr, 38000);
  assert.equal(quote.marginInr, 5700);
  assert.equal(quote.taxableInr, 43700);
  assert.equal(quote.gstInr, 7866);
  assert.equal(quote.grandTotalInr, 51566);
});

test('generateVendorPurchaseOrders produces 4 itemized vendor purchase orders', () => {
  const bundle = generateVendorPurchaseOrders({
    projectId: 'villa-5bhk-green-acres',
    projectName: 'Villa 5BHK',
    parts: [
      {
        id: 'p1',
        lengthMm: 2400,
        widthMm: 580,
        thicknessMm: 18,
        materialCode: 'bwp_ply',
        quantity: 4,
        externalLaminate: 'LAM-MERINO-WALNUT',
        internalLiner: 'LINER-OFFWHITE',
        edging: 'all_sides',
        partName: 'Wardrobe Gable',
      },
      {
        id: 'p2',
        lengthMm: 900,
        widthMm: 560,
        thicknessMm: 18,
        materialCode: 'bwp_ply',
        quantity: 8,
        externalLaminate: 'LAM-MERINO-WALNUT',
        internalLiner: 'LINER-OFFWHITE',
        edging: 'front_only',
        partName: 'Wardrobe Fixed Shelf',
      },
      {
        id: 'p3',
        lengthMm: 2100,
        widthMm: 450,
        thicknessMm: 18,
        materialCode: 'hdhmr',
        quantity: 4,
        externalLaminate: 'LAM-MATT-CHARCOAL',
        internalLiner: 'LINER-OFFWHITE',
        edging: 'all_sides',
        partName: 'Wardrobe Shutter Door',
      },
      {
        id: 'p4',
        lengthMm: 2400,
        widthMm: 900,
        thicknessMm: 6,
        materialCode: 'bwp_ply',
        quantity: 2,
        externalLaminate: 'LINER-OFFWHITE',
        internalLiner: 'LINER-OFFWHITE',
        edging: 'none',
        partName: 'Backing Panel',
      },
    ],
  });

  assert.equal(bundle.purchaseOrders.length, 4);

  // 1. Board PO
  const boardPO = bundle.purchaseOrders.find((po) => po.vendorCategory === 'board_supplier')!;
  assert.ok(boardPO);
  assert.ok(boardPO.items.length >= 2);
  assert.ok(boardPO.totalQuantity > 0);
  assert.ok(boardPO.estimatedGrandTotalInr > 0);

  // 2. Laminate PO
  const lamPO = bundle.purchaseOrders.find((po) => po.vendorCategory === 'laminate_distributor')!;
  assert.ok(lamPO);
  assert.ok(lamPO.items.some((it) => it.description.includes('Walnut') || it.description.includes('LAM-MERINO-WALNUT')));
  assert.ok(lamPO.items.some((it) => it.description.includes('Balancing Liner')));

  // 3. Edge Banding PO
  const edgePO = bundle.purchaseOrders.find((po) => po.vendorCategory === 'edgeband_vendor')!;
  assert.ok(edgePO);
  assert.ok(edgePO.items.length === 2);
  assert.ok(edgePO.totalQuantity >= 100);

  // 4. Hardware PO
  const hwPO = bundle.purchaseOrders.find((po) => po.vendorCategory === 'hardware_distributor')!;
  assert.ok(hwPO);
  assert.ok(hwPO.items.length >= 3);
  assert.ok(bundle.summary.estimatedTotalInr > 0);
});
