import test from 'node:test';
import assert from 'node:assert/strict';
import { areDesignInputsIdentical, isRoomSaveContentIdentical } from '../src/room-save-content.js';
import { normalizeDossierRenderImage } from '../src/dossier-render-image.js';
import { enqueueRoomSave } from '../../web/src/features/spaces/room-save-queue.ts';
import { curateUniqueReferences, MAX_CURATED_REFERENCES } from '../../web/src/components/library/curate-references.ts';
import sharp from 'sharp';

test('room-save-content detects content-identical room saves regardless of key order or benign whitespace', () => {
  const existing = {
    name: 'Master Bedroom',
    roomType: 'master_bedroom',
    ceilingHeightMm: 2850,
    requiredFurniture: ['bed', 'wardrobe'],
    wallRoles: { north: 'wardrobe', east: 'window' },
  };
  const incomingSame = {
    roomType: 'master_bedroom',
    name: 'Master Bedroom ',
    ceilingHeightMm: 2850,
    requiredFurniture: ['bed', 'wardrobe'],
    wallRoles: { east: 'window', north: 'wardrobe' },
  };
  const incomingChanged = {
    ...incomingSame,
    ceilingHeightMm: 3000,
  };

  assert.equal(isRoomSaveContentIdentical(existing, incomingSame), true);
  assert.equal(isRoomSaveContentIdentical(existing, incomingChanged), false);

  assert.equal(
    areDesignInputsIdentical(
      { compositionSchedules: [{ wallId: 'w1', bays: [600, 600] }], floorSurfaces: [] },
      { floorSurfaces: [], compositionSchedules: [{ bays: [600, 600], wallId: 'w1' }] },
    ),
    true,
  );
});

test('enqueueRoomSave serializes rapid saves per room ID so responses never overlap out of order', async () => {
  const order: string[] = [];
  const p1 = enqueueRoomSave('room-a', async () => {
    order.push('start-1');
    await new Promise((r) => setTimeout(r, 30));
    order.push('end-1');
    return 1;
  });
  const p2 = enqueueRoomSave('room-a', async () => {
    order.push('start-2');
    await new Promise((r) => setTimeout(r, 5));
    order.push('end-2');
    return 2;
  });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, 1);
  assert.equal(r2, 2);
  assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2']);
});

test('curateUniqueReferences deduplicates by hash and normalized path and caps at 24', () => {
  const raw = Array.from({ length: 40 }, (_, idx) => ({
    id: `ref-${idx}`,
    title: `Ref ${idx}`,
    sourcePath: `/vault/img-${idx % 30}.png`,
    sha256: `hash-${idx % 30}`,
  }));
  const curated = curateUniqueReferences(raw);
  assert.equal(curated.length, MAX_CURATED_REFERENCES);
});

test('normalizeDossierRenderImage converts static WebP into PDFKit-embeddable PNG', async () => {
  const webpBuffer = await sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 197, g: 156, b: 45 } },
  })
    .webp()
    .toBuffer();

  const normalized = await normalizeDossierRenderImage(webpBuffer);
  assert.ok(normalized, 'Expected WebP render buffer to normalize cleanly');
  assert.equal(normalized.mimeType, 'image/png');
  assert.equal(normalized.width, 32);
  assert.equal(normalized.height, 24);
  assert.ok(normalized.buffer.length > 0);
});
