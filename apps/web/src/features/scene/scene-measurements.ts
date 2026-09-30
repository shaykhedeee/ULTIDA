export type SceneBoundaryPoint = { xMm: number; yMm: number };
export type SceneRoomGeometry = { id: string; boundary: SceneBoundaryPoint[] };
export type SceneWallGeometry = { heightMm: number; spaceIds?: string[] };

export function measuredRoomAreaSqm(boundary: SceneBoundaryPoint[]): number | null {
  if (boundary.length < 3 || boundary.some((point) => !Number.isFinite(point.xMm) || !Number.isFinite(point.yMm))) return null;
  const twiceArea = boundary.reduce((sum, point, index) => {
    const next = boundary[(index + 1) % boundary.length];
    return sum + point.xMm * next.yMm - next.xMm * point.yMm;
  }, 0);
  const areaSqm = Math.abs(twiceArea) / 2_000_000;
  return areaSqm > 0 ? areaSqm : null;
}

export function measuredRoomCeilingHeightMm(
  roomId: string,
  roomCount: number,
  walls: SceneWallGeometry[],
): number | null {
  const roomWalls = walls.filter((wall) => wall.spaceIds?.includes(roomId) || (roomCount === 1 && !wall.spaceIds?.length));
  const heights = roomWalls.map((wall) => Number(wall.heightMm)).filter((height) => Number.isFinite(height) && height > 0);
  if (!heights.length || heights.some((height) => Math.abs(height - heights[0]) > 1)) return null;
  return Math.round(heights.reduce((sum, height) => sum + height, 0) / heights.length);
}
