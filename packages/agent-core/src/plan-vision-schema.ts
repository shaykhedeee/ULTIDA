import { z } from 'zod';

/**
 * Robust schema for vision-provider floor-plan output.
 *
 * Design choice: the vision model returns JSON, but it will NOT reliably use
 * our exact field names (e.g. it may emit `points` instead of `polygon`, or
 * omit an `id`). We therefore validate TYPES and PRESENCE of the candidate
 * arrays, tolerate missing/aliased fields, and NORMALIZE to our canonical
 * shape in `normalizeVisionOutput()` before reconciliation. This satisfies
 * "validate structured responses" + "require versioned structured output"
 * without pretending the model speaks our exact vocabulary.
 */

const coordPair = z.tuple([z.number(), z.number()]);

const baseCandidate = z.object({
  id: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  label: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(['ai', 'ocr', 'line', 'mixed']).default('ai'),
});

export const RoomCandidateSchema = baseCandidate.extend({
  polygon: z.array(coordPair).optional(),
  points: z.array(coordPair).optional(),
  bbox: z.array(coordPair).optional(),
});

export const WallCandidateSchema = baseCandidate.extend({
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  p1: coordPair.optional(),
  p2: coordPair.optional(),
});

export const OpeningSchema = baseCandidate.extend({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  hingeSide: z.enum(['left', 'right', 'unknown']).optional(),
});

export const DimensionCandidateSchema = baseCandidate.extend({
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  p1: coordPair.optional(),
  p2: coordPair.optional(),
  valueMm: z.number().positive().optional(),
  value: z.union([z.number(), z.string()]).optional(),
});

export const PointCandidateSchema = baseCandidate.extend({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  depth: z.number().optional(),
  height: z.number().optional(),
});

export const StairCandidateSchema = baseCandidate.extend({
  points: z.array(coordPair).min(2).optional(),
  polygon: z.array(coordPair).optional(),
});

export const FixtureCandidateSchema = baseCandidate.extend({
  x: z.number().optional(),
  y: z.number().optional(),
  type: z.enum(['toilet', 'sink', 'bathtub', 'shower', 'stove', 'fridge']).optional(),
});

export const ServiceCandidateSchema = baseCandidate.extend({
  x: z.number().optional(),
  y: z.number().optional(),
  type: z.enum(['electrical', 'plumbing', 'hvac', 'gas']).optional(),
});

export const AnnotationCandidateSchema = baseCandidate.extend({
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
});

export const UncertainRegionSchema = baseCandidate.extend({
  polygon: z.array(coordPair).min(3).optional(),
  reason: z.string().optional(),
});

export const PlanVisionOutputSchema = z.object({
  documentType: z.enum(['plan', 'section', 'elevation', 'detail', 'other']).optional(),
  orientation: z.string().optional(),
  unitSuggestion: z.enum(['mm', 'cm', 'm', 'ft', 'in']).optional(),
  roomCandidates: z.array(RoomCandidateSchema).optional().default([]),
  wallCandidates: z.array(WallCandidateSchema).optional().default([]),
  doorCandidates: z.array(OpeningSchema).optional().default([]),
  windowCandidates: z.array(OpeningSchema).optional().default([]),
  dimensionCandidates: z.array(DimensionCandidateSchema).optional().default([]),
  columnCandidates: z.array(PointCandidateSchema).optional().default([]),
  beamCandidates: z.array(WallCandidateSchema).optional().default([]),
  shaftCandidates: z.array(PointCandidateSchema).optional().default([]),
  stairCandidates: z.array(StairCandidateSchema).optional().default([]),
  fixedFixtures: z.array(FixtureCandidateSchema).optional().default([]),
  services: z.array(ServiceCandidateSchema).optional().default([]),
  annotations: z.array(AnnotationCandidateSchema).optional().default([]),
  uncertainRegions: z.array(UncertainRegionSchema).optional().default([]),
  assumptions: z.array(z.union([z.string(), z.object({}).passthrough()])).optional().default([]),
  warnings: z.array(z.union([z.string(), z.object({}).passthrough()])).optional().default([]),
});

export type PlanVisionOutput = z.infer<typeof PlanVisionOutputSchema>;

/** Normalize a validated-but-loosely-shaped provider response to our canonical form. */
export function normalizeVisionOutput(raw: PlanVisionOutput): PlanVisionOutput {
  let counter = 0;
  const id = (existing?: string) => existing || `c${counter++}`;
  const first = (...vals: Array<number | undefined>) => vals.find((v) => typeof v === 'number') as number | undefined;
  const polyOf = (c: any): Array<[number, number]> | undefined =>
    c.polygon || c.points || c.bbox || undefined;

  return {
    documentType: raw.documentType ?? 'plan',
    orientation: raw.orientation,
    unitSuggestion: raw.unitSuggestion,
    roomCandidates: (raw.roomCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      polygon: polyOf(c) ?? [],
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    wallCandidates: (raw.wallCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x1: first(c.x1, c.p1?.[0]) ?? 0,
      y1: first(c.y1, c.p1?.[1]) ?? 0,
      x2: first(c.x2, c.p2?.[0]) ?? 0,
      y2: first(c.y2, c.p2?.[1]) ?? 0,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    doorCandidates: (raw.doorCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x: c.x ?? 0,
      y: c.y ?? 0,
      width: c.width ?? 0,
      hingeSide: c.hingeSide === 'unknown' ? undefined : c.hingeSide,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    windowCandidates: (raw.windowCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x: c.x ?? 0,
      y: c.y ?? 0,
      width: c.width ?? 0,
      height: c.height ?? 0,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    dimensionCandidates: (raw.dimensionCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x1: first(c.x1, c.p1?.[0]) ?? 0,
      y1: first(c.y1, c.p1?.[1]) ?? 0,
      x2: first(c.x2, c.p2?.[0]) ?? 0,
      y2: first(c.y2, c.p2?.[1]) ?? 0,
      valueMm: typeof c.value === 'number' ? c.value : c.valueMm,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    columnCandidates: (raw.columnCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x: c.x ?? 0,
      y: c.y ?? 0,
      width: c.width,
      depth: c.depth,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    beamCandidates: (raw.beamCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x1: first(c.x1, c.p1?.[0]) ?? 0,
      y1: first(c.y1, c.p1?.[1]) ?? 0,
      x2: first(c.x2, c.p2?.[0]) ?? 0,
      y2: first(c.y2, c.p2?.[1]) ?? 0,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    shaftCandidates: (raw.shaftCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x: c.x ?? 0,
      y: c.y ?? 0,
      width: c.width,
      depth: c.depth,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    stairCandidates: (raw.stairCandidates ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      points: c.points ?? c.polygon ?? [],
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    fixedFixtures: (raw.fixedFixtures ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x: c.x ?? 0,
      y: c.y ?? 0,
      type: c.type,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    services: (raw.services ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x: c.x ?? 0,
      y: c.y ?? 0,
      type: c.type,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    annotations: (raw.annotations ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      x: c.x ?? 0,
      y: c.y ?? 0,
      text: c.text ?? c.label ?? '',
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    uncertainRegions: (raw.uncertainRegions ?? []).map((c) => ({
      id: id(c.id),
      confidence: c.confidence ?? 0.5,
      polygon: c.polygon ?? [],
      reason: c.reason,
      label: c.label,
      notes: c.notes,
      source: c.source,
    })),
    assumptions: (raw.assumptions ?? []).map((a) => (typeof a === 'string' ? a : JSON.stringify(a))),
    warnings: (raw.warnings ?? []).map((w) => (typeof w === 'string' ? w : JSON.stringify(w))),
  };
}
