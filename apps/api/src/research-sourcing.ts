import { availability, stores } from 'ikea-availability-checker';

export function parseIkeaStockQuery(query: { productId?: unknown; storeId?: unknown }) {
  const productId = typeof query.productId === 'string' ? query.productId.replaceAll('.', '').trim() : '';
  const storeId = typeof query.storeId === 'string' ? query.storeId.trim() : '';
  if (!/^\d{8}$/.test(productId) || !/^\d{3}$/.test(storeId)) return null;
  if (!stores.findOneById(storeId)) return null;
  return { productId, storeId };
}

export async function getIkeaResearchStock(
  query: { productId: string; storeId: string },
  lookup: typeof availability = availability,
) {
  const checkedAt = new Date().toISOString();
  const result = await lookup(query.storeId, query.productId, { timeout: 6000, maxRedirects: 0, maxContentLength: 2_000_000 });
  const base = { ...query, checkedAt, source: 'Ephigenia/ikea-availability-checker@2.0.4', usage: 'sourcing-only', geometryCertified: false };
  if (!result || result.productId !== query.productId || result.buCode !== query.storeId
    || !Number.isFinite(result.stock) || result.stock < 0 || !result.probability
    || !result.createdAt || !Number.isFinite(new Date(result.createdAt).getTime())) {
    return { ...base, status: 'unknown' as const };
  }
  return { ...base, status: 'reported' as const, stock: result.stock, storeName: result.store.name,
    reportedAt: new Date(result.createdAt).toISOString(), probability: result.probability };
}
