import { nestPanels2D, type CutlistPart, type ProductionSnapshotV1 } from './index.js';

/** Core sheets and loose laminate sheets must never be combined into a single tally. */
export function nestLaminateFaces(snapshot: ProductionSnapshotV1) {
  const groups = new Map<string, { width: number; height: number; parts: CutlistPart[] }>();
  const unresolvedPartIds: string[] = [];
  for (const part of snapshot.parts) {
    const recipe = part.surfaceRecipe;
    if (!recipe) { unresolvedPartIds.push(part.partInstanceId); continue; }
    if (recipe.mode === 'prelaminated') continue;
    for (const side of ['faceA', 'faceB'] as const) {
      const face = recipe[side];
      if (!face) continue; // Explicit bare face, not an inferred missing finish.
      if (!face.code.trim() || ![face.thicknessMm, face.stockWidthMm, face.stockHeightMm].every(v => Number.isFinite(v) && v > 0) || !Number.isFinite(face.allowanceMm) || face.allowanceMm < 0) throw new Error('INVALID_LAMINATE_FACE');
      const key = JSON.stringify([face.code, face.thicknessMm, face.stockWidthMm, face.stockHeightMm, face.grain]);
      const group = groups.get(key) ?? { width: face.stockWidthMm, height: face.stockHeightMm, parts: [] };
      // Stock grain runs along stock width (nest X). Turn the blank to align its width when requested.
      const length = part.lengthMm + 2 * face.allowanceMm, width = part.widthMm + 2 * face.allowanceMm;
      group.parts.push({ ...part, id: `${part.partInstanceId}:${side}`, partInstanceId: `${part.partInstanceId}:${side}`, sourcePartId: part.partInstanceId,
        partName: `${part.partName} ${side}`, lengthMm: face.grain === 'width' ? width : length, widthMm: face.grain === 'width' ? length : width,
        thicknessMm: face.thicknessMm, materialCode: face.code, grainDirection: face.grain === 'none' ? 'none' : 'horizontal',
        surfaceRecipe: undefined, edging: 'none', edgeSchedule: undefined, quantity: 1 });
      groups.set(key, group);
    }
  }
  const results = [...groups.values()].map((group, index) => {
    const nested = nestPanels2D(group.parts, group.width, group.height, snapshot.fabricationRules.kerfMm, snapshot.fabricationRules.trimMm);
    const rename = (id: string) => `laminate-${index + 1}-${id}`;
    return { ...nested, sheets: nested.sheets.map(s => ({ ...s, sheetId: rename(s.sheetId) })), updatedParts: nested.updatedParts.map(p => ({ ...p, sheetId: p.sheetId ? rename(p.sheetId) : undefined })) };
  });
  return { sheets: results.flatMap(r => r.sheets), parts: results.flatMap(r => r.updatedParts), unresolvedPartIds, complete: unresolvedPartIds.length === 0 };
}
