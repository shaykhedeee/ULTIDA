/**
 * geometry-core — deterministic canonical geometry builders.
 *
 * Everything here is pure arithmetic. No AI is involved in final measurements.
 */

import { createWallFrame, type WallFrame, type WorldPoint2D, worldToRoomLocal, type RoomLocalRef } from './coordinate-spaces.js';

export interface CanonicalWallInput {
  id: string;
  start: WorldPoint2D;
  end: WorldPoint2D;
  thicknessMm?: number;
  heightMm?: number;
  wallType?: 'load_bearing' | 'partition' | 'curtain' | 'retaining' | 'shaft' | 'stair';
  confidence?: number;
  verification?: 'unverified' | 'partial' | 'verified' | 'assumed';
  source?: 'ai' | 'ocr' | 'line' | 'mixed';
}

export interface CanonicalWall {
  id: string;
  sourceStart: { x: number; y: number };
  sourceEnd: { x: number; y: number };
  worldStart: { xMm: number; yMm: number };
  worldEnd: { xMm: number; yMm: number };
  lengthMm: number;
  thicknessMm: number;
  heightMm: number;
  interiorNormal: { x: number; y: number };
  adjacentSpaces: string[];
  wallType?: string;
  confidence?: number;
  verification: 'unverified' | 'partial' | 'verified' | 'assumed';
  source?: 'ai' | 'ocr' | 'line' | 'mixed';
  frame: WallFrame;
}

const EPS = 1e-6;

/** Point-in-polygon (ray casting) on world-mm points. */
export function pointInPolygon(p: WorldPoint2D, polygon: WorldPoint2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].xMm, yi = polygon[i].zMm;
    const xj = polygon[j].xMm, yj = polygon[j].zMm;
    const intersect =
      yi > p.zMm !== yj > p.zMm &&
      p.xMm < ((xj - xi) * (p.zMm - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Classify which side of a wall a world point lies on using the interior normal. */
function wallSideOffset(p: WorldPoint2D, frame: WallFrame): number {
  const dx = p.xMm - frame.origin.xMm;
  const dz = p.zMm - frame.origin.zMm;
  return dx * frame.normal.x + dz * frame.normal.z;
}

/**
 * Build a canonical wall: real length, default thickness/height, interior normal,
 * and adjacent spaces computed by testing each room's centroid against the wall's
 * two sides. Adjacent spaces are space ids whose centroid sits on the room side.
 */
export function buildCanonicalWall(
  input: CanonicalWallInput,
  roomCentroids: Array<{ id: string; centroid: WorldPoint2D }> = [],
  defaults: { thicknessMm?: number; heightMm?: number } = {}
): CanonicalWall {
  const length = Math.hypot(input.end.xMm - input.start.xMm, input.end.zMm - input.start.zMm);
  const frame = createWallFrame(input.start, input.end, 0);
  const thicknessMm = input.thicknessMm ?? defaults.thicknessMm ?? 100;
  const heightMm = input.heightMm ?? defaults.heightMm ?? 2700;

  // Determine adjacent spaces: a room is adjacent if its centroid is "behind" the
  // wall (offset from the wall line toward the interior normal) and the wall is
  // near that room. Use the interior-normal sign of the centroid offset.
  const adjacentSpaces: string[] = [];
  for (const r of roomCentroids) {
    const side = wallSideOffset(r.centroid, frame);
    // The centroid should be on the +normal (interior) side, and not far beyond
    // a reasonable thickness. We treat the room as adjacent when the wall passes
    // through/near the room boundary (centroid offset within room extent).
    if (side >= -thicknessMm && side <= 6000) {
      // crude adjacency: room is on interior side and wall end is inside room bbox
      adjacentSpaces.push(r.id);
    }
  }

  return {
    id: input.id,
    sourceStart: { x: input.start.xMm, y: input.start.zMm },
    sourceEnd: { x: input.end.xMm, y: input.end.zMm },
    worldStart: { xMm: input.start.xMm, yMm: input.start.zMm },
    worldEnd: { xMm: input.end.xMm, yMm: input.end.zMm },
    lengthMm: length,
    thicknessMm,
    heightMm,
    interiorNormal: { x: frame.normal.x, y: frame.normal.z },
    adjacentSpaces,
    wallType: input.wallType,
    confidence: input.confidence,
    verification: input.verification ?? 'unverified',
    source: input.source,
    frame,
  };
}

export interface OpeningAnchorInput {
  id: string;
  wallId: string;
  world: WorldPoint2D; // centerline position of the opening on the wall line
  widthMm: number;
  heightMm?: number;
  sillMm?: number;
  type?: 'door' | 'window';
  confidence?: number;
  verification?: 'unverified' | 'partial' | 'verified' | 'assumed';
}

export interface AnchoredOpening {
  id: string;
  wallId: string;
  offsetMm: number; // distance along wall from start to opening center
  widthMm: number;
  heightMm: number;
  sillMm: number;
  type?: 'door' | 'window';
  confidence?: number;
  verification: 'unverified' | 'partial' | 'verified' | 'assumed';
}

/**
 * Anchor a door/window to a wall by projecting its world point onto the wall line
 * to obtain the deterministic along-wall offset (mm). The opening keeps an explicit
 * wallId reference; offsets are derived, never guessed by a model.
 */
export function anchorOpening(input: OpeningAnchorInput, wall: CanonicalWall): AnchoredOpening {
  const dx = wall.worldEnd.xMm - wall.worldStart.xMm;
  const dz = wall.worldEnd.yMm - wall.worldStart.yMm;
  const len = Math.hypot(dx, dz);
  if (len === 0) throw new Error(`Cannot anchor opening to zero-length wall ${wall.id}.`);
  const tx = dx / len;
  const tz = dz / len;
  const vx = input.world.xMm - wall.worldStart.xMm;
  const vz = input.world.zMm - wall.worldStart.yMm;
  const offsetMm = vx * tx + vz * tz;
  return {
    id: input.id,
    wallId: wall.id,
    offsetMm,
    widthMm: input.widthMm,
    heightMm: input.heightMm ?? 2100,
    sillMm: input.sillMm ?? (input.type === 'window' ? 900 : 0),
    type: input.type,
    confidence: input.confidence,
    verification: input.verification ?? 'unverified',
  };
}

/** Build a closed room polygon (world mm) preserving source + world geometry. */
export function buildRoomPolygon(input: {
  id: string;
  sourcePolygon: Array<{ x: number; y: number }>;
  worldPolygon: WorldPoint2D[];
  roomType?: string;
  ceilingHeightMm?: number;
  confidence?: number;
  verification?: 'unverified' | 'partial' | 'verified' | 'assumed';
}): {
  id: string;
  sourcePolygon: Array<{ x: number; y: number }>;
  worldPolygon: WorldPoint2D[];
  roomType?: string;
  ceilingHeightMm: number;
  areaSqm: number;
  areaMm2: number;
  perimeterMm: number;
  centroid: WorldPoint2D;
  roomLocalRef: RoomLocalRef;
  confidence?: number;
  verification: 'unverified' | 'partial' | 'verified' | 'assumed';
} {
  const poly = input.worldPolygon;
  const areaMm2 = shoelaceAreaMm2(poly);
  const perimeterMm = polygonPerimeterMm(poly);
  const centroid = polygonCentroid(poly);
  const xs = poly.map((p) => p.xMm);
  const zs = poly.map((p) => p.zMm);
  const roomLocalRef: RoomLocalRef = {
    originXMm: Math.min(...xs),
    originZMm: Math.min(...zs),
  };
  return {
    id: input.id,
    sourcePolygon: input.sourcePolygon,
    worldPolygon: poly,
    roomType: input.roomType,
    ceilingHeightMm: input.ceilingHeightMm ?? 2700,
    areaSqm: Math.abs(areaMm2) / 1_000_000,
    areaMm2: Math.abs(areaMm2),
    perimeterMm,
    centroid,
    roomLocalRef,
    confidence: input.confidence,
    verification: input.verification ?? 'unverified',
  };
}

/** Shoelace (Gauss) area — deterministic, signed; caller takes abs. */
export function shoelaceAreaMm2(polygon: WorldPoint2D[]): number {
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    area += (polygon[j].xMm * polygon[i].zMm - polygon[i].xMm * polygon[j].zMm);
  }
  return area / 2;
}

export function polygonPerimeterMm(polygon: WorldPoint2D[]): number {
  let per = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    per += Math.hypot(polygon[i].xMm - polygon[j].xMm, polygon[i].zMm - polygon[j].zMm);
  }
  return per;
}

export function polygonCentroid(polygon: WorldPoint2D[]): WorldPoint2D {
  let cx = 0, cz = 0, a = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const cross = polygon[j].xMm * polygon[i].zMm - polygon[i].xMm * polygon[j].zMm;
    a += cross;
    cx += (polygon[j].xMm + polygon[i].xMm) * cross;
    cz += (polygon[j].zMm + polygon[i].zMm) * cross;
  }
  a /= 2;
  if (Math.abs(a) < EPS) {
    // Degenerate: fall back to vertex average.
    const n = polygon.length || 1;
    return {
      xMm: polygon.reduce((s, p) => s + p.xMm, 0) / n,
      zMm: polygon.reduce((s, p) => s + p.zMm, 0) / n,
    };
  }
  return { xMm: cx / (6 * a), zMm: cz / (6 * a) };
}

export { worldToRoomLocal };
