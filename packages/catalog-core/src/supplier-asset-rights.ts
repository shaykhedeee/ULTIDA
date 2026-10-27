export type SupplierAssetPermissionScope =
  | 'metadata_and_procedural_pbr_only'
  | 'external_cad_portal_deep_link'
  | 'user_confirmed_retail_catalog_integration'
  | 'explicit_written_redistribution_license_required';

export interface SupplierAssetRightRecord {
  supplierName:
    | 'Ebco'
    | 'Hettich'
    | 'Blum'
    | 'Merino'
    | 'Greenlam'
    | 'CenturyPly / CenturyLaminates'
    | 'Royale Touche'
    | 'Action TESA'
    | 'IKEA India';
  permissionScope: SupplierAssetPermissionScope;
  canBundleMetadataAndSpecs: boolean;
  canGenerateProceduralPbrSwatches: boolean;
  canRehostRawCadOrScanFilesWithoutLicense: boolean;
  officialReferenceUrl: string;
  complianceNote: string;
}

export const SUPPLIER_ASSET_RIGHTS_LEDGER: readonly SupplierAssetRightRecord[] = [
  {
    supplierName: 'Ebco',
    permissionScope: 'metadata_and_procedural_pbr_only',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.ebco.in/ebco/e-soft-linear-hinge-3d',
    complianceNote:
      'Published engineering dimensions (105° opening, Ø35mm cup, 14–22mm shutter thickness) are encoded as parametric validation rules. Raw manufacturer PDFs/DWGs are linked via official source URL.',
  },
  {
    supplierName: 'Hettich',
    permissionScope: 'external_cad_portal_deep_link',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.hettich.com/en-us/services/hettich-cad/cad-downloads',
    complianceNote:
      'Hettich publishes DWG, DXF, STEP, and IGES packages on the official Hettich CAD portal. Ultida encodes drilling/clearance envelopes and deep-links to official CAD downloads.',
  },
  {
    supplierName: 'Blum',
    permissionScope: 'external_cad_portal_deep_link',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.blum.com/in/en/services/planning-construction-product-selection/cad-cam-data-service/',
    complianceNote:
      'AVENTOS HF and TANDEMBOX antaro planning envelopes and power-factor rules are encoded parametrically; 3D STEP assemblies require Blum E-SERVICES login.',
  },
  {
    supplierName: 'Merino',
    permissionScope: 'metadata_and_procedural_pbr_only',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.merinolaminates.com/en/product-category/laminates/',
    complianceNote:
      'SKU codes (14149-RS, 14172, 14101-NS, 22109-ST, 21091-MR), sheet sizes (1220×2440mm), and procedural PBR color/roughness values are bundled; proprietary high-res texture scans require dealer/brand pack import.',
  },
  {
    supplierName: 'Greenlam',
    permissionScope: 'metadata_and_procedural_pbr_only',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.greenlam.com/india/laminates/',
    complianceNote:
      'AFX 9851 / 9861 anti-fingerprint SKU metadata and procedural super-matte shaders are bundled.',
  },
  {
    supplierName: 'CenturyPly / CenturyLaminates',
    permissionScope: 'metadata_and_procedural_pbr_only',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.centuryply.com/centurylaminates',
    complianceNote:
      'Lucida high-gloss, Silk Tuff AFP, and Sainik 710 IS:710 BWP Marine Plywood specifications and sheet dimensions are bundled.',
  },
  {
    supplierName: 'Royale Touche',
    permissionScope: 'metadata_and_procedural_pbr_only',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.royaletouche.com/',
    complianceNote:
      'Crystal 1.5mm Acrylic SKU metadata and procedural mirror-gloss PBR parameters are bundled.',
  },
  {
    supplierName: 'Action TESA',
    permissionScope: 'metadata_and_procedural_pbr_only',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.actiontesa.com/products/hdhmr-board/',
    complianceNote:
      '18mm HDHMR Pro and 22mm Boilo routing-grade core substrate specifications are bundled.',
  },
  {
    supplierName: 'IKEA India',
    permissionScope: 'user_confirmed_retail_catalog_integration',
    canBundleMetadataAndSpecs: true,
    canGenerateProceduralPbrSwatches: true,
    canRehostRawCadOrScanFilesWithoutLicense: false,
    officialReferenceUrl: 'https://www.ikea.com/in/en/',
    complianceNote:
      'Authorized loose & modular retail SKUs (BILLY, KALLAX, BESTÅ, MICKE, LACK, POÄNG, PAX, METOD, EKET) are modeled using procedural parametric silhouettes and strictly isolated from factory plywood cutlists.',
  },
] as const;

export function verifySupplierAssetRedistribution(input: {
  supplierName: SupplierAssetRightRecord['supplierName'];
  assetType: 'spec_metadata' | 'procedural_pbr_swatch' | 'raw_vendor_cad_or_scan';
  hasExplicitWrittenLicense?: boolean;
}): {
  allowed: boolean;
  reason: string;
  record: SupplierAssetRightRecord;
} {
  const record =
    SUPPLIER_ASSET_RIGHTS_LEDGER.find((item) => item.supplierName === input.supplierName) ??
    SUPPLIER_ASSET_RIGHTS_LEDGER[0];

  if (input.assetType === 'spec_metadata') {
    return {
      allowed: record.canBundleMetadataAndSpecs,
      reason: record.complianceNote,
      record,
    };
  }

  if (input.assetType === 'procedural_pbr_swatch') {
    return {
      allowed: record.canGenerateProceduralPbrSwatches,
      reason: record.complianceNote,
      record,
    };
  }

  const allowed = Boolean(
    record.canRehostRawCadOrScanFilesWithoutLicense || input.hasExplicitWrittenLicense,
  );
  return {
    allowed,
    reason: allowed
      ? 'Explicit written redistribution license verified for raw vendor CAD/scan bundle.'
      : `Rehosting raw ${record.supplierName} CAD/scan files inside the public repository is blocked without an explicit written license. Use procedural PBR/geometry and link to ${record.officialReferenceUrl}.`,
    record,
  };
}
