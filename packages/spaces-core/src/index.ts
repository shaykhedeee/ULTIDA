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
