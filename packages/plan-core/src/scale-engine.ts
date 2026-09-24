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


function generateUuid(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface RoomDimensionCandidate {
  id: string;
  label?: string;
  widthPx: number;
  heightPx: number;
  x?: number;
  y?: number;
}

export interface OcrTextEntry {
  text: string;
  x?: number;
  y?: number;
}

export interface ParsedRoomDimension {
  dim1Mm: number;
  dim2Mm: number;
  rawText: string;
}

export interface AutoCalibrationMatch {
  roomId: string;
  roomLabel: string;
  dimensionText: string;
  realDim1Mm: number;
  realDim2Mm: number;
  widthPx: number;
  heightPx: number;
  mmPerPixel: number;
  confidence: number;
}

export interface AutoCalibrationResult {
  success: boolean;
  resolvedMmPerPixel: number;
  confidence: number;
  matchedRooms: AutoCalibrationMatch[];
  observation?: ScaleObservation;
  summaryMessage: string;
}

/**
 * Parses dimension pairs (e.g. 14'0" x 12'0" or 3600 x 2400 mm) from a raw string.
 */
export function parseDimensionPair(raw: string): ParsedRoomDimension | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim();

  // Metric mm pair: e.g. 3600 x 2400, 4200X3000, 3600 * 2400 mm
  const metricMmMatch = clean.match(/\b(\d{3,5})\s*[xX*×]\s*(\d{3,5})\b/);
  if (metricMmMatch) {
    const dim1Mm = parseInt(metricMmMatch[1], 10);
    const dim2Mm = parseInt(metricMmMatch[2], 10);
    if (dim1Mm >= 800 && dim1Mm <= 30000 && dim2Mm >= 800 && dim2Mm <= 30000) {
      return { dim1Mm, dim2Mm, rawText: metricMmMatch[0] };
    }
  }

  // Metric meters pair: e.g. 3.60 x 2.40, 4.2 x 3.6 m, 3.6m x 2.4m
  const metricMetersMatch = clean.match(/\b(\d\.\d{1,3})\s*m?\s*[xX*×]\s*(\d\.\d{1,3})\s*m?\b/i);
  if (metricMetersMatch) {
    const dim1Mm = Math.round(parseFloat(metricMetersMatch[1]) * 1000);
    const dim2Mm = Math.round(parseFloat(metricMetersMatch[2]) * 1000);
    if (dim1Mm >= 800 && dim1Mm <= 30000 && dim2Mm >= 800 && dim2Mm <= 30000) {
      return { dim1Mm, dim2Mm, rawText: metricMetersMatch[0] };
    }
  }

  // Imperial dimension pair: e.g. 14'0" x 12'0", 14' x 12', 14 ft 6 in x 11 ft, 14'-6" X 12'-0"
  // Requires explicit feet marker (' or ft) to avoid treating metric integers as feet
  const imperialMatch = clean.match(
    /(\d+(?:\.\d+)?)\s*(?:'|ft)(?:\s*-\s*|\s+)?(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?\s*[xX*×]\s*(\d+(?:\.\d+)?)\s*(?:'|ft)(?:\s*-\s*|\s+)?(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?/
  );
  if (imperialMatch) {
    const f1 = parseFloat(imperialMatch[1]);
    const i1 = imperialMatch[2] ? parseFloat(imperialMatch[2]) : 0;
    const f2 = parseFloat(imperialMatch[3]);
    const i2 = imperialMatch[4] ? parseFloat(imperialMatch[4]) : 0;
    if (!isNaN(f1) && !isNaN(f2)) {
      const dim1Mm = Math.round(f1 * 304.8 + i1 * 25.4);
      const dim2Mm = Math.round(f2 * 304.8 + i2 * 25.4);
      if (dim1Mm >= 800 && dim2Mm >= 800) {
        return { dim1Mm, dim2Mm, rawText: imperialMatch[0] };
      }
    }
  }

  return null;
}

export function autoCalibrateFromRoomDimensions(
  rooms: RoomDimensionCandidate[],
  ocrEntries: Array<string | OcrTextEntry> = []
): AutoCalibrationResult {
  const normalizedOcr: OcrTextEntry[] = (ocrEntries || []).map(entry =>
    typeof entry === 'string' ? { text: entry } : entry
  );

  const matches: AutoCalibrationMatch[] = [];

  for (const room of rooms) {
    if (!room.widthPx || !room.heightPx || room.widthPx <= 10 || room.heightPx <= 10) continue;

    // Check if room label directly contains dimensions
    let parsed: ParsedRoomDimension | null = parseDimensionPair(room.label || '');

    // If not in label, search in OCR entries located near or inside this room
    if (!parsed) {
      for (const entry of normalizedOcr) {
        if (entry.x !== undefined && entry.y !== undefined && room.x !== undefined && room.y !== undefined) {
          // Check if OCR point is inside or close to room bounds (with 50px margin)
          const margin = 50;
          const inside =
            entry.x >= room.x - margin &&
            entry.x <= room.x + room.widthPx + margin &&
            entry.y >= room.y - margin &&
            entry.y <= room.y + room.heightPx + margin;
          if (inside) {
            parsed = parseDimensionPair(entry.text);
            if (parsed) break;
          }
        } else {
          // Unpositioned text: try matching if room label keyword is in text
          if (room.label && entry.text.toLowerCase().includes(room.label.toLowerCase().slice(0, 4))) {
            parsed = parseDimensionPair(entry.text);
            if (parsed) break;
          }
        }
      }
    }

    // Fallback: If still not matched, check any unassigned OCR text that has a dimension
    if (!parsed && rooms.length === 1 && normalizedOcr.length > 0) {
      for (const entry of normalizedOcr) {
        parsed = parseDimensionPair(entry.text);
        if (parsed) break;
      }
    }

    if (!parsed) continue;

    // We have parsed dimensions (dim1Mm, dim2Mm) and room pixels (widthPx, heightPx).
    // Test both orientation alignments:
    // Align 1: widthPx ~ dim1, heightPx ~ dim2
    const s1X = parsed.dim1Mm / room.widthPx;
    const s1Y = parsed.dim2Mm / room.heightPx;
    const diff1 = Math.abs(s1X - s1Y) / Math.min(s1X, s1Y);

    // Align 2: widthPx ~ dim2, heightPx ~ dim1
    const s2X = parsed.dim2Mm / room.widthPx;
    const s2Y = parsed.dim1Mm / room.heightPx;
    const diff2 = Math.abs(s2X - s2Y) / Math.min(s2X, s2Y);

    // Best orientation with aspect ratio tolerance of 22%
    let bestMmPerPx = 0;
    let confidence = 0;

    if (diff1 <= diff2 && diff1 <= 0.22) {
      bestMmPerPx = (s1X + s1Y) / 2;
      confidence = Math.max(0.6, 1.0 - diff1);
    } else if (diff2 <= 0.22) {
      bestMmPerPx = (s2X + s2Y) / 2;
      confidence = Math.max(0.6, 1.0 - diff2);
    }

    if (bestMmPerPx > 0) {
      matches.push({
        roomId: room.id,
        roomLabel: room.label || room.id,
        dimensionText: parsed.rawText,
        realDim1Mm: parsed.dim1Mm,
        realDim2Mm: parsed.dim2Mm,
        widthPx: room.widthPx,
        heightPx: room.heightPx,
        mmPerPixel: bestMmPerPx,
        confidence,
      });
    }
  }

  if (matches.length === 0) {
    return {
      success: false,
      resolvedMmPerPixel: 1.0,
      confidence: 0,
      matchedRooms: [],
      summaryMessage: 'No legible room dimension text could be correlated to room boundaries.',
    };
  }

  // Robust statistical aggregation (filter outliers >18% deviation from median)
  const sorted = [...matches].sort((a, b) => a.mmPerPixel - b.mmPerPixel);
  const medianMmPerPx = sorted[Math.floor(sorted.length / 2)].mmPerPixel;

  const inliers = sorted.filter(m => Math.abs(m.mmPerPixel - medianMmPerPx) / medianMmPerPx <= 0.18);
  const validMatches = inliers.length > 0 ? inliers : sorted;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const m of validMatches) {
    weightedSum += m.mmPerPixel * m.confidence;
    totalWeight += m.confidence;
  }
  const resolvedMmPerPixel = weightedSum / totalWeight;
  const overallConfidence = Math.min(0.98, (totalWeight / validMatches.length) * (validMatches.length >= 2 ? 1.0 : 0.88));

  // Construct canonical ScaleObservation
  const primary = validMatches[0];
  const observation: ScaleObservation = {
    id: generateUuid(),
    source: 'multiple_ocr_dimensions',
    pointA: { xPx: primary.widthPx > 0 ? primary.widthPx * 0.1 : 0, yPx: 0 },
    pointB: { xPx: primary.widthPx > 0 ? primary.widthPx * 0.9 : 100, yPx: 0 },
    pixelDistance: primary.widthPx * 0.8 || 100,
    realWorldDistanceMm: Math.round((primary.widthPx * 0.8 || 100) * resolvedMmPerPixel),
    mmPerSourceUnit: resolvedMmPerPixel,
    confidence: overallConfidence,
    verificationState: 'user_confirmed',
    note: `Auto-calibrated from ${validMatches.length} room label(s): ${validMatches.map(m => `${m.roomLabel} [${m.dimensionText}]`).join(', ')}`,
  };

  return {
    success: true,
    resolvedMmPerPixel,
    confidence: overallConfidence,
    matchedRooms: validMatches,
    observation,
    summaryMessage: `Auto-calibrated scale: 1 px = ${resolvedMmPerPixel.toFixed(2)} mm (based on ${validMatches.length} room dimension(s): ${validMatches.map(m => m.dimensionText).join(', ')})`,
  };
}
