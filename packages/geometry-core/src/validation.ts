/**
 * geometry-core — deterministic geometry validation.
 *
 * All rules are pure functions returning issue descriptors. A plan cannot be
 * approved while any blocking (critical) issue remains.
 */

import type { CanonicalWall, AnchoredOpening } from './builders.js';
import type { WorldPoint2D } from './coordinate-spaces.js';

export type IssueSeverity = 'warning' | 'critical';

export interface GeometryIssue {
  code: string;
  severity: IssueSeverity;
  entityId?: string;
  message: string;
}

export const IssueCode = {
  UNVERIFIED_SCALE: 'unverified_scale',
  DIMENSION_CONFLICT: 'dimension_conflict',
  OPEN_BOUNDARY: 'open_boundary',
  INVALID_POLYGON: 'invalid_polygon',
  OVERLAPPING_ROOM: 'overlapping_room',
  DISCONNECTED_WALL: 'disconnected_wall',
  ZERO_LENGTH_WALL: 'zero_length_wall',
  INVALID_WALL_INTERSECTION: 'invalid_wall_intersection',
  OPENING_OUTSIDE_WALL: 'opening_outside_wall',
  OPENING_WIDER_THAN_WALL: 'opening_wider_than_wall',
  MISSING_WALL_HEIGHT: 'missing_wall_height',
  MISSING_CEILING_HEIGHT: 'missing_ceiling_height',
} as const;

const EPS = 1e-6;

export interface ValidationContext {
  scaleVerified: boolean;
  walls: CanonicalWall[];
  openings: AnchoredOpening[];
  rooms: Array<{ id: string; worldPolygon: WorldPoint2D[]; ceilingHeightMm?: number }>;
  /** Optional pairwise dimension observations (mm) to detect conflicts. */
  dimensionClaimsMm?: Array<{ label: string; valueMm: number }>;
}

export function validateGeometry(ctx: ValidationContext): GeometryIssue[] {
  const issues: GeometryIssue[] = [];

  // 1. Unverified scale
  if (!ctx.scaleVerified) {
    issues.push({ code: IssueCode.UNVERIFIED_SCALE, severity: 'critical', message: 'Scale is not verified (no vector units, verified dimension, or confirmed calibration).' });
  }

  // 2. Dimension conflict (two claims for same label disagree >1%)
  if (ctx.dimensionClaimsMm && ctx.dimensionClaimsMm.length >= 2) {
    const byLabel = new Map<string, number[]>();
    for (const d of ctx.dimensionClaimsMm) {
      if (!byLabel.has(d.label)) byLabel.set(d.label, []);
      byLabel.get(d.label)!.push(d.valueMm);
    }
    for (const [label, vals] of byLabel) {
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      if (min > 0 && (max - min) / min > 0.01) {
        issues.push({ code: IssueCode.DIMENSION_CONFLICT, severity: 'critical', message: `Dimension "${label}" conflict: ${min}mm vs ${max}mm.` });
      }
    }
  }

  // 10/11. Missing wall height / ceiling height
  for (const w of ctx.walls) {
    if (!w.heightMm || w.heightMm <= 0) {
      issues.push({ code: IssueCode.MISSING_WALL_HEIGHT, severity: 'critical', entityId: w.id, message: `Wall ${w.id} is missing a non-negative height.` });
    }
  }
  for (const r of ctx.rooms) {
    if (!r.ceilingHeightMm || r.ceilingHeightMm <= 0) {
      issues.push({ code: IssueCode.MISSING_CEILING_HEIGHT, severity: 'critical', entityId: r.id, message: `Room ${r.id} is missing a non-negative ceiling height.` });
    }
  }

  // 7. Zero-length wall  +  9. Invalid wall intersection  +  6. Disconnected wall  +  12. invalid intersect
  const wallById = new Map(ctx.walls.map((w) => [w.id, w]));
  for (const w of ctx.walls) {
    const len = Math.hypot(w.worldEnd.xMm - w.worldStart.xMm, w.worldEnd.yMm - w.worldStart.yMm);
    if (len <= EPS) {
      issues.push({ code: IssueCode.ZERO_LENGTH_WALL, severity: 'critical', entityId: w.id, message: `Wall ${w.id} has zero or negative real-world length.` });
    }
  }

  // Pairwise wall intersection check (excluding shared endpoints = connected).
  for (let i = 0; i < ctx.walls.length; i++) {
    for (let j = i + 1; j < ctx.walls.length; j++) {
      const a = ctx.walls[i];
      const b = ctx.walls[j];
      if (segmentsShareEndpoint(a, b)) continue; // connected, not invalid
      const hit = segmentIntersection(a, b);
      if (hit) {
        issues.push({
          code: IssueCode.INVALID_WALL_INTERSECTION,
          severity: 'critical',
          entityId: `${a.id}|${b.id}`,
          message: `Walls ${a.id} and ${b.id} intersect mid-span at (${hit.xMm.toFixed(1)}, ${hit.zMm.toFixed(1)}) — non-manifold geometry.`,
        });
      }
    }
  }

  // 6. Disconnected wall: a wall whose neither endpoint touches any other wall endpoint.
  for (const w of ctx.walls) {
    const connected = ctx.walls.some(
      (o) => o.id !== w.id && (endpointEquals(w, o.worldStart) || endpointEquals(w, o.worldEnd) || endpointEquals(o, w.worldStart) || endpointEquals(o, w.worldEnd))
    );
    if (!connected && ctx.walls.length > 1) {
      issues.push({ code: IssueCode.DISCONNECTED_WALL, severity: 'warning', entityId: w.id, message: `Wall ${w.id} is not connected to any other wall.` });
    }
  }

  // 3. Open boundary + 4. Invalid polygon + 5. Overlapping room
  for (const r of ctx.rooms) {
    const poly = r.worldPolygon;
    if (poly.length < 3) {
      issues.push({ code: IssueCode.INVALID_POLYGON, severity: 'critical', entityId: r.id, message: `Room ${r.id} has fewer than 3 vertices.` });
      continue;
    }
    const first = poly[0];
    const last = poly[poly.length - 1];
    if (Math.abs(first.xMm - last.xMm) > 1e-6 || Math.abs(first.zMm - last.zMm) > 1e-6) {
      issues.push({ code: IssueCode.OPEN_BOUNDARY, severity: 'critical', entityId: r.id, message: `Room ${r.id} boundary is not closed.` });
      continue;
    }
    if (signedArea(poly) <= 0) {
      issues.push({ code: IssueCode.INVALID_POLYGON, severity: 'critical', entityId: r.id, message: `Room ${r.id} polygon is self-intersecting or clockwise (invalid).` });
    }
  }
  // Overlapping rooms (centroid-in-other-room or polygon overlap via centroid test)
  for (let i = 0; i < ctx.rooms.length; i++) {
    for (let j = i + 1; j < ctx.rooms.length; j++) {
      const a = ctx.rooms[i];
      const b = ctx.rooms[j];
      const aInsideB = pointInPolyCentroid(a, b);
      const bInsideA = pointInPolyCentroid(b, a);
      if (aInsideB || bInsideA) {
        issues.push({ code: IssueCode.OVERLAPPING_ROOM, severity: 'critical', entityId: `${a.id}|${b.id}`, message: `Rooms ${a.id} and ${b.id} overlap.` });
      }
    }
  }

  // 8. Opening outside wall + 10. opening wider than wall
  for (const o of ctx.openings) {
    const w = wallById.get(o.wallId);
    if (!w) {
      issues.push({ code: IssueCode.OPENING_OUTSIDE_WALL, severity: 'critical', entityId: o.id, message: `Opening ${o.id} references unknown wall ${o.wallId}.` });
      continue;
    }
    const len = Math.hypot(w.worldEnd.xMm - w.worldStart.xMm, w.worldEnd.yMm - w.worldStart.yMm);
    if (o.offsetMm < -EPS || o.offsetMm > len + EPS) {
      issues.push({ code: IssueCode.OPENING_OUTSIDE_WALL, severity: 'critical', entityId: o.id, message: `Opening ${o.id} offset ${o.offsetMm.toFixed(1)}mm is outside wall ${w.id} (length ${len.toFixed(1)}mm).` });
    }
    if (o.widthMm > len + EPS) {
      issues.push({ code: IssueCode.OPENING_WIDER_THAN_WALL, severity: 'critical', entityId: o.id, message: `Opening ${o.id} width ${o.widthMm}mm exceeds wall ${w.id} length ${len.toFixed(1)}mm.` });
    }
  }

  return issues;
}

function pointInPolyCentroid(a: { worldPolygon: WorldPoint2D[] }, b: { worldPolygon: WorldPoint2D[] }): boolean {
  // Use a Test: is any vertex of `a` strictly inside `b`? (sufficient for gross overlap)
  for (const p of a.worldPolygon) {
    if (pointInPolygon(p, b.worldPolygon)) return true;
  }
  return false;
}

function pointInPolygon(p: WorldPoint2D, poly: WorldPoint2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].xMm, yi = poly[i].zMm;
    const xj = poly[j].xMm, yj = poly[j].zMm;
    if (yi > p.zMm !== yj > p.zMm && p.xMm < ((xj - xi) * (p.zMm - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function endpointEquals(w: CanonicalWall, pt: { xMm: number; yMm: number }): boolean {
  return (
    (Math.abs(w.worldStart.xMm - pt.xMm) < 1e-6 && Math.abs(w.worldStart.yMm - pt.yMm) < 1e-6) ||
    (Math.abs(w.worldEnd.xMm - pt.xMm) < 1e-6 && Math.abs(w.worldEnd.yMm - pt.yMm) < 1e-6)
  );
}

function segmentsShareEndpoint(a: CanonicalWall, b: CanonicalWall): boolean {
  return (
    endpointEquals(a, b.worldStart) ||
    endpointEquals(a, b.worldEnd) ||
    endpointEquals(b, a.worldStart) ||
    endpointEquals(b, a.worldEnd)
  );
}

function signedArea(poly: WorldPoint2D[]): number {
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    area += poly[j].xMm * poly[i].zMm - poly[i].xMm * poly[j].zMm;
  }
  return area / 2;
}

/** Segment intersection (returns the intersection point or null). */
function segmentIntersection(a: CanonicalWall, b: CanonicalWall): WorldPoint2D | null {
  const p = { x: a.worldStart.xMm, y: a.worldStart.yMm };
  const q = { x: b.worldStart.xMm, y: b.worldStart.yMm };
  const r = { x: a.worldEnd.xMm - a.worldStart.xMm, y: a.worldEnd.yMm - a.worldStart.yMm };
  const s = { x: b.worldEnd.xMm - b.worldStart.xMm, y: b.worldEnd.yMm - b.worldStart.yMm };
  const rxs = cross(r, s);
  if (Math.abs(rxs) < EPS) return null; // parallel
  const qp = { x: q.x - p.x, y: q.y - p.y };
  const t = cross(qp, s) / rxs;
  const u = cross(qp, r) / rxs;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null; // only proper mid-span intersections
  return { xMm: p.x + t * r.x, zMm: p.y + t * r.y };
}

function cross(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.x * b.y - a.y * b.x;
}
