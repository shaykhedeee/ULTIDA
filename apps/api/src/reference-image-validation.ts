import sharp from 'sharp';
export async function validateReferenceImage(buffer: Buffer, declaredMime: unknown, declaredSize: unknown) {
  if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) throw new Error('Reference images must be between 1 byte and 25 MB.');
  if (typeof declaredSize !== 'number' || !Number.isSafeInteger(declaredSize) || declaredSize !== buffer.length) throw new Error('Uploaded image size does not match the declared file size.');
  const metadata = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
  const mime = ({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as Record<string, string>)[metadata.format ?? ''];
  if (!mime || mime !== declaredMime || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error('Use a single PNG, JPEG or WebP image with matching file type.');
  await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'warning' }).raw().toBuffer();
  return { mimeType: mime, width: metadata.width, height: metadata.height, fileSize: buffer.length };
}
