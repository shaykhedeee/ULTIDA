import type { FloorSurfaceV1 } from './index.js';

export interface FloorTilePlacementV1 {
  row: number;
  column: number;
  /** The lower-left tile origin in canonical room millimetres. */
  originMm: { xMm: number; yMm: number };
  kind: 'full' | 'cut';
}

export interface FlooringQuantityV1 {
  surfaceId: string;
  roomId: string;
  materialVersionId: string;
  netAreaSqm: number;
  fullTileCount: number;
  cutTileCount: number;
  totalTileCount: number;
  wastagePct: number;
  skirtingLinearM: number;
  tilePlacements: FloorTilePlacementV1[];
}

type Point = { xMm: number; yMm: number };

const EPSILON = 1e-6;
const round = (value: number, decimals = 6) => Number(value.toFixed(decimals));

function openPolygon(polygon: Point[]): Point[] {
  if (polygon.length > 1 && polygon[0].xMm === polygon[polygon.length - 1].xMm && polygon[0].yMm === polygon[polygon.length - 1].yMm) {
    return polygon.slice(0, -1);
  }
  return polygon;
}

function polygonAreaMm2(polygon: Point[]): number {
  const points = openPolygon(polygon);
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].xMm * next.yMm - next.xMm * points[index].yMm;
  }
  return Math.abs(area) / 2;
}

function polygonPerimeterMm(polygon: Point[]): number {
  const points = openPolygon(polygon);
  return points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + Math.hypot(next.xMm - point.xMm, next.yMm - point.yMm);
  }, 0);
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
  const cross = (point.yMm - start.yMm) * (end.xMm - start.xMm) - (point.xMm - start.xMm) * (end.yMm - start.yMm);
  if (Math.abs(cross) > EPSILON) return false;
  return point.xMm >= Math.min(start.xMm, end.xMm) - EPSILON && point.xMm <= Math.max(start.xMm, end.xMm) + EPSILON && point.yMm >= Math.min(start.yMm, end.yMm) - EPSILON && point.yMm <= Math.max(start.yMm, end.yMm) + EPSILON;
}

function pointInOrOnPolygon(point: Point, polygon: Point[]): boolean {
  const points = openPolygon(polygon);
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index];
    const b = points[previous];
    if (pointOnSegment(point, a, b)) return true;
    if ((a.yMm > point.yMm) !== (b.yMm > point.yMm) && point.xMm < ((b.xMm - a.xMm) * (point.yMm - a.yMm)) / (b.yMm - a.yMm) + a.xMm) inside = !inside;
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.xMm - a.xMm) * (c.yMm - a.yMm) - (b.yMm - a.yMm) * (c.xMm - a.xMm);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (Math.abs(abC) < EPSILON && pointOnSegment(c, a, b)) return true;
  if (Math.abs(abD) < EPSILON && pointOnSegment(d, a, b)) return true;
  if (Math.abs(cdA) < EPSILON && pointOnSegment(a, c, d)) return true;
  if (Math.abs(cdB) < EPSILON && pointOnSegment(b, c, d)) return true;
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}

function polygonsIntersect(a: Point[], b: Point[]): boolean {
  if (a.some((point) => pointInOrOnPolygon(point, b)) || b.some((point) => pointInOrOnPolygon(point, a))) return true;
  const aa = openPolygon(a);
  const bb = openPolygon(b);
  return aa.some((point, index) => bb.some((other, otherIndex) => segmentsIntersect(point, aa[(index + 1) % aa.length], other, bb[(otherIndex + 1) % bb.length])));
}

function rotate(point: Point, angleRad: number): Point {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { xMm: point.xMm * cos - point.yMm * sin, yMm: point.xMm * sin + point.yMm * cos };
}

function floorSkirtingLinearMm(surface: FloorSurfaceV1): number {
  if (!surface.skirting) return 0;
  const excluded = surface.skirting.doorwayExclusions.reduce((total, range) => total + Math.max(0, range.endMm - range.startMm), 0);
  return Math.max(0, polygonPerimeterMm(surface.regionPolygon) - excluded);
}

/**
 * Canonical flooring layout calculation. Plan-view, renderer and production
 * consumers must use this output rather than independently re-counting tiles.
 */
export function buildFlooringQuantities(surfaces: FloorSurfaceV1[]): FlooringQuantityV1[] {
  return surfaces.map((surface) => {
    const netAreaSqm = round(polygonAreaMm2(surface.regionPolygon) / 1_000_000);
    const skirtingLinearM = round(floorSkirtingLinearMm(surface) / 1000);
    if (!surface.tile) {
      return { surfaceId: surface.id, roomId: surface.roomId, materialVersionId: surface.materialVersionId, netAreaSqm, fullTileCount: 0, cutTileCount: 0, totalTileCount: 0, wastagePct: 0, skirtingLinearM, tilePlacements: [] };
    }

    const angle = (surface.tile.angleDeg * Math.PI) / 180;
    const localPolygon = surface.regionPolygon.map((point) => rotate({ xMm: point.xMm - surface.tile!.originX, yMm: point.yMm - surface.tile!.originY }, -angle));
    const xs = localPolygon.map((point) => point.xMm);
    const ys = localPolygon.map((point) => point.yMm);
    const pitchX = surface.tile.widthMm + surface.tile.groutWidthMm;
    const pitchY = surface.tile.lengthMm + surface.tile.groutWidthMm;
    const rowStart = Math.floor(Math.min(...ys) / pitchY);
    const rowEnd = Math.ceil(Math.max(...ys) / pitchY) - 1;
    const placements: FloorTilePlacementV1[] = [];

    for (let row = rowStart; row <= rowEnd; row += 1) {
      const brickOffset = surface.tile.pattern === 'brick' && Math.abs(row % 2) === 1 ? surface.tile.widthMm / 2 : 0;
      const colStart = Math.floor((Math.min(...xs) - brickOffset) / pitchX);
      const colEnd = Math.ceil((Math.max(...xs) - brickOffset) / pitchX) - 1;
      for (let column = colStart; column <= colEnd; column += 1) {
        const x = column * pitchX + brickOffset;
        const y = row * pitchY;
        const localTile = [{ xMm: x, yMm: y }, { xMm: x + surface.tile.widthMm, yMm: y }, { xMm: x + surface.tile.widthMm, yMm: y + surface.tile.lengthMm }, { xMm: x, yMm: y + surface.tile.lengthMm }];
        if (!polygonsIntersect(localTile, localPolygon)) continue;
        const kind = localTile.every((point) => pointInOrOnPolygon(point, localPolygon)) ? 'full' : 'cut';
        const worldOrigin = rotate({ xMm: x, yMm: y }, angle);
        placements.push({ row, column, originMm: { xMm: round(worldOrigin.xMm + surface.tile.originX), yMm: round(worldOrigin.yMm + surface.tile.originY) }, kind });
      }
    }

    const fullTileCount = placements.filter((placement) => placement.kind === 'full').length;
    const cutTileCount = placements.length - fullTileCount;
    const purchasedAreaMm2 = placements.length * surface.tile.widthMm * surface.tile.lengthMm;
    const wastagePct = netAreaSqm === 0 ? 0 : round(Math.max(0, ((purchasedAreaMm2 / 1_000_000 - netAreaSqm) / netAreaSqm) * 100), 2);
    return { surfaceId: surface.id, roomId: surface.roomId, materialVersionId: surface.materialVersionId, netAreaSqm, fullTileCount, cutTileCount, totalTileCount: placements.length, wastagePct, skirtingLinearM, tilePlacements: placements };
  });
}
