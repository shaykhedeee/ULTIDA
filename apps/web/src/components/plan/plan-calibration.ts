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

export function requireConfirmedScale<T extends ConfirmedScale>(scale: T | null | undefined, action: string): ScaleRequirementResult<T> {
  return isConfirmedScale(scale)
    ? { allowed: true, scale }
    : { allowed: false, code: 'SCALE_NOT_CONFIRMED', message: `${SCALE_NOT_CONFIRMED_MESSAGE} ${action} cannot continue.` };
}
