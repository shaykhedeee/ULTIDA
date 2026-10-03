type Point = { xMm: number; yMm: number };

export function fitCanvas(points: Point[], w = 760, h = 480, padding = 40) {
  const finite = points.filter(p => Number.isFinite(p.xMm) && Number.isFinite(p.yMm));
  const source = finite.length ? finite : [{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 1000 }];
  const minX = Math.min(...source.map(p => p.xMm));
  const minY = Math.min(...source.map(p => p.yMm));
  const maxX = Math.max(...source.map(p => p.xMm));
  const maxY = Math.max(...source.map(p => p.yMm));
  const scale = Math.min((w - 2 * padding) / (maxX - minX || 1), (h - 2 * padding) / (maxY - minY || 1));
  return { minX, minY, maxX, maxY, scale, w, h,
    offsetX: (w - (maxX - minX) * scale) / 2,
    offsetY: (h - (maxY - minY) * scale) / 2 };
}

export function projectPoint(point: Point, view: ReturnType<typeof fitCanvas>) {
  return { x: (point.xMm - view.minX) * view.scale + view.offsetX,
    y: (point.yMm - view.minY) * view.scale + view.offsetY };
}

export function unprojectPoint(x: number, y: number, view: ReturnType<typeof fitCanvas>): Point {
  return { xMm: (x - view.offsetX) / view.scale + view.minX,
    yMm: (y - view.offsetY) / view.scale + view.minY };
}
