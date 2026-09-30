export type RoomBuilderWall = 'north' | 'east' | 'south' | 'west';
export type RoomBuilderOpening = {
  id: string;
  kind: 'door' | 'window' | 'structural_column';
  wall: RoomBuilderWall;
  offsetMm: number;
  widthMm: number;
  depthMm?: number;
  heightMm?: number;
  sillMm?: number;
  headMm?: number;
};

export type RoomDraftGeometryInput = RoomBuilderDimensions & {
  roomId: string;
  originX: number;
  originY: number;
  openings: RoomBuilderOpening[];
};

/** Convert the standalone room proposal to the exact plan-space geometry contract. */
export function roomDraftToPlanGeometry(input: RoomDraftGeometryInput) {
  const { roomId, originX, originY, widthMm, depthMm, ceilingHeightMm, wallThicknessMm = 0 } = input;
  const topLeft = { xMm: originX, yMm: originY };
  const topRight = { xMm: originX + widthMm, yMm: originY };
  const bottomRight = { xMm: originX + widthMm, yMm: originY + depthMm };
  const bottomLeft = { xMm: originX, yMm: originY + depthMm };
  const polygon = [topLeft, topRight, bottomRight, bottomLeft];
  // Keep the same edge IDs produced by SpacesWorkspace.roomBoundaryWalls.
  // Match SpacesWorkspace.roomBoundaryWalls exactly; south and west run in the
  // reverse direction of the room-builder's visual ruler and need offset mapping.
  const walls = [
    { id: `${roomId}:edge:1`, start: topLeft, end: topRight },
    { id: `${roomId}:edge:2`, start: topRight, end: bottomRight },
    { id: `${roomId}:edge:3`, start: bottomRight, end: bottomLeft },
    { id: `${roomId}:edge:4`, start: bottomLeft, end: topLeft },
  ].map((wall) => ({ ...wall, heightMm: ceilingHeightMm, thicknessMm: wallThicknessMm, isExterior: false }));
  const wallBySide = { north: walls[0], east: walls[1], south: walls[2], west: walls[3] };
  const planOpenings = input.openings.filter((opening) => opening.kind === 'door' || opening.kind === 'window').map((opening) => ({
    id: opening.id,
    wallId: wallBySide[opening.wall].id,
    kind: opening.kind,
    offsetAlongWallMm: opening.wall === 'south' || opening.wall === 'west'
      ? (opening.wall === 'south' ? widthMm : depthMm) - opening.offsetMm - opening.widthMm
      : opening.offsetMm,
    widthMm: opening.widthMm,
    heightMm: opening.kind === 'window'
      ? Number(opening.headMm) - Number(opening.sillMm)
      : Number(opening.heightMm),
    sillHeightMm: opening.kind === 'window' ? opening.sillMm : 0,
  }));
  const columns = input.openings.filter((opening) => opening.kind === 'structural_column').map((column) => {
    const centerAlong = column.offsetMm + column.widthMm / 2;
    const projection = column.depthMm ?? 0;
    const position = column.wall === 'north'
      ? { xMm: originX + centerAlong, yMm: originY + projection / 2 }
      : column.wall === 'east'
        ? { xMm: originX + widthMm - projection / 2, yMm: originY + centerAlong }
        : column.wall === 'south'
          ? { xMm: originX + centerAlong, yMm: originY + depthMm - projection / 2 }
          : { xMm: originX + projection / 2, yMm: originY + centerAlong };
    const sizeMm = column.wall === 'north' || column.wall === 'south'
      ? { width: column.widthMm, depth: projection }
      : { width: projection, depth: column.widthMm };
    return { id: column.id, position, sizeMm };
  });
  return { polygon, walls, openings: planOpenings, columns };
}

export type RoomBuilderDimensions = {
  widthMm: number;
  depthMm: number;
  ceilingHeightMm: number;
  wallThicknessMm?: number;
};

export function roomBuilderGeometryIssues(
  dimensions: RoomBuilderDimensions,
  openings: RoomBuilderOpening[],
): string[] {
  const issues: string[] = [];
  if (!Number.isFinite(dimensions.widthMm) || dimensions.widthMm < 600) issues.push('Room width must be at least 600 mm.');
  if (!Number.isFinite(dimensions.depthMm) || dimensions.depthMm < 600) issues.push('Room depth must be at least 600 mm.');
  if (!Number.isFinite(dimensions.ceilingHeightMm) || dimensions.ceilingHeightMm < 1800) issues.push('Ceiling height must be at least 1,800 mm.');
  if (!Number.isFinite(dimensions.wallThicknessMm) || (dimensions.wallThicknessMm ?? 0) < 75 || (dimensions.wallThicknessMm ?? Infinity) > 600) issues.push('Wall thickness must be a confirmed value between 75 mm and 600 mm.');

  const spans: Record<RoomBuilderWall, number> = {
    north: dimensions.widthMm,
    south: dimensions.widthMm,
    east: dimensions.depthMm,
    west: dimensions.depthMm,
  };
  for (const wall of ['north', 'east', 'south', 'west'] as const) {
    const wallOpenings = openings.filter((opening) => opening.wall === wall)
      .slice().sort((a, b) => a.offsetMm - b.offsetMm);
    for (const opening of wallOpenings) {
      const span = spans[wall];
      if (!Number.isFinite(opening.offsetMm) || opening.offsetMm < 0
        || !Number.isFinite(opening.widthMm) || opening.widthMm < 300
        || opening.offsetMm + opening.widthMm > span) {
        issues.push(`${opening.kind.replace('_', ' ')} on ${wall} wall must fit inside its ${span} mm measured length.`);
      }
      if (opening.kind === 'window'
        && (!Number.isFinite(opening.sillMm) || !Number.isFinite(opening.headMm)
          || (opening.sillMm ?? -1) < 0 || (opening.headMm ?? 0) <= (opening.sillMm ?? 0)
          || (opening.headMm ?? Infinity) > dimensions.ceilingHeightMm)) {
        issues.push(`Window on ${wall} wall needs a valid sill and head below the ${dimensions.ceilingHeightMm} mm ceiling.`);
      }
      if (opening.kind === 'door'
        && (!Number.isFinite(opening.heightMm) || (opening.heightMm ?? 0) <= 0 || (opening.heightMm ?? Infinity) > dimensions.ceilingHeightMm)) {
        issues.push(`Door on ${wall} wall needs a measured positive height no greater than the ${dimensions.ceilingHeightMm} mm ceiling.`);
      }
      if (opening.kind === 'structural_column' && (!Number.isFinite(opening.depthMm) || (opening.depthMm ?? 0) <= 0)) {
        issues.push(`Structural column on ${wall} wall needs a positive projection depth.`);
      }
    }
    let furthestEnd = -Infinity;
    let furthestOpening: RoomBuilderOpening | undefined;
    for (const opening of wallOpenings) {
      if (furthestOpening && opening.offsetMm < furthestEnd) {
        issues.push(`${furthestOpening.kind.replace('_', ' ')} and ${opening.kind.replace('_', ' ')} overlap on ${wall} wall.`);
      }
      if (opening.offsetMm + opening.widthMm > furthestEnd) {
        furthestEnd = opening.offsetMm + opening.widthMm;
        furthestOpening = opening;
      }
    }
  }
  return [...new Set(issues)];
}

export function usableWallRunMm(wallLengthMm: number, openings: RoomBuilderOpening[]): number {
  if (!Number.isFinite(wallLengthMm) || wallLengthMm <= 0) return 0;
  const intervals = openings
    .map(({ offsetMm, widthMm }) => [Math.max(0, offsetMm), Math.min(wallLengthMm, offsetMm + widthMm)] as const)
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  let blockedMm = 0;
  let start: number | undefined;
  let end = 0;
  for (const [nextStart, nextEnd] of intervals) {
    if (start === undefined) {
      start = nextStart;
      end = nextEnd;
    } else if (nextStart <= end) {
      end = Math.max(end, nextEnd);
    } else {
      blockedMm += end - start;
      start = nextStart;
      end = nextEnd;
    }
  }
  if (start !== undefined) blockedMm += end - start;
  return Math.max(0, Math.round(wallLengthMm - blockedMm));
}
