import { VERIFIED_MERINO_REFERENCES, STARTER_FITTINGS } from '@ultida/catalog-core';

/** Reference import only: never invents thickness, price, stock or texture. */
export function supplierMaterialReference(sourceId: string) {
  const finish = VERIFIED_MERINO_REFERENCES.find(item => item.id === sourceId);
  const fitting = STARTER_FITTINGS.find(item => item.id === sourceId);
  if (!finish && !fitting) return null;
  return {
    name: finish ? `${finish.supplier} ${finish.name}` : `${fitting!.brand} ${fitting!.label}`,
    supplier: finish?.supplier ?? fitting!.brand,
    brand: finish?.supplier ?? fitting!.brand,
    // Stable source identity prevents same-decor/different-finish collisions.
    code: sourceId,
    category: finish ? (finish.kind === 'laminate' ? 'laminate' : 'board') : 'hardware',
    finish: finish?.finish ?? null,
    availability: 'unknown',
    metadata: {
      sourceRecordId: sourceId,
      supplierCode: finish?.decorCode ?? fitting!.code,
      sourceUrl: finish?.sourceUrl ?? fitting!.sourceUrl,
      evidence: 'manufacturer-listed',
      requiresSupplierConfirmation: true,
      ...(finish ? { productLine: finish.productLine, productKind: finish.kind, sheetSizesMm: finish.sheetSizesMm } : { fittingId: fitting!.id, fittingParameters: fitting!.parameters }),
    },
  };
}
