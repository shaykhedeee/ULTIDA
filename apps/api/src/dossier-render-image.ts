import sharp from 'sharp';
import type { PDFDocument, PDFImage } from 'pdf-lib';

export interface NormalizedRenderImageBuffer {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
}

export async function normalizeDossierRenderImage(
  input: Buffer | Uint8Array,
): Promise<NormalizedRenderImageBuffer | null> {
  try {
    const image = sharp(Buffer.from(input), { animated: false, limitInputPixels: 64_000_000 });
    const metadata = await image.metadata();
    if (!metadata.format || !['png', 'jpeg', 'jpg', 'webp', 'avif', 'tiff', 'heif'].includes(metadata.format)) {
      return null;
    }
    if ((metadata.pages ?? 1) > 1) {
      return null;
    }
    const pngBuffer = await image.png().toBuffer();
    return {
      buffer: pngBuffer,
      mimeType: 'image/png',
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Normalizes static render image bytes (PNG, JPEG, WebP, AVIF, TIFF) so they
 * can be embedded into a PDFDocument safely. Rejects animated/multi-frame images
 * and unsupported formats.
 */
export async function embedNormalizedRenderImage(
  pdf: PDFDocument,
  bytes: Uint8Array,
): Promise<PDFImage> {
  // Fast path for PNG (89 50 4E 47) and JPEG (FF D8 FF)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return pdf.embedPng(bytes);
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return pdf.embedJpg(bytes);
  }

  // Static WebP / AVIF / TIFF normalization via sharp -> PNG
  const image = sharp(Buffer.from(bytes), { animated: false, limitInputPixels: 64_000_000 });
  const metadata = await image.metadata();
  if (!metadata.format || !['png', 'jpeg', 'jpg', 'webp', 'avif', 'tiff', 'heif'].includes(metadata.format)) {
    throw new Error(`UNSUPPORTED_RENDER_IMAGE_FORMAT: ${metadata.format ?? 'unknown'}`);
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new Error('ANIMATED_RENDER_IMAGE_NOT_SUPPORTED');
  }
  const normalizedPng = await image.png().toBuffer();
  return pdf.embedPng(new Uint8Array(normalizedPng));
}
