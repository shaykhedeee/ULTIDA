/**
 * geometry-core — canonical coordinate systems.
 *
 * Canonical unit: MILLIMETRES (mm). Canonical plan axes: X horizontal, Z depth
 * (right-handed, viewed from above with +Z pointing "down/south" and +X "right/east").
 * 3D world uses right-handed Z-up: X (plan east), Y (height, up), Z (plan south).
 *
 * Five coordinate spaces:
 *  1. SOURCE-IMAGE  — raw pixels (xPx, yPx). Where the plan image came from.
 *  2. WORLD         — millimetres on the real floor (xMm, zMm in plan; yMm height).
 *  3. WALL-LOCAL    — measured along a wall + into the room + height (mm).
 *  4. ROOM-LOCAL    — axis-aligned mm frame with origin at the room's min-corner.
 *  5. RENDERER      — Three.js style [x, y, z] (Y-up) for the 3D viewport.
 *
 * Every transform is a pure, deterministic function — never delegated to an AI.
 */

export type SupportedUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export const UNIT_TO_MM: Record<SupportedUnit, number> = {
  mm: 1.0,
  cm: 10.0,
  m: 1000.0,
  in: 25.4,
  ft: 304.8,
};

export function convertToMm(value: number, unit: SupportedUnit): number {
  return value * UNIT_TO_MM[unit];
}

export function convertFromMm(valueMm: number, targetUnit: SupportedUnit): number {
  return valueMm / UNIT_TO_MM[targetUnit];
}

// ---------------------------------------------------------------------------
// 1) SOURCE-IMAGE  <->  2) WORLD
// ---------------------------------------------------------------------------

export interface SourceImageRef {
  originPx: { x: number; y: number };
  mmPerPixel: number;
  rotationRad?: number;
  cropPx?: { x: number; y: number };
}

export interface WorldPoint2D {
  xMm: number;
  zMm: number;
}

export function sourceImageToWorld(
  pixel: { xPx: number; yPx: number },
  ref: SourceImageRef
): WorldPoint2D {
  const rotation = ref.rotationRad ?? 0;
  const cropX = ref.cropPx?.x ?? 0;
  const cropY = ref.cropPx?.y ?? 0;
  const dx = pixel.xPx + cropX - ref.originPx.x;
  const dy = pixel.yPx + cropY - ref.originPx.y;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    xMm: (dx * cos - dy * sin) * ref.mmPerPixel,
    zMm: (dx * sin + dy * cos) * ref.mmPerPixel,
  };
}

export function worldToSourceImage(
  world: WorldPoint2D,
  ref: SourceImageRef
): { xPx: number; yPx: number } {
  const rotation = ref.rotationRad ?? 0;
  const cropX = ref.cropPx?.x ?? 0;
  const cropY = ref.cropPx?.y ?? 0;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const dxMm = world.xMm / ref.mmPerPixel;
  const dzMm = world.zMm / ref.mmPerPixel;
  const dx = dxMm * cos - dzMm * sin;
  const dy = dxMm * sin + dzMm * cos;
  return {
    xPx: dx + ref.originPx.x - cropX,
    yPx: dy + ref.originPx.y - cropY,
  };
}

// ---------------------------------------------------------------------------
// 3) WALL-LOCAL  <->  2) WORLD
// ---------------------------------------------------------------------------

export interface WallFrame {
  origin: { xMm: number; yMm: number; zMm: number };
  lengthMm: number;
  tangent: { x: number; z: number }; // unit vector along wall
  normal: { x: number; z: number }; // unit interior normal (perpendicular, into room)
}

function normalizeSafe(v: { x: number; z: number }): { x: number; z: number } {
  const len = Math.hypot(v.x, v.z);
  return len > 0 ? { x: v.x / len, z: v.z / len } : { x: 0, z: 1 };
}

export function createWallFrame(
  start: WorldPoint2D,
  end: WorldPoint2D,
  baseElevationMm = 0,
  interiorNormal?: { x: number; z: number }
): WallFrame {
  const dx = end.xMm - start.xMm;
  const dz = end.zMm - start.zMm;
  const length = Math.hypot(dx, dz);
  if (length === 0) {
    // Degenerate (zero-length) wall: return a zero frame so downstream
    // validation can flag it instead of crashing the builder.
    return {
      origin: { xMm: start.xMm, yMm: baseElevationMm, zMm: start.zMm },
      lengthMm: 0,
      tangent: { x: 1, z: 0 },
      normal: interiorNormal ? normalizeSafe(interiorNormal) : { x: 0, z: 1 },
    };
  }
  const tx = dx / length;
  const tz = dz / length;
  // Default interior normal: rotate tangent +90deg (tx,tz) -> (-tz, tx)
  let nx = -tz;
  let nz = tx;
  if (interiorNormal) {
    const nLen = Math.hypot(interiorNormal.x, interiorNormal.z);
    if (nLen > 0) {
      nx = interiorNormal.x / nLen;
      nz = interiorNormal.z / nLen;
    }
  }
  return {
    origin: { xMm: start.xMm, yMm: baseElevationMm, zMm: start.zMm },
    lengthMm: length,
    tangent: { x: tx, z: tz },
    normal: { x: nx, z: nz },
  };
}

export function wallLocalToWorld(
  local: { offsetAlongMm: number; offsetFromMm: number; heightMm: number },
  frame: WallFrame
): { xMm: number; yMm: number; zMm: number } {
  return {
    xMm: frame.origin.xMm + local.offsetAlongMm * frame.tangent.x + local.offsetFromMm * frame.normal.x,
    yMm: frame.origin.yMm + local.heightMm,
    zMm: frame.origin.zMm + local.offsetAlongMm * frame.tangent.z + local.offsetFromMm * frame.normal.z,
  };
}

export function worldToWallLocal(
  world: { xMm: number; yMm: number; zMm: number },
  frame: WallFrame
): { offsetAlongMm: number; offsetFromMm: number; heightMm: number } {
  const dx = world.xMm - frame.origin.xMm;
  const dz = world.zMm - frame.origin.zMm;
  return {
    offsetAlongMm: dx * frame.tangent.x + dz * frame.tangent.z,
    offsetFromMm: dx * frame.normal.x + dz * frame.normal.z,
    heightMm: world.yMm - frame.origin.yMm,
  };
}

// ---------------------------------------------------------------------------
// 4) ROOM-LOCAL  <->  2) WORLD
// ---------------------------------------------------------------------------
// Room-local frame: origin at the room's axis-aligned bounding-box min corner,
// X' along world +X, Z' along world +Z. Deterministic and invertible.

export interface RoomLocalRef {
  originXMm: number; // min x of room bbox
  originZMm: number; // min z of room bbox
}

export function worldToRoomLocal(
  world: WorldPoint2D,
  room: RoomLocalRef
): { xLocalMm: number; zLocalMm: number } {
  return { xLocalMm: world.xMm - room.originXMm, zLocalMm: world.zMm - room.originZMm };
}

export function roomLocalToWorld(
  local: { xLocalMm: number; zLocalMm: number },
  room: RoomLocalRef
): WorldPoint2D {
  return { xMm: room.originXMm + local.xLocalMm, zMm: room.originZMm + local.zLocalMm };
}

// ---------------------------------------------------------------------------
// 5) RENDERER (Three.js Y-up)  <->  WORLD (Z-up)
// ---------------------------------------------------------------------------

export function worldToRenderer(world: { xMm: number; yMm: number; zMm: number }): [number, number, number] {
  // Map ULTIDA (X_plan, Y_height, Z_plan) directly to Three.js (X, Y, Z).
  return [world.xMm, world.yMm, world.zMm];
}

export function rendererToWorld(pos: [number, number, number]): { xMm: number; yMm: number; zMm: number } {
  return { xMm: pos[0], yMm: pos[1], zMm: pos[2] };
}
