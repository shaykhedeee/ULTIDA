import test from 'node:test';
import assert from 'node:assert/strict';
import { getIkeaResearchStock, parseIkeaStockQuery } from '../src/research-sourcing.js';

test('stock queries accept dotted product IDs and reject URLs, arrays and unknown stores', () => {
  assert.deepEqual(parseIkeaStockQuery({ productId: '002.638.50', storeId: '117' }), { productId: '00263850', storeId: '117' });
  for (const query of [{ productId: 'https://localhost', storeId: '117' }, { productId: ['00263850'], storeId: '117' }, { productId: '00263850', storeId: '000' }]) assert.equal(parseIkeaStockQuery(query), null);
});
test('missing stock does not become zero; supplier errors remain errors', async () => {
  const query = { productId: '00263850', storeId: '117' };
  const unknown = await getIkeaResearchStock(query, async () => undefined);
  assert.equal(unknown.status, 'unknown');
  assert.equal('stock' in unknown, false);
  await assert.rejects(getIkeaResearchStock(query, async () => { throw new Error('supplier unavailable'); }), /supplier unavailable/);
});
test('stock results preserve provenance and cannot certify geometry', async () => {
  const result = await getIkeaResearchStock({ productId: '00263850', storeId: '117' }, async (_store, _product, options) => {
    assert.equal(options?.timeout, 6000);
    return { productId: '00263850', buCode: '117', stock: 3, probability: 'HIGH_IN_STOCK' as never, createdAt: new Date('2026-09-12T00:00:00Z'),
      store: { name: 'Test store', buCode: '117', countryCode: 'de', country: 'Germany', coordinates: [0, 0] } };
  });
  assert.equal(result.status, 'reported');
  assert.equal(result.geometryCertified, false);
  assert.equal(result.usage, 'sourcing-only');
  assert.equal('stock' in result && result.stock, 3);
});
