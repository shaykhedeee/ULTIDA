import type { FloorSurfaceV1 } from '@ultida/contracts';
type Point = { xMm: number; yMm: number };
type Material = { id: string; colorHex?: string; roughness?: number; metalness?: number };
export function roomFloorPreviews(room: { id: string; name: string; boundary: Point[] }, floors: Array<{ surfaces?: FloorSurfaceV1[] }>, materials: Material[]) {
  const surfaces = floors.flatMap(f => f.surfaces ?? []).filter(s => s.roomId === room.id);
  const open = (points: Point[]) => points.length > 1 && points[0]?.xMm === points.at(-1)?.xMm && points[0]?.yMm === points.at(-1)?.yMm ? points.slice(0, -1) : points;
  return (surfaces.length ? surfaces : [undefined]).map(surface => {
    const material = materials.find(m => m.id === surface?.materialVersionId);
    return {
      id: surface?.id ?? `unassigned-${room.id}`, polygon: open(surface?.regionPolygon ?? room.boundary),
      materialId: surface?.materialVersionId, surface,
      elevationMm: surface ? surface.elevationMm + surface.buildUpThicknessMm : 0,
      color: material?.colorHex && /^#[\da-f]{6}$/i.test(material.colorHex) ? material.colorHex : '#e2dbd0',
      roughness: material?.roughness ?? .65, metalness: material?.metalness ?? 0,
      source: surface ? 'saved-surface' : 'unassigned-preview',
    };
  });
}
