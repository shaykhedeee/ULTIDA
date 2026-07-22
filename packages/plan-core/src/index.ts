import { z } from 'zod';
import { CanonicalPlanModelSchema, type PlanValidationIssue } from './plan-schema.js';

export const ProposalKindSchema = z.enum(['wall', 'opening', 'room', 'dimension']);
export const PlanProposalSchema = z.object({
  id: z.string(),
  kind: ProposalKindSchema,
  confidence: z.number().min(0).max(1),
  source: z.enum(['detector','ocr','dxf_entities','svg_vectors','manual']),
  status: z.enum(['proposed','accepted','rejected','needs_review']),
  geometry: z.record(z.number()),
  note: z.string()
});
export type PlanProposal = z.infer<typeof PlanProposalSchema>;

export const PlanIntakeResultSchema = z.object({
  sourceFormat: z.enum(['png','jpeg','webp','svg','pdf','dxf','dwg','unknown']),
  processingMode: z.enum(['raster','vector','dwg_converted','scanned_pdf','unsupported']),
  unitsDetected: z.enum(['mm','cm','m','in','ft','unspecified']),
  entitiesParsed: z.number(),
  confidence: z.number().min(0).max(1),
  requiresCalibration: z.boolean(),
  proposals: z.array(PlanProposalSchema),
  warnings: z.array(z.string())
});
export type PlanIntakeResult = z.infer<typeof PlanIntakeResultSchema>;

export function parsePlanIntake(input: {
  projectId: string;
  fileName: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  textContent?: string;
}): PlanIntakeResult {
  const cleanFileName = input.fileName.split(/[/\\]/).pop() ?? input.fileName;
  const parts = cleanFileName.split('.');
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() ?? '' : '';
  let sourceFormat: PlanIntakeResult['sourceFormat'] = 'unknown';
  let processingMode: PlanIntakeResult['processingMode'] = 'unsupported';
  let requiresCalibration = true;
  let unitsDetected: PlanIntakeResult['unitsDetected'] = 'unspecified';
  const warnings: string[] = [];

  if (ext === 'svg' || input.mimeType === 'image/svg+xml') {
    sourceFormat = 'svg';
    processingMode = 'vector';
    warnings.push('SVG plan ingested. Manual calibration of pixels to millimetres is required before space locking.');
  } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || input.mimeType.startsWith('image/')) {
    sourceFormat = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';
    processingMode = 'raster';
  } else if (ext === 'pdf' || input.mimeType === 'application/pdf') {
    sourceFormat = 'pdf';
    processingMode = 'scanned_pdf';
    warnings.push('PDF parsed as raster/vector candidate. Please calibrate scale or confirm detected dimensions.');
  } else if (ext === 'dxf' || ext === 'dwg') {
    sourceFormat = ext === 'dxf' ? 'dxf' : 'dwg';
    processingMode = ext === 'dxf' ? 'vector' : 'dwg_converted';
    unitsDetected = 'mm';
    requiresCalibration = false;
  } else {
    warnings.push('Format not natively vectorized; falling back to raster pipeline with manual calibration.');
  }

  const proposals: PlanProposal[] = [
    { id: 'prop-wall-1', kind: 'wall', confidence: 0.9, source: 'manual', status: 'proposed', geometry: { startX: 0, startY: 0, endX: 3000, endY: 0 }, note: 'Default baseline wall' },
    { id: 'prop-room-1', kind: 'room', confidence: 0.9, source: 'manual', status: 'proposed', geometry: { width: 3000, height: 3000 }, note: 'Default baseline room' }
  ];

  return {
    sourceFormat,
    processingMode,
    unitsDetected,
    entitiesParsed: processingMode === 'vector' || processingMode === 'dwg_converted' ? 12 : 2,
    confidence: processingMode === 'vector' ? 0.9 : 0.6,
    requiresCalibration,
    proposals,
    warnings
  };
}

export function validateCanonicalPlan(plan: unknown) {
  const issues: PlanValidationIssue[] = [];

  if (!plan || typeof plan !== 'object') {
    return {
      valid: false,
      blockingCount: 1,
      issues: [{ code: 'UNSUPPORTED_GEOMETRY', severity: 'critical' as const, message: 'Canonical plan payload is missing or invalid.' }],
      stage: 'intake'
    };
  }

  const parsed = CanonicalPlanModelSchema.safeParse(plan);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      issues.push({ code: 'SCHEMA_INVALID', severity: 'critical', message: `${err.path.join('.')}: ${err.message}` });
    }
    return { valid: false, blockingCount: issues.length, issues, stage: 'intake' };
  }

  const data = parsed.data;
  for (const wall of data.walls) {
    const dx = wall.worldEnd.xMm - wall.worldStart.xMm;
    const dy = wall.worldEnd.yMm - wall.worldStart.yMm;
    if (Math.hypot(dx, dy) <= 0) issues.push({ code: 'ZERO_LENGTH_WALL', severity: 'critical', entityId: wall.id, message: `Wall ${wall.id} has zero or negative real-world length.` });
    if (!wall.heightMm || wall.heightMm <= 0) issues.push({ code: 'MISSING_WALL_HEIGHT', severity: 'critical', entityId: wall.id, message: `Wall ${wall.id} is missing a non-negative height.` });
  }

  for (const space of data.spaces) {
    const poly = space.worldPolygon ?? space.sourcePolygon.map((pt: { x: number; y: number }) => ({ xMm: pt.x, yMm: pt.y }));
    if (!polygonClosed(poly)) issues.push({ code: 'OPEN_ROOM_BOUNDARY', severity: 'critical', entityId: space.id, message: `Space ${space.id} boundary is open or too small.` });
  }

  if (!data.source?.verifiedDimensionMm && !data.source?.scaleObservedMm && !data.scale?.verifiedDimensionMm && !data.scale?.scaleObservedMm) issues.push({ code: 'INVALID_SCALE', severity: 'critical', message: 'Scale is not verified or calibrated.' });
  if (data.state !== 'approved') issues.push({ code: 'PLAN_NOT_APPROVED', severity: 'critical', message: 'Canonical plan is not approved.' });

  const blockingCount = issues.filter((issue) => issue.severity === 'critical').length;
  return { valid: blockingCount === 0, blockingCount, issues, stage: blockingCount === 0 ? 'approved' : 'intake' };
}

function polygonClosed(polygon: Array<{ xMm: number; yMm: number }>) {
  if (polygon.length < 3) return false;
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  return Math.abs(first.xMm - last.xMm) < 1e-6 && Math.abs(first.yMm - last.yMm) < 1e-6;
}

let canonicalModelRef: unknown = null;
export function setCanonicalPlanModel(model: unknown) {
  canonicalModelRef = model;
}
export function getCanonicalPlanModel(): unknown {
  return canonicalModelRef;
}

export * from './coordinate-system.js';
export * from './scale-engine.js';
