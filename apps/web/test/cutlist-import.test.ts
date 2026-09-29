import assert from 'node:assert/strict';
import test from 'node:test';
import { parse2DDrawingFile } from '../src/features/tools/cutlist-optimizer.ts';

test('JSON import preserves explicit panel dimensions and leaves room envelope unknown when absent', () => {
  const parsed = parse2DDrawingFile(JSON.stringify({ parts: [{ id: 'p1', name: 'Left shutter', lengthMm: 2100, widthMm: 450, thicknessMm: 18, quantity: 2 }] }), 'schedule.json');
  assert.equal(parsed.parts[0].lengthMm, 2100);
  assert.equal(parsed.parts[0].widthMm, 450);
  assert.equal(parsed.parts[0].quantity, 2);
  assert.equal(parsed.overallWidthMm, null);
  assert.equal(parsed.depthMm, null);
});

test('JSON import blocks absent and invalid panel dimensions instead of substituting defaults', () => {
  assert.throws(() => parse2DDrawingFile(JSON.stringify({ width: 2400, height: 2100, depth: 600 }), 'empty.json'), /No explicit panel records/);
  assert.throws(() => parse2DDrawingFile(JSON.stringify({ parts: [{ name: 'Shelf', widthMm: 400 }] }), 'missing-length.json'), /length must be provided/);
  assert.throws(() => parse2DDrawingFile(JSON.stringify({ parts: [{ name: 'Shelf', lengthMm: 0, widthMm: 400 }] }), 'zero-length.json'), /length must be provided/);
  assert.throws(() => parse2DDrawingFile('{"parts":[', 'broken.json'), /JSON panel schedule is malformed/);
});

test('CSV import reads header columns and rejects zero or missing dimensions', () => {
  const parsed = parse2DDrawingFile('Part ID,Part Name,Length (mm),Width (mm),Thickness (mm),Qty\nP-1,"Shelf, adjustable",800,450,18,2', 'panels.csv');
  assert.equal(parsed.parts[0].partInstanceId, 'P-1');
  assert.equal(parsed.parts[0].name, 'Shelf, adjustable');
  assert.equal(parsed.parts[0].quantity, 2);
  assert.throws(() => parse2DDrawingFile('Part,Length,Width\nShelf,0,450', 'bad.csv'), /length must be provided/);
  assert.throws(() => parse2DDrawingFile('Part,Length,Width\nShelf,,450', 'missing.csv'), /length must be provided/);
});

test('DXF import is rejected as a panel schedule and never creates a default cabinet', () => {
  assert.throws(() => parse2DDrawingFile('0\nSECTION\n2\nENTITIES\n', 'plan.dxf'), /DXF drawings are not panel schedules/);
});
