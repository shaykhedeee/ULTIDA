import { z } from 'zod';

export type { SpaceRequirementsV1, SpaceGeometryV1, SpaceReadinessV1 } from '@ultida/contracts';
export { SpaceRequirementsV1Schema, SpaceGeometryV1Schema, SpaceReadinessV1Schema,
  LivingRequirementsV1Schema, BedroomRequirementsV1Schema, KitchenRequirementsV1Schema,
  StudyRequirementsV1Schema, PoojaRequirementsV1Schema, UtilityRequirementsV1Schema, DiningRequirementsV1Schema
} from '@ultida/contracts';

// ─── Types for canonical plan fragments used here ─────────────────────────────
type WorldPoint = { xMm: number; yMm: number };
type PlanWall = { id: string; worldGeometry: { start: WorldPoint; end: WorldPoint }; isExterior?: boolean };
type PlanRoom = { id: string; worldGeometry: { polygon: WorldPoint[] }; areaSqm: number; name?: string; type?: string; ceilingHeightMm?: number };
type PlanOpening = { id: string; wallId: string; offsetAlongWallMm: number; kind?: string; widthMm?: number };
type PlanService = { id: string; kind?: string; positionMm?: { xMm: number; yMm: number } };
type PlanObstacle = { id: string; kind?: string; positionMm?: { xMm: number; yMm: number } };

export type CanonicalPlanFragment = {
  ceilingHeightMm: number;
  walls: PlanWall[];
  rooms: PlanRoom[];
  openings: PlanOpening[];
  services?: PlanService[];
  obstacles?: PlanObstacle[];
};

export type PlanIssue = {
  code: string;
  severity: 'warning' | 'critical';
  entityId?: string;
};

// ─── Derived SpaceGeometry from canonical plan.v1 ────────────────────────────
export function deriveSpaceGeometry(
  plan: CanonicalPlanFragment,
  spaceId: string,
  floorPlanVersionId: string
) {
  const room = plan.rooms.find((r) => r.id === spaceId);
  if (!room) {
    return null;
  }

  const polygon = room.worldGeometry.polygon;
  const areaSqm = room.areaSqm ?? computePolygonArea(polygon);
  const perimeterMm = computePolygonPerimeter(polygon);

  // Bounding box
  const xs = polygon.map((p) => p.xMm);
  const ys = polygon.map((p) => p.yMm);
  const boundingBox = {
    widthMm: Math.max(...xs) - Math.min(...xs),
    depthMm: Math.max(...ys) - Math.min(...ys),
  };

  // Find openings on walls that bound this room
  const openingsOnWalls = plan.openings.filter((o) => {
    const wall = plan.walls.find((w) => w.id === o.wallId);
    if (!wall) return false;
    // Check if wall endpoints are near the room polygon boundary
    return isWallNearRoom(wall, polygon);
  });

  // Build usable walls
  const roomWalls = plan.walls.filter((w) => isWallNearRoom(w, polygon));
  const usableWalls = roomWalls.map((wall) => {
    const wallLength = Math.hypot(
      wall.worldGeometry.end.xMm - wall.worldGeometry.start.xMm,
      wall.worldGeometry.end.yMm - wall.worldGeometry.start.yMm
    );
    const wallOpenings = openingsOnWalls
      .filter((o) => o.wallId === wall.id)
      .map((o) => ({
        id: o.id,
        kind: (o.kind ?? 'door') as 'door' | 'window',
        widthMm: o.widthMm ?? 900,
      }));
    return {
      id: wall.id,
      lengthMm: Math.round(wallLength),
      openings: wallOpenings,
      isExterior: wall.isExterior ?? false,
    };
  });

  // Services and obstacles in room bounding box
  const services = (plan.services ?? [])
    .filter((s) => s.positionMm && isPointInBoundingBox(s.positionMm, polygon))
    .map((s) => ({
      id: s.id,
      kind: (s.kind ?? 'electrical') as 'plumbing' | 'electrical' | 'gas' | 'drain',
      positionMm: s.positionMm!,
    }));

  const obstacles = (plan.obstacles ?? [])
    .filter((o) => o.positionMm && isPointInBoundingBox(o.positionMm, polygon))
    .map((o) => ({
      id: o.id,
      kind: o.kind ?? 'column',
      positionMm: o.positionMm!,
    }));

  return {
    spaceId,
    floorPlanVersionId,
    areaSqm: Math.round(areaSqm * 100) / 100,
    perimeterMm: Math.round(perimeterMm),
    boundingBox,
    ceilingHeightMm: room.ceilingHeightMm ?? plan.ceilingHeightMm ?? 2700,
    usableWalls,
    obstacles,
    services,
    derivedAt: new Date().toISOString(),
  };
}
// ─── Readiness Gate ────────────────────────────────────────────────────────────
export function computeSpaceReadiness(
  geometry: ReturnType<typeof deriveSpaceGeometry>,
  requirementsSaved: boolean,
  planIssues: PlanIssue[]
) {
  const blockingReasons: string[] = [];

  const geometryVerified = geometry !== null && geometry.areaSqm > 0;
  if (!geometryVerified) blockingReasons.push('Room geometry could not be derived from the approved floor plan.');

  const heightKnown = geometry !== null && (geometry.ceilingHeightMm ?? 0) > 0;
  if (!heightKnown) blockingReasons.push('Ceiling height is unknown. Set it in room requirements or calibrate the plan.');

  if (!requirementsSaved) blockingReasons.push('Room requirements have not been saved yet.');

  const criticalIssues = planIssues.filter(
    (i) => i.severity === 'critical' && (!i.entityId || i.entityId === geometry?.spaceId)
  );
  const noBlockingPlanIssues = criticalIssues.length === 0;
  if (!noBlockingPlanIssues) {
    blockingReasons.push(`${criticalIssues.length} critical plan issue(s) must be resolved before this room is ready.`);
  }

  const ready = geometryVerified && heightKnown && requirementsSaved && noBlockingPlanIssues;

  return {
    spaceId: geometry?.spaceId ?? '',
    geometryVerified,
    heightKnown,
    requirementsSaved,
    noBlockingPlanIssues,
    ready,
    blockingReasons,
  };
}

// ─── Spaces Approval Gate ──────────────────────────────────────────────────────
export function canApproveSpaces(readinessResults: Array<ReturnType<typeof computeSpaceReadiness>>): {
  approved: boolean;
  blockedRooms: string[];
  totalRooms: number;
  readyRooms: number;
} {
  const blockedRooms = readinessResults.filter((r) => !r.ready).map((r) => r.spaceId);
  return {
    approved: blockedRooms.length === 0 && readinessResults.length > 0,
    blockedRooms,
    totalRooms: readinessResults.length,
    readyRooms: readinessResults.filter((r) => r.ready).length,
  };
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function computePolygonArea(polygon: WorldPoint[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].xMm * polygon[j].yMm;
    area -= polygon[j].xMm * polygon[i].yMm;
  }
  return Math.abs(area) / 2 / 1_000_000; // mm² → m²
}

function computePolygonPerimeter(polygon: WorldPoint[]): number {
  let perimeter = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += Math.hypot(polygon[j].xMm - polygon[i].xMm, polygon[j].yMm - polygon[i].yMm);
  }
  return perimeter;
}

function isWallNearRoom(wall: PlanWall, polygon: WorldPoint[]): boolean {
  const xs = polygon.map((p) => p.xMm);
  const ys = polygon.map((p) => p.yMm);
  const minX = Math.min(...xs) - 200;
  const maxX = Math.max(...xs) + 200;
  const minY = Math.min(...ys) - 200;
  const maxY = Math.max(...ys) + 200;
  const { start, end } = wall.worldGeometry;
  const startNear = start.xMm >= minX && start.xMm <= maxX && start.yMm >= minY && start.yMm <= maxY;
  const endNear = end.xMm >= minX && end.xMm <= maxX && end.yMm >= minY && end.yMm <= maxY;
  return startNear || endNear;
}

function isPointInBoundingBox(point: { xMm: number; yMm: number }, polygon: WorldPoint[]): boolean {
  const xs = polygon.map((p) => p.xMm);
  const ys = polygon.map((p) => p.yMm);
  return point.xMm >= Math.min(...xs) && point.xMm <= Math.max(...xs) &&
         point.yMm >= Math.min(...ys) && point.yMm <= Math.max(...ys);
}

// ─── Usable-wall calculation (subtract fixed constraints) ─────────────────────
export interface WallDeduction {
  id: string;
  kind: "opening" | "column" | "shaft" | "curtain_zone" | "ac_restriction" | "fixed_fixture";
  widthMm: number;
  clearanceMm?: number; // required working clearance added on each side
}

export interface UsableWallResult {
  totalWallMm: number;
  deductionsMm: number;
  usableWallMm: number;
  breakdown: Array<{ kind: WallDeduction["kind"]; id: string; widthMm: number; clearanceMm: number }>;
}

/**
 * Total usable wall length for a room = sum of bounding-wall lengths minus every
 * fixed obstruction (openings, columns, shafts, curtain zones, AC restrictions,
 * fixed fixtures) and their required clearances. Pure + deterministic.
 */
export function computeUsableWallLength(
  roomWalls: Array<{ id: string; lengthMm: number }>,
  deductions: WallDeduction[] = []
): UsableWallResult {
  const totalWallMm = roomWalls.reduce((sum, w) => sum + Math.max(0, w.lengthMm), 0);
  const breakdown: UsableWallResult["breakdown"] = [];
  let deductionsMm = 0;
  for (const d of deductions) {
    const clearance = d.clearanceMm ?? 0;
    const occupied = Math.max(0, d.widthMm) + clearance * 2;
    deductionsMm += occupied;
    breakdown.push({ kind: d.kind, id: d.id, widthMm: Math.max(0, d.widthMm), clearanceMm: clearance });
  }
  const usableWallMm = Math.max(0, Math.round(totalWallMm - deductionsMm));
  return { totalWallMm: Math.round(totalWallMm), deductionsMm: Math.round(deductionsMm), usableWallMm, breakdown };
}

// ─── Structural edits → derived plan version (never mutate the immutable source) ─
export interface DerivedPlanFragment extends CanonicalPlanFragment {
  derivedFromVersionId: string;
  revisionLabel: string;
}

export interface EditResult {
  fragment: DerivedPlanFragment;
  derivedVersionId: string;
}

function newVersionId(): string {
  return "derived-" + Math.random().toString(36).slice(2, 10);
}

export function deriveFragment(source: CanonicalPlanFragment, revisionLabel = "spaces-edit"): DerivedPlanFragment {
  return {
    ...source,
    walls: source.walls.map((w) => ({ ...w })),
    rooms: source.rooms.map((r) => ({ ...r, worldGeometry: { polygon: r.worldGeometry.polygon.map((p) => ({ ...p })) } })),
    openings: source.openings.map((o) => ({ ...o })),
    services: (source.services ?? []).map((s) => ({ ...s })),
    obstacles: (source.obstacles ?? []).map((o) => ({ ...o })),
    derivedFromVersionId: (source as any).versionId ?? "approved",
    revisionLabel,
  };
}

export function editAddWall(source: CanonicalPlanFragment, wall: PlanWall): EditResult {
  const f = deriveFragment(source);
  f.walls.push(wall);
  return { fragment: f, derivedVersionId: f.derivedFromVersionId + ":" + newVersionId() };
}
export function editAddOpening(source: CanonicalPlanFragment, opening: PlanOpening): EditResult {
  const f = deriveFragment(source);
  f.openings.push(opening);
  return { fragment: f, derivedVersionId: f.derivedFromVersionId + ":" + newVersionId() };
}
export function editAddColumn(source: CanonicalPlanFragment, column: PlanObstacle): EditResult {
  const f = deriveFragment(source);
  f.obstacles = [...(f.obstacles ?? []), column];
  return { fragment: f, derivedVersionId: f.derivedFromVersionId + ":" + newVersionId() };
}
export function editSplitRoom(source: CanonicalPlanFragment, roomId: string, polygonA: WorldPoint[], polygonB: WorldPoint[]): EditResult {
  const f = deriveFragment(source);
  f.rooms = f.rooms.flatMap((r) => {
    if (r.id !== roomId) return [r];
    const areaA = computePolygonArea(polygonA);
    const areaB = computePolygonArea(polygonB);
    const base = { ceilingHeightMm: r.ceilingHeightMm ?? source.ceilingHeightMm };
    return [
      { ...r, id: r.id + "-a", worldGeometry: { polygon: polygonA }, areaSqm: areaA },
      { ...r, id: r.id + "-b", worldGeometry: { polygon: polygonB }, areaSqm: areaB },
    ].map((x: any) => ({ ...x, ...base }));
  });
  return { fragment: f, derivedVersionId: f.derivedFromVersionId + ":" + newVersionId() };
}
export function editMergeRooms(source: CanonicalPlanFragment, roomIds: string[], mergedPolygon: WorldPoint[]): EditResult {
  const f = deriveFragment(source);
  const kept = f.rooms.filter((r) => !roomIds.includes(r.id));
  const mergedArea = computePolygonArea(mergedPolygon);
  const base = kept[0] ? { ceilingHeightMm: kept[0].ceilingHeightMm ?? source.ceilingHeightMm } : { ceilingHeightMm: source.ceilingHeightMm };
  kept.push({ id: "merged-" + roomIds.join("_"), worldGeometry: { polygon: mergedPolygon }, areaSqm: mergedArea, ...(base as any) } as any);
  f.rooms = kept;
  return { fragment: f, derivedVersionId: f.derivedFromVersionId + ":" + newVersionId() };
}

// ─── Overlap detection (invalid overlap rule) ─────────────────────────────────
function pointInPolygon(p: WorldPoint, poly: WorldPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].xMm, yi = poly[i].yMm, xj = poly[j].xMm, yj = poly[j].yMm;
    const intersect = (yi > p.yMm) !== (yj > p.yMm) && p.xMm < ((xj - xi) * (p.yMm - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function segmentsIntersect(a: WorldPoint, b: WorldPoint, c: WorldPoint, d: WorldPoint): boolean {
  const orient = (o: WorldPoint, p: WorldPoint, q: WorldPoint) =>
    Math.sign((q.yMm - o.yMm) * (p.xMm - o.xMm) - (p.yMm - o.yMm) * (q.xMm - o.xMm));
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return o1 !== o2 && o3 !== o4;
}
export function polygonsOverlap(a: WorldPoint[], b: WorldPoint[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  for (const p of a) if (pointInPolygon(p, b)) return true;
  for (const p of b) if (pointInPolygon(p, a)) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i], a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j], b2 = b[(j + 1) % b.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

