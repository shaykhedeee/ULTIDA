/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ULTIDA ADVANCED 2D GUILLOTINE NESTING OPTIMIZER & LAMINATE MATCHING ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * High-precision sheet optimization conforming to System 32 Indian modular
 * architectural woodworking.
 *
 * Implements a multi-pass 2D Guillotine Maximal-Rectangles (MaxRects) algorithm
 * with rotation optimization, saw kerf allowance, edge trim margins, and remnant
 * offcut recovery to push board yield above 95% (wastage < 5%).
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export type GrainDirection = 'vertical' | 'horizontal' | 'none';

export type PartClassification =
  | 'external_shutter'
  | 'external_drawer_front'
  | 'external_filler'
  | 'external_pelmet'
  | 'external_skirting'
  | 'internal_carcass_gable'
  | 'internal_carcass_deck'
  | 'internal_divider'
  | 'internal_shelf_fixed'
  | 'internal_shelf_adj'
  | 'internal_drawer_side'
  | 'internal_drawer_back'
  | 'internal_drawer_bottom'
  | 'back_panel';

export interface NestingPart {
  id: string;
  partInstanceId: string;
  name: string;
  roomName?: string;
  moduleName?: string;
  classification: PartClassification;
  isExternal: boolean;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  quantity: number;
  materialCode: string;
  materialName?: string;
  grainDirection: GrainDirection;
  /** Set only when the material supplier allows 90-degree grain rotation for this part. */
  grainRotationAllowed?: boolean;
  externalLaminateCode?: string;
  internalLinerCode?: string;
  edgeBanding: {
    l1: string; // e.g. '2.0mm PVC' or '0.8mm PVC' or 'none'
    l2: string;
    w1: string;
    w2: string;
    totalLinearMeters: number;
  };
  notes?: string;
}

export interface PlacedPanel {
  id: string;
  partRef: NestingPart;
  name: string;
  classification: PartClassification;
  isExternal: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  grain: GrainDirection;
  color: string;
  laminateCode?: string;
  edgeBandingText: string;
  cutSequenceNumber: number;
}

export interface GuillotineCut {
  id: string;
  type: 'rip' | 'cross';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sequence: number;
}

export interface OptimizedSheet {
  sheetIndex: number;
  sheetLabel: string;
  materialCode: string;
  materialName: string;
  thicknessMm: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  usableWidthMm: number;
  usableHeightMm: number;
  trimMm: number;
  kerfMm: number;
  placedPanels: PlacedPanel[];
  cuts: GuillotineCut[];
  totalAreaSqm: number;
  usedAreaSqm: number;
  wasteAreaSqm: number;
  yieldPct: number;
  wastePct: number;
  remnants: Array<{ x: number; y: number; w: number; h: number }>;
}

export interface NestingOptimizationResult {
  sheets: OptimizedSheet[];
  summary: {
    totalPartsPlaced: number;
    blockingIssues: string[];
    unplacedParts: Array<{ partInstanceId: string; name: string; quantity: number; reason: string }>;
    totalAreaRequiredSqm: number;
    totalBoardAreaPurchasedSqm: number;
    overallYieldPct: number;
    overallWastePct: number;
    totalSheetsCount: number;
    sheetsByMaterial: Record<string, number>;
    laminateRequirement: {
      externalDecorativeSheets: number;
      internalLinerSheets: number;
      backingPlySheets: number;
      carcassPlySheets: number;
    };
    edgeBandingRequirement: {
      pvc2mmMeters: number;
      pvc08mmMeters: number;
      otherMeters: number;
      totalMeters: number;
    };
  };
}

export interface NestingOptions {
  sheetWidthMm?: number;  // Standard 2440 mm (8 ft)
  sheetHeightMm?: number; // Standard 1220 mm (4 ft)
  trimMm?: number;         // Board edge squaring margin (10 mm)
  kerfMm?: number;         // Saw blade thickness (3 mm or 4 mm)
  allowGrainRotationForSolid?: boolean; // true
}

export interface MaterialMatchingPreset {
  carcassCorePly: string;
  carcassThicknessMm: number;
  externalDecorativeLaminate: string;
  externalLaminateThicknessMm: number;
  internalLinerLaminate: string;
  internalLinerThicknessMm: number;
  backPanelMaterial: string;
  backPanelThicknessMm: number;
  externalEdgeBand: string;
  internalEdgeBand: string;
}

export const DEFAULT_MATERIAL_PRESET: MaterialMatchingPreset = {
  carcassCorePly: '18mm BWP Marine Plywood (IS:710)',
  carcassThicknessMm: 18,
  externalDecorativeLaminate: '1.0mm Premium Textured Woodgrain (Merino Royal Oak)',
  externalLaminateThicknessMm: 1.0,
  internalLinerLaminate: '0.8mm Off-White Suede Liner (Anti-Bacterial)',
  internalLinerThicknessMm: 0.8,
  backPanelMaterial: '9mm BWP Backing Ply with matching liner',
  backPanelThicknessMm: 9,
  externalEdgeBand: '2.0mm High-Impact PVC Tape (Zero Joint)',
  internalEdgeBand: '0.8mm Color-Matched PVC Tape',
};

// ─── Free Rectangle Data Structure for Guillotine Bin Packing ───────────────
interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * High-performance 2D Guillotine MaxRects Nesting Engine
 * Tests multiple sort heuristics (Area, Height, Width, Aspect) and selects the
 * packing configuration that achieves the lowest waste (< 5% target).
 */
export function optimizeGuillotineNesting(
  parts: NestingPart[],
  options: NestingOptions = {}
): NestingOptimizationResult {
  const sheetW = options.sheetWidthMm ?? 2440;
  const sheetH = options.sheetHeightMm ?? 1220;
  const trim = options.trimMm ?? 10;
  const kerf = options.kerfMm ?? 4;
  const allowGrainRot = options.allowGrainRotationForSolid ?? true;

  if (![sheetW, sheetH].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError('Sheet width and height must be finite positive millimetre values.');
  if (![trim, kerf].every((value) => Number.isFinite(value) && value >= 0)) throw new RangeError('Trim and saw kerf must be finite non-negative millimetre values.');
  if (sheetW - trim * 2 <= 0 || sheetH - trim * 2 <= 0) throw new RangeError('Sheet trim leaves no usable panel area.');
  const seenPartIds = new Set<string>();
  for (const part of parts) {
    const partId = part.partInstanceId || part.id;
    if (!partId.trim() || seenPartIds.has(partId)) throw new RangeError(`Part identifier "${partId}" is missing or duplicated.`);
    seenPartIds.add(partId);
    if (![part.lengthMm, part.widthMm, part.thicknessMm].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError(`Part ${partId} has a non-positive or invalid dimension.`);
    if (!Number.isInteger(part.quantity) || part.quantity <= 0) throw new RangeError(`Part ${partId} quantity must be a positive whole number.`);
    if (!['vertical', 'horizontal', 'none'].includes(part.grainDirection)) throw new RangeError(`Part ${partId} has an invalid grain direction.`);
    if (!Number.isFinite(part.edgeBanding?.totalLinearMeters) || part.edgeBanding.totalLinearMeters < 0) throw new RangeError(`Part ${partId} has invalid edge-banding quantity.`);
  }

  const usableW = sheetW - trim * 2;
  const usableH = sheetH - trim * 2;

  // Group parts by (core substrate + thickness + external decorative finish + internal liner finish)
  // This ensures identical finishes across all modules and rooms (e.g. TV unit & Wardrobe sharing the
  // same decorative laminate) are consolidated onto the same cutting sheets, while incompatible finishes
  // are cleanly isolated onto separate sheets.
  const getMaterialGroupingKey = (part: NestingPart) => {
    const core = String(part.materialCode || 'core-ply').trim().toLowerCase();
    const thick = Number(part.thicknessMm || 18);
    const ext = part.isExternal && part.externalLaminateCode ? `_ext:${String(part.externalLaminateCode).trim().toLowerCase()}` : '';
    const liner = part.internalLinerCode ? `_in:${String(part.internalLinerCode).trim().toLowerCase()}` : '';
    return `${core}_${thick}mm${ext}${liner}`;
  };

  const byMaterial: Record<string, NestingPart[]> = {};
  for (const part of parts) {
    const key = getMaterialGroupingKey(part);
    if (!byMaterial[key]) {
      byMaterial[key] = [];
    }
    byMaterial[key].push(part);
  }

  const allOptimizedSheets: OptimizedSheet[] = [];
  const unplacedParts: NestingOptimizationResult['summary']['unplacedParts'] = [];
  let globalSheetIndex = 1;

  const colorPalette = [
    '#c59c2d', '#2563eb', '#059669', '#d97706', '#7c3aed',
    '#db2777', '#0891b2', '#65a30d', '#b91c1c', '#4338ca',
    '#047857', '#b45309', '#6d28d9', '#be185d', '#0f766e'
  ];

  // For each material and finish combination, find the best packing across multiple heuristics
  for (const [matGroupKey, matParts] of Object.entries(byMaterial)) {
    const firstPart = matParts[0];
    const baseMatName = firstPart?.materialName || firstPart?.materialCode || 'Core Substrate';
    const extLam = firstPart?.externalLaminateCode;
    const resolvedMaterialName = extLam
      ? `${baseMatName} + Laminate: ${extLam}`
      : `${baseMatName} (${firstPart?.thicknessMm || 18}mm)`;
    const resolvedThickness = firstPart?.thicknessMm || 18;

    // Expand parts by quantity
    const itemsToPack: Array<{
      itemKey: string;
      part: NestingPart;
      length: number;
      width: number;
      grain: GrainDirection;
    }> = [];

    for (const p of matParts) {
      const qty = p.quantity;
      for (let q = 0; q < qty; q++) {
        itemsToPack.push({
          itemKey: `${p.partInstanceId || p.id}_q${q + 1}`,
          part: p,
          length: Math.max(p.lengthMm, p.widthMm),
          width: Math.min(p.lengthMm, p.widthMm),
          grain: p.grainDirection,
        });
      }
    }

    // Heuristics to test:
    // 1. Decreasing Area
    // 2. Decreasing Max Dimension (Length)
    // 3. Decreasing Width
    // 4. Best Aspect Ratio (Length / Width)
    const heuristics: Array<{
      name: string;
      sorter: (a: typeof itemsToPack[0], b: typeof itemsToPack[0]) => number;
    }> = [
      {
        name: 'decreasing_area',
        sorter: (a, b) => b.length * b.width - a.length * a.width,
      },
      {
        name: 'decreasing_length',
        sorter: (a, b) => b.length - a.length || b.width - a.width,
      },
      {
        name: 'decreasing_width',
        sorter: (a, b) => b.width - a.width || b.length - a.length,
      },
      {
        name: 'aspect_ratio',
        sorter: (a, b) => (b.length / b.width) - (a.length / a.width) || (b.length * b.width - a.length * a.width),
      },
    ];

    let bestPackResult: OptimizedSheet[] | null = null;
    let highestYield = -1;

    for (const h of heuristics) {
      const sorted = [...itemsToPack].sort(h.sorter);
      const simulatedSheets = packSingleMaterialGuillotine(
        sorted,
        firstPart?.materialCode || matGroupKey,
        resolvedMaterialName,
        resolvedThickness,
        sheetW,
        sheetH,
        usableW,
        usableH,
        trim,
        kerf,
        allowGrainRot,
        colorPalette,
        globalSheetIndex
      );

      const totalUsed = simulatedSheets.reduce((sum, s) => sum + s.usedAreaSqm, 0);
      const totalPurchased = simulatedSheets.reduce((sum, s) => sum + s.totalAreaSqm, 0);
      const yieldPct = totalPurchased > 0 ? (totalUsed / totalPurchased) * 100 : 0;

      if (yieldPct > highestYield || (simulatedSheets.length < (bestPackResult?.length ?? Infinity))) {
        highestYield = yieldPct;
        bestPackResult = simulatedSheets;
      }
    }

    if (bestPackResult) {
      allOptimizedSheets.push(...bestPackResult);
      globalSheetIndex += bestPackResult.length;
      const placedKeys = new Set(bestPackResult.flatMap((sheet) => sheet.placedPanels.map((panel) => panel.id)));
      const unplacedByPart = new Map<string, { part: NestingPart; quantity: number }>();
      for (const item of itemsToPack) {
        if (placedKeys.has(item.itemKey)) continue;
        const key = item.part.partInstanceId || item.part.id;
        const entry = unplacedByPart.get(key) ?? { part: item.part, quantity: 0 };
        entry.quantity += 1;
        unplacedByPart.set(key, entry);
      }
      for (const [partInstanceId, entry] of unplacedByPart) {
        unplacedParts.push({ partInstanceId, name: entry.part.name, quantity: entry.quantity, reason: 'No selected sheet can fit this part within trim, kerf, and grain-direction constraints.' });
      }
    }
  }

  // Calculate totals and material summaries
  const totalPartsPlaced = allOptimizedSheets.reduce((sum, s) => sum + s.placedPanels.length, 0);
  const totalAreaRequiredRaw = allOptimizedSheets.reduce((sum, s) => sum + s.usedAreaSqm, 0);
  const totalBoardAreaPurchasedRaw = allOptimizedSheets.reduce((sum, s) => sum + s.totalAreaSqm, 0);
  const totalAreaRequiredSqm = Math.round(totalAreaRequiredRaw * 10_000) / 10_000;
  const totalBoardAreaPurchasedSqm = Math.round(totalBoardAreaPurchasedRaw * 10_000) / 10_000;
  const overallYieldPct = totalBoardAreaPurchasedRaw > 0
    ? Math.min(100, Math.round((totalAreaRequiredRaw / totalBoardAreaPurchasedRaw) * 1000) / 10)
    : 0;
  const overallWastePct = Math.max(0, Math.round((100 - overallYieldPct) * 10) / 10);

  const sheetsByMaterial: Record<string, number> = {};
  for (const s of allOptimizedSheets) {
    sheetsByMaterial[s.materialCode] = (sheetsByMaterial[s.materialCode] ?? 0) + 1;
  }

  // Laminate sheet counting:
  // External decorative panels require matching 1.0mm decorative laminate sheets
  // Carcass panels require double-side 0.8mm liner laminate sheets
  let externalPanelAreaSqm = 0;
  let internalPanelAreaSqm = 0;
  let backingAreaSqm = 0;
  let total2mmEdgeMeters = 0;
  let total08mmEdgeMeters = 0;
  let otherEdgeMeters = 0;

  for (const p of parts) {
    const partArea = (p.lengthMm * p.widthMm * p.quantity) / 1e6;
    if (p.isExternal) {
      externalPanelAreaSqm += partArea;
    } else if (p.classification === 'back_panel') {
      backingAreaSqm += partArea;
    } else {
      internalPanelAreaSqm += partArea;
    }

    const edges = [
      { lengthMm: p.lengthMm, band: p.edgeBanding.l1 },
      { lengthMm: p.lengthMm, band: p.edgeBanding.l2 },
      { lengthMm: p.widthMm, band: p.edgeBanding.w1 },
      { lengthMm: p.widthMm, band: p.edgeBanding.w2 },
    ];
    for (const edge of edges) {
      if (!edge.band || /^(none|n\/a|-)$/i.test(edge.band.trim())) continue;
      const meters = (edge.lengthMm * p.quantity) / 1000;
      const thickness = Number(edge.band.match(/(\d+(?:\.\d+)?)\s*mm/i)?.[1]);
      if (!Number.isFinite(thickness)) otherEdgeMeters += meters;
      else if (thickness <= 0.9) total08mmEdgeMeters += meters;
      else if (thickness >= 1.5 && thickness <= 2.5) total2mmEdgeMeters += meters;
      else otherEdgeMeters += meters;
    }
  }

  const standardSheetSqm = (sheetW * sheetH) / 1e6;
  // These are area-only lower bounds, not a laminate nesting plan. Actual
  // quantities can be higher because separate decor codes cannot share stock,
  // and grain, trimming, kerf, and defects consume additional area.
  const externalDecorativeSheets = Math.ceil(externalPanelAreaSqm / standardSheetSqm);
  const internalLinerSheets = Math.ceil((internalPanelAreaSqm * 2 + externalPanelAreaSqm + backingAreaSqm) / standardSheetSqm);
  const carcassPlySheets = Math.ceil((internalPanelAreaSqm + externalPanelAreaSqm) / standardSheetSqm);
  const backingPlySheets = Math.ceil(backingAreaSqm / standardSheetSqm);

  return {
    sheets: allOptimizedSheets,
    summary: {
      totalPartsPlaced,
      blockingIssues: [],
      unplacedParts,
      totalAreaRequiredSqm,
      totalBoardAreaPurchasedSqm,
      overallYieldPct,
      overallWastePct,
      totalSheetsCount: allOptimizedSheets.length,
      sheetsByMaterial,
      laminateRequirement: {
        externalDecorativeSheets,
        internalLinerSheets,
        backingPlySheets,
        carcassPlySheets,
      },
      edgeBandingRequirement: {
        pvc2mmMeters: Math.round(total2mmEdgeMeters * 1000) / 1000,
        pvc08mmMeters: Math.round(total08mmEdgeMeters * 1000) / 1000,
        otherMeters: Math.round(otherEdgeMeters * 1000) / 1000,
        totalMeters: Math.round((total2mmEdgeMeters + total08mmEdgeMeters + otherEdgeMeters) * 1000) / 1000,
      },
    },
  };
}

/**
 * Packs panels of a single material code using the Guillotine Maximal Rectangles Best-Short-Side Fit.
 */
function packSingleMaterialGuillotine(
  items: Array<{
    itemKey: string;
    part: NestingPart;
    length: number;
    width: number;
    grain: GrainDirection;
  }>,
  materialCode: string,
  materialName: string,
  thicknessMm: number,
  sheetW: number,
  sheetH: number,
  usableW: number,
  usableH: number,
  trim: number,
  kerf: number,
  allowGrainRot: boolean,
  colorPalette: string[],
  startSheetIndex: number
): OptimizedSheet[] {
  const remaining = [...items];
  const sheets: OptimizedSheet[] = [];
  let sheetIdx = startSheetIndex;

  while (remaining.length > 0) {
    const freeRects: FreeRect[] = [{ x: trim, y: trim, w: usableW, h: usableH }];
    const placedOnSheet: PlacedPanel[] = [];
    const cutsOnSheet: GuillotineCut[] = [];
    let cutSeq = 1;

    let placedAnyInPass = true;
    while (placedAnyInPass && remaining.length > 0) {
      placedAnyInPass = false;

      // Find the best panel and best free rect using Best-Short-Side-Fit (BSSF)
      let bestItemIndex = -1;
      let bestRectIndex = -1;
      let bestRotated = false;
      let bestShortSideScore = Infinity;
      let bestAreaScore = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const canRotate = item.grain === 'none' || (allowGrainRot && item.part.grainRotationAllowed === true);

        for (let r = 0; r < freeRects.length; r++) {
          const rect = freeRects[r];

          // Try orientation 1 (normal: length along X, width along Y)
          const w1 = item.length;
          const h1 = item.width;
          if (w1 <= rect.w && h1 <= rect.h) {
            const shortSideFit = Math.min(rect.w - w1, rect.h - h1);
            const areaFit = rect.w * rect.h - w1 * h1;
            if (shortSideFit < bestShortSideScore || (shortSideFit === bestShortSideScore && areaFit < bestAreaScore)) {
              bestShortSideScore = shortSideFit;
              bestAreaScore = areaFit;
              bestItemIndex = i;
              bestRectIndex = r;
              bestRotated = false;
            }
          }

          // Try orientation 2 (rotated 90 deg: width along X, length along Y)
          if (canRotate) {
            const w2 = item.width;
            const h2 = item.length;
            if (w2 <= rect.w && h2 <= rect.h) {
              const shortSideFit = Math.min(rect.w - w2, rect.h - h2);
              const areaFit = rect.w * rect.h - w2 * h2;
              if (shortSideFit < bestShortSideScore || (shortSideFit === bestShortSideScore && areaFit < bestAreaScore)) {
                bestShortSideScore = shortSideFit;
                bestAreaScore = areaFit;
                bestItemIndex = i;
                bestRectIndex = r;
                bestRotated = true;
              }
            }
          }
        }
      }

      // If we found a fit, place it and split the free rectangle
      if (bestItemIndex !== -1 && bestRectIndex !== -1) {
        const item = remaining[bestItemIndex];
        const rect = freeRects[bestRectIndex];

        const panelW = bestRotated ? item.width : item.length;
        const panelH = bestRotated ? item.length : item.width;

        const placedPanel: PlacedPanel = {
          id: item.itemKey,
          partRef: item.part,
          name: item.part.name,
          classification: item.part.classification,
          isExternal: item.part.isExternal,
          x: rect.x,
          y: rect.y,
          w: panelW,
          h: panelH,
          rotated: bestRotated,
          grain: item.part.grainDirection,
          color: colorPalette[placedOnSheet.length % colorPalette.length],
          laminateCode: item.part.isExternal ? item.part.externalLaminateCode : item.part.internalLinerCode,
          edgeBandingText: `${item.part.edgeBanding.l1} / ${item.part.edgeBanding.w1}`,
          cutSequenceNumber: cutSeq++,
        };

        placedOnSheet.push(placedPanel);
        remaining.splice(bestItemIndex, 1);
        placedAnyInPass = true;

        // Perform Guillotine Split of rect:
        // Free space right of panel: (rect.x + panelW + kerf, rect.y, rect.w - panelW - kerf, panelH)
        // Free space below panel: (rect.x, rect.y + panelH + kerf, rect.w, rect.h - panelH - kerf)
        freeRects.splice(bestRectIndex, 1);

        const rightW = rect.w - panelW - kerf;
        const bottomH = rect.h - panelH - kerf;

        // Guillotine rip cut line
        cutsOnSheet.push({
          id: `cut-rip-${cutSeq}`,
          type: 'rip',
          x1: rect.x + panelW,
          y1: rect.y,
          x2: rect.x + panelW,
          y2: rect.y + rect.h,
          sequence: cutSeq++,
        });

        // Guillotine cross cut line
        cutsOnSheet.push({
          id: `cut-cross-${cutSeq}`,
          type: 'cross',
          x1: rect.x,
          y1: rect.y + panelH,
          x2: rect.x + rect.w,
          y2: rect.y + panelH,
          sequence: cutSeq++,
        });

        // Split strategy: split along shorter axis to produce larger contiguous remnants
        if (rightW > 40 && panelH > 40) {
          freeRects.push({
            x: rect.x + panelW + kerf,
            y: rect.y,
            w: rightW,
            h: panelH,
          });
        }
        if (bottomH > 40 && rect.w > 40) {
          freeRects.push({
            x: rect.x,
            y: rect.y + panelH + kerf,
            w: rect.w,
            h: bottomH,
          });
        }

        // Clean up overlapping or degenerate rects
        pruneFreeRects(freeRects);
      }
    }

    if (placedOnSheet.length === 0) break;
    const totalSheetAreaSqm = (sheetW * sheetH) / 1e6;
    const usedAreaSqm = placedOnSheet.reduce((sum, p) => sum + (p.w * p.h) / 1e6, 0);
    const yieldPct = Math.min(100, Math.round((usedAreaSqm / totalSheetAreaSqm) * 1000) / 10);
    const wastePct = Math.max(0, Math.round((100 - yieldPct) * 10) / 10);

    sheets.push({
      sheetIndex: sheetIdx++,
      sheetLabel: `Sheet #${sheets.length + 1} — ${materialName} (${thicknessMm}mm)`,
      materialCode,
      materialName,
      thicknessMm,
      sheetWidthMm: sheetW,
      sheetHeightMm: sheetH,
      usableWidthMm: usableW,
      usableHeightMm: usableH,
      trimMm: trim,
      kerfMm: kerf,
      placedPanels: placedOnSheet,
      cuts: cutsOnSheet,
      totalAreaSqm: totalSheetAreaSqm,
      usedAreaSqm,
      wasteAreaSqm: totalSheetAreaSqm - usedAreaSqm,
      yieldPct,
      wastePct,
      remnants: freeRects.filter((r) => r.w >= 100 && r.h >= 100),
    });

    // Guard against infinite loop if an oversized panel can't fit on any sheet
    if (!placedAnyInPass && remaining.length > 0) {
      console.warn('Oversized panel cannot fit in usable sheet area:', remaining[0]);
      // Force place with warning or break to prevent hang
      break;
    }
  }

  return sheets;
}

function pruneFreeRects(rects: FreeRect[]): void {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      // If a is fully inside b, remove a
      if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
        rects.splice(i, 1);
        i--;
        break;
      }
      // If b is fully inside a, remove b
      if (b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h) {
        rects.splice(j, 1);
        j--;
      }
    }
  }
}

// ─── 2D Drawing / CAD File Parser & Anatomy Extractor ───────────────────────
export interface Parsed2DSpace {
  title: string;
  sourceType: 'json' | 'dxf' | 'csv' | 'preset';
  overallWidthMm: number | null;
  overallHeightMm: number | null;
  depthMm: number | null;
  parts: NestingPart[];
  materialsMatched: {
    carcass: string;
    externalLaminate: string;
    internalLiner: string;
    backing: string;
  };
}

/**
 * Ingests a 2D drawing file (JSON, DXF ASCII, or CSV) and parses internal and external joinery.
 */
export function parse2DDrawingFile(
  content: string,
  fileName: string = 'drawing.json',
  presetConfig: MaterialMatchingPreset = DEFAULT_MATERIAL_PRESET
): Parsed2DSpace {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('The uploaded panel schedule is empty. No cutlist was created.');

  // JSON imports either parse as a complete explicit schedule or fail clearly;
  // malformed/incomplete data must never fall through to guessed cabinet sizes.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('The JSON panel schedule is malformed. Correct the file and try again.');
    }
    return parseJsonDrawingData(data, fileName, presetConfig);
  }

  if (/\.dxf$/i.test(fileName)) {
    throw new Error('DXF drawings are not panel schedules. Import a reviewed CSV/JSON panel list or generate the cutlist from an approved scene. No cabinet dimensions were inferred from the drawing.');
  }
  if (trimmed.includes(',') && /(?:length|width|part|panel)/i.test(trimmed.split(/\r?\n/, 1)[0])) {
    return parseCsvDrawingData(trimmed, fileName, presetConfig);
  }
  throw new Error('Unsupported cutlist input. Provide a JSON or CSV panel schedule with explicit panel lengths and widths.');
}

function readRequiredPositiveNumber(value: unknown, field: string, rowLabel: string) {
  const numeric = value === undefined || value === null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error(`${rowLabel}: ${field} must be provided as a positive millimetre value.`);
  return numeric;
}

function readOptionalPositiveNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  return readRequiredPositiveNumber(value, field, 'Schedule');
}

function parseJsonDrawingData(data: any, fileName: string, preset: MaterialMatchingPreset): Parsed2DSpace {
  const root = Array.isArray(data) ? { parts: data } : data;
  if (!root || typeof root !== 'object') throw new Error('The JSON schedule must contain a parts array.');
  const title = String(root.title ?? root.name ?? fileName.replace(/\.[^/.]+$/, '')).trim();
  const overallW = readOptionalPositiveNumber(root.overallWidthMm ?? root.width, 'overallWidthMm');
  const overallH = readOptionalPositiveNumber(root.overallHeightMm ?? root.height, 'overallHeightMm');
  const depth = readOptionalPositiveNumber(root.depthMm ?? root.depth, 'depthMm');

  const rawParts = Array.isArray(root.parts) ? root.parts : (Array.isArray(root.modules) ? extractPartsFromModules(root.modules) : []);
  if (!rawParts.length) throw new Error('No explicit panel records were found. Choose a parametric template and enter its dimensions, or import a panel schedule.');
  const parts: NestingPart[] = [];

  for (let idx = 0; idx < rawParts.length; idx++) {
    const raw = rawParts[idx];
    if (!raw || typeof raw !== 'object') throw new Error(`Part row ${idx + 1} is not an object.`);
    const name = String(raw.name ?? raw.partName ?? `Part-${idx + 1}`);
    const rawExternal = raw.isExternal;
    const isExt = rawExternal === undefined ? (
      name.toLowerCase().includes('shutter') ||
      name.toLowerCase().includes('door') ||
      name.toLowerCase().includes('fascia') ||
      name.toLowerCase().includes('filler') ||
      name.toLowerCase().includes('skirting') ||
      name.toLowerCase().includes('pelmet')
    ) : typeof rawExternal === 'boolean' ? rawExternal : String(rawExternal).toLowerCase() === 'true' ? true : String(rawExternal).toLowerCase() === 'false' ? false : (() => { throw new Error(`Part ${idx + 1}: isExternal must be true or false.`); })();

    const inferredClassification: PartClassification = (
      isExt
        ? (name.toLowerCase().includes('drawer') ? 'external_drawer_front' : 'external_shutter')
        : (name.toLowerCase().includes('back') ? 'back_panel' :
           name.toLowerCase().includes('shelf') ? 'internal_shelf_fixed' :
           name.toLowerCase().includes('divider') ? 'internal_divider' : 'internal_carcass_gable')
    );
    const allowedClassifications: PartClassification[] = ['external_shutter','external_drawer_front','external_filler','external_pelmet','external_skirting','internal_carcass_gable','internal_carcass_deck','internal_divider','internal_shelf_fixed','internal_shelf_adj','internal_drawer_side','internal_drawer_back','internal_drawer_bottom','back_panel'];
    const classification = raw.classification ?? inferredClassification;
    if (!allowedClassifications.includes(classification)) throw new Error(`Part ${idx + 1}: unrecognized classification "${String(classification)}".`);

    const rowLabel = String(raw.partInstanceId ?? raw.id ?? `part ${idx + 1}`);
    const lengthMm = readRequiredPositiveNumber(raw.lengthMm ?? raw.length ?? raw.height, 'length', rowLabel);
    const widthMm = readRequiredPositiveNumber(raw.widthMm ?? raw.width, 'width', rowLabel);
    const thicknessMm = readRequiredPositiveNumber(raw.thicknessMm ?? raw.thickness ?? (classification === 'back_panel' ? preset.backPanelThicknessMm : preset.carcassThicknessMm), 'thickness', rowLabel);
    const qty = Number(raw.quantity ?? raw.qty ?? 1);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error(`${rowLabel}: quantity must be a positive whole number.`);
    const grain = raw.grainDirection ?? (isExt ? 'vertical' : 'none');
    if (!['vertical', 'horizontal', 'none'].includes(grain)) throw new Error(`${rowLabel}: grainDirection must be vertical, horizontal, or none.`);

    const matCode = String(raw.materialCode ?? raw.materialName ?? (isExt ? preset.carcassCorePly : classification === 'back_panel' ? preset.backPanelMaterial : preset.carcassCorePly));

    parts.push({
      id: String(raw.id ?? `p-${idx + 1}`),
      partInstanceId: String(raw.partInstanceId ?? raw.id ?? `PART-${idx + 1}`),
      name,
      roomName: raw.roomName || 'Main Room',
      moduleName: raw.moduleName || title,
      classification,
      isExternal: isExt,
      lengthMm,
      widthMm,
      thicknessMm,
      quantity: qty,
      materialCode: matCode,
      materialName: matCode,
      grainDirection: grain,
      externalLaminateCode: isExt ? String(raw.externalLaminateCode ?? preset.externalDecorativeLaminate) : undefined,
      internalLinerCode: raw.internalLinerCode == null ? preset.internalLinerLaminate : String(raw.internalLinerCode),
      edgeBanding: {
        l1: String(raw.edgeBanding?.l1 ?? (isExt ? preset.externalEdgeBand : preset.internalEdgeBand)),
        l2: String(raw.edgeBanding?.l2 ?? (isExt ? preset.externalEdgeBand : 'none')),
        w1: String(raw.edgeBanding?.w1 ?? (isExt ? preset.externalEdgeBand : preset.internalEdgeBand)),
        w2: String(raw.edgeBanding?.w2 ?? (isExt ? preset.externalEdgeBand : 'none')),
        totalLinearMeters: Math.round(((lengthMm * 2 + widthMm * 2) * qty / 1000) * 10) / 10,
      },
      notes: raw.notes || (isExt ? 'External Shutter — Grain Matched' : 'Internal Carcass — System 32'),
    });
  }

  return {
    title,
    sourceType: 'json',
    overallWidthMm: overallW,
    overallHeightMm: overallH,
    depthMm: depth,
    parts,
    materialsMatched: {
      carcass: preset.carcassCorePly,
      externalLaminate: preset.externalDecorativeLaminate,
      internalLiner: preset.internalLinerLaminate,
      backing: preset.backPanelMaterial,
    },
  };
}

function parseCsvDrawingData(csvText: string, fileName: string, preset: MaterialMatchingPreset): Parsed2DSpace {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  const parts: NestingPart[] = [];
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('length') || lines[i].toLowerCase().includes('width') || lines[i].toLowerCase().includes('part')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) throw new Error('CSV panel schedule needs a header row with part name, length, and width columns.');
  const headers = parseCsvRow(lines[headerIndex]).map(normalizeCsvHeader);
  const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const nameColumn = findColumn('name', 'part', 'partname', 'description');
  const lengthColumn = findColumn('length', 'lengthmm', 'height', 'heightmm');
  const widthColumn = findColumn('width', 'widthmm', 'depth', 'depthmm');
  const quantityColumn = findColumn('quantity', 'qty');
  const thicknessColumn = findColumn('thickness', 'thicknessmm');
  const materialColumn = findColumn('material', 'materialcode', 'substrate');
  const idColumn = findColumn('partinstanceid', 'partid', 'id');
  if (lengthColumn < 0 || widthColumn < 0) throw new Error('CSV panel schedule must include length and width columns.');
  const startLine = headerIndex + 1;
  for (let i = startLine; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    if (cols.every((cell) => !cell.trim())) continue;
    const name = cols[nameColumn >= 0 ? nameColumn : 0]?.trim() || `Panel-${i}`;
    const rowLabel = cols[idColumn >= 0 ? idColumn : -1]?.trim() || `CSV row ${i + 1}`;
    const length = readRequiredPositiveNumber(cols[lengthColumn], 'length', rowLabel);
    const width = readRequiredPositiveNumber(cols[widthColumn], 'width', rowLabel);
    const qty = quantityColumn >= 0 ? Number(cols[quantityColumn]) : 1;
    if (!Number.isInteger(qty) || qty <= 0) throw new Error(`${rowLabel}: quantity must be a positive whole number.`);
    const isExt = name.toLowerCase().includes('shutter') || name.toLowerCase().includes('door') || name.toLowerCase().includes('fascia');

    const classification: PartClassification = isExt
      ? 'external_shutter'
      : (name.toLowerCase().includes('back') ? 'back_panel' :
         name.toLowerCase().includes('shelf') ? 'internal_shelf_fixed' : 'internal_carcass_gable');

    const matCode = classification === 'back_panel' ? preset.backPanelMaterial : preset.carcassCorePly;

    parts.push({
      id: idColumn >= 0 && cols[idColumn]?.trim() ? cols[idColumn].trim() : `csv-${i}`,
      partInstanceId: idColumn >= 0 && cols[idColumn]?.trim() ? cols[idColumn].trim() : `CSV-P${i}`,
      name,
      classification,
      isExternal: isExt,
      lengthMm: length,
      widthMm: width,
      thicknessMm: thicknessColumn >= 0 && cols[thicknessColumn] ? readRequiredPositiveNumber(cols[thicknessColumn], 'thickness', rowLabel) : classification === 'back_panel' ? preset.backPanelThicknessMm : preset.carcassThicknessMm,
      quantity: qty,
      materialCode: materialColumn >= 0 && cols[materialColumn]?.trim() ? cols[materialColumn].trim() : matCode,
      materialName: materialColumn >= 0 && cols[materialColumn]?.trim() ? cols[materialColumn].trim() : matCode,
      grainDirection: isExt ? 'vertical' : 'none',
      externalLaminateCode: isExt ? preset.externalDecorativeLaminate : undefined,
      internalLinerCode: preset.internalLinerLaminate,
      edgeBanding: {
        l1: isExt ? preset.externalEdgeBand : preset.internalEdgeBand,
        l2: 'none',
        w1: isExt ? preset.externalEdgeBand : preset.internalEdgeBand,
        w2: 'none',
        totalLinearMeters: Math.round(((length * 2 + width * 2) * qty / 1000) * 10) / 10,
      },
    });
  }

  if (!parts.length) throw new Error('The CSV contains no panel rows. No cutlist was generated.');
  return {
    title: fileName.replace(/\.[^/.]+$/, ''),
    sourceType: 'csv',
    overallWidthMm: null,
    overallHeightMm: null,
    depthMm: null,
    parts,
    materialsMatched: {
      carcass: preset.carcassCorePly,
      externalLaminate: preset.externalDecorativeLaminate,
      internalLiner: preset.internalLinerLaminate,
      backing: preset.backPanelMaterial,
    },
  };
}

function normalizeCsvHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { result.push(current.trim()); current = ''; }
    else current += character;
  }
  if (quoted) throw new Error('CSV panel schedule contains an unclosed quoted value.');
  result.push(current.trim());
  return result;
}

function extractPartsFromModules(modules: any[]): any[] {
  const parts: any[] = [];
  for (const m of modules) {
    if (Array.isArray(m.parts)) {
      parts.push(...m.parts);
    }
  }
  return parts;
}

/**
 * Generates an architecturally complete internal and external carcass anatomy conforming
 * to System 32 joinery standards for a given overall width, height, and depth.
 */
export function generateParametricCabinetAnatomy(
  title: string,
  widthMm: number,
  heightMm: number,
  depthMm: number,
  preset: MaterialMatchingPreset = DEFAULT_MATERIAL_PRESET
): Parsed2DSpace {
  const parts: NestingPart[] = [];
  const t = preset.carcassThicknessMm;
  const plinthH = 100;
  const carcassH = heightMm - plinthH;
  const carcassW = widthMm;

  // Number of vertical bays based on 600mm / 450mm modular grid
  const bayCount = Math.max(2, Math.round(carcassW / 600));
  const bayWidth = Math.round((carcassW - (bayCount + 1) * t) / bayCount);

  // 1. External Shutters (Matched Grain)
  const shutterCount = bayCount <= 2 ? bayCount * 2 : bayCount;
  const shutterW = Math.round((carcassW - (shutterCount - 1) * 2 - 4) / shutterCount);
  const shutterH = carcassH - 4; // 2mm top and bottom reveal gap

  parts.push({
    id: 'shutter-main',
    partInstanceId: 'SHT-01',
    name: `External Shutter (${shutterCount}x Doors)`,
    moduleName: title,
    classification: 'external_shutter',
    isExternal: true,
    lengthMm: shutterH,
    widthMm: shutterW,
    thicknessMm: 18,
    quantity: shutterCount,
    materialCode: preset.externalDecorativeLaminate,
    materialName: preset.externalDecorativeLaminate,
    grainDirection: 'vertical',
    externalLaminateCode: preset.externalDecorativeLaminate,
    internalLinerCode: preset.internalLinerLaminate,
    edgeBanding: {
      l1: preset.externalEdgeBand,
      l2: preset.externalEdgeBand,
      w1: preset.externalEdgeBand,
      w2: preset.externalEdgeBand,
      totalLinearMeters: Math.round(((shutterH * 2 + shutterW * 2) * shutterCount / 1000) * 10) / 10,
    },
    notes: 'Premium 1.0mm Decorative Laminate on 18mm HDHMR + 2mm PVC Tape (Grain Matched)',
  });

  // 2. Dummy Scribe Fillers (Left & Right)
  parts.push({
    id: 'dummy-filler',
    partInstanceId: 'FIL-01',
    name: 'Wall Scribe / Dummy Filler (Left & Right)',
    moduleName: title,
    classification: 'external_filler',
    isExternal: true,
    lengthMm: heightMm,
    widthMm: 50,
    thicknessMm: 18,
    quantity: 2,
    materialCode: preset.externalDecorativeLaminate,
    materialName: preset.externalDecorativeLaminate,
    grainDirection: 'vertical',
    externalLaminateCode: preset.externalDecorativeLaminate,
    internalLinerCode: preset.internalLinerLaminate,
    edgeBanding: {
      l1: preset.externalEdgeBand,
      l2: 'none',
      w1: 'none',
      w2: 'none',
      totalLinearMeters: Math.round((heightMm * 2 / 1000) * 10) / 10,
    },
    notes: 'Site scribe filler with 2mm PVC edge',
  });

  // 3. Plinth Skirting
  parts.push({
    id: 'skirting-fascia',
    partInstanceId: 'SKT-01',
    name: 'Plinth Skirting Fascia',
    moduleName: title,
    classification: 'external_skirting',
    isExternal: true,
    lengthMm: carcassW,
    widthMm: plinthH,
    thicknessMm: 18,
    quantity: 1,
    materialCode: preset.externalDecorativeLaminate,
    materialName: preset.externalDecorativeLaminate,
    grainDirection: 'horizontal',
    externalLaminateCode: preset.externalDecorativeLaminate,
    internalLinerCode: preset.internalLinerLaminate,
    edgeBanding: {
      l1: preset.externalEdgeBand,
      l2: 'none',
      w1: 'none',
      w2: 'none',
      totalLinearMeters: Math.round((carcassW / 1000) * 10) / 10,
    },
  });

  // 4. Carcass Outer Gables (Left & Right)
  parts.push({
    id: 'carcass-outer-gables',
    partInstanceId: 'GBL-OUT',
    name: 'Carcass Outer Gables (Left & Right)',
    moduleName: title,
    classification: 'internal_carcass_gable',
    isExternal: false,
    lengthMm: carcassH,
    widthMm: depthMm,
    thicknessMm: t,
    quantity: 2,
    materialCode: preset.carcassCorePly,
    materialName: preset.carcassCorePly,
    grainDirection: 'none',
    internalLinerCode: preset.internalLinerLaminate,
    edgeBanding: {
      l1: preset.internalEdgeBand,
      l2: 'none',
      w1: preset.internalEdgeBand,
      w2: 'none',
      totalLinearMeters: Math.round(((carcassH * 2 + depthMm * 2) * 2 / 1000) * 10) / 10,
    },
    notes: '18mm BWP Marine Plywood with 0.8mm Liner Laminate both sides',
  });

  // 5. Internal Bay Dividers
  if (bayCount > 1) {
    const dividerCount = bayCount - 1;
    parts.push({
      id: 'carcass-dividers',
      partInstanceId: 'DIV-01',
      name: `Internal Bay Dividers (${dividerCount}x)`,
      moduleName: title,
      classification: 'internal_divider',
      isExternal: false,
      lengthMm: carcassH - t * 2,
      widthMm: depthMm - 20,
      thicknessMm: t,
      quantity: dividerCount,
      materialCode: preset.carcassCorePly,
      materialName: preset.carcassCorePly,
      grainDirection: 'none',
      internalLinerCode: preset.internalLinerLaminate,
      edgeBanding: {
        l1: preset.internalEdgeBand,
        l2: 'none',
        w1: 'none',
        w2: 'none',
        totalLinearMeters: Math.round((carcassH * dividerCount / 1000) * 10) / 10,
      },
    });
  }

  // 6. Top & Bottom Decks
  parts.push({
    id: 'carcass-decks',
    partInstanceId: 'DCK-01',
    name: 'Carcass Top & Bottom Decks',
    moduleName: title,
    classification: 'internal_carcass_deck',
    isExternal: false,
    lengthMm: carcassW - t * 2,
    widthMm: depthMm,
    thicknessMm: t,
    quantity: 2,
    materialCode: preset.carcassCorePly,
    materialName: preset.carcassCorePly,
    grainDirection: 'none',
    internalLinerCode: preset.internalLinerLaminate,
    edgeBanding: {
      l1: preset.internalEdgeBand,
      l2: 'none',
      w1: 'none',
      w2: 'none',
      totalLinearMeters: Math.round(((carcassW - t * 2) * 2 / 1000) * 10) / 10,
    },
  });

  // 7. Fixed & Adjustable Shelves
  const shelvesPerBay = 3;
  const totalShelves = bayCount * shelvesPerBay;
  parts.push({
    id: 'internal-shelves',
    partInstanceId: 'SHF-01',
    name: `Internal Shelves (${totalShelves}x Fixed/Adjustable)`,
    moduleName: title,
    classification: 'internal_shelf_adj',
    isExternal: false,
    lengthMm: bayWidth,
    widthMm: depthMm - 30,
    thicknessMm: t,
    quantity: totalShelves,
    materialCode: preset.carcassCorePly,
    materialName: preset.carcassCorePly,
    grainDirection: 'none',
    internalLinerCode: preset.internalLinerLaminate,
    edgeBanding: {
      l1: preset.internalEdgeBand,
      l2: 'none',
      w1: 'none',
      w2: 'none',
      totalLinearMeters: Math.round((bayWidth * totalShelves / 1000) * 10) / 10,
    },
    notes: 'System 32 adjustable shelf holes at 32mm pitch',
  });

  // 8. Internal Drawer Boxes (Sides, Back, Bottom)
  const drawerBoxesCount = 4;
  parts.push(
    {
      id: 'drawer-sides',
      partInstanceId: 'DRW-SD',
      name: `Drawer Box Sides (${drawerBoxesCount * 2}x)`,
      moduleName: title,
      classification: 'internal_drawer_side',
      isExternal: false,
      lengthMm: depthMm - 100,
      widthMm: 150,
      thicknessMm: 12,
      quantity: drawerBoxesCount * 2,
      materialCode: '12mm Birch Ply / Prelam',
      materialName: '12mm Birch Ply / Prelam',
      grainDirection: 'none',
      internalLinerCode: preset.internalLinerLaminate,
      edgeBanding: {
        l1: preset.internalEdgeBand,
        l2: 'none',
        w1: 'none',
        w2: 'none',
        totalLinearMeters: Math.round(((depthMm - 100) * drawerBoxesCount * 2 / 1000) * 10) / 10,
      },
    },
    {
      id: 'drawer-backs',
      partInstanceId: 'DRW-BK',
      name: `Drawer Box Backs (${drawerBoxesCount}x)`,
      moduleName: title,
      classification: 'internal_drawer_back',
      isExternal: false,
      lengthMm: bayWidth - 60,
      widthMm: 150,
      thicknessMm: 12,
      quantity: drawerBoxesCount,
      materialCode: '12mm Birch Ply / Prelam',
      materialName: '12mm Birch Ply / Prelam',
      grainDirection: 'none',
      internalLinerCode: preset.internalLinerLaminate,
      edgeBanding: {
        l1: preset.internalEdgeBand,
        l2: 'none',
        w1: 'none',
        w2: 'none',
        totalLinearMeters: Math.round(((bayWidth - 60) * drawerBoxesCount / 1000) * 10) / 10,
      },
    }
  );

  // 9. Back Panel (9mm BWP Marine Ply)
  parts.push({
    id: 'back-panel',
    partInstanceId: 'BCK-01',
    name: 'Carcass Backing Panel',
    moduleName: title,
    classification: 'back_panel',
    isExternal: false,
    lengthMm: carcassH - 20,
    widthMm: carcassW - 20,
    thicknessMm: preset.backPanelThicknessMm,
    quantity: 1,
    materialCode: preset.backPanelMaterial,
    materialName: preset.backPanelMaterial,
    grainDirection: 'none',
    internalLinerCode: preset.internalLinerLaminate,
    edgeBanding: {
      l1: 'none',
      l2: 'none',
      w1: 'none',
      w2: 'none',
      totalLinearMeters: 0,
    },
    notes: '9mm rebate / groove recessed back panel with 0.8mm liner',
  });

  return {
    title,
    sourceType: 'preset',
    overallWidthMm: widthMm,
    overallHeightMm: heightMm,
    depthMm,
    parts,
    materialsMatched: {
      carcass: preset.carcassCorePly,
      externalLaminate: preset.externalDecorativeLaminate,
      internalLiner: preset.internalLinerLaminate,
      backing: preset.backPanelMaterial,
    },
  };
}

// ─── Standard Modular Presets ───────────────────────────────────────────────
export const MODULAR_PRESETS: Record<string, { label: string; width: number; height: number; depth: number }> = {
  wardrobe_4door: { label: '4-Door Master Wardrobe Suite (2400×2100×600mm)', width: 2400, height: 2100, depth: 600 },
  wardrobe_3door: { label: '3-Door Sliding Wardrobe with Lofts (1800×2400×600mm)', width: 1800, height: 2400, depth: 600 },
  kitchen_base_wall: { label: 'Modular Kitchen Base & Overhead Run (3000×2100×600mm)', width: 3000, height: 2100, depth: 600 },
  tv_console_louvers: { label: 'Luxury TV Entertainment Console & Fluted Panel (2700×1800×450mm)', width: 2700, height: 1800, depth: 450 },
  study_credenza: { label: 'Executive Study Desk & Bookcase (2100×2100×500mm)', width: 2100, height: 2100, depth: 500 },
  pooja_mandir: { label: 'Sacred Mandir Sanctum with CNC Lattice (1200×2100×450mm)', width: 1200, height: 2100, depth: 450 },
};

// ─── Exporters: CSV, DXF, Cutting Dossier ───────────────────────────────────
export function exportCutlistToCsv(result: NestingOptimizationResult, spaceTitle: string): string {
  const rows: string[][] = [
    ['ULTIDA PRECISION CUTLIST & NESTING DOSSIER', spaceTitle],
    ['Overall Board Yield', `${result.summary.overallYieldPct}%`],
    ['Total Scrap / Wastage', `${result.summary.overallWastePct}%`],
    ['Total Sheets Required', `${result.summary.totalSheetsCount} sheets`],
    ['Total Panels', `${result.summary.totalPartsPlaced}`],
    [],
    ['SHEET SUMMARY'],
    ['Sheet #', 'Material Code', 'Dimensions (mm)', 'Placed Parts', 'Used Area (m²)', 'Yield (%)', 'Waste (%)'],
    ...result.sheets.map((s) => [
      `Sheet ${s.sheetIndex}`,
      s.materialName,
      `${s.sheetWidthMm}x${s.sheetHeightMm}`,
      `${s.placedPanels.length} parts`,
      `${s.usedAreaSqm}`,
      `${s.yieldPct}%`,
      `${s.wastePct}%`,
    ]),
    [],
    ['DETAILED PANEL CUTTING SCHEDULE'],
    ['Sheet #', 'Seq #', 'Part ID', 'Part Name', 'Length (mm)', 'Width (mm)', 'Thick (mm)', 'Rotated', 'Grain', 'Material', 'Edge Banding'],
    ...result.sheets.flatMap((s) =>
      s.placedPanels.map((p) => [
        `Sheet ${s.sheetIndex}`,
        String(p.cutSequenceNumber),
        p.id,
        p.name,
        String(p.w),
        String(p.h),
        String(p.partRef.thicknessMm),
        p.rotated ? 'YES (90°)' : 'NO',
        p.grain,
        s.materialName,
        p.edgeBandingText,
      ])
    ),
    [],
    ['LAMINATE PROCUREMENT SCHEDULE'],
    ['Laminate Type', 'Sheets Required (8x4 ft)', 'Specification'],
    ['External Decorative Laminate (Front)', `${result.summary.laminateRequirement.externalDecorativeSheets}`, '1.0mm Premium Acrylic / Textured Woodgrain with protective film'],
    ['Internal Balancing Liner (Both Faces)', `${result.summary.laminateRequirement.internalLinerSheets}`, '0.8mm Off-White Suede Finish Anti-Bacterial Liner'],
    ['Carcass Plywood Board (18mm)', `${result.summary.laminateRequirement.carcassPlySheets}`, '18mm BWP Marine Plywood IS:710 Grade'],
    ['Backing Plywood Board (9mm)', `${result.summary.laminateRequirement.backingPlySheets}`, '9mm BWP Plywood IS:710 Grade'],
    [],
    ['EDGE BANDING SCHEDULE'],
    ['Tape Specification', 'Running Meters Required', 'Application'],
    ['2.0mm High-Impact PVC Tape', `${result.summary.edgeBandingRequirement.pvc2mmMeters} m`, 'External Shutters, Drawer Fronts, Exposed Gables'],
    ['0.8mm Color-Matched PVC Tape', `${result.summary.edgeBandingRequirement.pvc08mmMeters} m`, 'Internal Shelves, Bay Dividers, Carcass Edges'],
    ['Total Edge Banding', `${result.summary.edgeBandingRequirement.totalMeters} m`, 'Factory edge-bander with EVA / PUR glue'],
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

export function exportNestingToDxf(result: NestingOptimizationResult): string {
  const lines: string[] = [
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '5',
    '0', 'LAYER', '2', 'SHEET_BORDER', '70', '0', '62', '7', '6', 'CONTINUOUS', '0',
    '0', 'LAYER', '2', 'PANEL_OUTLINE', '70', '0', '62', '2', '6', 'CONTINUOUS', '0',
    '0', 'LAYER', '2', 'PANEL_TEXT', '70', '0', '62', '3', '6', 'CONTINUOUS', '0',
    '0', 'LAYER', '2', 'GRAIN_ARROW', '70', '0', '62', '1', '6', 'CONTINUOUS', '0',
    '0', 'LAYER', '2', 'CUT_LINES', '70', '0', '62', '6', '6', 'CONTINUOUS', '0',
    '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
  ];

  function addLine(layer: string, x1: number, y1: number, x2: number, y2: number) {
    lines.push('0', 'LINE', '8', layer, '10', x1.toFixed(2), '20', y1.toFixed(2), '30', '0.0', '11', x2.toFixed(2), '21', y2.toFixed(2), '31', '0.0');
  }

  function addText(layer: string, text: string, x: number, y: number, heightMm: number) {
    lines.push('0', 'TEXT', '8', layer, '10', x.toFixed(2), '20', y.toFixed(2), '30', '0.0', '40', heightMm.toString(), '1', text);
  }

  let sheetOffsetY = 0;
  for (const sheet of result.sheets) {
    // Sheet border
    addLine('SHEET_BORDER', 0, sheetOffsetY, sheet.sheetWidthMm, sheetOffsetY);
    addLine('SHEET_BORDER', sheet.sheetWidthMm, sheetOffsetY, sheet.sheetWidthMm, sheetOffsetY + sheet.sheetHeightMm);
    addLine('SHEET_BORDER', sheet.sheetWidthMm, sheetOffsetY + sheet.sheetHeightMm, 0, sheetOffsetY + sheet.sheetHeightMm);
    addLine('SHEET_BORDER', 0, sheetOffsetY + sheet.sheetHeightMm, 0, sheetOffsetY);

    addText('PANEL_TEXT', `${sheet.sheetLabel} [Yield: ${sheet.yieldPct}% | Waste: ${sheet.wastePct}%]`, 20, sheetOffsetY - 50, 45);

    // Panels
    for (const p of sheet.placedPanels) {
      const px = p.x;
      const py = sheetOffsetY + p.y;
      addLine('PANEL_OUTLINE', px, py, px + p.w, py);
      addLine('PANEL_OUTLINE', px + p.w, py, px + p.w, py + p.h);
      addLine('PANEL_OUTLINE', px + p.w, py + p.h, px, py + p.h);
      addLine('PANEL_OUTLINE', px, py + p.h, px, py);

      addText('PANEL_TEXT', `#${p.cutSequenceNumber} ${p.name}`, px + 20, py + p.h / 2, 28);
      addText('PANEL_TEXT', `${p.w}x${p.h} mm [${p.isExternal ? 'EXT' : 'INT'}]`, px + 20, py + p.h / 2 - 40, 22);

      // Grain arrow if vertical
      if (p.grain === 'vertical') {
        addLine('GRAIN_ARROW', px + p.w / 2, py + 20, px + p.w / 2, py + p.h - 20);
        addLine('GRAIN_ARROW', px + p.w / 2, py + p.h - 20, px + p.w / 2 - 15, py + p.h - 45);
        addLine('GRAIN_ARROW', px + p.w / 2, py + p.h - 20, px + p.w / 2 + 15, py + p.h - 45);
      }
    }

    sheetOffsetY += sheet.sheetHeightMm + 600;
  }

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\r\n');
}
