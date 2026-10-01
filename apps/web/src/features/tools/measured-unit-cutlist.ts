import type { MaterialMatchingPreset, NestingPart } from './cutlist-optimizer';

export type MeasuredUnit = {
  id: string; name: string; widthMm: number; heightMm: number; depthMm: number;
  shelves: number; doors: 0 | 2; backThicknessMm: 6 | 18;
};

/** Only reviewed rectangular outlines; never derives cabinet anatomy from pixels or lines. */
export function readDxfRectangles(text: string): Array<{ layer: string; widthMm: number; heightMm: number }> {
  if (text.length > 2_000_000) throw new Error('Use a DXF smaller than 2 MB for this outline review.');
  const lines = text.trim().split(/\r?\n/).map(line => line.trim());
  const pairs: Array<[number, string]> = [];
  for (let index = 0; index + 1 < lines.length; index += 2) pairs.push([Number(lines[index]), lines[index + 1]]);
  const units = pairs.findIndex(([code, value]) => code === 9 && value === '$INSUNITS');
  if (units < 0 || pairs[units + 1]?.[1] !== '4') throw new Error('DXF must explicitly declare millimetres ($INSUNITS = 4). Confirm units in AutoCAD and export again.');
  const result: Array<{ layer: string; widthMm: number; heightMm: number }> = [];
  for (let index = 0; index < pairs.length; index++) {
    if (pairs[index][0] !== 0 || pairs[index][1] !== 'LWPOLYLINE') continue;
    let end = index + 1; while (end < pairs.length && pairs[end][0] !== 0) end++;
    const entity = pairs.slice(index + 1, end);
    if (!(Number(entity.find(([code]) => code === 70)?.[1]) & 1) || entity.some(([code, value]) => code === 42 && Number(value) !== 0)) continue;
    const vertices: Array<{ x: number; y: number }> = [];
    for (let v = 0; v < entity.length; v++) if (entity[v][0] === 10 && entity[v + 1]?.[0] === 20) vertices.push({ x: Number(entity[v][1]), y: Number(entity[v + 1][1]) });
    if (vertices.length !== 4 || !vertices.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) continue;
    const xs = [...new Set(vertices.map(point => point.x))], ys = [...new Set(vertices.map(point => point.y))];
    if (xs.length !== 2 || ys.length !== 2 || new Set(vertices.map(point => `${point.x},${point.y}`)).size !== 4) continue;
    const widthMm = Math.abs(xs[1] - xs[0]), heightMm = Math.abs(ys[1] - ys[0]);
    if (widthMm && heightMm) result.push({ layer: entity.find(([code]) => code === 8)?.[1] ?? '0', widthMm, heightMm });
    index = end - 1;
  }
  if (!result.length) throw new Error('No supported closed rectangular outlines found. Export unit elevations as closed LWPOLYLINE rectangles. Depth, boards and internals still need manual confirmation.');
  return result;
}

/** Inset swing fronts, butt-jointed carcass, full-overlay surface-mounted back.
 * Overall depth includes the back. No filler, plinth, drawer or hardware is invented.
 */
export function buildMeasuredUnitParts(unit: MeasuredUnit, material: MaterialMatchingPreset): NestingPart[] {
  const t = material.carcassThicknessMm;
  if (![unit.widthMm, unit.heightMm, unit.depthMm, t].every(value => Number.isFinite(value) && value > 0) || !Number.isInteger(unit.shelves) || unit.shelves < 0 || unit.shelves > 20 || ![0, 2].includes(unit.doors) || ![6, 18].includes(unit.backThicknessMm)) throw new Error('Confirm positive dimensions, 0–20 shelves, style and 6 or 18 mm back thickness.');
  const innerW = unit.widthMm - 2 * t, innerH = unit.heightMm - 2 * t;
  const sideDepth = unit.depthMm - unit.backThicknessMm;
  const shelfDepth = sideDepth - (unit.doors ? t + 2 : 0);
  if (innerW <= (unit.doors ? 6 : 4) || innerH <= 4 || shelfDepth <= 0 || innerH <= unit.shelves * t) throw new Error('Boards, fronts and shelves do not fit inside these overall dimensions.');
  const edge = (length: number, external = false) => ({ l1: external ? material.externalEdgeBand : material.internalEdgeBand, l2: external ? material.externalEdgeBand : 'none', w1: external ? material.externalEdgeBand : 'none', w2: external ? material.externalEdgeBand : 'none', totalLinearMeters: length / 1000 });
  const part = (key: string, name: string, lengthMm: number, widthMm: number, thicknessMm: number, quantity: number, classification: NestingPart['classification'], external = false): NestingPart => ({
    id: `${unit.id}:${key}`, partInstanceId: `${unit.id}:${key}`, moduleName: unit.name, name,
    lengthMm, widthMm, thicknessMm, quantity, classification, isExternal: external,
    materialCode: classification === 'back_panel' ? `${unit.backThicknessMm}mm backing plywood` : material.carcassCorePly,
    grainDirection: external ? 'vertical' : 'none',
    ...(external ? { externalLaminateCode: material.externalDecorativeLaminate } : {}),
    internalLinerCode: material.internalLinerLaminate,
    edgeBanding: classification === 'back_panel' ? { l1: 'none', l2: 'none', w1: 'none', w2: 'none', totalLinearMeters: 0 } : edge(external ? 2 * (lengthMm + widthMm) * quantity : lengthMm * quantity, external),
    notes: 'Measured draft: inset fronts, butt joints and surface-mounted back. Confirm joinery, laminate faces, hardware and final finished-size allowances before manufacture.',
  });
  const parts = [part('sides', 'Left / right side', unit.heightMm, sideDepth, t, 2, 'internal_carcass_gable'), part('decks', 'Top / bottom between sides', innerW, sideDepth, t, 2, 'internal_carcass_deck'), part('back', 'Surface-mounted full back', unit.heightMm, unit.widthMm, unit.backThicknessMm, 1, 'back_panel')];
  if (unit.shelves) parts.push(part('shelves', 'Adjustable shelves', innerW, shelfDepth, t, unit.shelves, 'internal_shelf_adj'));
  if (unit.doors) parts.push(part('fronts', 'Inset swing shutters', innerH - 4, (innerW - 6) / 2, t, 2, 'external_shutter', true));
  return parts;
}
