import test from 'node:test';
import assert from 'node:assert/strict';
import { LaminateMaterialVersions } from '../dist/index.js';
import { MaterialSlotSchema, CuratedLaminateCatalog } from '../../catalog-core/dist/index.js';

test('20 complete supplier laminate versions feed the existing catalog', () => {
  assert.ok(LaminateMaterialVersions.length >= 20);
  assert.equal(new Set(LaminateMaterialVersions.map(m => m.id)).size, LaminateMaterialVersions.length);
  for (const material of LaminateMaterialVersions) {
    assert.equal(material.schema, 'material.version.v1');
    assert.ok(material.supplierCode && material.name && material.thicknessMm > 0);
    assert.match(material.swatchUrl, /^https:\/\/cdn\.egger\.com\/img\/pim\/.+\/original\.png$/);
    assert.equal(material.pbr.baseColorUrl, material.swatchUrl);
    assert.ok(material.pbr.textureScaleMm.width > 0 && material.pbr.textureScaleMm.height > 0);
    assert.ok(material.allowedSlots.length);
    material.allowedSlots.forEach(slot => MaterialSlotSchema.parse(slot));
    assert.ok(CuratedLaminateCatalog.some(item => item.id === material.id));
  }
  assert.deepEqual(new Set(LaminateMaterialVersions.map(m => m.finish)), new Set(['matte', 'textured', 'glossy']));
});
