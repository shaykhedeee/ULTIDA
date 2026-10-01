export type WallOpeningRange = { offsetMm: number; widthMm: number; sillHeightMm: number; heightMm: number };
export type WallSolid = { startMm: number; endMm: number; bottomMm: number; heightMm: number };

/** Subtract the union of measured opening rectangles from a wall elevation.
 * Shared by the browser mesh and deterministic render, including stacked openings.
 */
export function wallSolids(lengthMm: number, heightMm: number, openings: WallOpeningRange[]): WallSolid[] {
  if (![lengthMm, heightMm].every(value => Number.isFinite(value) && value > 0)) throw new Error('Measured wall dimensions are required.');
  const holes = openings.map(opening => {
    const { offsetMm, widthMm, sillHeightMm, heightMm: openingHeight } = opening;
    if (![offsetMm, widthMm, sillHeightMm, openingHeight].every(Number.isFinite) || offsetMm < 0 || sillHeightMm < 0 || widthMm <= 0 || openingHeight <= 0 || offsetMm + widthMm > lengthMm + 0.5 || sillHeightMm + openingHeight > heightMm + 0.5) {
      throw new Error('Opening geometry must be measured and fit within its wall.');
    }
    return { start: offsetMm, end: Math.min(lengthMm, offsetMm + widthMm), bottom: sillHeightMm, top: Math.min(heightMm, sillHeightMm + openingHeight) };
  });
  const breaks = [...new Set([0, lengthMm, ...holes.flatMap(hole => [hole.start, hole.end])])].sort((a, b) => a - b);
  const solids: WallSolid[] = [];
  for (let index = 1; index < breaks.length; index += 1) {
    const startMm = breaks[index - 1], endMm = breaks[index];
    const blocked = holes.filter(hole => hole.start < endMm && hole.end > startMm).sort((a, b) => a.bottom - b.bottom);
    let bottom = 0;
    const add = (top: number) => { if (top > bottom) solids.push({ startMm, endMm, bottomMm: bottom, heightMm: top - bottom }); };
    for (const hole of blocked) { add(hole.bottom); bottom = Math.max(bottom, hole.top); }
    add(heightMm);
  }
  return solids;
}
