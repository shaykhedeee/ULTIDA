import test from 'node:test';
import assert from 'node:assert/strict';
import { compileOpeningInventoryLock } from '../src/opening-inventory-lock.js';

test('compileOpeningInventoryLock creates anti-hallucination inventory and solid wall lock', () => {
  const walls = [
    {
      id: 'W_NORTH',
      name: 'North Wall (Kitchen Modular Run)',
      lengthMm: 3600,
      openings: [], // Solid wall!
    },
    {
      id: 'W_EAST',
      name: 'East Wall',
      lengthMm: 3000,
      openings: [
        { type: 'window', widthMm: 1200, offsetMm: 900 },
      ],
    },
  ];

  const lock = compileOpeningInventoryLock(walls);

  assert.strictEqual(lock.wallSummaries.length, 2);
  assert.strictEqual(lock.wallSummaries[0].isSolidWall, true);
  assert.strictEqual(lock.wallSummaries[1].isSolidWall, false);

  assert.ok(lock.positiveInventoryClause.includes('ZERO windows, ZERO doors'));
  assert.ok(lock.positiveInventoryClause.includes('window (1200mm wide at offset 900mm)'));
  assert.ok(lock.negativeOpeningLock.includes('North Wall (Kitchen Modular Run)'));
});
