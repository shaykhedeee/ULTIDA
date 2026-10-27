export type ModularFinishFamilyId =
  | 'hpl-1mm-matte-suede'
  | 'synchro-woodgrain-1mm'
  | 'anti-fingerprint-supermatte'
  | 'high-gloss-acrylic-1.5mm'
  | '2k-pu-duco-lacquer'
  | 'natural-veneer-pu-0.5mm'
  | 'cnc-fluted-shaker-profile'
  | 'slim-alu-fluted-tinted-glass';

export interface BareBonesFinishFamily {
  id: ModularFinishFamilyId;
  name: string;
  coreSubstrateSpec: string;
  defaultCoreThicknessMm: number;
  exteriorFaceSpec: string;
  exteriorFaceThicknessMm: number;
  backBalancingLinerSpec: string;
  backBalancingLinerThicknessMm: number;
  adhesiveLayerSpec: string;
  shutterEdgeBandThicknessMm: number;
  carcassVisibleEdgeBandThicknessMm: number;
  carcassHiddenEdgeBandThicknessMm: number;
  grainDirectionLocked: boolean;
  bookMatchRequiredOnDrawers: boolean;
  excludedFromPlywoodNesting: boolean;
  recommendedHingeId: string;
  wetZoneApproved: boolean;
}

export const BARE_BONES_FINISH_FAMILIES: readonly BareBonesFinishFamily[] = [
  {
    id: 'hpl-1mm-matte-suede',
    name: '1.0mm HPL Matte / Suede (MerinoLam / Greenlam / Century)',
    coreSubstrateSpec: '18mm Action TESA HDHMR or CenturyPly IS:710 BWP',
    defaultCoreThicknessMm: 18,
    exteriorFaceSpec: '1.0mm Decorative HPL Matte / Suede',
    exteriorFaceThicknessMm: 1.0,
    backBalancingLinerSpec: '0.8mm White Balancing Liner HPL (Mandatory anti-warp)',
    backBalancingLinerThicknessMm: 0.8,
    adhesiveLayerSpec: 'PUR Hot-Melt / D3 Cross-Linked PVA (0.1mm)',
    shutterEdgeBandThicknessMm: 2.0,
    carcassVisibleEdgeBandThicknessMm: 2.0,
    carcassHiddenEdgeBandThicknessMm: 0.8,
    grainDirectionLocked: false,
    bookMatchRequiredOnDrawers: false,
    excludedFromPlywoodNesting: false,
    recommendedHingeId: 'ebco-esoft-linear-hinge-3d-105',
    wetZoneApproved: true,
  },
  {
    id: 'synchro-woodgrain-1mm',
    name: '1.0mm Synchronized Woodgrain (Merino Senses / Greenlam Synchro)',
    coreSubstrateSpec: '18mm Action TESA HDHMR or CenturyPly IS:710 BWP',
    defaultCoreThicknessMm: 18,
    exteriorFaceSpec: '1.0mm Registered Emboss Synchronized Woodgrain HPL',
    exteriorFaceThicknessMm: 1.0,
    backBalancingLinerSpec: '0.8mm White / Ivory Balancing Liner HPL',
    backBalancingLinerThicknessMm: 0.8,
    adhesiveLayerSpec: 'PUR Hot-Melt / D3 Cross-Linked PVA (0.1mm)',
    shutterEdgeBandThicknessMm: 2.0,
    carcassVisibleEdgeBandThicknessMm: 2.0,
    carcassHiddenEdgeBandThicknessMm: 0.8,
    grainDirectionLocked: true,
    bookMatchRequiredOnDrawers: true,
    excludedFromPlywoodNesting: false,
    recommendedHingeId: 'ebco-esoft-linear-hinge-3d-105',
    wetZoneApproved: true,
  },
  {
    id: 'anti-fingerprint-supermatte',
    name: '1.0mm Anti-Fingerprint Super-Matte (Merino Tuff / Greenlam AFX / Century AFP)',
    coreSubstrateSpec: '18mm Calibrated Action TESA HDHMR Pro',
    defaultCoreThicknessMm: 18,
    exteriorFaceSpec: '1.0mm Electron-Beam Cured Thermal-Healing Super-Matte HPL',
    exteriorFaceThicknessMm: 1.0,
    backBalancingLinerSpec: '1.0mm Color-Matched Matte Balancing Liner',
    backBalancingLinerThicknessMm: 1.0,
    adhesiveLayerSpec: 'Zero-Line PUR Structural Adhesive (0.1mm)',
    shutterEdgeBandThicknessMm: 2.0,
    carcassVisibleEdgeBandThicknessMm: 2.0,
    carcassHiddenEdgeBandThicknessMm: 0.8,
    grainDirectionLocked: false,
    bookMatchRequiredOnDrawers: false,
    excludedFromPlywoodNesting: false,
    recommendedHingeId: 'ebco-esoft-linear-hinge-3d-105',
    wetZoneApproved: true,
  },
  {
    id: 'high-gloss-acrylic-1.5mm',
    name: '1.5mm High-Gloss / Matte Acrylic (Merino / Royale Touche Crystal)',
    coreSubstrateSpec: '18mm Calibrated Action TESA HDHMR Pro (Zero-Telegraphing)',
    defaultCoreThicknessMm: 18,
    exteriorFaceSpec: '1.5mm Optical-Grade PMMA Acrylic Sheet',
    exteriorFaceThicknessMm: 1.5,
    backBalancingLinerSpec: '1.0mm Color-Matched ABS Balancing Backer (Prevents Bowing)',
    backBalancingLinerThicknessMm: 1.0,
    adhesiveLayerSpec: 'Reactive PUR Hot-Melt Laminating Line (0.1mm)',
    shutterEdgeBandThicknessMm: 1.5,
    carcassVisibleEdgeBandThicknessMm: 2.0,
    carcassHiddenEdgeBandThicknessMm: 0.8,
    grainDirectionLocked: false,
    bookMatchRequiredOnDrawers: false,
    excludedFromPlywoodNesting: false,
    recommendedHingeId: 'ebco-esoft-linear-hinge-3d-105',
    wetZoneApproved: true,
  },
  {
    id: '2k-pu-duco-lacquer',
    name: '2K Italian PU / Duco Lacquer (Asian Paints / ICA Italian PU)',
    coreSubstrateSpec: '18mm Action TESA HDHMR (Sanded 320-Grit)',
    defaultCoreThicknessMm: 18,
    exteriorFaceSpec: '2.0mm 6-Coat Polyester Isolator + Primer + 2K Acrylic PU Topcoat',
    exteriorFaceThicknessMm: 0.4,
    backBalancingLinerSpec: 'All 6 Faces Sealed in 2K PU Matte Balancing Coat',
    backBalancingLinerThicknessMm: 0.3,
    adhesiveLayerSpec: 'Direct Spray Monolithic Seal (No Edge Band Joint)',
    shutterEdgeBandThicknessMm: 0,
    carcassVisibleEdgeBandThicknessMm: 2.0,
    carcassHiddenEdgeBandThicknessMm: 0.8,
    grainDirectionLocked: false,
    bookMatchRequiredOnDrawers: false,
    excludedFromPlywoodNesting: false,
    recommendedHingeId: 'ebco-esoft-linear-hinge-3d-105',
    wetZoneApproved: false,
  },
  {
    id: 'natural-veneer-pu-0.5mm',
    name: '0.5mm Natural / Recon Veneer + Open-Pore PU (Century Veneers / Decowood)',
    coreSubstrateSpec: '18mm Calibrated CenturyPly IS:710 BWP or HDHMR',
    defaultCoreThicknessMm: 18,
    exteriorFaceSpec: '0.5mm Group-Matched Natural Teak / Walnut Veneer + Dead-Matte PU',
    exteriorFaceThicknessMm: 0.5,
    backBalancingLinerSpec: '0.5mm Backing Veneer + Sealer Coat (Equal Moisture Vapour Rate)',
    backBalancingLinerThicknessMm: 0.5,
    adhesiveLayerSpec: 'Hot-Press Urea-Formaldehyde E1 / D3 Veneer Glue',
    shutterEdgeBandThicknessMm: 1.5,
    carcassVisibleEdgeBandThicknessMm: 2.0,
    carcassHiddenEdgeBandThicknessMm: 0.8,
    grainDirectionLocked: true,
    bookMatchRequiredOnDrawers: true,
    excludedFromPlywoodNesting: false,
    recommendedHingeId: 'ebco-esoft-linear-hinge-3d-105',
    wetZoneApproved: false,
  },
  {
    id: 'cnc-fluted-shaker-profile',
    name: 'CNC Fluted / Shaker Routed Profile (22mm Routing-Grade HDHMR)',
    coreSubstrateSpec: '22mm Action TESA Boilo / Routing-Grade High-Density HDHMR',
    defaultCoreThicknessMm: 22,
    exteriorFaceSpec: '3.5mm Deep CNC Ball-Nose Fluting / Shaker Frame + 2K PU Spray',
    exteriorFaceThicknessMm: 0.4,
    backBalancingLinerSpec: '0.8mm Balancing Liner + 2K PU Sealed Back',
    backBalancingLinerThicknessMm: 0.8,
    adhesiveLayerSpec: 'Monolithic CNC Milled Face (0mm Edge Band Deduction)',
    shutterEdgeBandThicknessMm: 0,
    carcassVisibleEdgeBandThicknessMm: 2.0,
    carcassHiddenEdgeBandThicknessMm: 0.8,
    grainDirectionLocked: true,
    bookMatchRequiredOnDrawers: false,
    excludedFromPlywoodNesting: false,
    recommendedHingeId: 'hettich-sensys-8645i-110',
    wetZoneApproved: false,
  },
  {
    id: 'slim-alu-fluted-tinted-glass',
    name: '20x45mm Slim Anodized Aluminium Frame + 5mm Toughened Fluted Glass',
    coreSubstrateSpec: '20x45mm Extruded Architectural Aluminium Profile (Champagne / Black)',
    defaultCoreThicknessMm: 20,
    exteriorFaceSpec: '5mm Saint-Gobain Toughened Reeded / Bronze Tinted Glass Insert',
    exteriorFaceThicknessMm: 5.0,
    backBalancingLinerSpec: 'EPDM Acoustic Glazing Gasket',
    backBalancingLinerThicknessMm: 0,
    adhesiveLayerSpec: 'Mechanical Corner Cleat Assembly',
    shutterEdgeBandThicknessMm: 0,
    carcassVisibleEdgeBandThicknessMm: 2.0,
    carcassHiddenEdgeBandThicknessMm: 0.8,
    grainDirectionLocked: true,
    bookMatchRequiredOnDrawers: false,
    excludedFromPlywoodNesting: true,
    recommendedHingeId: 'hettich-sensys-8645i-110',
    wetZoneApproved: true,
  },
] as const;

export interface PreMillCutDimensionInput {
  finishedLengthMm: number;
  finishedWidthMm: number;
  edgeTopMm: number;
  edgeBottomMm: number;
  edgeLeftMm: number;
  edgeRightMm: number;
}

export interface PreMillCutDimensionOutput {
  finishedLengthMm: number;
  finishedWidthMm: number;
  preMillCutLengthMm: number;
  preMillCutWidthMm: number;
  edgeDeductionLengthMm: number;
  edgeDeductionWidthMm: number;
  stickerEdgeMap: string;
}

export function computePreMillCutDimensions(
  input: PreMillCutDimensionInput,
): PreMillCutDimensionOutput {
  const edgeDeductionLengthMm = Number((input.edgeTopMm + input.edgeBottomMm).toFixed(2));
  const edgeDeductionWidthMm = Number((input.edgeLeftMm + input.edgeRightMm).toFixed(2));
  const preMillCutLengthMm = Number(
    Math.max(1, input.finishedLengthMm - edgeDeductionLengthMm).toFixed(2),
  );
  const preMillCutWidthMm = Number(
    Math.max(1, input.finishedWidthMm - edgeDeductionWidthMm).toFixed(2),
  );

  const fmtEdge = (eb: number) => (eb >= 1.5 ? `${eb}EB` : eb > 0 ? `${eb}EB` : '0');
  const stickerEdgeMap = `[T:${fmtEdge(input.edgeTopMm)} | B:${fmtEdge(input.edgeBottomMm)} | L:${fmtEdge(input.edgeLeftMm)} | R:${fmtEdge(input.edgeRightMm)}]`;

  return {
    finishedLengthMm: input.finishedLengthMm,
    finishedWidthMm: input.finishedWidthMm,
    preMillCutLengthMm,
    preMillCutWidthMm,
    edgeDeductionLengthMm,
    edgeDeductionWidthMm,
    stickerEdgeMap,
  };
}

export interface VendorApprovedMaterialSku {
  id: string;
  brand:
    | 'Merino'
    | 'Greenlam'
    | 'CenturyLaminates'
    | 'Royale Touche'
    | 'Action TESA'
    | 'CenturyPly';
  collection: string;
  skuCode: string;
  name: string;
  finishFamilyId: ModularFinishFamilyId;
  role: 'exterior_face' | 'backing_liner' | 'core_substrate';
  sheetWidthMm: number;
  sheetHeightMm: number;
  thicknessMm: number;
  grainDirection: 'vertical' | 'none';
  swatchHex: string;
  secondaryHex?: string;
  roughness: number;
  metalness: number;
  priceInrPerSheet: number;
  matchingEdgeBandSku: string;
  recommendedBackingSku: string;
  sourceUrl: string;
}

export const VENDOR_APPROVED_LAMINATES: readonly VendorApprovedMaterialSku[] = [
  {
    id: 'merino-14149-rs-alameda-oak-dune',
    brand: 'Merino',
    collection: 'Merino Senses (Synchronized Pore)',
    skuCode: '14149-RS',
    name: 'Alameda Oak Dune (Synchronized)',
    finishFamilyId: 'synchro-woodgrain-1mm',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.0,
    grainDirection: 'vertical',
    swatchHex: '#b89672',
    secondaryHex: '#9d7a56',
    roughness: 0.62,
    metalness: 0.04,
    priceInrPerSheet: 2650,
    matchingEdgeBandSku: 'REHAU-EB-14149-22x2.0',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.merinolaminates.com/en/product-category/laminates/',
  },
  {
    id: 'merino-14172-light-drift-oak',
    brand: 'Merino',
    collection: 'MerinoLam Woodgrains',
    skuCode: '14172-WV',
    name: 'Light Drift Oak',
    finishFamilyId: 'synchro-woodgrain-1mm',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.0,
    grainDirection: 'vertical',
    swatchHex: '#c8ae8e',
    secondaryHex: '#b09371',
    roughness: 0.58,
    metalness: 0.03,
    priceInrPerSheet: 2150,
    matchingEdgeBandSku: 'REHAU-EB-14172-22x2.0',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.merinolaminates.com/en/product-category/laminates/',
  },
  {
    id: 'merino-14101-ns-cinder-walnut',
    brand: 'Merino',
    collection: 'Merino Senses (Synchronized Pore)',
    skuCode: '14101-NS',
    name: 'Cinder Walnut (Deep Pore)',
    finishFamilyId: 'synchro-woodgrain-1mm',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.0,
    grainDirection: 'vertical',
    swatchHex: '#594132',
    secondaryHex: '#3f2d22',
    roughness: 0.64,
    metalness: 0.05,
    priceInrPerSheet: 2790,
    matchingEdgeBandSku: 'REHAU-EB-14101-22x2.0',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.merinolaminates.com/en/product-category/laminates/',
  },
  {
    id: 'merino-22109-st-zero-g-sandstone',
    brand: 'Merino',
    collection: 'Merino Stone & Concrete',
    skuCode: '22109-ST',
    name: 'Zero-G Warm Sandstone',
    finishFamilyId: 'hpl-1mm-matte-suede',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.0,
    grainDirection: 'none',
    swatchHex: '#d9d1c5',
    secondaryHex: '#c4baac',
    roughness: 0.72,
    metalness: 0.02,
    priceInrPerSheet: 1980,
    matchingEdgeBandSku: 'REHAU-EB-22109-22x2.0',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.merinolaminates.com/en/product-category/laminates/',
  },
  {
    id: 'merino-21091-frosty-white-liner-08',
    brand: 'Merino',
    collection: 'Merino Internal & Balancing Liner',
    skuCode: '21091-MR',
    name: 'Frosty White Carcass Liner 0.8mm',
    finishFamilyId: 'hpl-1mm-matte-suede',
    role: 'backing_liner',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 0.8,
    grainDirection: 'none',
    swatchHex: '#f5f4f0',
    roughness: 0.65,
    metalness: 0.01,
    priceInrPerSheet: 920,
    matchingEdgeBandSku: 'REHAU-EB-21091-22x0.8',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.merinolaminates.com/en/product-category/laminates/',
  },
  {
    id: 'greenlam-afx-9851-white-x',
    brand: 'Greenlam',
    collection: 'AFX Anti-Fingerprint Super-Matte',
    skuCode: 'AFX-9851',
    name: 'AFX 9851 Warm White X (Zero Reflection)',
    finishFamilyId: 'anti-fingerprint-supermatte',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.0,
    grainDirection: 'none',
    swatchHex: '#eeebe4',
    roughness: 0.88,
    metalness: 0.01,
    priceInrPerSheet: 3450,
    matchingEdgeBandSku: 'GREENLAM-AFX-EB-9851-22x2.0',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.greenlam.com/india/laminates/',
  },
  {
    id: 'greenlam-afx-9861-black-x',
    brand: 'Greenlam',
    collection: 'AFX Anti-Fingerprint Super-Matte',
    skuCode: 'AFX-9861',
    name: 'AFX 9861 Obsidian Black X',
    finishFamilyId: 'anti-fingerprint-supermatte',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.0,
    grainDirection: 'none',
    swatchHex: '#252629',
    roughness: 0.9,
    metalness: 0.02,
    priceInrPerSheet: 3550,
    matchingEdgeBandSku: 'GREENLAM-AFX-EB-9861-22x2.0',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.greenlam.com/india/laminates/',
  },
  {
    id: 'century-lucida-gl-101-champagne',
    brand: 'CenturyLaminates',
    collection: 'Lucida Scuff-Resistant High Gloss',
    skuCode: 'LUC-GL-101',
    name: 'Lucida Mirror Champagne Pearl',
    finishFamilyId: 'hpl-1mm-matte-suede',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.0,
    grainDirection: 'none',
    swatchHex: '#e6dccb',
    roughness: 0.12,
    metalness: 0.08,
    priceInrPerSheet: 2480,
    matchingEdgeBandSku: 'REHAU-EB-LUC101-22x2.0',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.centuryply.com/centurylaminates',
  },
  {
    id: 'century-afp-1308-milky-white',
    brand: 'CenturyLaminates',
    collection: 'Silk Tuff AFP Anti-Fingerprint',
    skuCode: 'AFP-1308',
    name: 'Silk Tuff Milky Cashmere Matt',
    finishFamilyId: 'anti-fingerprint-supermatte',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.0,
    grainDirection: 'none',
    swatchHex: '#e8e2d8',
    roughness: 0.85,
    metalness: 0.01,
    priceInrPerSheet: 2950,
    matchingEdgeBandSku: 'REHAU-EB-AFP1308-22x2.0',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.centuryply.com/centurylaminates',
  },
  {
    id: 'royale-touche-crystal-1181-ivory-acrylic',
    brand: 'Royale Touche',
    collection: 'Crystal 1.5mm Luxury Acrylic',
    skuCode: 'RT-CRY-1181',
    name: 'Crystal 1181 Warm Ivory Mirror Acrylic',
    finishFamilyId: 'high-gloss-acrylic-1.5mm',
    role: 'exterior_face',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 1.5,
    grainDirection: 'none',
    swatchHex: '#f2ece1',
    roughness: 0.06,
    metalness: 0.1,
    priceInrPerSheet: 4650,
    matchingEdgeBandSku: 'REHAU-PMMA-1181-23x1.5',
    recommendedBackingSku: 'RT-ABS-BACKER-10',
    sourceUrl: 'https://www.royaletouche.com/',
  },
  {
    id: 'action-tesa-18mm-hdhmr-pro',
    brand: 'Action TESA',
    collection: 'HDHMR Pro Structural Core',
    skuCode: 'AT-HDHMR-18',
    name: 'Action TESA 18mm Borer & Moisture Resistant HDHMR',
    finishFamilyId: 'hpl-1mm-matte-suede',
    role: 'core_substrate',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 18.0,
    grainDirection: 'none',
    swatchHex: '#6c8b65',
    roughness: 0.8,
    metalness: 0.0,
    priceInrPerSheet: 2850,
    matchingEdgeBandSku: 'REHAU-EB-21091-22x0.8',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.actiontesa.com/products/hdhmr-board/',
  },
  {
    id: 'centuryply-18mm-sainik-710-bwp',
    brand: 'CenturyPly',
    collection: 'Sainik 710 IS:710 Boiling Water Proof Marine Ply',
    skuCode: 'CP-S710-18',
    name: 'CenturyPly 18mm IS:710 BWP Calibrated Marine Plywood',
    finishFamilyId: 'hpl-1mm-matte-suede',
    role: 'core_substrate',
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    thicknessMm: 18.0,
    grainDirection: 'vertical',
    swatchHex: '#b98b5c',
    roughness: 0.78,
    metalness: 0.0,
    priceInrPerSheet: 3380,
    matchingEdgeBandSku: 'REHAU-EB-21091-22x0.8',
    recommendedBackingSku: '21091-MR',
    sourceUrl: 'https://www.centuryply.com/sainik-710',
  },
] as const;

export interface IkeaRetailCatalogItem {
  id: string;
  brand: 'IKEA';
  seriesName: 'BILLY' | 'KALLAX' | 'BESTÅ' | 'MICKE' | 'LACK' | 'POÄNG' | 'PAX' | 'METOD' | 'EKET';
  articleNumber: string;
  title: string;
  roomZone: 'living' | 'study' | 'bedroom' | 'kitchen';
  widthMm: number;
  depthMm: number;
  heightMm: number;
  finishDescription: string;
  swatchHex: string;
  priceInr: number;
  packageCount: number;
  wallAnchoringRequired: boolean;
  manufacturingRoute: 'retail_procurement_only';
  generatesCutlistPanels: false;
  authorizedPartnerReference: string;
}

export const IKEA_INDIA_RETAIL_CATALOG: readonly IkeaRetailCatalogItem[] = [
  {
    id: 'ikea-billy-800x280x2020',
    brand: 'IKEA',
    seriesName: 'BILLY',
    articleNumber: '002.638.50',
    title: 'BILLY Bookcase with Adjustable Shelves (White / Oak Veneer)',
    roomZone: 'living',
    widthMm: 800,
    depthMm: 280,
    heightMm: 2020,
    finishDescription: 'White Foil / White Stained Oak Veneer',
    swatchHex: '#edeae2',
    priceInr: 6990,
    packageCount: 1,
    wallAnchoringRequired: true,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
  {
    id: 'ikea-kallax-765x390x1465',
    brand: 'IKEA',
    seriesName: 'KALLAX',
    articleNumber: '802.758.87',
    title: 'KALLAX 4×2 Cube Shelving Partition Unit',
    roomZone: 'study',
    widthMm: 765,
    depthMm: 390,
    heightMm: 1465,
    finishDescription: 'High-Strength Honeycomb Board in Matte White / Oak Effect',
    swatchHex: '#dcd5c7',
    priceInr: 6490,
    packageCount: 1,
    wallAnchoringRequired: true,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
  {
    id: 'ikea-besta-1200x400x380',
    brand: 'IKEA',
    seriesName: 'BESTÅ',
    articleNumber: '693.990.58',
    title: 'BESTÅ Floating / Floor TV Bench with Lappviken Doors',
    roomZone: 'living',
    widthMm: 1200,
    depthMm: 400,
    heightMm: 380,
    finishDescription: 'Walnut Effect Light Grey / Soft-Closing Hinges',
    swatchHex: '#a5937e',
    priceInr: 13500,
    packageCount: 4,
    wallAnchoringRequired: true,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
  {
    id: 'ikea-micke-1050x500x750',
    brand: 'IKEA',
    seriesName: 'MICKE',
    articleNumber: '803.542.76',
    title: 'MICKE Workstation Desk with Integrated Cable Trunk',
    roomZone: 'study',
    widthMm: 1050,
    depthMm: 500,
    heightMm: 750,
    finishDescription: 'Powder-Coated Steel Leg + White / Anthracite Top',
    swatchHex: '#f1efe9',
    priceInr: 7990,
    packageCount: 1,
    wallAnchoringRequired: false,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
  {
    id: 'ikea-lack-900x550x450',
    brand: 'IKEA',
    seriesName: 'LACK',
    articleNumber: '904.499.06',
    title: 'LACK Coffee Table with Lower Magazine Shelf',
    roomZone: 'living',
    widthMm: 900,
    depthMm: 550,
    heightMm: 450,
    finishDescription: 'White Stained Oak Effect',
    swatchHex: '#cfb795',
    priceInr: 2290,
    packageCount: 1,
    wallAnchoringRequired: false,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
  {
    id: 'ikea-poang-680x830x1000',
    brand: 'IKEA',
    seriesName: 'POÄNG',
    articleNumber: '698.912.72',
    title: 'POÄNG Layer-Glued Bent Birch Lounge Armchair (Knisa Beige)',
    roomZone: 'living',
    widthMm: 680,
    depthMm: 830,
    heightMm: 1000,
    finishDescription: 'Bent Birch Veneer Frame + Knisa Light Beige Cushion',
    swatchHex: '#d7c7ad',
    priceInr: 8990,
    packageCount: 2,
    wallAnchoringRequired: false,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
  {
    id: 'ikea-pax-2000x600x2360',
    brand: 'IKEA',
    seriesName: 'PAX',
    articleNumber: '794.296.49',
    title: 'PAX / FORSAND 4-Door Wardrobe Combination with KOMPLEMENT Organizers',
    roomZone: 'bedroom',
    widthMm: 2000,
    depthMm: 600,
    heightMm: 2360,
    finishDescription: 'White Stained Oak Effect w/ Mesh Baskets & Soft-Close Hinges',
    swatchHex: '#cbb392',
    priceInr: 48500,
    packageCount: 14,
    wallAnchoringRequired: true,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
  {
    id: 'ikea-metod-800x370x800',
    brand: 'IKEA',
    seriesName: 'METOD',
    articleNumber: '493.070.16',
    title: 'METOD Wall Cabinet with 2 VEDDINGE / Glass Doors',
    roomZone: 'kitchen',
    widthMm: 800,
    depthMm: 370,
    heightMm: 800,
    finishDescription: 'Smooth Matte White Moisture-Resistant Melamine',
    swatchHex: '#f0eee8',
    priceInr: 9800,
    packageCount: 5,
    wallAnchoringRequired: true,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
  {
    id: 'ikea-eket-700x350x700',
    brand: 'IKEA',
    seriesName: 'EKET',
    articleNumber: '303.339.56',
    title: 'EKET 4-Compartment Wall-Mounted Display Cabinet',
    roomZone: 'living',
    widthMm: 700,
    depthMm: 350,
    heightMm: 700,
    finishDescription: 'Light Grey-Green / Dark Grey Architectural Matte',
    swatchHex: '#9ba39a',
    priceInr: 4500,
    packageCount: 2,
    wallAnchoringRequired: true,
    manufacturingRoute: 'retail_procurement_only',
    generatesCutlistPanels: false,
    authorizedPartnerReference: 'IKEA India Retail Integration (Authorized Loose Furniture Pack)',
  },
] as const;

export function isRetailProcurementItem(item: {
  id?: string;
  manufacturingRoute?: string;
  generatesCutlistPanels?: boolean;
}): boolean {
  if (
    item.manufacturingRoute === 'retail_procurement_only' ||
    item.generatesCutlistPanels === false
  ) {
    return true;
  }
  if (typeof item.id === 'string' && item.id.startsWith('ikea-')) {
    return true;
  }
  return false;
}

export function assertRetailIsNotCutlistPart(item: {
  id: string;
  title?: string;
  manufacturingRoute?: string;
  generatesCutlistPanels?: boolean;
}): void {
  if (isRetailProcurementItem(item)) {
    throw new Error(
      `[ULTIDA_RETAIL_CUTLIST_GUARDRAIL] Item "${item.title ?? item.id}" is a purchased retail SKU (IKEA India / Retail Procurement Only). It is included in 2D/3D space planning and the Commercial Retail BOQ, and must NEVER be decomposed into raw factory plywood cutlist panels.`,
    );
  }
}
