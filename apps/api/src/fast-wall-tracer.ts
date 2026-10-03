import sharp from 'sharp';
import type { CvOpeningEvidence, CvTraceEvidence } from './plan-analysis-service.js';

export interface FastWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thicknessPx?: number;
  lengthPx: number;
  confidence: number;
  startCornerId?: string | null;
  endCornerId?: string | null;
}

export interface FastCorner {
  id: string;
  x: number;
  y: number;
  refs: number;
}

export interface FastRoom {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  polygon: Array<[number, number]>;
  confidence: number;
}

export interface FastTraceResult extends CvTraceEvidence {
  walls: FastWall[];
  corners: FastCorner[];
  wallCount: number;
  openingCount: number;
  rooms: FastRoom[];
  method: 'pure-typescript-morphological-tracer';
}

/**
 * Native TypeScript geometric floor-plan tracer using Sharp's pixel decoding.
 * Operates without a Python interpreter or OpenCV installation; all results remain review evidence.
 */
export async function tracePlanBuffer(
  input: Buffer | Uint8Array,
  options: {
    workingLimit?: number;
    colorExclusion?: boolean;
    filterText?: boolean;
  } = {}
): Promise<FastTraceResult> {
  // A 1200px reference retains room-scale line detail while keeping the pure
  // TypeScript pass responsive on serverless workers when the source is small.
  const workingLimit = options.workingLimit ?? 1200;
  const image = sharp(input, { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error('Plan image dimensions could not be decoded. Upload a valid image or PDF page.');
  // rotate() applies EXIF orientation, but metadata() still reports the stored
  // dimensions. Keep detection, preview coordinates and calibration upright.
  const swapsAxes = meta.orientation !== undefined && meta.orientation >= 5 && meta.orientation <= 8;
  const sourceW = swapsAxes ? meta.height : meta.width;
  const sourceH = swapsAxes ? meta.width : meta.height;
  const longest = Math.max(sourceW, sourceH);

  // Always detect at one reference size. Previously only large images were
  // downsampled, leaving low-resolution photos to use a different effective
  // threshold scale than scans of the same plan.
  const scale = workingLimit / longest;
  const targetW = Math.max(1, Math.round(sourceW * scale));
  const targetH = Math.max(1, Math.round(sourceH * scale));

  const { data, info } = await image
    .resize(targetW, targetH)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const totalPixels = w * h;

  // Step 1: Preprocessing & Binarization
  // Architectural walls are dark neutral lines (<140 luminance).
  // Saturated annotation colors (red dimension lines, blue furniture marks) are excluded.
  const binary = new Uint8Array(totalPixels);
  for (let i = 0, p = 0; i < data.length; i += 3, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    const redness = r - (g + b) / 2;
    const blueness = b - (r + g) / 2;
    const isDark = brightness < 140;
    const isSaturated = redness > 40 || blueness > 40;
    if (isDark && !isSaturated) {
      binary[p] = 1;
    }
  }

  // Step 2: Remove small compact text-like connected components if enabled
  if (options.filterText !== false) {
    filterTextComponents(binary, w, h);
  }

  // Step 3: Morphological line segment detection
  // Minimum line segment length scaled to image dimension
  const minLineLength = Math.max(16, Math.round(Math.max(w, h) * 0.018));
  const rawSegments = detectLineSegments(binary, w, h, minLineLength);

  // Step 4: Axis snapping and collinear merging
  const merged = mergeCollinearSegments(rawSegments, Math.max(10, Math.round(12 * scale)), 8);

  // Step 5: Parallel wall thickness pairing and deduplication
  const maxPairDist = Math.max(25, Math.round(42 * scale));
  const wallsWithThickness = pairParallelWalls(merged, maxPairDist);

  // Step 6: Corners detection and endpoint snapping
  const snapTol = Math.max(10, Math.round(15 * scale));
  const corners = findCorners(wallsWithThickness, snapTol);
  const snappedWalls = snapWallsToCorners(wallsWithThickness, corners, snapTol);

  // Step 7: Filter out trivial noise strokes
  const minWallLenPx = Math.max(18, Math.round(Math.max(w, h) * 0.015));
  const significantWalls = snappedWalls.filter((wall) => wall.lengthPx >= minWallLenPx);

  // Step 8: Detect openings (doors and windows) along wall centerlines
  const openings = detectOpenings(significantWalls, binary, w, h, scale);

  // Step 9: Detect interior room candidates from bounded empty spaces
  const rooms = extractInteriorRooms(significantWalls, binary, w, h);

  // Step 10: Scale coordinates back to original source pixels if resized
  if (scale !== 1.0) {
    const inv = 1.0 / scale;
    for (const wall of significantWalls) {
      wall.x1 = Math.round(wall.x1 * inv * 100) / 100;
      wall.y1 = Math.round(wall.y1 * inv * 100) / 100;
      wall.x2 = Math.round(wall.x2 * inv * 100) / 100;
      wall.y2 = Math.round(wall.y2 * inv * 100) / 100;
      wall.lengthPx = Math.round(wall.lengthPx * inv * 100) / 100;
      if (wall.thicknessPx != null) {
        wall.thicknessPx = Math.round(wall.thicknessPx * inv * 100) / 100;
      }
    }
    for (const corner of corners) {
      corner.x = Math.round(corner.x * inv * 100) / 100;
      corner.y = Math.round(corner.y * inv * 100) / 100;
    }
    for (const opening of openings) {
      opening.approxCenterPx.x = Math.round(opening.approxCenterPx.x * inv * 100) / 100;
      opening.approxCenterPx.y = Math.round(opening.approxCenterPx.y * inv * 100) / 100;
      opening.approxWidthPx = Math.round(opening.approxWidthPx * inv * 100) / 100;
    }
    for (const room of rooms) {
      room.x = Math.round(room.x * inv * 100) / 100;
      room.y = Math.round(room.y * inv * 100) / 100;
      room.width = Math.round(room.width * inv * 100) / 100;
      room.height = Math.round(room.height * inv * 100) / 100;
      room.polygon = room.polygon.map(([px, py]) => [
        Math.round(px * inv * 100) / 100,
        Math.round(py * inv * 100) / 100,
      ]);
    }
  }

  return {
    widthPx: sourceW,
    heightPx: sourceH,
    walls: significantWalls,
    openings,
    corners,
    rooms,
    wallCount: significantWalls.length,
    openingCount: openings.length,
    method: 'pure-typescript-morphological-tracer',
  };
}

/**
 * Filter out compact text-like character components to prevent annotation letters from becoming walls.
 */
function filterTextComponents(binary: Uint8Array, w: number, h: number): void {
  const visited = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (binary[idx] === 1 && visited[idx] === 0) {
        const queue: number[] = [idx];
        visited[idx] = 1;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let area = 0;
        let head = 0;

        while (head < queue.length) {
          const curr = queue[head++];
          area++;
          const cx = curr % w;
          const cy = Math.floor(curr / w);
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // 8-connected neighbors
          for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= h) continue;
            const rowOff = ny * w;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              if (nx < 0 || nx >= w) continue;
              const nIdx = rowOff + nx;
              if (binary[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push(nIdx);
              }
            }
          }
        }

        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const bboxArea = bw * bh;
        const fillRatio = bboxArea > 0 ? area / bboxArea : 0;
        const aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));

        // Characters form compact, medium-to-high fill ratio components in small bboxes
        const isTextlike = fillRatio > 0.35 && aspect < 4.0 && bboxArea < 900;
        if (isTextlike) {
          for (const p of queue) {
            binary[p] = 0;
          }
        }
      }
    }
  }
}

interface RawSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'horizontal' | 'vertical';
}

function detectLineSegments(binary: Uint8Array, w: number, h: number, minLength: number): RawSegment[] {
  const segments: RawSegment[] = [];

  // Horizontal scan
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    let startX = -1;
    for (let x = 0; x < w; x++) {
      if (binary[rowOffset + x] === 1) {
        if (startX === -1) startX = x;
      } else {
        if (startX !== -1) {
          const len = x - startX;
          if (len >= minLength) {
            segments.push({ x1: startX, y1: y, x2: x - 1, y2: y, kind: 'horizontal' });
          }
          startX = -1;
        }
      }
    }
    if (startX !== -1 && w - startX >= minLength) {
      segments.push({ x1: startX, y1: y, x2: w - 1, y2: y, kind: 'horizontal' });
    }
  }

  // Vertical scan
  for (let x = 0; x < w; x++) {
    let startY = -1;
    for (let y = 0; y < h; y++) {
      if (binary[y * w + x] === 1) {
        if (startY === -1) startY = y;
      } else {
        if (startY !== -1) {
          const len = y - startY;
          if (len >= minLength) {
            segments.push({ x1: x, y1: startY, x2: x, y2: y - 1, kind: 'vertical' });
          }
          startY = -1;
        }
      }
    }
    if (startY !== -1 && h - startY >= minLength) {
      segments.push({ x1: x, y1: startY, x2: x, y2: h - 1, kind: 'vertical' });
    }
  }

  return segments;
}

function mergeCollinearSegments(
  segments: RawSegment[],
  gapTol: number,
  offsetTol: number
): RawSegment[] {
  const horiz = segments.filter((s) => s.kind === 'horizontal');
  const vert = segments.filter((s) => s.kind === 'vertical');

  const mergeGroup = (group: RawSegment[], axisIsY: boolean): RawSegment[] => {
    const buckets = new Map<number, RawSegment[]>();
    for (const seg of group) {
      const key = axisIsY ? seg.y1 : seg.x1;
      let matchedKey: number | null = null;
      for (const existingKey of buckets.keys()) {
        if (Math.abs(existingKey - key) <= offsetTol) {
          matchedKey = existingKey;
          break;
        }
      }
      if (matchedKey !== null) {
        buckets.get(matchedKey)!.push(seg);
      } else {
        buckets.set(key, [seg]);
      }
    }

    const merged: RawSegment[] = [];
    for (const [key, segs] of buckets.entries()) {
      const intervals = axisIsY
        ? segs.map((s) => [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)] as [number, number]).sort((a, b) => a[0] - b[0])
        : segs.map((s) => [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)] as [number, number]).sort((a, b) => a[0] - b[0]);

      if (intervals.length === 0) continue;
      const runs: Array<[number, number]> = [[intervals[0][0], intervals[0][1]]];
      for (let i = 1; i < intervals.length; i++) {
        const [lo, hi] = intervals[i];
        const last = runs[runs.length - 1];
        if (lo - last[1] <= gapTol) {
          last[1] = Math.max(last[1], hi);
        } else {
          runs.push([lo, hi]);
        }
      }

      for (const [lo, hi] of runs) {
        if (axisIsY) {
          merged.push({ x1: lo, y1: key, x2: hi, y2: key, kind: 'horizontal' });
        } else {
          merged.push({ x1: key, y1: lo, x2: key, y2: hi, kind: 'vertical' });
        }
      }
    }
    return merged;
  };

  return [...mergeGroup(horiz, true), ...mergeGroup(vert, false)];
}

function pairParallelWalls(segments: RawSegment[], maxPairDist: number): FastWall[] {
  const horiz = segments.filter((s) => s.kind === 'horizontal');
  const vert = segments.filter((s) => s.kind === 'vertical');
  const walls: FastWall[] = [];
  let wallCounter = 1;

  const processPairing = (group: RawSegment[], axisIsY: boolean) => {
    const used = new Set<number>();
    for (let i = 0; i < group.length; i++) {
      if (used.has(i)) continue;
      const a = group[i];
      let bestJ = -1;
      let bestDist = Infinity;

      for (let j = 0; j < group.length; j++) {
        if (i === j || used.has(j)) continue;
        const b = group[j];
        const dist = Math.abs((axisIsY ? a.y1 : a.x1) - (axisIsY ? b.y1 : b.x1));
        if (dist >= 6 && dist <= maxPairDist) {
          const aLo = axisIsY ? a.x1 : a.y1;
          const aHi = axisIsY ? a.x2 : a.y2;
          const bLo = axisIsY ? b.x1 : b.y1;
          const bHi = axisIsY ? b.x2 : b.y2;
          const overlap = Math.min(aHi, bHi) - Math.max(aLo, bLo);
          const minLen = Math.min(aHi - aLo, bHi - bLo);
          if (overlap > 0.35 * minLen && dist < bestDist) {
            bestDist = dist;
            bestJ = j;
          }
        }
      }

      if (bestJ !== -1) {
        const b = group[bestJ];
        used.add(i);
        used.add(bestJ);
        const centerline = Math.round(((axisIsY ? a.y1 : a.x1) + (axisIsY ? b.y1 : b.x1)) / 2);
        if (axisIsY) {
          const x1 = Math.min(a.x1, b.x1);
          const x2 = Math.max(a.x2, b.x2);
          walls.push({
            id: `wall_${wallCounter++}`,
            x1,
            y1: centerline,
            x2,
            y2: centerline,
            thicknessPx: Math.round(bestDist),
            lengthPx: Math.abs(x2 - x1),
            confidence: 0.92,
          });
        } else {
          const y1 = Math.min(a.y1, b.y1);
          const y2 = Math.max(a.y2, b.y2);
          walls.push({
            id: `wall_${wallCounter++}`,
            x1: centerline,
            y1,
            x2: centerline,
            y2,
            thicknessPx: Math.round(bestDist),
            lengthPx: Math.abs(y2 - y1),
            confidence: 0.92,
          });
        }
      } else {
        used.add(i);
        const len = axisIsY ? Math.abs(a.x2 - a.x1) : Math.abs(a.y2 - a.y1);
        walls.push({
          id: `wall_${wallCounter++}`,
          x1: a.x1,
          y1: a.y1,
          x2: a.x2,
          y2: a.y2,
          thicknessPx: undefined,
          lengthPx: len,
          confidence: 0.65,
        });
      }
    }
  };

  processPairing(horiz, true);
  processPairing(vert, false);
  return walls;
}

function findCorners(walls: FastWall[], snapTol: number): FastCorner[] {
  const points: Array<{ x: number; y: number }> = [];
  for (const w of walls) {
    points.push({ x: w.x1, y: w.y1 });
    points.push({ x: w.x2, y: w.y2 });
  }

  const corners: FastCorner[] = [];
  for (const pt of points) {
    let placed = false;
    for (const c of corners) {
      if (Math.hypot(pt.x - c.x, pt.y - c.y) <= snapTol) {
        c.x = Math.round((c.x + pt.x) / 2);
        c.y = Math.round((c.y + pt.y) / 2);
        c.refs += 1;
        placed = true;
        break;
      }
    }
    if (!placed) {
      corners.push({ id: `corner_${corners.length}`, x: pt.x, y: pt.y, refs: 1 });
    }
  }
  return corners;
}

function snapWallsToCorners(walls: FastWall[], corners: FastCorner[], snapTol: number): FastWall[] {
  const findNearest = (x: number, y: number): FastCorner | null => {
    let best: FastCorner | null = null;
    let bestDist = Infinity;
    for (const c of corners) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= snapTol && d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  };

  return walls.map((w) => {
    const c1 = findNearest(w.x1, w.y1);
    const c2 = findNearest(w.x2, w.y2);
    const x1 = c1 ? c1.x : w.x1;
    const y1 = c1 ? c1.y : w.y1;
    const x2 = c2 ? c2.x : w.x2;
    const y2 = c2 ? c2.y : w.y2;
    return {
      ...w,
      startCornerId: c1?.id ?? null,
      endCornerId: c2?.id ?? null,
      x1,
      y1,
      x2,
      y2,
      lengthPx: Math.round(Math.hypot(x2 - x1, y2 - y1)),
    };
  });
}

function detectOpenings(
  walls: FastWall[],
  binary: Uint8Array,
  w: number,
  h: number,
  scale: number
): CvOpeningEvidence[] {
  const minGapPx = 15 * scale;
  const maxGapPx = 140 * scale;
  const openings: CvOpeningEvidence[] = [];

  const horiz = walls.filter((wall) => Math.abs(wall.y1 - wall.y2) < 2);
  const vert = walls.filter((wall) => Math.abs(wall.x1 - wall.x2) < 2);

  const checkAxis = (group: FastWall[], axisIsY: boolean) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const posA = axisIsY ? a.y1 : a.x1;
        const posB = axisIsY ? b.y1 : b.x1;
        if (Math.abs(posA - posB) > 10 * scale) continue;

        const aLo = axisIsY ? Math.min(a.x1, a.x2) : Math.min(a.y1, a.y2);
        const aHi = axisIsY ? Math.max(a.x1, a.x2) : Math.max(a.y1, a.y2);
        const bLo = axisIsY ? Math.min(b.x1, b.x2) : Math.min(b.y1, b.y2);
        const bHi = axisIsY ? Math.max(b.x1, b.x2) : Math.max(b.y1, b.y2);

        let gap: number | null = null;
        let gapStart = 0;
        let gapEnd = 0;

        if (bLo >= aHi) {
          gap = bLo - aHi;
          gapStart = aHi;
          gapEnd = bLo;
        } else if (aLo >= bHi) {
          gap = aLo - bHi;
          gapStart = bHi;
          gapEnd = aLo;
        }

        if (gap != null && gap >= minGapPx && gap <= maxGapPx) {
          // Check for obstruction by another wall
          const obstructed = group.some(
            (c) =>
              c !== a &&
              c !== b &&
              Math.abs((axisIsY ? c.y1 : c.x1) - posA) <= 10 * scale &&
              Math.min(axisIsY ? c.x1 : c.y1, axisIsY ? c.x2 : c.y2) < gapEnd &&
              Math.max(axisIsY ? c.x1 : c.y1, axisIsY ? c.x2 : c.y2) > gapStart
          );
          if (obstructed) continue;

          const mid = (gapStart + gapEnd) / 2;
          const center = axisIsY ? { x: mid, y: posA } : { x: posA, y: mid };

          // Visual cue classification from binary pixels around gap
          const { kindHint, confidence, note } = classifyOpeningPatch(binary, w, h, center, gap, axisIsY);

          openings.push({
            betweenWallIds: [a.id, b.id],
            approxCenterPx: center,
            approxWidthPx: Math.round(gap * 10) / 10,
            kindHint,
            confidence,
            note,
          });
        }
      }
    }
  };

  checkAxis(horiz, true);
  checkAxis(vert, false);
  return openings;
}

function classifyOpeningPatch(
  binary: Uint8Array,
  w: number,
  h: number,
  center: { x: number; y: number },
  gapWidth: number,
  axisIsY: boolean
): { kindHint: 'door' | 'window' | 'unknown'; confidence: number; note: string } {
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  const radius = Math.max(10, Math.round(gapWidth * 0.7));

  const y1 = Math.max(0, cy - radius);
  const y2 = Math.min(h - 1, cy + radius);
  const x1 = Math.max(0, cx - radius);
  const x2 = Math.min(w - 1, cx + radius);

  let parallelStrokes = 0;
  let diagonalOrArcStrokes = 0;

  // Scan across the gap window
  if (axisIsY) {
    // Horizontal wall gap: look for horizontal rails (window) or vertical/diagonal leaf (door)
    for (let y = y1; y <= y2; y++) {
      let run = 0;
      for (let x = x1; x <= x2; x++) {
        if (binary[y * w + x] === 1) run++;
      }
      if (run > gapWidth * 0.4) parallelStrokes++;
    }
    for (let x = x1; x <= x2; x++) {
      let run = 0;
      for (let y = y1; y <= y2; y++) {
        if (binary[y * w + x] === 1) run++;
      }
      if (run > radius * 0.4) diagonalOrArcStrokes++;
    }
  } else {
    // Vertical wall gap
    for (let x = x1; x <= x2; x++) {
      let run = 0;
      for (let y = y1; y <= y2; y++) {
        if (binary[y * w + x] === 1) run++;
      }
      if (run > gapWidth * 0.4) parallelStrokes++;
    }
    for (let y = y1; y <= y2; y++) {
      let run = 0;
      for (let x = x1; x <= x2; x++) {
        if (binary[y * w + x] === 1) run++;
      }
      if (run > radius * 0.4) diagonalOrArcStrokes++;
    }
  }

  if (parallelStrokes >= 2 && diagonalOrArcStrokes <= 1) {
    return {
      kindHint: 'window',
      confidence: 0.74,
      note: 'Parallel window-rail strokes are visible across the wall gap.',
    };
  }
  if (diagonalOrArcStrokes >= 1) {
    return {
      kindHint: 'door',
      confidence: 0.72,
      note: 'A door-leaf or swing stroke is visible beside the wall gap.',
    };
  }
  return {
    kindHint: 'unknown',
    confidence: 0.48,
    note: 'A structural wall gap is visible, but door/window semantics are uncertain.',
  };
}

function extractInteriorRooms(
  walls: FastWall[],
  binary: Uint8Array,
  w: number,
  h: number
): FastRoom[] {
  // If we have 4 or more walls, compute bounding box of interior
  if (walls.length < 4) return [];

  // Create temporary wall mask with virtual bridges across gaps so rooms are separated
  const wallMask = new Uint8Array(binary);
  for (const wall of walls) {
    const x1 = Math.max(0, Math.min(w - 1, Math.round(wall.x1)));
    const y1 = Math.max(0, Math.min(h - 1, Math.round(wall.y1)));
    const x2 = Math.max(0, Math.min(w - 1, Math.round(wall.x2)));
    const y2 = Math.max(0, Math.min(h - 1, Math.round(wall.y2)));

    if (y1 === y2) {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      for (let x = minX; x <= maxX; x++) wallMask[y1 * w + x] = 1;
    } else if (x1 === x2) {
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      for (let y = minY; y <= maxY; y++) wallMask[y * w + x1] = 1;
    }
  }

  // Flood exterior
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  for (let x = 0; x < w; x++) {
    if (wallMask[x] === 0) { visited[x] = 2; queue.push(x); }
    const bIdx = (h - 1) * w + x;
    if (wallMask[bIdx] === 0) { visited[bIdx] = 2; queue.push(bIdx); }
  }
  for (let y = 0; y < h; y++) {
    const lIdx = y * w;
    if (wallMask[lIdx] === 0) { visited[lIdx] = 2; queue.push(lIdx); }
    const rIdx = y * w + (w - 1);
    if (wallMask[rIdx] === 0) { visited[rIdx] = 2; queue.push(rIdx); }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const cx = idx % w;
    const cy = Math.floor(idx / w);
    const neighbors = [
      cy > 0 ? idx - w : -1,
      cy < h - 1 ? idx + w : -1,
      cx > 0 ? idx - 1 : -1,
      cx < w - 1 ? idx + 1 : -1,
    ];
    for (const n of neighbors) {
      if (n !== -1 && visited[n] === 0 && wallMask[n] === 0) {
        visited[n] = 2;
        queue.push(n);
      }
    }
  }

  const rooms: FastRoom[] = [];
  const minArea = w * h * 0.02;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx] === 0 && wallMask[idx] === 0) {
        const roomQueue: number[] = [idx];
        visited[idx] = 3;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let area = 0;
        let qHead = 0;

        while (qHead < roomQueue.length) {
          const curr = roomQueue[qHead++];
          area++;
          const px = curr % w;
          const py = Math.floor(curr / w);
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;

          const neighbors = [
            py > 0 ? curr - w : -1,
            py < h - 1 ? curr + w : -1,
            px > 0 ? curr - 1 : -1,
            px < w - 1 ? curr + 1 : -1,
          ];
          for (const n of neighbors) {
            if (n !== -1 && visited[n] === 0 && wallMask[n] === 0) {
              visited[n] = 3;
              roomQueue.push(n);
            }
          }
        }

        if (area >= minArea) {
          const rw = maxX - minX;
          const rh = maxY - minY;
          rooms.push({
            id: `room_${rooms.length + 1}`,
            label: `Room ${rooms.length + 1}`,
            x: minX,
            y: minY,
            width: rw,
            height: rh,
            polygon: [
              [minX, minY],
              [maxX, minY],
              [maxX, maxY],
              [minX, maxY],
            ],
            confidence: 0.88,
          });
        }
      }
    }
  }

  return rooms;
}
