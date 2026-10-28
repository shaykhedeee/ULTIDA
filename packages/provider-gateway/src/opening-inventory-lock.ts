/**
 * Solid-Wall & Opening Inventory Prompt Builder (inspired by Rumeasiyan/roomsmith & TryBuildFlow).
 *
 * In generative interior rendering, diffusion models frequently hallucinate windows or doors
 * on unbroken solid walls where modular cabinetry must mount.
 * This lock derives an authoritative structural inventory from SceneV1/PlanV1:
 * 1. An explicit list of all walls and their confirmed openings (e.g., "Wall North: 1 window at offset 1200mm").
 * 2. An explicit list of solid walls with ZERO openings (e.g., "Wall South: SOLID WALL with 0 windows, 0 doors, 0 openings").
 * 3. Strict negative prompt constraints barring hallucinated openings on solid modular runs.
 */

export interface StructuralWallOpeningSummary {
  wallId: string;
  wallName?: string;
  lengthMm: number;
  openingsCount: number;
  openingsSummary: string[];
  isSolidWall: boolean;
}

export interface AntiHallucinationPromptLock {
  positiveInventoryClause: string;
  negativeOpeningLock: string;
  wallSummaries: StructuralWallOpeningSummary[];
}

export function compileOpeningInventoryLock(walls: Array<{
  id: string;
  name?: string;
  lengthMm?: number;
  openings?: Array<{
    type?: string;
    widthMm?: number;
    offsetMm?: number;
  }>;
}>): AntiHallucinationPromptLock {
  const wallSummaries: StructuralWallOpeningSummary[] = [];
  const positiveClauses: string[] = [];
  const solidWallNames: string[] = [];

  for (const wall of walls) {
    const wallLabel = wall.name || `Wall ${wall.id}`;
    const len = wall.lengthMm ?? 3000;
    const openings = wall.openings ?? [];
    const openingDescriptions: string[] = [];

    for (const op of openings) {
      const type = op.type ?? 'opening';
      const w = op.widthMm ?? 900;
      const off = op.offsetMm ?? 0;
      openingDescriptions.push(`${type} (${w}mm wide at offset ${off}mm)`);
    }

    const isSolid = openings.length === 0;
    if (isSolid) {
      solidWallNames.push(wallLabel);
      positiveClauses.push(
        `[STRUCTURAL LOCK: ${wallLabel} (length ${len}mm) is a 100% solid unbroken wall with ZERO windows, ZERO doors, ZERO vents]`
      );
    } else {
      positiveClauses.push(
        `[STRUCTURAL OPENINGS: ${wallLabel} contains exactly: ${openingDescriptions.join(', ')}]`
      );
    }

    wallSummaries.push({
      wallId: wall.id,
      wallName: wallLabel,
      lengthMm: len,
      openingsCount: openings.length,
      openingsSummary: openingDescriptions,
      isSolidWall: isSolid,
    });
  }

  const positiveInventoryClause = positiveClauses.join('; ');
  
  const negativeOpeningLock = solidWallNames.length > 0
    ? `hallucinated windows on solid walls, extra doors, fake windows behind cabinets, windows on ${solidWallNames.join(', ')}, broken modular elevations, floating cabinets without wall mounting`
    : 'hallucinated windows, fake exterior views, extra doors, broken wall geometry';

  return {
    positiveInventoryClause,
    negativeOpeningLock,
    wallSummaries,
  };
}
