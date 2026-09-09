import assert from 'node:assert/strict';
import test from 'node:test';
import { IndianModularCatalog, validatePlacement, RoomTypeSchema, listCatalog } from '../dist/index.js';

function mmToFeetInches(mm: number): string {
  const totalInches = Math.round(mm / 25.4);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

function sqmToSqft(sqm: number): number {
  return Math.round(sqm * 10.7639);
}

function inferRoomType(rawType?: unknown, roomName?: unknown): string {
  const supplied = String(rawType ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const valid = ['kitchen', 'living', 'bedroom', 'master_bedroom', 'kids_bedroom', 'bathroom', 'dining', 'study', 'pooja', 'utility', 'foyer', 'balcony', 'parking', 'store'];
  if (supplied && supplied !== 'other' && valid.includes(supplied)) return supplied;
  const label = `${rawType ?? ''} ${roomName ?? ''}`.toLowerCase();
  if (/master|m\.?\s*bed/.test(label)) return 'master_bedroom';
  if (/kids?|child|c\.?\s*bed/.test(label)) return 'kids_bedroom';
  if (/bed(room)?/.test(label)) return 'bedroom';
  if (/open\s*kitchen|kitchen|pantry/.test(label)) return 'kitchen';
  if (/living|drawing|lounge|hall/.test(label)) return 'living';
  if (/dining/.test(label)) return 'dining';
  if (/toilet|bath|washroom/.test(label)) return 'bathroom';
  if (/pooja|prayer/.test(label)) return 'pooja';
  if (/utility|laundry/.test(label)) return 'utility';
  if (/study|office/.test(label)) return 'study';
  if (/foyer|entry|lobby/.test(label)) return 'foyer';
  if (/balcony|terrace/.test(label)) return 'balcony';
  return 'living';
}

test('Room type inference maps unclassified or database room_type to valid design rooms', () => {
  assert.equal(inferRoomType('other', 'Living room'), 'living');
  assert.equal(inferRoomType(null, 'Master Bedroom'), 'master_bedroom');
  assert.equal(inferRoomType(undefined, 'Kids Bed'), 'kids_bedroom');
  assert.equal(inferRoomType('other', 'Open Kitchen & Pantry'), 'kitchen');
  assert.equal(inferRoomType('other', 'Formal Dining Area'), 'dining');
  assert.equal(inferRoomType('other', 'Attached Bath'), 'bathroom');
  assert.equal(inferRoomType('other', 'Pooja Room'), 'pooja');
  assert.equal(inferRoomType('other', 'Home Office / Study'), 'study');
  assert.equal(inferRoomType('other', 'Main Entry Foyer'), 'foyer');
});

test('Every module in IndianModularCatalog validates placement in its assigned room with 1200mm clearance', () => {
  assert.ok(IndianModularCatalog.length >= 25, 'Catalog should contain comprehensive modules');
  for (const module of IndianModularCatalog) {
    for (const room of module.roomTypes) {
      const result = validatePlacement(module, room, Math.max(1200, module.minClearanceMm));
      assert.equal(result.valid, true, `Module ${module.id} failed in assigned room ${room}: ${result.issues.join(', ')}`);
    }
  }
});

test('Every module in IndianModularCatalog allows placement in other without blocking error', () => {
  for (const module of IndianModularCatalog) {
    const result = validatePlacement(module, 'other', Math.max(1200, module.minClearanceMm));
    assert.equal(result.valid, true, `Module ${module.id} failed in other: ${result.issues.join(', ')}`);
  }
});

test('Dual unit conversions produce accurate architectural imperial and metric values', () => {
  assert.equal(mmToFeetInches(9140), "30'0\"");
  assert.equal(mmToFeetInches(4200), "13'9\"");
  assert.equal(mmToFeetInches(2400), "7'10\"");
  assert.equal(mmToFeetInches(600), "2'0\"");
  assert.equal(sqmToSqft((9140 * 4200) / 1e6), 413);
  assert.equal(sqmToSqft(12), 129);
});

test('GLB metadata validator correctly verifies dimensions, poly limits, and storage conventions', async () => {
  const { validateGlbModelMetadata, buildGlbStoragePath, generateSignedGlbUrl } = await import('../dist/index.js');

  const validGlb = validateGlbModelMetadata({
    declaredDimensionsMm: { width: 600, depth: 600, height: 750 },
    boundingBoxMm: { width: 601, depth: 599.5, height: 751 },
    polyCount: 12500,
    materialSlotNames: ['carcass', 'shutter', 'hardware'],
  });
  assert.equal(validGlb.valid, true);
  assert.equal(validGlb.lodTier, 'lod1');

  const oversizedPolys = validateGlbModelMetadata({
    declaredDimensionsMm: { width: 600, depth: 600, height: 750 },
    boundingBoxMm: { width: 600, depth: 600, height: 750 },
    polyCount: 85000,
    materialSlotNames: ['carcass', 'shutter'],
  });
  assert.equal(oversizedPolys.valid, false);
  assert.ok(oversizedPolys.errors[0].includes('exceeds maximum allowed threshold'));

  const storageKey = buildGlbStoragePath('org-123', 'mod-wardrobe', 'v1');
  assert.equal(storageKey, 'catalog/org-123/mod-wardrobe/v1/model.glb');

  const signedUrl = generateSignedGlbUrl(storageKey, 60);
  assert.ok(signedUrl.includes('catalog/org-123/mod-wardrobe/v1/model.glb'));
  assert.ok(signedUrl.includes('signed=true'));
});

test('W06 panel schedule generator outputs certified panels with System 32 boring', async () => {
  const { generateW06PanelSchedule, IndianModularCatalog } = await import('../dist/index.js');
  const base600 = IndianModularCatalog.find((m) => m.id === 'kit-base-600')!;
  assert.ok(base600);

  const panels = generateW06PanelSchedule(base600);
  assert.ok(panels.length >= 5, 'Base module must have gables, base, top, back, and shutters');

  const leftGable = panels.find((p) => p.partId.includes('GBL-L'));
  assert.ok(leftGable);
  assert.equal(leftGable.system32Boring, true);
  assert.equal(leftGable.thicknessMm, 18);

  const shutter = panels.find((p) => p.partId.includes('SHT'));
  assert.ok(shutter);
  assert.equal(shutter.role, 'shutter');
  assert.ok((shutter.hingeBores?.length ?? 0) >= 2);
});

