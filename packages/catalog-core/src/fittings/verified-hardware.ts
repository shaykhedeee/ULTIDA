import { z } from 'zod';

export const HardwareSupplierSchema = z.enum([
  'Ebco',
  'Hettich',
  'Blum',
  'Kesseböhmer',
]);
export type HardwareSupplier = z.infer<typeof HardwareSupplierSchema>;

export const HardwareCategorySchema = z.enum([
  'hinge',
  'drawer_runner',
  'drawer_system',
  'lift_system',
  'corner_solution',
  'handleless_profile',
]);
export type HardwareCategory = z.infer<typeof HardwareCategorySchema>;

export const AssetLicenseStatusSchema = z.enum([
  'verified_spec_metadata_only',
  'supplier_cad_portal_linked',
  'authorized_redistributable_asset',
]);
export type AssetLicenseStatus = z.infer<typeof AssetLicenseStatusSchema>;

export interface VerifiedHardwareFitting {
  id: string;
  supplier: HardwareSupplier;
  modelName: string;
  skuCode: string;
  category: HardwareCategory;
  mountingVariant?: 'full_overlay' | 'half_overlay' | 'inset' | 'undermount' | 'bifold_lift' | 'blind_corner' | 'gola_extrusion';
  openingAngleDeg?: number;
  cupDiameterMm?: number;
  cupDepthMm?: number;
  shutterThicknessMinMm?: number;
  shutterThicknessMaxMm?: number;
  maxSingleShutterWidthMm?: number;
  nominalLengthMm?: number;
  minInternalCarcassDepthMm?: number;
  minClearOpeningWidthMm?: number;
  maxLoadKg?: number;
  softCloseIntegrated: boolean;
  adjustment3D: boolean;
  priceInrPerUnit: number;
  unitLabel: 'pair' | 'piece' | 'set' | 'bar_3m';
  manufacturerSourceUrl: string;
  cadFormatsPublished: ('DWG' | 'DXF' | 'STEP' | 'IGES' | 'PDF')[];
  assetLicenseStatus: AssetLicenseStatus;
  engineeringNotes: string;
}

export const VERIFIED_HARDWARE_REGISTRY: readonly VerifiedHardwareFitting[] = [
  {
    id: 'ebco-esoft-linear-hinge-3d-105',
    supplier: 'Ebco',
    modelName: 'E-Soft Linear Hinge 3D (0 Crank Full Overlay)',
    skuCode: 'ESLH-3D-0C',
    category: 'hinge',
    mountingVariant: 'full_overlay',
    openingAngleDeg: 105,
    cupDiameterMm: 35,
    cupDepthMm: 11.5,
    shutterThicknessMinMm: 14,
    shutterThicknessMaxMm: 22,
    maxSingleShutterWidthMm: 600,
    maxLoadKg: 18,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 295,
    unitLabel: 'pair',
    manufacturerSourceUrl: 'https://www.ebco.in/ebco/e-soft-linear-hinge-3d',
    cadFormatsPublished: ['PDF', 'DWG'],
    assetLicenseStatus: 'verified_spec_metadata_only',
    engineeringNotes:
      'Linear mounting plate keeps carcass side clear for internal pullouts. 105° opening angle, Ø35mm cup bore, verified for 14–22mm shutters.',
  },
  {
    id: 'ebco-esoft-linear-hinge-3d-105-half',
    supplier: 'Ebco',
    modelName: 'E-Soft Linear Hinge 3D (9.5 Crank Half Overlay)',
    skuCode: 'ESLH-3D-9C',
    category: 'hinge',
    mountingVariant: 'half_overlay',
    openingAngleDeg: 105,
    cupDiameterMm: 35,
    cupDepthMm: 11.5,
    shutterThicknessMinMm: 14,
    shutterThicknessMaxMm: 22,
    maxSingleShutterWidthMm: 600,
    maxLoadKg: 18,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 305,
    unitLabel: 'pair',
    manufacturerSourceUrl: 'https://www.ebco.in/ebco/e-soft-linear-hinge-3d',
    cadFormatsPublished: ['PDF', 'DWG'],
    assetLicenseStatus: 'verified_spec_metadata_only',
    engineeringNotes:
      'Half-overlay crank for shared central partition stiles (18mm partition with dual doors). Verified for 14–22mm shutter thickness.',
  },
  {
    id: 'ebco-esoft-linear-hinge-3d-105-inset',
    supplier: 'Ebco',
    modelName: 'E-Soft Linear Hinge 3D (18 Crank Inset)',
    skuCode: 'ESLH-3D-18C',
    category: 'hinge',
    mountingVariant: 'inset',
    openingAngleDeg: 105,
    cupDiameterMm: 35,
    cupDepthMm: 11.5,
    shutterThicknessMinMm: 14,
    shutterThicknessMaxMm: 22,
    maxSingleShutterWidthMm: 600,
    maxLoadKg: 16,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 315,
    unitLabel: 'pair',
    manufacturerSourceUrl: 'https://www.ebco.in/ebco/e-soft-linear-hinge-3d',
    cadFormatsPublished: ['PDF', 'DWG'],
    assetLicenseStatus: 'verified_spec_metadata_only',
    engineeringNotes:
      'Flush inset door mounting inside carcass gables. Requires cup setback adjustment +18mm.',
  },
  {
    id: 'hettich-sensys-8645i-110',
    supplier: 'Hettich',
    modelName: 'Sensys 8645i TH52 110° Integrated Silent System Hinge',
    skuCode: 'HET-9071205',
    category: 'hinge',
    mountingVariant: 'full_overlay',
    openingAngleDeg: 110,
    cupDiameterMm: 35,
    cupDepthMm: 12.8,
    shutterThicknessMinMm: 15,
    shutterThicknessMaxMm: 24,
    maxSingleShutterWidthMm: 600,
    maxLoadKg: 22,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 580,
    unitLabel: 'pair',
    manufacturerSourceUrl: 'https://www.hettich.com/en-us/services/hettich-cad/cad-downloads',
    cadFormatsPublished: ['DWG', 'DXF', 'STEP', 'IGES'],
    assetLicenseStatus: 'supplier_cad_portal_linked',
    engineeringNotes:
      'Wide 35° self-closing angle with temperature-stable damper. Supports thicker 15–24mm lacquered, fluted, or acrylic shutters.',
  },
  {
    id: 'hettich-quadro-v6-450-silent',
    supplier: 'Hettich',
    modelName: 'Quadro V6 Silent System 450mm Full Extension Runner',
    skuCode: 'HET-9113671',
    category: 'drawer_runner',
    mountingVariant: 'undermount',
    nominalLengthMm: 450,
    minInternalCarcassDepthMm: 463,
    shutterThicknessMinMm: 16,
    shutterThicknessMaxMm: 19,
    maxLoadKg: 30,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 1650,
    unitLabel: 'set',
    manufacturerSourceUrl: 'https://www.hettich.com/en-us/services/hettich-cad/cad-downloads',
    cadFormatsPublished: ['DWG', 'DXF', 'STEP', 'IGES'],
    assetLicenseStatus: 'supplier_cad_portal_linked',
    engineeringNotes:
      'Precision steel ball-bearing channels for wooden drawers in 500–550mm deep wardrobes and dressers. Requires minimum 463mm internal carcass depth.',
  },
  {
    id: 'hettich-quadro-v6-500-silent',
    supplier: 'Hettich',
    modelName: 'Quadro V6 Silent System 500mm Full Extension Runner',
    skuCode: 'HET-9113675',
    category: 'drawer_runner',
    mountingVariant: 'undermount',
    nominalLengthMm: 500,
    minInternalCarcassDepthMm: 513,
    shutterThicknessMinMm: 16,
    shutterThicknessMaxMm: 19,
    maxLoadKg: 30,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 1790,
    unitLabel: 'set',
    manufacturerSourceUrl: 'https://www.hettich.com/en-us/services/hettich-cad/cad-downloads',
    cadFormatsPublished: ['DWG', 'DXF', 'STEP', 'IGES'],
    assetLicenseStatus: 'supplier_cad_portal_linked',
    engineeringNotes:
      'Standard 500mm runner for 580–600mm deep kitchen base units and deep wardrobes. Requires minimum 513mm internal carcass depth.',
  },
  {
    id: 'hettich-actro-5d-550-70kg',
    supplier: 'Hettich',
    modelName: 'Actro 5D Silent System 550mm Heavy-Duty Runner (70kg)',
    skuCode: 'HET-9257294',
    category: 'drawer_runner',
    mountingVariant: 'undermount',
    nominalLengthMm: 550,
    minInternalCarcassDepthMm: 563,
    shutterThicknessMinMm: 16,
    shutterThicknessMaxMm: 19,
    maxLoadKg: 70,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 4250,
    unitLabel: 'set',
    manufacturerSourceUrl: 'https://www.hettich.com/en-us/services/hettich-cad/cad-downloads',
    cadFormatsPublished: ['DWG', 'DXF', 'STEP', 'IGES'],
    assetLicenseStatus: 'supplier_cad_portal_linked',
    engineeringNotes:
      '5-way adjustment (height, side, tilt, radial, depth) with synchronous control for wide 900–1200mm heavy pot drawers.',
  },
  {
    id: 'blum-tandembox-antaro-500-65kg',
    supplier: 'Blum',
    modelName: 'TANDEMBOX antaro 500mm 65kg Heavy-Duty Tandem Drawer System',
    skuCode: 'BLM-378M5002SA',
    category: 'drawer_system',
    mountingVariant: 'undermount',
    nominalLengthMm: 500,
    minInternalCarcassDepthMm: 503,
    shutterThicknessMinMm: 16,
    shutterThicknessMaxMm: 22,
    maxLoadKg: 65,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 5400,
    unitLabel: 'set',
    manufacturerSourceUrl: 'https://www.blum.com/in/en/products/boxsystems/tandembox-antaro/',
    cadFormatsPublished: ['DWG', 'DXF', 'STEP', 'IGES'],
    assetLicenseStatus: 'supplier_cad_portal_linked',
    engineeringNotes:
      'Double-walled metal box drawer system rated for 65kg dynamic load in 900mm 3-drawer kitchen bases (150mm cutlery + 250mm thali + 320mm pot pan).',
  },
  {
    id: 'blum-aventos-hf-25',
    supplier: 'Blum',
    modelName: 'AVENTOS HF 25 Bi-Fold Overhead Lift System',
    skuCode: 'BLM-20F2500.05',
    category: 'lift_system',
    mountingVariant: 'bifold_lift',
    openingAngleDeg: 104,
    cupDiameterMm: 35,
    shutterThicknessMinMm: 16,
    shutterThicknessMaxMm: 22,
    maxSingleShutterWidthMm: 1200,
    minInternalCarcassDepthMm: 278,
    maxLoadKg: 24,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 6850,
    unitLabel: 'set',
    manufacturerSourceUrl: 'https://www.blum.com/in/en/products/liftsystems/aventos-hf/',
    cadFormatsPublished: ['DWG', 'DXF', 'STEP', 'IGES'],
    assetLicenseStatus: 'supplier_cad_portal_linked',
    engineeringNotes:
      'Bi-fold lift mechanism for two-part horizontal overhead wall cabinets (H 600–900mm, D 320–350mm). Variable stop prevents ceiling collision.',
  },
  {
    id: 'kesseboehmer-lemans-ii-450',
    supplier: 'Kesseböhmer',
    modelName: 'LeMans II Arena Classic 450 Blind Corner Swivel Unit',
    skuCode: 'KB-LM2-450-AR',
    category: 'corner_solution',
    mountingVariant: 'blind_corner',
    minInternalCarcassDepthMm: 500,
    minClearOpeningWidthMm: 411,
    maxLoadKg: 50,
    softCloseIntegrated: true,
    adjustment3D: true,
    priceInrPerUnit: 24500,
    unitLabel: 'set',
    manufacturerSourceUrl: 'https://www.hettich.com/en-us/services/hettich-cad/cad-downloads',
    cadFormatsPublished: ['DWG', 'STEP', 'PDF'],
    assetLicenseStatus: 'verified_spec_metadata_only',
    engineeringNotes:
      'Kidney-shaped independent swing-out trays (25kg per tray). Requires a minimum 450mm shutter (411mm clear door opening) and 50×50mm L-corner dead-space filler.',
  },
  {
    id: 'ebco-gola-profile-j-c-set',
    supplier: 'Ebco',
    modelName: 'Anodized Aluminium Handleless Gola J & C Profile System (3m)',
    skuCode: 'EB-GOLA-JC-3000-BLK',
    category: 'handleless_profile',
    mountingVariant: 'gola_extrusion',
    nominalLengthMm: 3000,
    shutterThicknessMinMm: 16,
    shutterThicknessMaxMm: 22,
    softCloseIntegrated: false,
    adjustment3D: false,
    priceInrPerUnit: 1850,
    unitLabel: 'bar_3m',
    manufacturerSourceUrl: 'https://www.ebco.in/',
    cadFormatsPublished: ['PDF', 'DWG'],
    assetLicenseStatus: 'verified_spec_metadata_only',
    engineeringNotes:
      'Requires CNC gable notch: 26×57mm top J-profile cutout and 26×73mm middle C-profile cutout between drawer banks.',
  },
] as const;

export interface HardwareCompatibilityInput {
  moduleId?: string;
  moduleCategory?: 'hinged_door' | 'drawer_unit' | 'bifold_wall_unit' | 'blind_corner_unit';
  shutterThicknessMm: number;
  shutterWidthMm: number;
  shutterHeightMm: number;
  internalCarcassDepthMm: number;
  expectedDrawerLoadKg?: number;
  clearOpeningWidthMm?: number;
}

export interface HardwareCompatibilityIssue {
  code:
    | 'SHUTTER_TOO_THIN'
    | 'SHUTTER_TOO_THICK'
    | 'SHUTTER_WIDTH_EXCEEDS_HINGE_LIMIT'
    | 'CARCASS_DEPTH_INSUFFICIENT_FOR_RUNNER'
    | 'DRAWER_LOAD_EXCEEDS_RUNNER_RATING'
    | 'BLIND_CORner_OPENING_TOO_NARROW';
  severity: 'blocking' | 'warning';
  message: string;
  remediation: string;
}

export interface HardwareCompatibilityResult {
  fitting: VerifiedHardwareFitting;
  compatible: boolean;
  recommendedHingeCountPerShutter: number;
  issues: HardwareCompatibilityIssue[];
}

export function computeRecommendedHingeCount(
  shutterHeightMm: number,
  shutterWidthMm: number,
  shutterThicknessMm = 18,
): number {
  if (shutterHeightMm <= 0) return 0;
  // Approximate MDF/HDHMR + laminate mass at ~780 kg/m³
  const volumeM3 = (shutterHeightMm / 1000) * (shutterWidthMm / 1000) * (shutterThicknessMm / 1000);
  const weightKg = volumeM3 * 780;

  if (shutterHeightMm <= 900 && weightKg <= 9) return 2;
  if (shutterHeightMm <= 1600 && weightKg <= 15) return 3;
  if (shutterHeightMm <= 2100 && weightKg <= 21) return 4;
  return 5;
}

export function getVerifiedHardwareById(fittingId: string): VerifiedHardwareFitting | undefined {
  return VERIFIED_HARDWARE_REGISTRY.find((item) => item.id === fittingId);
}

export function validateHardwareCompatibility(
  input: HardwareCompatibilityInput,
  fittingId = 'ebco-esoft-linear-hinge-3d-105',
): HardwareCompatibilityResult {
  const fitting =
    getVerifiedHardwareById(fittingId) ?? VERIFIED_HARDWARE_REGISTRY[0];
  const issues: HardwareCompatibilityIssue[] = [];

  if (
    typeof fitting.shutterThicknessMinMm === 'number' &&
    input.shutterThicknessMm < fitting.shutterThicknessMinMm
  ) {
    issues.push({
      code: 'SHUTTER_TOO_THIN',
      severity: 'blocking',
      message: `${fitting.supplier} ${fitting.modelName} requires minimum ${fitting.shutterThicknessMinMm}mm shutter thickness (received ${input.shutterThicknessMm}mm). Ø35mm cup bore (${fitting.cupDepthMm ?? 11.5}mm deep) risks blowing through the front face.`,
      remediation: `Upgrade shutter core to at least ${fitting.shutterThicknessMinMm}mm (standard 18mm HDHMR / IS:710 BWP).`,
    });
  }

  if (
    typeof fitting.shutterThicknessMaxMm === 'number' &&
    input.shutterThicknessMm > fitting.shutterThicknessMaxMm
  ) {
    issues.push({
      code: 'SHUTTER_TOO_THICK',
      severity: 'blocking',
      message: `${fitting.supplier} ${fitting.modelName} supports maximum ${fitting.shutterThicknessMaxMm}mm shutter thickness (received ${input.shutterThicknessMm}mm). Adjacent door reveal will bind at ${fitting.openingAngleDeg ?? 105}° swing.`,
      remediation:
        fitting.supplier === 'Ebco'
          ? 'Switch to Hettich Sensys 8645i TH52 (supports up to 24mm thick shutters) or reduce shutter core thickness to ≤22mm.'
          : `Reduce shutter thickness to ≤${fitting.shutterThicknessMaxMm}mm.`,
    });
  }

  if (
    typeof fitting.maxSingleShutterWidthMm === 'number' &&
    input.shutterWidthMm > fitting.maxSingleShutterWidthMm
  ) {
    issues.push({
      code: 'SHUTTER_WIDTH_EXCEEDS_HINGE_LIMIT',
      severity: 'blocking',
      message: `Single shutter width (${input.shutterWidthMm}mm) exceeds ${fitting.supplier} ${fitting.modelName} anti-sag limit of ${fitting.maxSingleShutterWidthMm}mm.`,
      remediation: `Auto-split into 2 equal shutters of ${Math.round(input.shutterWidthMm / 2)}mm or use Ultida's Equal-Shutter Wall Divider.`,
    });
  }

  if (
    typeof fitting.minInternalCarcassDepthMm === 'number' &&
    input.internalCarcassDepthMm < fitting.minInternalCarcassDepthMm
  ) {
    issues.push({
      code: 'CARCASS_DEPTH_INSUFFICIENT_FOR_RUNNER',
      severity: 'blocking',
      message: `${fitting.supplier} ${fitting.modelName} requires ≥${fitting.minInternalCarcassDepthMm}mm internal carcass depth (current internal depth: ${input.internalCarcassDepthMm}mm).`,
      remediation:
        input.internalCarcassDepthMm >= 463
          ? 'Switch to Hettich Quadro V6 450mm runner (min 463mm internal depth).'
          : `Increase cabinet depth so internal clear depth is at least ${fitting.minInternalCarcassDepthMm}mm.`,
    });
  }

  if (
    typeof fitting.maxLoadKg === 'number' &&
    typeof input.expectedDrawerLoadKg === 'number' &&
    input.expectedDrawerLoadKg > fitting.maxLoadKg
  ) {
    issues.push({
      code: 'DRAWER_LOAD_EXCEEDS_RUNNER_RATING',
      severity: 'blocking',
      message: `Expected drawer load (${input.expectedDrawerLoadKg}kg) exceeds ${fitting.supplier} ${fitting.modelName} dynamic rating of ${fitting.maxLoadKg}kg.`,
      remediation:
        'Upgrade to Blum TANDEMBOX antaro 65kg or Hettich Actro 5D 70kg heavy-duty runner.',
    });
  }

  if (
    typeof fitting.minClearOpeningWidthMm === 'number' &&
    typeof input.clearOpeningWidthMm === 'number' &&
    input.clearOpeningWidthMm < fitting.minClearOpeningWidthMm
  ) {
    issues.push({
      code: 'BLIND_CORner_OPENING_TOO_NARROW',
      severity: 'blocking',
      message: `${fitting.modelName} requires ≥${fitting.minClearOpeningWidthMm}mm clear door opening (received ${input.clearOpeningWidthMm}mm).`,
      remediation: 'Use at least a 450mm shutter with a 50×50mm L-corner filler.',
    });
  }

  const recommendedHingeCountPerShutter =
    fitting.category === 'hinge'
      ? computeRecommendedHingeCount(
          input.shutterHeightMm,
          input.shutterWidthMm,
          input.shutterThicknessMm,
        )
      : 0;

  return {
    fitting,
    compatible: issues.every((issue) => issue.severity !== 'blocking'),
    recommendedHingeCountPerShutter,
    issues,
  };
}

export function recommendVerifiedHardwareForModule(
  input: HardwareCompatibilityInput,
): {
  primaryFitting: VerifiedHardwareFitting;
  secondaryFitting?: VerifiedHardwareFitting;
  validation: HardwareCompatibilityResult;
} {
  if (input.moduleCategory === 'bifold_wall_unit') {
    const validation = validateHardwareCompatibility(input, 'blum-aventos-hf-25');
    return {
      primaryFitting: validation.fitting,
      validation,
    };
  }

  if (input.moduleCategory === 'blind_corner_unit') {
    const validation = validateHardwareCompatibility(input, 'kesseboehmer-lemans-ii-450');
    const hingeFit = getVerifiedHardwareById('ebco-esoft-linear-hinge-3d-105');
    return {
      primaryFitting: validation.fitting,
      secondaryFitting: hingeFit,
      validation,
    };
  }

  if (input.moduleCategory === 'drawer_unit') {
    const needsHeavyDuty = (input.expectedDrawerLoadKg ?? 25) > 30 || input.shutterWidthMm >= 750;
    const runnerId = needsHeavyDuty
      ? 'blum-tandembox-antaro-500-65kg'
      : input.internalCarcassDepthMm >= 513
        ? 'hettich-quadro-v6-500-silent'
        : 'hettich-quadro-v6-450-silent';
    const validation = validateHardwareCompatibility(input, runnerId);
    return {
      primaryFitting: validation.fitting,
      validation,
    };
  }

  // Default hinged door selection: Ebco for 14-22mm, Hettich Sensys for 22-24mm
  const hingeId =
    input.shutterThicknessMm > 22
      ? 'hettich-sensys-8645i-110'
      : 'ebco-esoft-linear-hinge-3d-105';
  const validation = validateHardwareCompatibility(input, hingeId);
  const runnerCandidate =
    input.internalCarcassDepthMm >= 513
      ? getVerifiedHardwareById('hettich-quadro-v6-500-silent')
      : input.internalCarcassDepthMm >= 463
        ? getVerifiedHardwareById('hettich-quadro-v6-450-silent')
        : undefined;

  return {
    primaryFitting: validation.fitting,
    secondaryFitting: runnerCandidate,
    validation,
  };
}

/** Starter fitting records transcribed from official manufacturer pages on 2026-10-13.
 * These are RESEARCH records, not licensed CAD models or factory-authorized drilling programs.
 * Source versions, stock and all fit conditions must be rechecked for production.
 */
export type FittingBrand = 'Ebco' | 'Hettich';
export type FittingRecord = {
  id: string; brand: FittingBrand; code: string; label: string;
  kind: 'hinge' | 'drawer_runner'; sourceUrl: string; reviewedOn: string;
  reviewedSpecification: true; cadAssetStatus: 'not_imported';
  parameters: {
    minShutterThicknessMm?: number; maxShutterThicknessMm?: number;
    maxShutterWidthTwoHingesMm?: number; maxShutterHeightTwoHingesMm?: number;
    maxShutterWeightTwoHingesKg?: number; openingAngleDeg?: number;
    cupDiameterMm?: number; cupDepthMm?: number;
    nominalLengthMm?: number; minCabinetDepthMm?: number;
    maxDrawerSideThicknessMm?: number; loadClassKg?: number;
    runnerSide?: 'left' | 'right';
  };
};
export const STARTER_FITTINGS: readonly FittingRecord[] = [
  {id:'ebco-esl1',brand:'Ebco',code:'ESL1',label:'E Soft Linear Hinge 3D — Full Overlay, Nickel',kind:'hinge',
    sourceUrl:'https://www.ebco.in/ebco/e-soft-linear-hinge-3d',reviewedOn:'2026-10-13',reviewedSpecification:true,cadAssetStatus:'not_imported',
    parameters:{minShutterThicknessMm:14,maxShutterThicknessMm:22,maxShutterWidthTwoHingesMm:600,maxShutterHeightTwoHingesMm:900,maxShutterWeightTwoHingesKg:6,openingAngleDeg:105,cupDiameterMm:35,cupDepthMm:11.4}},
  {id:'ebco-esl2',brand:'Ebco',code:'ESL2',label:'E Soft Linear Hinge 3D — Half Overlay, Nickel',kind:'hinge',
    sourceUrl:'https://www.ebco.in/ebco/e-soft-linear-hinge-3d',reviewedOn:'2026-10-13',reviewedSpecification:true,cadAssetStatus:'not_imported',
    parameters:{minShutterThicknessMm:14,maxShutterThicknessMm:22,maxShutterWidthTwoHingesMm:600,maxShutterHeightTwoHingesMm:900,maxShutterWeightTwoHingesKg:6,openingAngleDeg:105,cupDiameterMm:35,cupDepthMm:11.4}},
  {id:'hettich-9099124',brand:'Hettich',code:'9099124',label:'Quadro V6 Silent System — 450 mm, Left',kind:'drawer_runner',
    sourceUrl:'https://shop.hettich.com/in_EN/Runner-systems/Concealed-drawer-runners/Quadro-drawer-runners/Quadro-V6/Quadro-V6-with-Silent-System%2C-450-mm%2C-left/p/9099124',reviewedOn:'2026-10-13',reviewedSpecification:true,cadAssetStatus:'not_imported',
    parameters:{nominalLengthMm:450,minCabinetDepthMm:463,maxDrawerSideThicknessMm:16,loadClassKg:30,runnerSide:'left'}},
  {id:'hettich-9099125',brand:'Hettich',code:'9099125',label:'Quadro V6 Silent System — 450 mm, Right',kind:'drawer_runner',
    sourceUrl:'https://shop.hettich.com/in_EN/Runner-systems/Concealed-drawer-runners/Quadro-drawer-runners/Quadro-V6/Quadro-V6-with-Silent-System%2C-450-mm%2C-right/p/9099125',reviewedOn:'2026-10-13',reviewedSpecification:true,cadAssetStatus:'not_imported',
    parameters:{nominalLengthMm:450,minCabinetDepthMm:463,maxDrawerSideThicknessMm:16,loadClassKg:30,runnerSide:'right'}},
] as const;
export type FittingFitRequest = {
  kind: 'hinge'|'drawer_runner'; shutterThicknessMm?:number; shutterWidthMm?:number; shutterHeightMm?:number;
  shutterMassKg?:number; hingeCount?:number;
  cabinetInternalDepthMm?:number; drawerSideThicknessMm?:number; drawerLoadKg?:number;
  nominalRunnerLengthMm?:number;
};
export function checkFittingCompatibility(fitting:FittingRecord,request:FittingFitRequest):{compatible:boolean;issues:string[]} {
  const issues:string[]=[];
  const p=fitting.parameters;
  const dimensions = ['shutterThicknessMm', 'shutterWidthMm', 'shutterHeightMm', 'cabinetInternalDepthMm', 'drawerSideThicknessMm', 'nominalRunnerLengthMm'] as const;
  for (const key of dimensions) {
    const value = request[key];
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) issues.push(`${key} must be a finite positive measurement.`);
  }
  for (const key of ['shutterMassKg', 'drawerLoadKg'] as const) {
    const value = request[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) issues.push(`${key} must be a finite nonnegative load.`);
  }
  if(fitting.kind!==request.kind)issues.push('Fitting family does not match target.');
  if(fitting.kind==='hinge') {
    if(request.shutterThicknessMm==null)issues.push('Shutter thickness must be supplied.');
    else if(request.shutterThicknessMm<(p.minShutterThicknessMm??0)||request.shutterThicknessMm>(p.maxShutterThicknessMm??Infinity)) issues.push('Shutter thickness is outside the published hinge range.');
    if(request.hingeCount!==2)issues.push('This starter record only verifies the manufacturer two-hinge example; consult manufacturer data for other counts.');
    if(request.shutterWidthMm==null||request.shutterHeightMm==null||request.shutterMassKg==null) issues.push('Shutter width, height and mass are required for the two-hinge check.');
    else {
      if(request.shutterWidthMm>(p.maxShutterWidthTwoHingesMm??Infinity))issues.push('Shutter exceeds published two-hinge width.');
      if(request.shutterHeightMm>(p.maxShutterHeightTwoHingesMm??Infinity))issues.push('Shutter exceeds published two-hinge height.');
      if(request.shutterMassKg>(p.maxShutterWeightTwoHingesKg??Infinity))issues.push('Shutter exceeds published two-hinge mass.');
    }
  }else{
    if(request.cabinetInternalDepthMm==null||request.cabinetInternalDepthMm<(p.minCabinetDepthMm??0))issues.push('Cabinet body depth is unverified or below the published minimum.');
    if(request.drawerSideThicknessMm==null||request.drawerSideThicknessMm>(p.maxDrawerSideThicknessMm??Infinity))issues.push('Drawer side thickness is unverified or above the published limit.');
    if(request.drawerLoadKg==null||request.drawerLoadKg>(p.loadClassKg??0))issues.push('Drawer load is unverified or exceeds load class.');
    if(request.nominalRunnerLengthMm!==p.nominalLengthMm)issues.push('Nominal runner length does not match published fitting.');
  }
  return {compatible:issues.length===0,issues};
}

/** A runner pair must include both sides of the same verified manufacturer system. */
export function checkRunnerPair(left:FittingRecord,right:FittingRecord,request:FittingFitRequest):{compatible:boolean;issues:string[]} {
  const issues=[...checkFittingCompatibility(left,request).issues,...checkFittingCompatibility(right,request).issues];
  if(left.kind!=='drawer_runner'||right.kind!=='drawer_runner'||left.brand!==right.brand) issues.push('Runners must be from the same verified manufacturer system.');
  if(left.parameters.runnerSide!=='left'||right.parameters.runnerSide!=='right') issues.push('A matched left/right pair is required.');
  if(left.parameters.nominalLengthMm!==right.parameters.nominalLengthMm) issues.push('Nominal runner lengths differ.');
  return {compatible:issues.length===0,issues};
}
