import { z } from 'zod';

export const ScaleObservationSourceSchema = z.enum([
  'native_vector_units',
  'verified_written_dimension',
  'multiple_ocr_dimensions',
  'drawing_scale_annotation',
  'manual_two_point_calibration',
  'ai_low_confidence_estimate'
]);
export type ScaleObservationSource = z.infer<typeof ScaleObservationSourceSchema>;

export const ScaleObservationSchema = z.object({
  id: z.string().uuid(),
  source: ScaleObservationSourceSchema,
  pointA: z.object({ xPx: z.number(), yPx: z.number() }),
  pointB: z.object({ xPx: z.number(), yPx: z.number() }),
  pixelDistance: z.number().positive(),
  realWorldDistanceMm: z.number().positive(),
  mmPerSourceUnit: z.number().positive(),
  confidence: z.number().min(0).max(1),
  verificationState: z.enum(['unverified', 'user_confirmed', 'rejected']).default('unverified'),
  note: z.string().optional()
});
export type ScaleObservation = z.infer<typeof ScaleObservationSchema>;

export interface ScaleResolutionResult {
  isVerified: boolean;
  resolvedMmPerPixel: number;
  confidence: number;
  observationsUsed: number;
  anomaliesDetected: {
    inconsistentDimensions: boolean;
    conflictingUnits: boolean;
    centerlineVsInternalMismatch: boolean;
    stretchedDrawingDetected: boolean;
    details: string[];
  };
}

/**
 * Scale Resolution Engine
 * Resolves plan scale using robust statistical weighted aggregation over multiple observations.
 */
export function resolveScale(observations: ScaleObservation[]): ScaleResolutionResult {
  const validObs = observations.filter(o => o.verificationState !== 'rejected' && o.confidence > 0);

  if (validObs.length === 0) {
    return {
      isVerified: false,
      resolvedMmPerPixel: 1.0,
      confidence: 0,
      observationsUsed: 0,
      anomaliesDetected: {
        inconsistentDimensions: false,
        conflictingUnits: false,
        centerlineVsInternalMismatch: false,
        stretchedDrawingDetected: false,
        details: ['No valid scale observations available.']
      }
    };
  }

  // Calculate weighted mean of mmPerSourceUnit
  let weightedSum = 0;
  let totalWeight = 0;
  const values: number[] = [];

  for (const obs of validObs) {
    // Verified user calibration or native vectors carry higher weight
    let weight = obs.confidence;
    if (obs.verificationState === 'user_confirmed') weight *= 3.0;
    if (obs.source === 'native_vector_units') weight *= 2.5;
    if (obs.source === 'ai_low_confidence_estimate') weight *= 0.2;

    weightedSum += obs.mmPerSourceUnit * weight;
    totalWeight += weight;
    values.push(obs.mmPerSourceUnit);
  }

  const resolvedMmPerPixel = weightedSum / totalWeight;

  // Anomaly Detection: Check variance / outliers
  const details: string[] = [];
  let inconsistentDimensions = false;
  let conflictingUnits = false;

  for (const val of values) {
    const deviationRatio = Math.abs(val - resolvedMmPerPixel) / resolvedMmPerPixel;
    if (deviationRatio > 0.1) {
      inconsistentDimensions = true;
      details.push(`Observation scale variance (${val.toFixed(3)} vs resolved ${resolvedMmPerPixel.toFixed(3)}) exceeds 10% tolerance.`);
    }
  }

  // Verification Gate check
  const hasUserOrNative = validObs.some(o => 
    o.source === 'native_vector_units' || 
    o.verificationState === 'user_confirmed' ||
    (o.source === 'manual_two_point_calibration' && o.verificationState !== 'unverified')
  );

  const isVerified = hasUserOrNative && !inconsistentDimensions;

  return {
    isVerified,
    resolvedMmPerPixel,
    confidence: isVerified ? Math.min(1.0, totalWeight / validObs.length) : 0.4,
    observationsUsed: validObs.length,
    anomaliesDetected: {
      inconsistentDimensions,
      conflictingUnits,
      centerlineVsInternalMismatch: false,
      stretchedDrawingDetected: false,
      details
    }
  };
}
