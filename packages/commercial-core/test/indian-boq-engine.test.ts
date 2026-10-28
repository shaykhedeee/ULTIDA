import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIndianGstBoq,
  exportTallyPrimeSalesVoucherXml,
  INDIAN_INTERIOR_HSN_REGISTRY,
} from '../src/indian-boq-engine.js';

test('calculateIndianGstBoq calculates intrastate CGST + SGST splits and HSN assignments', () => {
  const items = [
    { id: '1', description: 'Modular Kitchen Base & Wall Cabinets', taxableAmountInr: 250000, hsnKey: '94034000' },
    { id: '2', description: 'Master Bedroom 3-Door Sliding Wardrobe', taxableAmountInr: 180000, hsnKey: '94035000' },
    { id: '3', description: 'Ebco / Hettich Soft Close Hardware', taxableAmountInr: 45000, hsnKey: '83024200' },
  ];

  const result = calculateIndianGstBoq(items, { isInterState: false });

  assert.strictEqual(result.taxableTotalInr, 475000);
  // 18% total: 9% CGST (42,750) + 9% SGST (42,750) = 85,500
  assert.strictEqual(result.cgstTotalInr, 42750);
  assert.strictEqual(result.sgstTotalInr, 42750);
  assert.strictEqual(result.igstTotalInr, 0);
  assert.strictEqual(result.totalGstInr, 85500);
  assert.strictEqual(result.grandTotalWithGstInr, 560500);

  assert.strictEqual(result.items.length, 3);
  assert.strictEqual(result.items[0].hsnCode, '9403.40.00');
  assert.strictEqual(result.items[0].cgstAmountInr, 22500);
});

test('calculateIndianGstBoq calculates interstate IGST 18%', () => {
  const items = [
    { id: '1', description: 'Turnkey Interior Works Package', taxableAmountInr: 1000000, hsnKey: '995476' },
  ];

  const result = calculateIndianGstBoq(items, { isInterState: true });

  assert.strictEqual(result.taxableTotalInr, 1000000);
  assert.strictEqual(result.cgstTotalInr, 0);
  assert.strictEqual(result.sgstTotalInr, 0);
  assert.strictEqual(result.igstTotalInr, 180000);
  assert.strictEqual(result.grandTotalWithGstInr, 1180000);
});

test('exportTallyPrimeSalesVoucherXml generates compliant XML for TallyPrime import', () => {
  const summary = calculateIndianGstBoq([
    { id: '1', description: 'Modular Kitchen Cabinets', taxableAmountInr: 100000, hsnKey: '94034000' },
  ]);

  const xml = exportTallyPrimeSalesVoucherXml(summary, {
    voucherNo: 'INV/2026/001',
    dateIso: '2026-10-28',
    partyName: 'Mr. Rajesh Sharma',
  });

  assert.ok(xml.includes('<VOUCHER VCHTYPE="Sales" ACTION="Create">'));
  assert.ok(xml.includes('<VOUCHERNUMBER>INV/2026/001</VOUCHERNUMBER>'));
  assert.ok(xml.includes('<PARTYLEDGERNAME>Mr. Rajesh Sharma</PARTYLEDGERNAME>'));
  assert.ok(xml.includes('<LEDGERNAME>Output CGST 9%</LEDGERNAME>'));
  assert.ok(xml.includes('<LEDGERNAME>Output SGST 9%</LEDGERNAME>'));
  assert.ok(xml.includes('<AMOUNT>100000.00</AMOUNT>'));
});
