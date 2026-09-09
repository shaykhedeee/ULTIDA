/**
 * Floor Plan Vector Extractor & Geometric Healer
 * Implements Native Vector Extraction, Sub-Pixel Corner Refinement,
 * Collinear Wall Merging, Thickness Bounds Validation, ROI Clustering,
 * and Retroactive Calibration Cross-Checking.
 */

export interface ExtractedVectorSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  angleDeg: number;
  layer?: string;
}

export interface ExtractedTextDimension {
  id: string;
  x: number;
  y: number;
  text: string;
  valueMm?: number;
}

export interface VectorExtractionResult {
  segments: ExtractedVectorSegment[];
  dimensions: ExtractedTextDimension[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Trick 1: Native Vector PDF / SVG Extraction
 * Parses SVG vector path streams (M, L, H, V, Z), lines, rects, and text tags directly,
 * completely bypassing rasterization and Hough transform noise.
 */
export function extractSvgVectorSegments(svgContent: string): VectorExtractionResult {
  const segments: ExtractedVectorSegment[] = [];
  const dimensions: ExtractedTextDimension[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  const addSegment = (x1: number, y1: number, x2: number, y2: number, layer?: string) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 1) return; // Skip zero-length or noise artifacts
    updateBounds(x1, y1);
    updateBounds(x2, y2);
    let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;
    segments.push({
      id: `seg-${segments.length + 1}`,
      x1: Math.round(x1 * 100) / 100,
      y1: Math.round(y1 * 100) / 100,
      x2: Math.round(x2 * 100) / 100,
      y2: Math.round(y2 * 100) / 100,
      length: Math.round(length * 100) / 100,
      angleDeg: Math.round(angleDeg * 10) / 10,
      layer,
    });
  };

  // 1. Match <line x1="..." y1="..." x2="..." y2="..." ... />
  const lineRegex = /<line\b[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"[^>]*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(svgContent)) !== null) {
    const x1 = parseFloat(match[1]);
    const y1 = parseFloat(match[2]);
    const x2 = parseFloat(match[3]);
    const y2 = parseFloat(match[4]);
    if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
      addSegment(x1, y1, x2, y2);
    }
  }

  // 2. Match <rect x="..." y="..." width="..." height="..." ... />
  const rectRegex = /<rect\b[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"[^>]*\/?>/gi;
  while ((match = rectRegex.exec(svgContent)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const w = parseFloat(match[3]);
    const h = parseFloat(match[4]);
    if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      addSegment(x, y, x + w, y);
      addSegment(x + w, y, x + w, y + h);
      addSegment(x + w, y + h, x, y + h);
      addSegment(x, y + h, x, y);
    }
  }

  // 3. Match <path d="..." ... />
  const pathRegex = /<path\b[^>]*d="([^"]+)"[^>]*\/?>/gi;
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const d = match[1];
    const commands = d.match(/([a-df-z])|([-+]?(?:\d*\.\d+|\d+))/gi) || [];
    let curX = 0;
    let curY = 0;
    let startX = 0;
    let startY = 0;
    let cmd = '';

    let i = 0;
    while (i < commands.length) {
      const token = commands[i];
      if (/^[a-df-z]$/i.test(token)) {
        cmd = token;
        i++;
      }
      if (cmd === 'M' || cmd === 'm') {
        const x = parseFloat(commands[i++]);
        const y = parseFloat(commands[i++]);
        if (!isNaN(x) && !isNaN(y)) {
          curX = cmd === 'M' ? x : curX + x;
          curY = cmd === 'M' ? y : curY + y;
          startX = curX;
          startY = curY;
          updateBounds(curX, curY);
          cmd = cmd === 'M' ? 'L' : 'l'; // Subsequent coordinates imply LineTo
        }
      } else if (cmd === 'L' || cmd === 'l') {
        const x = parseFloat(commands[i++]);
        const y = parseFloat(commands[i++]);
        if (!isNaN(x) && !isNaN(y)) {
          const nextX = cmd === 'L' ? x : curX + x;
          const nextY = cmd === 'L' ? y : curY + y;
          addSegment(curX, curY, nextX, nextY);
          curX = nextX;
          curY = nextY;
        }
      } else if (cmd === 'H' || cmd === 'h') {
        const x = parseFloat(commands[i++]);
        if (!isNaN(x)) {
          const nextX = cmd === 'H' ? x : curX + x;
          addSegment(curX, curY, nextX, curY);
          curX = nextX;
        }
      } else if (cmd === 'V' || cmd === 'v') {
        const y = parseFloat(commands[i++]);
        if (!isNaN(y)) {
          const nextY = cmd === 'V' ? y : curY + y;
          addSegment(curX, curY, curX, nextY);
          curY = nextY;
        }
      } else if (cmd === 'Z' || cmd === 'z') {
        if (Math.hypot(curX - startX, curY - startY) > 0.5) {
          addSegment(curX, curY, startX, startY);
        }
        curX = startX;
        curY = startY;
        cmd = '';
      } else {
        i++;
      }
    }
  }

  // 4. Match <text x="..." y="...">content</text>
  const textRegex = /<text\b[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*>([^<]+)<\/text>/gi;
  while ((match = textRegex.exec(svgContent)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const rawText = match[3].trim();
    if (!isNaN(x) && !isNaN(y) && rawText.length > 0) {
      let valueMm: number | undefined;
      const mmMatch = rawText.match(/(\d+(?:\.\d+)?)\s*mm\b/i);
      const mMatch = rawText.match(/(\d+(?:\.\d+)?)\s*m\b/i);
      if (mmMatch) {
        valueMm = parseFloat(mmMatch[1]);
      } else if (mMatch) {
        valueMm = parseFloat(mMatch[1]) * 1000;
      } else {
        const numMatch = rawText.match(/\b(\d+(?:\.\d+)?)\b/);
        if (numMatch) {
          valueMm = parseFloat(numMatch[1]);
        }
      }
      dimensions.push({
        id: `dim-${dimensions.length + 1}`,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        text: rawText,
        valueMm,
      });
      updateBounds(x, y);
    }
  }

  return {
    segments,
    dimensions,
    bounds: {
      minX: Number.isFinite(minX) ? minX : 0,
      minY: Number.isFinite(minY) ? minY : 0,
      maxX: Number.isFinite(maxX) ? maxX : 1000,
      maxY: Number.isFinite(maxY) ? maxY : 850,
    },
  };
}

/**
 * Trick 2: Sub-Pixel Corner Refinement (cornerSubPix)
 * Snaps wall intersection junctions and endpoints with sub-pixel floating point centroid resolution.
 * Groups points within windowPx and returns an array mapping each point index to its refined cluster centroid.
 */
export function refineCornerSubPix(
  points: Array<{ x: number; y: number }>,
  windowPx = 8
): Array<{ x: number; y: number }> {
  if (points.length === 0) return [];
  const assigned = new Array(points.length).fill(false);
  const refinedPoints = points.map((p) => ({ ...p }));

  for (let i = 0; i < points.length; i++) {
    if (assigned[i]) continue;
    const clusterIndices = [i];
    assigned[i] = true;

    for (let j = i + 1; j < points.length; j++) {
      if (assigned[j]) continue;
      const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (dist <= windowPx) {
        clusterIndices.push(j);
        assigned[j] = true;
      }
    }

    if (clusterIndices.length > 1) {
      const avgX = clusterIndices.reduce((sum, idx) => sum + points[idx].x, 0) / clusterIndices.length;
      const avgY = clusterIndices.reduce((sum, idx) => sum + points[idx].y, 0) / clusterIndices.length;
      const subPixX = Math.round(avgX * 100) / 100;
      const subPixY = Math.round(avgY * 100) / 100;
      for (const idx of clusterIndices) {
        refinedPoints[idx] = { x: subPixX, y: subPixY };
      }
    }
  }

  return refinedPoints;
}

/**
 * Wall Thickness Bounding
 * Enforces real-world architectural bounds (75mm to 300mm).
 * Flags lines separated by < 75mm or > 300mm for manual confirmation.
 */
export function validateWallThicknessBounds(thicknessMm: number): {
  valid: boolean;
  warning?: string;
  clampedMm: number;
} {
  if (thicknessMm < 75) {
    return {
      valid: false,
      warning: `Wall thickness (${thicknessMm}mm) is below standard architectural partition minimum (75mm). Verify whether this is a panel or chase.`,
      clampedMm: 115,
    };
  }
  if (thicknessMm > 300) {
    return {
      valid: false,
      warning: `Wall thickness (${thicknessMm}mm) exceeds typical structural wall bounds (300mm). Verify if this is a double wall or column.`,
      clampedMm: 230,
    };
  }
  return {
    valid: true,
    clampedMm: thicknessMm,
  };
}

/**
 * Corner Healing & Collinear Wall Merging
 * Merges collinear wall segments along the same datum (horizontal or vertical within tolerance)
 * into a single continuous wall run.
 */
export function mergeCollinearSegments<
  T extends { id: string; geometry: { x1?: number; y1?: number; x2?: number; y2?: number }; [key: string]: any }
>(walls: T[], tolerancePx = 8, maxGapPx = 30): T[] {
  if (walls.length <= 1) return walls;

  const result: T[] = [];
  const mergedIds = new Set<string>();

  for (let i = 0; i < walls.length; i++) {
    const w1 = walls[i];
    if (mergedIds.has(w1.id)) continue;

    const g1 = w1.geometry;
    if (g1.x1 === undefined || g1.y1 === undefined || g1.x2 === undefined || g1.y2 === undefined) {
      result.push(w1);
      continue;
    }

    const isH1 = Math.abs(g1.y2 - g1.y1) <= tolerancePx;
    const isV1 = Math.abs(g1.x2 - g1.x1) <= tolerancePx;

    const mergedWall = { ...w1, geometry: { ...g1 } };

    if (isH1) {
      const datumY = (g1.y1 + g1.y2) / 2;
      let minX = Math.min(g1.x1, g1.x2);
      let maxX = Math.max(g1.x1, g1.x2);

      for (let j = i + 1; j < walls.length; j++) {
        const w2 = walls[j];
        if (mergedIds.has(w2.id)) continue;
        const g2 = w2.geometry;
        if (g2.x1 === undefined || g2.y1 === undefined || g2.x2 === undefined || g2.y2 === undefined) continue;

        const isH2 = Math.abs(g2.y2 - g2.y1) <= tolerancePx;
        const datumY2 = (g2.y1 + g2.y2) / 2;

        if (isH2 && Math.abs(datumY - datumY2) <= tolerancePx) {
          const w2MinX = Math.min(g2.x1, g2.x2);
          const w2MaxX = Math.max(g2.x1, g2.x2);

          // Check if segments overlap or gap is within maxGapPx
          const overlaps = w2MinX <= maxX + maxGapPx && w2MaxX >= minX - maxGapPx;
          if (overlaps) {
            minX = Math.min(minX, w2MinX);
            maxX = Math.max(maxX, w2MaxX);
            mergedIds.add(w2.id);
          }
        }
      }

      mergedWall.geometry.x1 = minX;
      mergedWall.geometry.x2 = maxX;
      mergedWall.geometry.y1 = Math.round(datumY);
      mergedWall.geometry.y2 = Math.round(datumY);
    } else if (isV1) {
      const datumX = (g1.x1 + g1.x2) / 2;
      let minY = Math.min(g1.y1, g1.y2);
      let maxY = Math.max(g1.y1, g1.y2);

      for (let j = i + 1; j < walls.length; j++) {
        const w2 = walls[j];
        if (mergedIds.has(w2.id)) continue;
        const g2 = w2.geometry;
        if (g2.x1 === undefined || g2.y1 === undefined || g2.x2 === undefined || g2.y2 === undefined) continue;

        const isV2 = Math.abs(g2.x2 - g2.x1) <= tolerancePx;
        const datumX2 = (g2.x1 + g2.x2) / 2;

        if (isV2 && Math.abs(datumX - datumX2) <= tolerancePx) {
          const w2MinY = Math.min(g2.y1, g2.y2);
          const w2MaxY = Math.max(g2.y1, g2.y2);

          const overlaps = w2MinY <= maxY + maxGapPx && w2MaxY >= minY - maxGapPx;
          if (overlaps) {
            minY = Math.min(minY, w2MinY);
            maxY = Math.max(maxY, w2MaxY);
            mergedIds.add(w2.id);
          }
        }
      }

      mergedWall.geometry.x1 = Math.round(datumX);
      mergedWall.geometry.x2 = Math.round(datumX);
      mergedWall.geometry.y1 = minY;
      mergedWall.geometry.y2 = maxY;
    }

    result.push(mergedWall);
  }

  return result;
}

/**
 * Trick 3: Region-of-Interest (ROI) Re-Detection
 * Identifies spatial clusters with confidence < 75% or conflicting OCR labels,
 * providing bounding boxes for high-sensitivity localized re-detection.
 */
export interface RoiDetectionCluster {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  elementIds: string[];
  avgConfidence: number;
}

export function findLowConfidenceClusters<
  T extends {
    id: string;
    confidence: number;
    geometry: { x1?: number; y1?: number; x2?: number; y2?: number; x?: number; y?: number; width?: number; height?: number };
  }
>(elements: T[], threshold = 0.75, paddingPx = 20): RoiDetectionCluster[] {
  const lowConf = elements.filter((e) => e.confidence < threshold);
  if (lowConf.length === 0) return [];

  const clusters: RoiDetectionCluster[] = [];
  const visited = new Set<string>();

  for (const item of lowConf) {
    if (visited.has(item.id)) continue;

    const getCenter = (el: T) => {
      const g = el.geometry;
      if (g.x1 !== undefined && g.y1 !== undefined && g.x2 !== undefined && g.y2 !== undefined) {
        return {
          x: (g.x1 + g.x2) / 2,
          y: (g.y1 + g.y2) / 2,
          minX: Math.min(g.x1, g.x2),
          maxX: Math.max(g.x1, g.x2),
          minY: Math.min(g.y1, g.y2),
          maxY: Math.max(g.y1, g.y2),
        };
      }
      const x = g.x ?? 0;
      const y = g.y ?? 0;
      const w = g.width ?? 50;
      const h = g.height ?? 50;
      return { x: x + w / 2, y: y + h / 2, minX: x, maxX: x + w, minY: y, maxY: y + h };
    };

    const c1 = getCenter(item);
    const clusterItems = [item];
    visited.add(item.id);

    let minX = c1.minX;
    let maxX = c1.maxX;
    let minY = c1.minY;
    let maxY = c1.maxY;

    for (const other of lowConf) {
      if (visited.has(other.id)) continue;
      const c2 = getCenter(other);
      const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
      if (dist < 120) {
        clusterItems.push(other);
        visited.add(other.id);
        minX = Math.min(minX, c2.minX);
        maxX = Math.max(maxX, c2.maxX);
        minY = Math.min(minY, c2.minY);
        maxY = Math.max(maxY, c2.maxY);
      }
    }

    const avgConf = clusterItems.reduce((sum, el) => sum + el.confidence, 0) / clusterItems.length;

    clusters.push({
      id: `roi-${clusters.length + 1}`,
      x: Math.max(0, Math.round(minX - paddingPx)),
      y: Math.max(0, Math.round(minY - paddingPx)),
      width: Math.round(maxX - minX + paddingPx * 2),
      height: Math.round(maxY - minY + paddingPx * 2),
      elementIds: clusterItems.map((el) => el.id),
      avgConfidence: Math.round(avgConf * 100) / 100,
    });
  }

  return clusters;
}

/**
 * Trick 4: Retroactive Calibration Cross-Checking
 * Evaluates detected dimension strings or OCR labels against scaleMmPerPixel.
 * Flags any wall where | pixelLength * scale - ocrDimension | > tolerance.
 */
export interface CalibrationCrossCheckDiscrepancy {
  elementId: string;
  label: string;
  ocrDimensionMm: number;
  calibratedMm: number;
  deltaMm: number;
  deltaPct: number;
  severity: 'warning' | 'critical';
  message: string;
}

export function crossCheckCalibrationDimensions<
  T extends { id: string; label?: string; dimensionMm?: number; geometry: { x1?: number; y1?: number; x2?: number; y2?: number } }
>(elements: T[], scaleMmPerPixel: number, tolerancePct = 0.05): CalibrationCrossCheckDiscrepancy[] {
  if (!scaleMmPerPixel || scaleMmPerPixel <= 0) return [];
  const discrepancies: CalibrationCrossCheckDiscrepancy[] = [];

  for (const el of elements) {
    if (!el.dimensionMm || el.dimensionMm <= 0) continue;
    const g = el.geometry;
    if (g.x1 === undefined || g.y1 === undefined || g.x2 === undefined || g.y2 === undefined) continue;

    const pixelLength = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    const calibratedMm = Math.round(pixelLength * scaleMmPerPixel);
    const ocrDimensionMm = el.dimensionMm;
    const deltaMm = Math.abs(calibratedMm - ocrDimensionMm);
    const deltaPct = deltaMm / ocrDimensionMm;

    if (deltaPct > tolerancePct) {
      const isCritical = deltaPct > 0.15 || deltaMm > 300;
      discrepancies.push({
        elementId: el.id,
        label: el.label || `Element ${el.id}`,
        ocrDimensionMm,
        calibratedMm,
        deltaMm,
        deltaPct: Math.round(deltaPct * 1000) / 10,
        severity: isCritical ? 'critical' : 'warning',
        message: `${el.label || 'Wall'}: Calibrated ${calibratedMm}mm differs from detected printed dimension ${ocrDimensionMm}mm by ${deltaMm}mm (${Math.round(deltaPct * 100)}%).`,
      });
    }
  }

  return discrepancies;
}
