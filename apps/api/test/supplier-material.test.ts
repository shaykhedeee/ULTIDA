import test from 'node:test';
import assert from 'node:assert/strict';
import { supplierMaterialReference } from '../src/supplier-material.js';
test('supplier imports preserve shared identities and unknown commercial fields', () => {
  const finish = supplierMaterialReference('merino-senses-14149-rs')!;
  assert.equal(finish.code, finish.metadata.sourceRecordId);
  assert.equal(finish.metadata.supplierCode, '14149');
  assert.equal(finish.category, 'board');
  assert.equal(finish.availability, 'unknown');
  assert.equal('unit_cost' in finish, false);
  const hardware = supplierMaterialReference('hettich-9099124')!;
  assert.equal(hardware.category, 'hardware');
  assert.equal(hardware.metadata.fittingId, 'hettich-9099124');
  assert.equal(supplierMaterialReference('invented-sku'), null);
});
