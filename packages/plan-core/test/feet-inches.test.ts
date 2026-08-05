import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeetInchesToMm, formatDualDimension } from '../dist/index.js';

test('parseFeetInchesToMm parses 12\' 6" to 3810mm', () => {
  const result = parseFeetInchesToMm("12' 6\"");
  assert.strictEqual(result, 3810);
});

test('parseFeetInchesToMm parses 10\' to 3048mm', () => {
  const result = parseFeetInchesToMm("10'");
  assert.strictEqual(result, 3048);
});

test('parseFeetInchesToMm parses 6" to 152mm', () => {
  const result = parseFeetInchesToMm('6"');
  assert.strictEqual(result, 152);
});

test('parseFeetInchesToMm parses 12 ft 6 in to 3810mm', () => {
  const result = parseFeetInchesToMm('12 ft 6 in');
  assert.strictEqual(result, 3810);
});

test('formatDualDimension formats 3658mm into ftIn string', () => {
  const result = formatDualDimension(3658);
  assert.strictEqual(result.mm, 3658);
  assert.strictEqual(result.ftIn, '12\' 0"');
});
