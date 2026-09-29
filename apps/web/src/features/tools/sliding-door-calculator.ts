/**
 * sliding-door-calculator.ts — Sliding Wardrobe Shutter & Infill Panel Deduction Engine
 *
 * Produces reviewable draft deductions for:
 * 1. Finished shutter sizes from clear wardrobe opening (W × H), door count (N),
 *    overlap (O), and track/roller height deduction (Dh).
 * 2. Infill panel allowances for 4-sided aluminium profile frames (glass, acrylic, or thin board)
 *    versus direct 18mm/25mm board shutters without profiles.
 * 3. Roller hardware capacity and weight verification (BWP Ply ~750 kg/m³, HDHMR ~850 kg/m³, Glass ~2500 kg/m³).
 * 4. 1-Click generation of certified cutlist NestingPart[] items for Cutlist Studio.
 */

import type { NestingPart } from './cutlist-optimizer';

export interface SlidingHardwareProfilePreset {
  id: string;
  name: string;
  brand: string;
  description: string;
  defaultHeightDeductionMm: number; // Dh (track, top roller, bottom guide/wheel)
  defaultOverlapMm: number;         // O (door-to-door meeting overlap)
  hasSurroundingFrame: boolean;     // Whether panels sit in aluminum profile frame
  sideProfileAllowanceMm: number;   // Deduction per side stile
  topProfileAllowanceMm: number;    // Deduction for top rail
  bottomProfileAllowanceMm: number; // Deduction for bottom rail
  maxDoorWeightKg: number;
}

export const SLIDING_HARDWARE_PRESETS: SlidingHardwareProfilePreset[] = [
  {
    id: 'hafele-classic-50',
    name: 'Hafele Classic Top-Hung (Direct Board)',
    brand: 'Hafele',
    description: 'Heavy-duty 50kg top-hung sliding system for 18mm/25mm solid board shutters without aluminium frame.',
    defaultHeightDeductionMm: 50,
    defaultOverlapMm: 30,
    hasSurroundingFrame: false,
    sideProfileAllowanceMm: 0,
    topProfileAllowanceMm: 0,
    bottomProfileAllowanceMm: 0,
    maxDoorWeightKg: 50,
  },
  {
    id: 'hafele-aluflex-45',
    name: 'Hafele Aluflex 45 Slim Profile (Glass / Board Infill)',
    brand: 'Hafele',
    description: 'Luxury 4-sided aluminium profile system with 35mm side stiles and 50mm top/bottom horizontal rails.',
    defaultHeightDeductionMm: 50,
    defaultOverlapMm: 35,
    hasSurroundingFrame: true,
    sideProfileAllowanceMm: 35,
    topProfileAllowanceMm: 50,
    bottomProfileAllowanceMm: 50,
    maxDoorWeightKg: 80,
  },
  {
    id: 'ozone-super-slim-20',
    name: 'Ozone Super-Slim 20 Minimalist Profile',
    brand: 'Ozone',
    description: 'Minimalist 20mm visible aluminum profile frame with concealed soft-closing damper rollers.',
    defaultHeightDeductionMm: 45,
    defaultOverlapMm: 25,
    hasSurroundingFrame: true,
    sideProfileAllowanceMm: 20,
    topProfileAllowanceMm: 35,
    bottomProfileAllowanceMm: 35,
    maxDoorWeightKg: 65,
  },
  {
    id: 'ebco-slide-comfort-40',
    name: 'Ebco Slide-Comfort Inset Bottom Roller',
    brand: 'Ebco',
    description: 'Bottom-running floor track system with top guide channel for cost-effective modular wardrobes.',
    defaultHeightDeductionMm: 40,
    defaultOverlapMm: 30,
    hasSurroundingFrame: false,
    sideProfileAllowanceMm: 0,
    topProfileAllowanceMm: 0,
    bottomProfileAllowanceMm: 0,
    maxDoorWeightKg: 45,
  },
  {
    id: 'ebco-slim-profile-glass',
    name: 'Ebco Slim Profile 4-Side Fluted Glass Shutter',
    brand: 'Ebco',
    description: 'Anodized black/champagne aluminium profile for 4-8mm fluted toughened glass or mirror infill.',
    defaultHeightDeductionMm: 48,
    defaultOverlapMm: 32,
    hasSurroundingFrame: true,
    sideProfileAllowanceMm: 28,
    topProfileAllowanceMm: 42,
    bottomProfileAllowanceMm: 42,
    maxDoorWeightKg: 60,
  },
  {
    id: 'custom-hardware',
    name: 'Custom Manufacturer Specification',
    brand: 'Custom',
    description: 'Enter exact manufacturer catalog track deductions, overlaps, and profile stile/rail allowances.',
    defaultHeightDeductionMm: 50,
    defaultOverlapMm: 30,
    hasSurroundingFrame: false,
    sideProfileAllowanceMm: 0,
    topProfileAllowanceMm: 0,
    bottomProfileAllowanceMm: 0,
    maxDoorWeightKg: 60,
  },
];

export interface SlidingDoorInput {
  openingWidthMm: number;
  openingHeightMm: number;
  doorCount: number; // typically 2, 3, or 4
  hardwarePresetId: string;
  customHeightDeductionMm?: number;
  customOverlapMm?: number;
  isProfileFrame?: boolean;
  sideProfileAllowanceMm?: number;
  topProfileAllowanceMm?: number;
  bottomProfileAllowanceMm?: number;
  materialType: 'plywood_18' | 'hdhmr_18' | 'mdf_18' | 'glass_fluted_8' | 'mirror_6' | 'acrylic_12';
  decorativeLaminateCode?: string;
  /** Stable batch identifier for part IDs, supplied when committing a calculation. */
  calculationId?: string;
  wardrobeModuleName?: string;
  roomName?: string;
}

export interface SlidingDoorResult {
  openingWidthMm: number;
  openingHeightMm: number;
  doorCount: number;
  overlapMm: number;
  heightDeductionMm: number;
  finishedShutterWidthMm: number;
  finishedShutterHeightMm: number;
  isProfileFrame: boolean;
  infillWidthMm: number;
  infillHeightMm: number;
  weightPerDoorKg: number;
  weightCapacityStatus: 'safe' | 'warning' | 'exceeded';
  edgeBandingPerimeterMeters: number;
  formulas: {
    widthFormula: string;
    heightFormula: string;
    infillWidthFormula?: string;
    infillHeightFormula?: string;
  };
  hardwareChecklist: Array<{ name: string; quantity: number; unit?: 'pc' | 'm'; notes: string }>;
  cutlistParts: NestingPart[];
}

const MATERIAL_DENSITIES_KG_M3: Record<SlidingDoorInput['materialType'], { density: number; thicknessMm: number; label: string }> = {
  plywood_18: { density: 750, thicknessMm: 18, label: '18mm BWP Marine Plywood' },
  hdhmr_18: { density: 850, thicknessMm: 18, label: '18mm Action TESA HDHMR' },
  mdf_18: { density: 780, thicknessMm: 18, label: '18mm Interior MDF' },
  glass_fluted_8: { density: 2500, thicknessMm: 8, label: '8mm Tinted Fluted Toughened Glass' },
  mirror_6: { density: 2500, thicknessMm: 6, label: '6mm Clear Mirror with Safety Backing' },
  acrylic_12: { density: 1190, thicknessMm: 12, label: '12mm High-Gloss Acrylic on MR Board' },
};

/**
 * Calculates exact sliding door deductions and finished component sizes
 * based on clear opening dimensions and hardware specifications.
 */
export function calculateSlidingDoorDeductions(input: SlidingDoorInput): SlidingDoorResult {
  const preset = SLIDING_HARDWARE_PRESETS.find((p) => p.id === input.hardwarePresetId);
  if (!preset) throw new RangeError(`Unknown sliding hardware preset: ${input.hardwarePresetId}`);
  if (!Number.isFinite(input.openingWidthMm) || input.openingWidthMm <= 0) throw new RangeError('Enter a measured positive clear opening width in millimetres.');
  if (!Number.isFinite(input.openingHeightMm) || input.openingHeightMm <= 0) throw new RangeError('Enter a measured positive clear opening height in millimetres.');
  if (!Number.isInteger(input.doorCount) || input.doorCount < 2 || input.doorCount > 6) throw new RangeError('Door count must be a whole number from 2 to 6.');

  const W = input.openingWidthMm;
  const H = input.openingHeightMm;
  const N = input.doorCount;
  const isProfileFrame = input.isProfileFrame ?? preset.hasSurroundingFrame;
  if ((input.materialType === 'glass_fluted_8' || input.materialType === 'mirror_6') && !isProfileFrame) {
    throw new RangeError('Glass and mirror infills require a profile-frame system.');
  }

  const O = input.customOverlapMm ?? preset.defaultOverlapMm;
  const Dh = input.customHeightDeductionMm ?? preset.defaultHeightDeductionMm;
  const allowances = [O, Dh, input.sideProfileAllowanceMm ?? preset.sideProfileAllowanceMm, input.topProfileAllowanceMm ?? preset.topProfileAllowanceMm, input.bottomProfileAllowanceMm ?? preset.bottomProfileAllowanceMm];
  if (!allowances.every((value) => Number.isFinite(value) && value >= 0)) throw new RangeError('Overlap, track deduction, and profile allowances must be finite non-negative measurements.');
  if (Dh >= H) throw new RangeError(`Track deduction (${Dh} mm) must be less than the measured opening height (${H} mm).`);

  // Formula 1: Finished Shutter Width = [W + (N - 1) * O] / N
  const totalWidthWithOverlap = W + (N - 1) * O;
  const finishedShutterWidthMm = Math.round((totalWidthWithOverlap / N) * 10) / 10;

  // Formula 2: Finished Shutter Height = H - Dh
  const finishedShutterHeightMm = H - Dh;

  const sideAllowance = isProfileFrame ? (input.sideProfileAllowanceMm ?? preset.sideProfileAllowanceMm) : 0;
  const topAllowance = isProfileFrame ? (input.topProfileAllowanceMm ?? preset.topProfileAllowanceMm) : 0;
  const bottomAllowance = isProfileFrame ? (input.bottomProfileAllowanceMm ?? preset.bottomProfileAllowanceMm) : 0;

  // Formula 3: Infill Panel Width = Shutter Width - (2 * sideAllowance)
  const infillWidthMm = isProfileFrame
    ? Math.round((finishedShutterWidthMm - sideAllowance * 2) * 10) / 10
    : finishedShutterWidthMm;

  // Formula 4: Infill Panel Height = Shutter Height - (topAllowance + bottomAllowance)
  const infillHeightMm = isProfileFrame
    ? Math.round((finishedShutterHeightMm - (topAllowance + bottomAllowance)) * 10) / 10
    : finishedShutterHeightMm;

  // Weight Calculation: Volume in m³ * Density
  const matInfo = MATERIAL_DENSITIES_KG_M3[input.materialType];
  if (!matInfo) throw new RangeError('Select a supported shutter material before calculating panels.');
  if (finishedShutterWidthMm <= 0 || finishedShutterHeightMm <= 0 || infillWidthMm <= 0 || infillHeightMm <= 0) {
    throw new RangeError('The selected deductions leave a zero or negative shutter/infill size. Check the measured opening and hardware profile dimensions.');
  }
  const areaSqm = (infillWidthMm * infillHeightMm) / 1_000_000;
  const volumeM3 = areaSqm * (matInfo.thicknessMm / 1000);
  const weightPerDoorKg = Math.round(volumeM3 * matInfo.density * 10) / 10;

  let weightCapacityStatus: SlidingDoorResult['weightCapacityStatus'] = 'safe';
  if (weightPerDoorKg > preset.maxDoorWeightKg) {
    weightCapacityStatus = 'exceeded';
  } else if (weightPerDoorKg > preset.maxDoorWeightKg * 0.85) {
    weightCapacityStatus = 'warning';
  }

  // Edge Banding per door (perimeter in meters)
  const edgePerimeterM = isProfileFrame ? 0 : Math.round(((finishedShutterWidthMm * 2 + finishedShutterHeightMm * 2) / 1000) * 10) / 10;

  // Hardware Checklist
  const hardwareChecklist: SlidingDoorResult['hardwareChecklist'] = [
    { name: `Top Guide Track (${Math.round(W)} mm)`, quantity: 1, notes: 'Anodized aluminum dual-channel' },
    { name: `Bottom Running Track (${Math.round(W)} mm)`, quantity: 1, notes: 'Concealed/surface mount' },
    { name: 'Roller & Carriage Assembly', quantity: N, notes: `${preset.maxDoorWeightKg}kg rated soft-close synchronized` },
    { name: 'Anti-Jump Guide Pin & Soft-Close Buffer Set', quantity: N, notes: 'Prevents shutter derailment during rapid sliding' },
  ];
  if (isProfileFrame) {
    hardwareChecklist.push(
      { name: 'Vertical Handle Stiles (Left & Right)', quantity: N * 2, notes: `${finishedShutterHeightMm}mm anodized aluminum profile` },
      { name: 'Horizontal Rails (Top & Bottom)', quantity: N * 2, notes: `${finishedShutterWidthMm}mm profile rails with corner brackets` },
      { name: 'EPDM Infill Rubber Gasket Tape', quantity: Math.round(((infillWidthMm * 2 + infillHeightMm * 2) / 1000) * N * 100) / 100, unit: 'm', notes: 'Calculated from infill perimeter × door count; confirm supplier joining/waste allowance.' }
    );
  } else {
    hardwareChecklist.push(
      { name: 'Concealed Shutter Straightener Tensioner Rods', quantity: N * 2, notes: 'Milled into back of 18mm board to prevent warping over 2100mm height' }
    );
  }

  // Cutlist Parts Output
  const moduleName = input.wardrobeModuleName || 'Sliding Wardrobe';
  const roomName = input.roomName || 'Master Bedroom';
  const calculationId = input.calculationId || 'preview';
  if (!/^[a-z0-9_-]{1,80}$/i.test(calculationId)) throw new RangeError('Calculation ID must use only letters, numbers, dashes, or underscores.');
  const cutlistParts: NestingPart[] = [];

  for (let i = 1; i <= N; i++) {
    cutlistParts.push({
      id: `sliding-door-${calculationId}-${i}`,
      partInstanceId: `SLD-${calculationId}-${i}`,
      name: isProfileFrame
        ? `Door ${i} of ${N} Infill Panel (${matInfo.label})`
        : `Door ${i} of ${N} Finished Shutter Board`,
      moduleName,
      roomName,
      classification: 'external_shutter',
      isExternal: true,
      lengthMm: Math.round(infillHeightMm),
      widthMm: Math.round(infillWidthMm),
      thicknessMm: matInfo.thicknessMm,
      quantity: 1,
      materialCode: input.materialType,
      materialName: matInfo.label,
      grainDirection: input.materialType === 'glass_fluted_8' || input.materialType === 'mirror_6' ? 'none' : 'vertical',
      ...(input.materialType !== 'glass_fluted_8' && input.materialType !== 'mirror_6' && input.decorativeLaminateCode ? { externalLaminateCode: input.decorativeLaminateCode } : {}),
      edgeBanding: {
        l1: isProfileFrame ? 'none' : '2.0mm PVC (Impact Resistant)',
        l2: isProfileFrame ? 'none' : '2.0mm PVC (Impact Resistant)',
        w1: isProfileFrame ? 'none' : '2.0mm PVC (Impact Resistant)',
        w2: isProfileFrame ? 'none' : '2.0mm PVC (Impact Resistant)',
        totalLinearMeters: isProfileFrame ? 0 : edgePerimeterM,
      },
      notes: isProfileFrame
        ? `Infill for ${preset.name}. Stile deduction: ${sideAllowance}mm/side, Rail deduction: top ${topAllowance}mm, btm ${bottomAllowance}mm.`
        : `Direct board shutter for ${preset.name}. Clear opening ${W}×${H}mm, Dh=${Dh}mm, Overlap=${O}mm.`,
    });
  }

  return {
    openingWidthMm: W,
    openingHeightMm: H,
    doorCount: N,
    overlapMm: O,
    heightDeductionMm: Dh,
    finishedShutterWidthMm,
    finishedShutterHeightMm,
    isProfileFrame,
    infillWidthMm,
    infillHeightMm,
    weightPerDoorKg,
    weightCapacityStatus,
    edgeBandingPerimeterMeters: edgePerimeterM * N,
    formulas: {
      widthFormula: `Width = [${W} + (${N} - 1) × ${O}] / ${N} = ${finishedShutterWidthMm} mm`,
      heightFormula: `Height = ${H} - ${Dh} (Dh) = ${finishedShutterHeightMm} mm`,
      infillWidthFormula: isProfileFrame
        ? `Infill W = ${finishedShutterWidthMm} - (${sideAllowance} + ${sideAllowance}) = ${infillWidthMm} mm`
        : undefined,
      infillHeightFormula: isProfileFrame
        ? `Infill H = ${finishedShutterHeightMm} - (${topAllowance} + ${bottomAllowance}) = ${infillHeightMm} mm`
        : undefined,
    },
    hardwareChecklist,
    cutlistParts,
  };
}
