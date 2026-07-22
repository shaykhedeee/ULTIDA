import { z } from 'zod';
import { CanonicalPlanModelSchema } from './plan-schema.js';

export type ValidationResult = { valid: boolean; blockingCount: number; issues: Array<{ code: string; severity: 'warning' | 'critical'; entityId?: string; message: string }> };

export function validateCanonicalPlanJson(json: unknown): ValidationResult {
  const parsed = CanonicalPlanModelSchema.safeParse(json);
  const issues: ValidationResult['issues'] = [];
  if (!parsed.success) {
    issues.push({ code: 'UNSUPPORTED_GEOMETRY', severity: 'critical', message: 'Canonical plan payload failed schema validation.' });
    return { valid: false, blockingCount: 1, issues };
  }
  const data = parsed.data;
  for (const wall of data.walls) {
    const dx = wall.worldEnd.xMm - wall.worldStart.xMm;
    const dy = wall.worldEnd.yMm - wall.worldStart.yMm;
    if (Math.hypot(dx, dy) <= 0) issues.push({ code: 'ZERO_LENGTH_WALL', severity: 'critical', entityId: wall.id, message: `Wall ${wall.id} has zero or negative real-world length.` });
    if (!wall.heightMm || wall.heightMm <= 0) issues.push({ code: 'MISSING_WALL_HEIGHT', severity: 'critical', entityId: wall.id, message: `Wall ${wall.id} is missing a non-negative height.` });
  }
  for (const space of data.spaces) {
    const poly = space.worldPolygon ?? space.sourcePolygon.map((pt) => ({ xMm: pt.x, yMm: pt.y }));
    if (poly.length < 3 || Math.abs((poly[0]?.xMm ?? 0) - (poly[poly.length-1]?.xMm ?? 0)) > 1e-6 || Math.abs((poly[0]?.yMm ?? 0) - (poly[poly.length-1]?.yMm ?? 0)) > 1e-6) {
      issues.push({ code: 'OPEN_ROOM_BOUNDARY', severity: 'critical', entityId: space.id, message: `Space ${space.id} boundary is open or too small.` });
    }
  }
  if (!data.source?.verifiedDimensionMm && !data.source?.scaleObservedMm) issues.push({ code: 'INVALID_SCALE', severity: 'critical', message: 'Scale is not verified or calibrated.' });
  if (data.state !== 'approved') issues.push({ code: 'PLAN_NOT_APPROVED', severity: 'critical', message: 'Canonical plan is not approved.' });
  const blockingCount = issues.filter((issue) => issue.severity === 'critical').length;
  return { valid: blockingCount === 0, blockingCount, issues };
}
