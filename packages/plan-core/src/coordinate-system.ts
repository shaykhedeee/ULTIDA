import { z } from 'zod';

/**
 * Canonical Units: Millimetres (mm)
 * Coordinate system convention:
 * - 2D Floor Plan (X, Z): X = horizontal axis, Z = second horizontal plan axis
 * - 3D World (X, Y, Z): X = horizontal plan, Y = vertical height (Floor level Y = 0), Z = depth / second horizontal axis
 */

export interface Point2D {
  x: number;
  z: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Matrix3x3 {
  // 3x3 transformation matrix stored as column-major array of 9 numbers
  m: [number, number, number, number, number, number, number, number, number];
}

export interface Affine2DTransform {
  scaleX: number;
  scaleZ: number;
  skewX: number;
  skewZ: number;
  translateX: number;
  translateZ: number;
  rotationRad: number;
}

// ---------------------------------------------------------------------------
// Unit Conversions
// ---------------------------------------------------------------------------

export const UNIT_CONVERSIONS = {
  mm: 1.0,
  cm: 10.0,
  m: 1000.0,
  in: 25.4,
  ft: 304.8,
} as const;

export type SupportedUnit = keyof typeof UNIT_CONVERSIONS;

export function convertToMm(value: number, unit: SupportedUnit): number {
  return value * UNIT_CONVERSIONS[unit];
}

export function convertFromMm(valueMm: number, targetUnit: SupportedUnit): number {
  return valueMm / UNIT_CONVERSIONS[targetUnit];
}

// ---------------------------------------------------------------------------
// Coordinate System Transformations
// ---------------------------------------------------------------------------

/**
 * Converts a 2D source pixel coordinate (X_px, Y_px) to World Millimetres (X_mm, Z_mm)
 * using origin offset, scale (mm/px), rotation (radians), and optional crop.
 */
export function sourceImageToWorld(
  pixel: { xPx: number; yPx: number },
  planSource: {
    originPx: { x: number; y: number };
    mmPerPixel: number;
    rotationRad?: number;
    cropPx?: { x: number; y: number };
  }
): Point2D {
  const rotation = planSource.rotationRad ?? 0;
  const cropX = planSource.cropPx?.x ?? 0;
  const cropY = planSource.cropPx?.y ?? 0;

  // Apply crop offset & origin shift
  const dx = pixel.xPx + cropX - planSource.originPx.x;
  const dy = pixel.yPx + cropY - planSource.originPx.y;

  // Apply rotation and scale
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const xMm = (dx * cos - dy * sin) * planSource.mmPerPixel;
  const zMm = (dx * sin + dy * cos) * planSource.mmPerPixel;

  return { x: xMm, z: zMm };
}

/**
 * Converts World Millimetres (X_mm, Z_mm) to 2D source pixel coordinate (X_px, Y_px).
 */
export function worldToSourceImage(
  worldPt: Point2D,
  planSource: {
    originPx: { x: number; y: number };
    mmPerPixel: number;
    rotationRad?: number;
    cropPx?: { x: number; y: number };
  }
): { xPx: number; yPx: number } {
  const rotation = planSource.rotationRad ?? 0;
  const cropX = planSource.cropPx?.x ?? 0;
  const cropY = planSource.cropPx?.y ?? 0;

  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);

  const dxMm = worldPt.x / planSource.mmPerPixel;
  const dzMm = worldPt.z / planSource.mmPerPixel;

  const dx = dxMm * cos - dzMm * sin;
  const dy = dxMm * sin + dzMm * cos;

  return {
    xPx: dx + planSource.originPx.x - cropX,
    yPx: dy + planSource.originPx.y - cropY,
  };
}

/**
 * Wall Frame Transformation:
 * Wall origin is at wall start (X_start, Z_start, Y_base).
 * Tangent vector T along wall length (dx, dz).
 * Interior normal N perpendicular to T (-dz, dx).
 * Vertical vector V is +Y (up).
 */
export interface WallFrame {
  origin: Point3D;
  lengthMm: number;
  tangent: Point2D; // Normalized (tx, tz)
  normal: Point2D;  // Normalized interior normal (nx, nz)
}

export function createWallFrame(
  start: Point2D,
  end: Point2D,
  baseElevationMm: number = 0,
  interiorNormal?: Point2D
): WallFrame {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);

  if (length === 0) {
    throw new Error('Cannot create WallFrame from zero-length wall.');
  }

  const tx = dx / length;
  const tz = dz / length;

  // Default interior normal pointing along +Z when wall vector is along +X
  let nx = -tz;
  let nz = Math.abs(tx) > 0 ? 1 : 0;

  if (interiorNormal) {
    const nLen = Math.hypot(interiorNormal.x, interiorNormal.z);
    if (nLen > 0) {
      nx = interiorNormal.x / nLen;
      nz = interiorNormal.z / nLen;
    }
  }

  return {
    origin: { x: start.x, y: baseElevationMm, z: start.z },
    lengthMm: length,
    tangent: { x: tx, z: tz },
    normal: { x: nx, z: nz },
  };
}

/**
 * Transforms a point local to a wall frame (offsetAlongWall, offsetFromWall, heightAboveBase) to World 3D (X, Y, Z).
 */
export function wallLocalToWorld(
  local: { offsetAlongMm: number; offsetFromMm: number; heightMm: number },
  wallFrame: WallFrame
): Point3D {
  return {
    x: wallFrame.origin.x + local.offsetAlongMm * wallFrame.tangent.x + local.offsetFromMm * wallFrame.normal.x,
    y: wallFrame.origin.y + local.heightMm,
    z: wallFrame.origin.z + local.offsetAlongMm * wallFrame.tangent.z + local.offsetFromMm * wallFrame.normal.z,
  };
}

/**
 * Transforms a World 3D point (X, Y, Z) into wall-local frame coordinates.
 */
export function worldToWallLocal(
  worldPt: Point3D,
  wallFrame: WallFrame
): { offsetAlongMm: number; offsetFromMm: number; heightMm: number } {
  const dx = worldPt.x - wallFrame.origin.x;
  const dz = worldPt.z - wallFrame.origin.z;

  const offsetAlongMm = dx * wallFrame.tangent.x + dz * wallFrame.tangent.z;
  const offsetFromMm = dx * wallFrame.normal.x + dz * wallFrame.normal.z;
  const heightMm = worldPt.y - wallFrame.origin.y;

  return { offsetAlongMm, offsetFromMm, heightMm };
}

/**
 * Renderer Axis Conversions:
 * Standard ULTIDA 3D system: Right-handed Z-up (X = right, Y = up, Z = out/depth in 2D plan).
 * Three.js 3D system: Right-handed Y-up (X = right, Y = up, Z = out).
 */
export function worldToThreeJs(pt: Point3D): [number, number, number] {
  // Map ULTIDA (X_plan, Y_height, Z_plan) directly to Three.js (X, Y, Z)
  return [pt.x, pt.y, pt.z];
}

export function threeJsToWorld(pos: [number, number, number]): Point3D {
  return { x: pos[0], y: pos[1], z: pos[2] };
}
