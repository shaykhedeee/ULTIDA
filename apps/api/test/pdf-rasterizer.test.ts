import test from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { rasterizePdfPage } from '../src/pdf-rasterizer.js';

test('rasterizes real PDF wall geometry without Poppler and preserves page orientation', async () => {
  const doc = new PDFDocument({ size: [400, 300], margin: 0 });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const done = new Promise<void>((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
  doc.lineWidth(5).rect(30, 30, 340, 240).stroke();
  doc.end(); await done;
  const raster = await rasterizePdfPage(Buffer.concat(chunks));
  const metadata = await sharp(raster).metadata();
  assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 1000); assert.equal(metadata.height, 750);
  const { data } = await sharp(raster).greyscale().raw().toBuffer({ resolveWithObject: true });
  assert.ok(data.filter(value => value < 80).length > 1000, 'Actual wall strokes must survive rendering');
  assert.ok(data[375 * 1000 + 500] > 240, 'Room interior remains blank, without synthetic geometry');
});

test('rejects malformed PDFs instead of inventing a plan', async () => {
  await assert.rejects(rasterizePdfPage(Buffer.from('not a PDF')));
});
