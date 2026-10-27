import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { validateReferenceImage } from '../src/reference-image-validation.js';
test('reference uploads verify raster dimensions, actual MIME and exact size', async () => {
  const bytes = await sharp({ create: { width: 12, height: 16, channels: 3, background: '#aabbcc' } }).png().toBuffer();
  assert.deepEqual(await validateReferenceImage(bytes, 'image/png', bytes.length), { mimeType: 'image/png', width: 12, height: 16, fileSize: bytes.length });
  await assert.rejects(validateReferenceImage(bytes, 'image/jpeg', bytes.length));
  await assert.rejects(validateReferenceImage(bytes, 'image/png', 0));
  await assert.rejects(validateReferenceImage(Buffer.from('<svg/>'), 'image/png', 6));
  await assert.rejects(validateReferenceImage(Buffer.alloc(0), 'image/png', 0));
  const truncated = bytes.subarray(0, 62);
  assert.equal((await sharp(truncated).metadata()).width, 12);
  await assert.rejects(validateReferenceImage(truncated, 'image/png', truncated.length));
});
