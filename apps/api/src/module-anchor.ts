export type CanonicalWallAnchor = {
  id: string;
  worldStart: { xMm: number; yMm: number };
  worldEnd: { xMm: number; yMm: number };
};

export type RequestedModuleAnchor = {
  wallId: string;
  offsetMm: number;
  zMm?: number;
};

export type ResolvedModuleAnchor = {
  wallId: string;
  offsetMm: number;
  xMm: number;
  yMm: number;
  zMm: number;
  rotationDeg: number;
  anchor: 'wall';
};

export function resolveModuleWallAnchor(
  walls: CanonicalWallAnchor[],
  request: RequestedModuleAnchor,
  moduleWidthMm: number,
): { ok: true; anchor: ResolvedModuleAnchor } | { ok: false; code: string; message: string } {
  if (!Number.isFinite(moduleWidthMm) || moduleWidthMm <= 0) {
    return { ok: false, code: 'MODULE_DIMENSIONS_INVALID', message: 'A module must have a positive width before it can be anchored.' };
  }
  if (!request || typeof request.wallId !== 'string' || !Number.isFinite(request.offsetMm) || request.offsetMm < 0) {
    return { ok: false, code: 'MODULE_ANCHOR_REQUIRED', message: 'A module needs a wall ID and a non-negative millimetre offset.' };
  }
  const wall = walls.find((candidate) => candidate.id === request.wallId);
  if (!wall) return { ok: false, code: 'MODULE_WALL_NOT_FOUND', message: 'The module anchor must reference a wall in the active approved plan.' };

  const dx = wall.worldEnd.xMm - wall.worldStart.xMm;
  const dy = wall.worldEnd.yMm - wall.worldStart.yMm;
  const lengthMm = Math.hypot(dx, dy);
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) {
    return { ok: false, code: 'MODULE_WALL_INVALID', message: 'The selected wall has no valid measured length.' };
  }
  if (request.offsetMm + moduleWidthMm > lengthMm + 0.5) {
    return { ok: false, code: 'MODULE_EXCEEDS_WALL', message: `Module width and offset exceed the selected wall by ${Math.ceil(request.offsetMm + moduleWidthMm - lengthMm)} mm.` };
  }

  const directionX = dx / lengthMm;
  const directionY = dy / lengthMm;
  return {
    ok: true,
    anchor: {
      wallId: wall.id,
      offsetMm: request.offsetMm,
      xMm: wall.worldStart.xMm + directionX * request.offsetMm,
      yMm: wall.worldStart.yMm + directionY * request.offsetMm,
      zMm: Number.isFinite(request.zMm) ? Number(request.zMm) : 0,
      rotationDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
      anchor: 'wall',
    },
  };
}
