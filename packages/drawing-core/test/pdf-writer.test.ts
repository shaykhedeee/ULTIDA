import test from 'node:test';
import assert from 'node:assert/strict';
import { PdfWriter, formatDualMm, parseHexColor } from '../src/pdf-writer.ts';

test('formatDualMm formats metric millimetres with imperial feet and fractional inches', () => {
  assert.equal(formatDualMm(2400), '2400 mm [7\' 10½"]');
  assert.equal(formatDualMm(1200), '1200 mm [3\' 11¼"]');
  assert.equal(formatDualMm(600), '600 mm [1\' 11⅝"]');
  assert.equal(formatDualMm(2100), '2100 mm [6\' 10⅝"]');
  assert.equal(formatDualMm(100), '100 mm [3⅞"]');
});

test('parseHexColor parses 3-digit and 6-digit hex color strings correctly', () => {
  const white = parseHexColor('#fff');
  assert.deepEqual(white, [1, 1, 1]);
  const black = parseHexColor('#000000');
  assert.deepEqual(black, [0, 0, 0]);
  const gold = parseHexColor('#c59c2d');
  assert.ok(gold[0] > 0.7 && gold[1] > 0.5);
});

test('PdfWriter generates a valid multi-page PDF 1.4 binary buffer', () => {
  const writer = new PdfWriter({ size: 'A4', layout: 'landscape' });
  // Sheet 1
  writer.rect(20, 20, 800, 550).lineWidth(1.5).strokeColor('#1c1917').stroke();
  writer.font('Helvetica-Bold').fontSize(16).fillColor('#c59c2d').text('ULTIDA ARCHITECTURAL STUDIO', 40, 40);
  writer.font('Helvetica').fontSize(10).fillColor('#334155').text('Master Sign-Off Dossier', 40, 65);
  writer.dash(3, { space: 2 }).line(40, 80, 800, 80).undash();

  // Table on Sheet 1
  writer.drawTable(
    40,
    100,
    ['ROOM / MODULE', 'SPECIFICATION', 'DIMENSIONS (MM / FT-IN)', 'STATUS'],
    [
      ['Master Bed Wardrobe', '18mm HDHMR + Royale Touche', formatDualMm(3300) + ' × ' + formatDualMm(2785), 'APPROVED'],
      ['Modular Kitchen Suite', 'BWP Marine Ply + Tinted Glass', formatDualMm(3600) + ' × ' + formatDualMm(2400), 'APPROVED'],
    ],
    [160, 220, 260, 100]
  );

  // Sheet 2
  writer.addPage({ size: 'A4', layout: 'landscape' });
  writer.rect(20, 20, 800, 550).lineWidth(1.5).strokeColor('#1c1917').stroke();
  writer.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917').text('SHEET 2: WALL ELEVATIONS', 40, 40);

  const buffer = writer.toBuffer();
  assert.ok(buffer.length > 500, 'Buffer should be non-empty and reasonably sized');
  const header = buffer.subarray(0, 8).toString('utf-8');
  assert.ok(header.startsWith('%PDF-1.4'), 'Header must be %PDF-1.4');

  const content = buffer.toString('utf-8');
  assert.ok(content.includes('/Type /Catalog'), 'Must contain Catalog object');
  assert.ok(content.includes('/Type /Pages'), 'Must contain Pages object');
  assert.ok(content.includes('/Count 2'), 'Must indicate 2 pages');
  assert.ok(content.includes('ULTIDA ARCHITECTURAL STUDIO'), 'Must include text payload');
  assert.ok(content.includes('xref'), 'Must contain xref table');
  assert.ok(content.includes('%%EOF'), 'Must end with %%EOF');
});
