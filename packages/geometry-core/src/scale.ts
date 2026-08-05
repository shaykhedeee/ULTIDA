/**
 * geometry-core — scale resolution.
 *
 * Priority order (highest first):
 *  1. verified vector units        (native_vector_units)
 *  2. verified explicit dimension  (verified_written_dimension)
 *  3. multiple consistent OCR dims  (multiple_ocr_dimensions)
 *  4. drawing scale annotation      (drawing_scale_annotation)
 *  5. manual two-point calibration  (manual_two_point_calibration)
 *  6. AI estimate (unverified only) (ai_low_confidence_estimate)
 *
 * Deterministic: every resolved scale is a weighted aggregation of observations,
 * never an AI guess used as ground truth. AI estimates are flagged unverified.
 */

import { z } from 'zod';

export const ScaleObservationSourceSchema = z.enum([
  'native_vector_units',
  'verified_written_dimension',
  'multiple_ocr_dimensions',
  'drawing_scale_annotation',
  'manual_two_point_calibration',
  'ai_low_confidence_estimate',
]);
export type ScaleObservationSource = z.infer<typeof ScaleObservationSourceSchema>;

export const PRIORITY: Record<ScaleObservationSource, number> = {
  native_vector_units: 6,
  verified_written_dimension: 5,
  multiple_ocr_dimensions: 4,
  drawing_scale_annotation: 3,
  manual_two_point_calibration: 2,
  ai_low_confidence_estimate: 1,
};

export const VerificationStateSchema = z.enum(['unverified', 'user_confirmed', 'rejected']);
export type VerificationState = z.infer<typeof VerificationStateSchema>;

export const ScaleObservationSchema = z.object({
  id: z.string().min(1),
  source: ScaleObservationSourceSchema,
  pointA: z.object({ xPx: z.number(), yPx: z.number() }),
  pointB: z.object({ xPx: z.number(), yPx: z.number() }),
  pixelDistance: z.number().positive(),
  realWorldDistanceMm: z.number().positive(),
  mmPerSourceUnit: z.number().positive(),
  method: ScaleObservationSourceSchema,
  confidence: z.number().min(0).max(1),
  verificationState: VerificationStateSchema.default('unverified'),
  note: z.string().optional(),
});
export type ScaleObservation = z.infer<typeof ScaleObservationSchema>;

export const ResolvedScaleSchema = z.object({
  isVerified: z.boolean(),
  resolvedMmPerPixel: z.number().positive(),
  confidence: z.number().min(0).max(1),
  resolutionMethod: ScaleObservationSourceSchema,
  observationsUsed: z.number().int().nonnegative(),
  xyDistortion: z.object({
    detected: z.boolean(),
    ratio: z.number().min(0), // max(|sx-sz|)/min(sx,sz); 0 = isotropic
    sx: z.number().positive(),
    sz: z.number().positive(),
  }),
  anomalies: z.object({
    inconsistentDimensions: z.boolean(),
    conflictingUnits: z.boolean(),
    stretchedDrawingDetected: z.boolean(),
    details: z.array(z.string()),
  }),
});
export type ResolvedScale = z.infer<typeof ResolvedScaleSchema>;

const INCONSISTENCY_TOLERANCE = 0.1; // 10% spread triggers a flagged inconsistency

/**
 * Resolve scale from one or more independent observations.
 * - Picks the method by highest PRIORITY among accepted observations.
 * - Aggregates mm/px with priority+confidence+verification weighting.
 * - Detects inconsistent observations (>10% spread) and X/Y (anisotropic) distortion.
 */
export function resolveScale(observations: ScaleObservation[]): ResolvedScale {
  const accepted = observations
    .filter((o) => o.verificationState !== 'rejected' && o.confidence > 0 && o.pixelDistance > 0)
    .map((o) => ScaleObservationSchema.parse(o));

  const defaultResult: ResolvedScale = {
    isVerified: false,
    resolvedMmPerPixel: 1.0,
    confidence: 0,
    resolutionMethod: 'ai_low_confidence_estimate',
    observationsUsed: 0,
    xyDistortion: { detected: false, ratio: 0, sx: 1, sz: 1 },
    anomalies: { inconsistentDimensions: false, conflictingUnits: false, stretchedDrawingDetected: false, details: ['No valid scale observations available.'] },
  };
  if (accepted.length === 0) return defaultResult;

  // ---- Priority-first reconciliation ----
  // Highest-priority accepted observation is authoritative. Lower-priority
  // observations that conflict with it (>tolerance) are treated as outliers and
  // dropped, so a verified dimension or confirmed calibration is never
  // overruled by an unverified AI estimate.
  let topPriority = -1;
  for (const o of accepted) topPriority = Math.max(topPriority, PRIORITY[o.source]);
  const authority = accepted.find((o) => PRIORITY[o.source] === topPriority)!;
  const authoritativeMmPerPx = authority.mmPerSourceUnit;
  const consistent = accepted.filter((o) => {
    const dev = Math.abs(o.mmPerSourceUnit - authoritativeMmPerPx) / authoritativeMmPerPx;
    // An observation is kept if it shares the top priority OR is within tolerance
    // of the authority. Conflicting lower-priority observations are dropped.
    return PRIORITY[o.source] === topPriority || dev <= INCONSISTENCY_TOLERANCE;
  });
  const workingSet = consistent.length > 0 ? consistent : accepted;

  // ---- X/Y distortion detection (only meaningful with >=2 observations spread on both axes) ----
  const xy = detectXyDistortion(workingSet);

  // ---- Weighted aggregation of mm/px ----
  let weightedSum = 0;
  let totalWeight = 0;
  const values: number[] = [];
  let bestPriority = -1;
  let bestMethod: ScaleObservationSource = 'ai_low_confidence_estimate';
  const details: string[] = [];

  for (const obs of workingSet) {
    let weight = obs.confidence;
    if (obs.verificationState === 'user_confirmed') weight *= 3.0;
    if (obs.source === 'native_vector_units') weight *= 2.5;
    if (obs.source === 'ai_low_confidence_estimate') weight *= 0.2;

    weightedSum += obs.mmPerSourceUnit * weight;
    totalWeight += weight;
    values.push(obs.mmPerSourceUnit);

    const p = PRIORITY[obs.source];
    if (p > bestPriority) {
      bestPriority = p;
      bestMethod = obs.source;
    }
  }
  const resolvedMmPerPixel = weightedSum / totalWeight;

  // ---- Inconsistency detection (among the working set) ----
  let inconsistentDimensions = false;
  for (const val of values) {
    const deviation = Math.abs(val - resolvedMmPerPixel) / resolvedMmPerPixel;
    if (deviation > INCONSISTENCY_TOLERANCE) {
      inconsistentDimensions = true;
      details.push(`Observation scale ${val.toFixed(3)} mm/px deviates ${(deviation * 100).toFixed(1)}% from resolved ${resolvedMmPerPixel.toFixed(3)} mm/px (tol ${INCONSISTENCY_TOLERANCE * 100}%).`);
    }
  }

  // A method is "verified" only if it is NOT the AI estimate and observations are consistent.
  const isVerified =
    bestMethod !== 'ai_low_confidence_estimate' && !inconsistentDimensions && !xy.detected;

  return {
    isVerified,
    resolvedMmPerPixel,
    confidence: isVerified ? Math.min(1.0, 0.6 + 0.4 * (totalWeight / accepted.length)) : 0.4,
    resolutionMethod: bestMethod,
    observationsUsed: accepted.length,
    xyDistortion: xy,
    anomalies: {
      inconsistentDimensions,
      conflictingUnits: false,
      stretchedDrawingDetected: xy.detected,
      details,
    },
  };
}

function detectXyDistortion(obs: ScaleObservation[]) {
  // Group observations by dominant axis and compute per-axis mm/px.
  const sxVals: number[] = [];
  const szVals: number[] = [];
  for (const o of obs) {
    const ddx = Math.abs(o.pointB.xPx - o.pointA.xPx);
    const ddy = Math.abs(o.pointB.yPx - o.pointA.yPx);
    const mmPerPx = o.realWorldDistanceMm / o.pixelDistance;
    if (ddx >= ddy) sxVals.push(mmPerPx);
    else szVals.push(mmPerPx);
  }
  if (sxVals.length === 0 || szVals.length === 0) {
    const all = [...sxVals, ...szVals];
    const m = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 1;
    return { detected: false, ratio: 0, sx: m, sz: m };
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const sx = mean(sxVals);
  const sz = mean(szVals);
  const lo = Math.min(sx, sz);
  const hi = Math.max(sx, sz);
  const ratio = lo > 0 ? (hi - lo) / lo : 0;
  return { detected: ratio > INCONSISTENCY_TOLERANCE, ratio, sx, sz };
}

/**
 * Build a manual two-point calibration observation from two source pixels and a
 * known real-world distance. This is the designer's ground truth input.
 */
export function manualTwoPointObservation(input: {
  id: string;
  pointA: { xPx: number; yPx: number };
  pointB: { xPx: number; yPx: number };
  realWorldDistanceMm: number;
  verified?: boolean;
}): ScaleObservation {
  const pixelDistance = Math.hypot(
    input.pointB.xPx - input.pointA.xPx,
    input.pointB.yPx - input.pointA.yPx
  );
  if (pixelDistance <= 0) throw new Error('Manual calibration requires two distinct points.');
  return {
    id: input.id,
    source: 'manual_two_point_calibration',
    method: 'manual_two_point_calibration',
    pointA: input.pointA,
    pointB: input.pointB,
    pixelDistance,
    realWorldDistanceMm: input.realWorldDistanceMm,
    mmPerSourceUnit: input.realWorldDistanceMm / pixelDistance,
    confidence: 1.0,
    verificationState: input.verified === false ? 'unverified' : 'user_confirmed',
  };
}
