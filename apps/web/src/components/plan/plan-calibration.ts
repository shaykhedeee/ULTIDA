export type ConfirmedScale = { mmPerPixel: number };

export type ScaleRequirementResult<T extends ConfirmedScale = ConfirmedScale> =
  | { allowed: true; scale: T }
  | { allowed: false; code: 'SCALE_NOT_CONFIRMED'; message: string };

export const SCALE_NOT_CONFIRMED_MESSAGE =
  'Scale not confirmed. This action is blocked until a manual two-point calibration or a trusted vector/PDF dimension source confirms the plan scale.';

/** A newly uploaded plan has no measurement scale until evidence confirms one. */
export function createFreshPlanCalibrationState() {
  return { scale: null as null };
}

export function isConfirmedScale(scale: unknown): scale is ConfirmedScale {
  if (!scale || typeof scale !== 'object') return false;
  const mmPerPixel = Number((scale as { mmPerPixel?: unknown }).mmPerPixel);
  return Number.isFinite(mmPerPixel) && mmPerPixel > 0;
}

export function requireConfirmedScale<T extends ConfirmedScale>(
  scale: T | null | undefined,
  action: string,
): ScaleRequirementResult<T> {
  return isConfirmedScale(scale)
    ? { allowed: true, scale }
    : {
        allowed: false,
        code: 'SCALE_NOT_CONFIRMED',
        message: `${SCALE_NOT_CONFIRMED_MESSAGE} ${action} cannot continue.`,
      };
}

export type CalibrationUnit = 'mm' | 'cm' | 'm' | 'ft-in';

export interface CalibrationPreset {
  id: string;
  label: string;
  lengthMm: number;
  category: 'opening' | 'room' | 'grid';
}

export const COMMON_CALIBRATION_PRESETS_MM: readonly CalibrationPreset[] = [
  { id: 'door-900', label: '900 mm Bedroom Door', lengthMm: 900, category: 'opening' },
  { id: 'door-1050', label: '1050 mm Main Entry Door', lengthMm: 1050, category: 'opening' },
  { id: 'win-1200', label: '1200 mm Standard Window', lengthMm: 1200, category: 'opening' },
  { id: 'win-1500', label: '1500 mm Wide Window', lengthMm: 1500, category: 'opening' },
  { id: 'wall-2400', label: '2400 mm Kitchen / Bath Wall', lengthMm: 2400, category: 'room' },
  { id: 'wall-3000', label: '3000 mm Bedroom Wall (10 ft)', lengthMm: 3000, category: 'room' },
  { id: 'wall-3600', label: '3600 mm Living Span (12 ft)', lengthMm: 3600, category: 'grid' },
] as const;

export function parseCalibrationInputToMm(
  rawInput: string,
  unit: CalibrationUnit = 'mm',
): number | null {
  const trimmed = String(rawInput ?? '').trim();
  if (!trimmed) return null;

  // Support feet-inches notation like 10'6" or 10 ft 6 in
  const ftInMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/i,
  );
  if (ftInMatch) {
    const feet = Number(ftInMatch[1]);
    const inches = ftInMatch[2] ? Number(ftInMatch[2]) : 0;
    const totalMm = Math.round((feet * 12 + inches) * 25.4);
    return totalMm > 0 ? totalMm : null;
  }

  const numeric = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  switch (unit) {
    case 'cm':
      return Math.round(numeric * 10);
    case 'm':
      return Math.round(numeric * 1000);
    case 'ft-in':
      return Math.round(numeric * 304.8);
    case 'mm':
    default:
      return Math.round(numeric);
  }
}

export type SecondDimensionVerificationStatus = 'verified' | 'advisory' | 'blocking';

export interface SecondDimensionVerificationResult {
  printedMm: number;
  measuredMm: number;
  deltaMm: number;
  discrepancyPercent: number;
  status: SecondDimensionVerificationStatus;
  productionReady: boolean;
  summaryMessage: string;
}

export function evaluateSecondDimensionVerification(input: {
  printedMm: number;
  measuredPixels: number;
  mmPerPixel: number;
}): SecondDimensionVerificationResult {
  const printedMm = Math.max(1, Number(input.printedMm));
  const measuredMm = Math.max(0, Math.round(input.measuredPixels * input.mmPerPixel));
  const deltaMm = Math.abs(measuredMm - printedMm);
  const discrepancyPercent = Number(((deltaMm / printedMm) * 100).toFixed(2));

  if (discrepancyPercent <= 2.0) {
    return {
      printedMm,
      measuredMm,
      deltaMm,
      discrepancyPercent,
      status: 'verified',
      productionReady: true,
      summaryMessage: `Second-dimension check verified (${measuredMm} mm measured vs ${printedMm} mm printed, ${discrepancyPercent}% drift ≤ 2%). Safe for factory cutlists.`,
    };
  }

  if (discrepancyPercent <= 5.0) {
    return {
      printedMm,
      measuredMm,
      deltaMm,
      discrepancyPercent,
      status: 'advisory',
      productionReady: true,
      summaryMessage: `Advisory scale drift (${measuredMm} mm vs ${printedMm} mm printed, ${discrepancyPercent}% drift). Suitable for concept design; verify site laser dimensions before CNC release.`,
    };
  }

  return {
    printedMm,
    measuredMm,
    deltaMm,
    discrepancyPercent,
    status: 'blocking',
    productionReady: false,
    summaryMessage: `Scale mismatch detected (${measuredMm} mm vs ${printedMm} mm printed, ${discrepancyPercent}% > 5%). Re-calibrate along a longer structural wall before approving for production.`,
  };
}

export type GuidedPlanStepId =
  | 'import'
  | 'calibrate'
  | 'detect'
  | 'review'
  | 'approve'
  | 'furnish';

export interface GuidedPlanStepDescriptor {
  stepNumber: 1 | 2 | 3 | 4 | 5 | 6;
  id: GuidedPlanStepId;
  title: string;
  subtitle: string;
  status: 'complete' | 'active' | 'pending' | 'attention';
  badgeText: string;
}

export function computeGuidedPlanWorkflowSteps(input: {
  hasSourceFile: boolean;
  isCalibrated: boolean;
  secondReferenceVerified?: boolean;
  totalWalls: number;
  totalRooms: number;
  unreviewedCount: number;
  isApproved: boolean;
}): GuidedPlanStepDescriptor[] {
  const step1Done = input.hasSourceFile;
  const step2Done = input.isCalibrated;
  const step3Done = input.totalWalls > 0 || input.totalRooms > 0;
  const step4Done = step3Done && input.unreviewedCount === 0;
  const step5Done = input.isApproved && step2Done && step4Done;

  return [
    {
      stepNumber: 1,
      id: 'import',
      title: '1. Import',
      subtitle: 'Upload PDF, DXF or raster plan',
      status: step1Done ? 'complete' : 'active',
      badgeText: step1Done ? 'Ready' : 'Upload plan',
    },
    {
      stepNumber: 2,
      id: 'calibrate',
      title: '2. Calibrate',
      subtitle: '2-point scale + 2nd check',
      status: step2Done
        ? input.secondReferenceVerified
          ? 'complete'
          : 'complete'
        : step1Done
          ? 'active'
          : 'pending',
      badgeText: step2Done
        ? input.secondReferenceVerified
          ? '2-Ref Verified'
          : '1-Ref Calibrated'
        : 'Needs scale',
    },
    {
      stepNumber: 3,
      id: 'detect',
      title: '3. Detect',
      subtitle: 'Walls, rooms & openings',
      status: step3Done ? 'complete' : step2Done ? 'active' : 'pending',
      badgeText: step3Done
        ? `${input.totalWalls}W · ${input.totalRooms}R`
        : 'Run detection',
    },
    {
      stepNumber: 4,
      id: 'review',
      title: '4. Review',
      subtitle: 'Confirm inferred geometry',
      status: !step3Done
        ? 'pending'
        : input.unreviewedCount > 0
          ? 'attention'
          : 'complete',
      badgeText:
        input.unreviewedCount > 0
          ? `${input.unreviewedCount} needs review`
          : step3Done
            ? 'All verified'
            : 'Pending',
    },
    {
      stepNumber: 5,
      id: 'approve',
      title: '5. Approve',
      subtitle: 'Lock verified measurements',
      status: step5Done ? 'complete' : step4Done && step2Done ? 'active' : 'pending',
      badgeText: step5Done ? 'Approved' : 'Lock plan',
    },
    {
      stepNumber: 6,
      id: 'furnish',
      title: '6. Furnish',
      subtitle: 'Send to AI & Modular Studio',
      status: step5Done ? 'active' : 'pending',
      badgeText: step5Done ? 'Open Studio' : 'Approve first',
    },
  ];
}
