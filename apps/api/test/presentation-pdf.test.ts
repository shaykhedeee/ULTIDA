import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildPresentationPdf } from '../src/presentation-pdf.js';

test('client presentation contains cover, saved image sheet and closing sheet in landscape', async () => {
  const image = await sharp({ create: { width: 640, height: 360, channels: 3, background: '#a5b18c' } }).png().toBuffer();
  const pdf = await buildPresentationPdf('Fixture residence', 'fixture-revision', [{ title: 'Wardrobe elevation', subtitle: 'Saved geometry · mm', image }]);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const content = pdf.toString('latin1');
  assert.match(content, /\/Count 3\b/);
  assert.match(content, /\/MediaBox \[0 0 960 540\]/);
  assert.match(content, /\/Subtype \/Image/);
  assert.ok(pdf.length > 2500);
});

test('presentation without images does not invent a render sheet', async () => {
  const pdf = await buildPresentationPdf('Empty fixture', 'fixture-revision', []);
  assert.match(pdf.toString('latin1'), /\/Count 2\b/);
});
