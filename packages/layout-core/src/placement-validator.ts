import { z } from 'zod';
import { PlacementSchema, type Placement, type ValidationIssue, type ValidationResult } from './schema.js';

export interface SpatialAnchor {
  anchorType: 'wall' | 'room' | 'corner' | 'opening' | 'floor' | 'ceiling' | 'module';
  wallId?: string;
  roomId?: string;
  parentModuleId?: string;
  offsetAlongWallMm?: number;
  offsetFromWallMm?: number;
  baseElevationMm?: number;
}

export function validatePlacementSet(
  placements: Placement[],
  roomGeometry: {
    roomType?: string;
    roomPolygon: Array<{ xMm: number; yMm: number }>;
    walls: Array<{ id: string; start: { xMm: number; yMm: number }; end: { xMm: number; yMm: number }; heightMm: number }>;
    openings: Array<{ id: string; wallId: string; offsetMm: number; widthMm: number; heightMm: number; sillMm?: number }>;
  }
): ValidationResult {
  const issues: ValidationIssue[] = [];

  const allowedCategoriesByRoom: Record<string, string[]> = {
    kitchen: ['kitchen', 'utility', 'other'],
    living: ['living', 'tv_unit', 'other'],
    bedroom: ['bedroom', 'wardrobe', 'study_unit', 'other'],
    dining: ['dining', 'crockery_unit', 'other']
  };

  for (const placement of placements) {
    // 0. Room Category Suitability Check
    if (roomGeometry.roomType) {
      const allowed = allowedCategoriesByRoom[roomGeometry.roomType.toLowerCase()] ?? [];
      if (allowed.length > 0 && !allowed.includes(placement.category)) {
        issues.push({
          code: 'INVALID_ROOM_CATEGORY',
          severity: 'blocking',
          message: `Cannot place ${placement.category.replace('_', ' ')} in a ${roomGeometry.roomType}. TV Units belong in Living/Bedroom areas.`,
          entityIds: [placement.id]
        });
      }
    }
    // 1. Check wall fit & wall existence if anchored to wall
    if (placement.anchor === 'wall' && placement.wallRef) {
      const wall = roomGeometry.walls.find(w => w.id === placement.wallRef);
      if (!wall) {
        issues.push({
          code: 'WALL_NOT_FOUND',
          severity: 'blocking',
          message: `Placement ${placement.id} references non-existent wall ${placement.wallRef}.`,
          entityIds: [placement.id]
        });
      } else {
        const wallLength = Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
        if (placement.widthMm > wallLength) {
          issues.push({
            code: 'MODULE_EXCEEDS_WALL_LENGTH',
            severity: 'blocking',
            message: `Placement ${placement.id} width (${placement.widthMm}mm) exceeds wall length (${wallLength.toFixed(1)}mm).`,
            entityIds: [placement.id, wall.id]
          });
        }
      }
    }

    // 2. Height check against room wall heights
    const maxWallHeight = roomGeometry.walls.length > 0
      ? Math.max(...roomGeometry.walls.map(w => w.heightMm))
      : 2700;
    
    if (placement.heightMm + (placement.positionMm[1] ?? 0) > maxWallHeight) {
      issues.push({
        code: 'CEILING_COLLISION',
        severity: 'blocking',
        message: `Placement ${placement.id} total height exceeds ceiling height (${maxWallHeight}mm).`,
        entityIds: [placement.id]
      });
    }

    // 3. Opening collisions (e.g. doors/windows obstruction)
    if (placement.anchor === 'wall' && placement.wallRef) {
      const wallOpenings = roomGeometry.openings.filter(o => o.wallId === placement.wallRef);
      const modOffset = placement.positionMm[0]; // offset along wall
      const modEnd = modOffset + placement.widthMm;

      for (const op of wallOpenings) {
        const opStart = op.offsetMm;
        const opEnd = op.offsetMm + op.widthMm;

        // Check 1D segment overlap along wall
        if (Math.max(modOffset, opStart) < Math.min(modEnd, opEnd)) {
          issues.push({
            code: 'OPENING_OBSTRUCTION',
            severity: 'blocking',
            message: `Placement ${placement.id} obstructs opening ${op.id} on wall ${placement.wallRef}.`,
            entityIds: [placement.id, op.id]
          });
        }
      }
    }
  }

  // 4. Inter-module collisions (Bounding box check)
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      if (a.wallRef === b.wallRef && a.anchor === 'wall') {
        const aStart = a.positionMm[0];
        const aEnd = aStart + a.widthMm;
        const bStart = b.positionMm[0];
        const bEnd = bStart + b.widthMm;

        if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
          issues.push({
            code: 'FURNITURE_COLLISION',
            severity: 'blocking',
            message: `Placement ${a.id} collides with placement ${b.id} along wall ${a.wallRef}.`,
            entityIds: [a.id, b.id]
          });
        }
      }
    }
  }

  const valid = !issues.some(i => i.severity === 'blocking');
  return { valid, issues };
}
