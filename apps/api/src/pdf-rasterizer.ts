import { createCanvas } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** Renders page one without an external OS executable or hosted conversion service. */
export async function rasterizePdfPage(bytes: Uint8Array): Promise<Buffer> {
  if (bytes.byteLength > 40 * 1024 * 1024) throw new Error('PDF exceeds the 40 MB analysis limit.');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const root = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const task = getDocument({ data: Uint8Array.from(bytes),
    standardFontDataUrl: join(root, 'standard_fonts') + '/', cMapUrl: join(root, 'cmaps') + '/', cMapPacked: true,
    useSystemFonts: false, stopAtErrors: true, maxImageSize: 16_000_000 });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    if (![unscaled.width, unscaled.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('PDF page has invalid dimensions.');
    const viewport = page.getViewport({ scale: Math.min(180 / 72, 2400 / Math.max(unscaled.width, unscaled.height)) });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: canvas as any, canvasContext: canvas.getContext('2d') as any, viewport, background: '#ffffff' }).promise;
    return canvas.toBuffer('image/png');
  } finally { await task.destroy(); }
}
