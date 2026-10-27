export interface LaminateRecipePanelInput {
  partId: string;
  moduleId: string;
  moduleTitle: string;
  partLabel: string;
  coreSubstrate: string;
  thicknessMm: number;
  frontLaminateSku: string;
  backLinerSku: string;
  finishedLengthMm: number;
  finishedWidthMm: number;
  edgeTopMm: number;
  edgeBottomMm: number;
  edgeLeftMm: number;
  edgeRightMm: number;
  grainDirection: 'vertical' | 'none';
  quantity?: number;
}

export interface NestedPartPlacement {
  partId: string;
  moduleId: string;
  moduleTitle: string;
  partLabel: string;
  recipeKey: string;
  sheetIndex: number;
  xMm: number;
  yMm: number;
  finishedLengthMm: number;
  finishedWidthMm: number;
  cutLengthMm: number;
  cutWidthMm: number;
  rotated90: boolean;
  grainDirection: 'vertical' | 'none';
  stickerEdgeMap: string;
  frontLaminateSku: string;
  backLinerSku: string;
}

export interface ReusableOffcutRect {
  sheetIndex: number;
  xMm: number;
  yMm: number;
  lengthMm: number;
  widthMm: number;
  areaSqm: number;
  reusable: boolean;
}

export interface LaminateRecipeSheetLayout {
  sheetId: string;
  sheetIndex: number;
  recipeKey: string;
  coreSubstrate: string;
  thicknessMm: number;
  frontLaminateSku: string;
  backLinerSku: string;
  sheetLengthMm: number;
  sheetWidthMm: number;
  trimMarginMm: number;
  sawKerfMm: number;
  utilizationPercent: number;
  usedAreaSqm: number;
  grossAreaSqm: number;
  placements: NestedPartPlacement[];
  reusableOffcuts: ReusableOffcutRect[];
}

export interface LaminateAwareNestingResult {
  sheetLengthMm: number;
  sheetWidthMm: number;
  trimMarginMm: number;
  sawKerfMm: number;
  totalSheets: number;
  totalPartsPlaced: number;
  averageUtilizationPercent: number;
  totalReusableOffcutAreaSqm: number;
  recipeGroups: Array<{
    recipeKey: string;
    coreSubstrate: string;
    thicknessMm: number;
    frontLaminateSku: string;
    backLinerSku: string;
    sheetCount: number;
    partCount: number;
  }>;
  sheets: LaminateRecipeSheetLayout[];
}

function formatEdgeToken(mm: number): string {
  if (mm <= 0) return '0';
  return `${mm}EB`;
}

export function buildStickerEdgeMap(input: {
  edgeTopMm: number;
  edgeBottomMm: number;
  edgeLeftMm: number;
  edgeRightMm: number;
}): string {
  return `[T:${formatEdgeToken(input.edgeTopMm)} | B:${formatEdgeToken(input.edgeBottomMm)} | L:${formatEdgeToken(input.edgeLeftMm)} | R:${formatEdgeToken(input.edgeRightMm)}]`;
}

export function packLaminateRecipeSheets(
  panels: readonly LaminateRecipePanelInput[],
  options?: {
    sheetLengthMm?: number;
    sheetWidthMm?: number;
    trimMarginMm?: number;
    sawKerfMm?: number;
  },
): LaminateAwareNestingResult {
  const sheetLengthMm = options?.sheetLengthMm ?? 2440;
  const sheetWidthMm = options?.sheetWidthMm ?? 1220;
  const trimMarginMm = options?.trimMarginMm ?? 10;
  const sawKerfMm = options?.sawKerfMm ?? 4;

  const usableLengthMm = sheetLengthMm - 2 * trimMarginMm;
  const usableWidthMm = sheetWidthMm - 2 * trimMarginMm;
  const grossSheetAreaSqm = (sheetLengthMm * sheetWidthMm) / 1_000_000;

  // Expand quantities and compute pre-mill cut sizes
  interface ExpandedPart {
    partId: string;
    moduleId: string;
    moduleTitle: string;
    partLabel: string;
    recipeKey: string;
    coreSubstrate: string;
    thicknessMm: number;
    frontLaminateSku: string;
    backLinerSku: string;
    finishedLengthMm: number;
    finishedWidthMm: number;
    cutLengthMm: number;
    cutWidthMm: number;
    grainDirection: 'vertical' | 'none';
    stickerEdgeMap: string;
  }

  const expanded: ExpandedPart[] = [];
  for (const panel of panels) {
    const qty = Math.max(1, Math.round(panel.quantity ?? 1));
    const recipeKey = `${panel.coreSubstrate}__${panel.thicknessMm}mm__FACE:${panel.frontLaminateSku}__BACK:${panel.backLinerSku}`;
    const cutLengthMm = Number(
      Math.max(20, panel.finishedLengthMm - (panel.edgeTopMm + panel.edgeBottomMm)).toFixed(1),
    );
    const cutWidthMm = Number(
      Math.max(20, panel.finishedWidthMm - (panel.edgeLeftMm + panel.edgeRightMm)).toFixed(1),
    );
    const stickerEdgeMap = buildStickerEdgeMap(panel);

    for (let i = 0; i < qty; i += 1) {
      expanded.push({
        partId: qty > 1 ? `${panel.partId}-${i + 1}` : panel.partId,
        moduleId: panel.moduleId,
        moduleTitle: panel.moduleTitle,
        partLabel: panel.partLabel,
        recipeKey,
        coreSubstrate: panel.coreSubstrate,
        thicknessMm: panel.thicknessMm,
        frontLaminateSku: panel.frontLaminateSku,
        backLinerSku: panel.backLinerSku,
        finishedLengthMm: panel.finishedLengthMm,
        finishedWidthMm: panel.finishedWidthMm,
        cutLengthMm: Math.min(usableLengthMm, cutLengthMm),
        cutWidthMm: Math.min(usableWidthMm, cutWidthMm),
        grainDirection: panel.grainDirection,
        stickerEdgeMap,
      });
    }
  }

  // Group by recipeKey so different core/laminate sandwiches are never mixed on the same sheet
  const byRecipe = new Map<string, ExpandedPart[]>();
  for (const item of expanded) {
    const list = byRecipe.get(item.recipeKey) ?? [];
    list.push(item);
    byRecipe.set(item.recipeKey, list);
  }

  const sheets: LaminateRecipeSheetLayout[] = [];
  const recipeGroups: LaminateAwareNestingResult['recipeGroups'] = [];
  let globalSheetIndex = 1;

  for (const [recipeKey, groupParts] of byRecipe.entries()) {
    // Sort largest area / length first for deterministic guillotine shelf packing
    const sorted = [...groupParts].sort(
      (a, b) => b.cutLengthMm * b.cutWidthMm - a.cutLengthMm * a.cutWidthMm,
    );

    interface ActiveShelf {
      yMm: number;
      heightMm: number;
      cursorXMm: number;
    }

    interface ActiveSheet {
      sheetIndex: number;
      shelves: ActiveShelf[];
      placements: NestedPartPlacement[];
    }

    const recipeSheets: ActiveSheet[] = [];

    for (const part of sorted) {
      let placed = false;

      // Try existing sheets in this recipe group
      for (const sheet of recipeSheets) {
        for (const shelf of sheet.shelves) {
          // 1. Normal orientation (cutLengthMm along X, cutWidthMm along Y)
          if (
            part.cutWidthMm <= shelf.heightMm &&
            shelf.cursorXMm + part.cutLengthMm <= trimMarginMm + usableLengthMm
          ) {
            sheet.placements.push({
              partId: part.partId,
              moduleId: part.moduleId,
              moduleTitle: part.moduleTitle,
              partLabel: part.partLabel,
              recipeKey,
              sheetIndex: sheet.sheetIndex,
              xMm: shelf.cursorXMm,
              yMm: shelf.yMm,
              finishedLengthMm: part.finishedLengthMm,
              finishedWidthMm: part.finishedWidthMm,
              cutLengthMm: part.cutLengthMm,
              cutWidthMm: part.cutWidthMm,
              rotated90: false,
              grainDirection: part.grainDirection,
              stickerEdgeMap: part.stickerEdgeMap,
              frontLaminateSku: part.frontLaminateSku,
              backLinerSku: part.backLinerSku,
            });
            shelf.cursorXMm += part.cutLengthMm + sawKerfMm;
            placed = true;
            break;
          }

          // 2. 90-degree rotation ONLY if grainDirection === 'none'
          if (
            part.grainDirection === 'none' &&
            part.cutLengthMm <= shelf.heightMm &&
            shelf.cursorXMm + part.cutWidthMm <= trimMarginMm + usableLengthMm
          ) {
            sheet.placements.push({
              partId: part.partId,
              moduleId: part.moduleId,
              moduleTitle: part.partLabel,
              partLabel: part.partLabel,
              recipeKey,
              sheetIndex: sheet.sheetIndex,
              xMm: shelf.cursorXMm,
              yMm: shelf.yMm,
              finishedLengthMm: part.finishedLengthMm,
              finishedWidthMm: part.finishedWidthMm,
              cutLengthMm: part.cutWidthMm,
              cutWidthMm: part.cutLengthMm,
              rotated90: true,
              grainDirection: part.grainDirection,
              stickerEdgeMap: part.stickerEdgeMap,
              frontLaminateSku: part.frontLaminateSku,
              backLinerSku: part.backLinerSku,
            });
            shelf.cursorXMm += part.cutWidthMm + sawKerfMm;
            placed = true;
            break;
          }
        }

        if (placed) break;

        // Try opening a new guillotine rip shelf on this sheet
        const usedY =
          sheet.shelves.length === 0
            ? trimMarginMm
            : sheet.shelves[sheet.shelves.length - 1].yMm +
              sheet.shelves[sheet.shelves.length - 1].heightMm +
              sawKerfMm;

        if (usedY + part.cutWidthMm <= trimMarginMm + usableWidthMm) {
          const newShelf: ActiveShelf = {
            yMm: usedY,
            heightMm: part.cutWidthMm,
            cursorXMm: trimMarginMm + part.cutLengthMm + sawKerfMm,
          };
          sheet.shelves.push(newShelf);
          sheet.placements.push({
            partId: part.partId,
            moduleId: part.moduleId,
            moduleTitle: part.moduleTitle,
            partLabel: part.partLabel,
            recipeKey,
            sheetIndex: sheet.sheetIndex,
            xMm: trimMarginMm,
            yMm: usedY,
            finishedLengthMm: part.finishedLengthMm,
            finishedWidthMm: part.finishedWidthMm,
            cutLengthMm: part.cutLengthMm,
            cutWidthMm: part.cutWidthMm,
            rotated90: false,
            grainDirection: part.grainDirection,
            stickerEdgeMap: part.stickerEdgeMap,
            frontLaminateSku: part.frontLaminateSku,
            backLinerSku: part.backLinerSku,
          });
          placed = true;
          break;
        }
      }

      if (!placed) {
        const nextSheetIndex = globalSheetIndex++;
        const firstShelf: ActiveShelf = {
          yMm: trimMarginMm,
          heightMm: part.cutWidthMm,
          cursorXMm: trimMarginMm + part.cutLengthMm + sawKerfMm,
        };
        recipeSheets.push({
          sheetIndex: nextSheetIndex,
          shelves: [firstShelf],
          placements: [
            {
              partId: part.partId,
              moduleId: part.moduleId,
              moduleTitle: part.moduleTitle,
              partLabel: part.partLabel,
              recipeKey,
              sheetIndex: nextSheetIndex,
              xMm: trimMarginMm,
              yMm: trimMarginMm,
              finishedLengthMm: part.finishedLengthMm,
              finishedWidthMm: part.finishedWidthMm,
              cutLengthMm: part.cutLengthMm,
              cutWidthMm: part.cutWidthMm,
              rotated90: false,
              grainDirection: part.grainDirection,
              stickerEdgeMap: part.stickerEdgeMap,
              frontLaminateSku: part.frontLaminateSku,
              backLinerSku: part.backLinerSku,
            },
          ],
        });
      }
    }

    const sample = sorted[0];
    recipeGroups.push({
      recipeKey,
      coreSubstrate: sample.coreSubstrate,
      thicknessMm: sample.thicknessMm,
      frontLaminateSku: sample.frontLaminateSku,
      backLinerSku: sample.backLinerSku,
      sheetCount: recipeSheets.length,
      partCount: sorted.length,
    });

    for (const active of recipeSheets) {
      const usedAreaSqm = Number(
        (
          active.placements.reduce((sum, p) => sum + p.cutLengthMm * p.cutWidthMm, 0) /
          1_000_000
        ).toFixed(3),
      );
      const utilizationPercent = Number(
        Math.min(99.5, (usedAreaSqm / grossSheetAreaSqm) * 100).toFixed(1),
      );

      // Compute reusable offcuts (>= 300 x 200 mm)
      const reusableOffcuts: ReusableOffcutRect[] = [];
      for (const shelf of active.shelves) {
        const remX = trimMarginMm + usableLengthMm - shelf.cursorXMm;
        if (remX >= 300 && shelf.heightMm >= 200) {
          reusableOffcuts.push({
            sheetIndex: active.sheetIndex,
            xMm: shelf.cursorXMm,
            yMm: shelf.yMm,
            lengthMm: Number(remX.toFixed(1)),
            widthMm: Number(shelf.heightMm.toFixed(1)),
            areaSqm: Number(((remX * shelf.heightMm) / 1_000_000).toFixed(3)),
            reusable: true,
          });
        }
      }
      const lastShelf = active.shelves[active.shelves.length - 1];
      if (lastShelf) {
        const bottomStart = lastShelf.yMm + lastShelf.heightMm + sawKerfMm;
        const remY = trimMarginMm + usableWidthMm - bottomStart;
        if (usableLengthMm >= 300 && remY >= 200) {
          reusableOffcuts.push({
            sheetIndex: active.sheetIndex,
            xMm: trimMarginMm,
            yMm: bottomStart,
            lengthMm: usableLengthMm,
            widthMm: Number(remY.toFixed(1)),
            areaSqm: Number(((usableLengthMm * remY) / 1_000_000).toFixed(3)),
            reusable: true,
          });
        }
      }

      sheets.push({
        sheetId: `SHT-${String(active.sheetIndex).padStart(2, '0')}`,
        sheetIndex: active.sheetIndex,
        recipeKey,
        coreSubstrate: sample.coreSubstrate,
        thicknessMm: sample.thicknessMm,
        frontLaminateSku: sample.frontLaminateSku,
        backLinerSku: sample.backLinerSku,
        sheetLengthMm,
        sheetWidthMm,
        trimMarginMm,
        sawKerfMm,
        utilizationPercent,
        usedAreaSqm,
        grossAreaSqm: Number(grossSheetAreaSqm.toFixed(3)),
        placements: active.placements,
        reusableOffcuts,
      });
    }
  }

  const totalReusableOffcutAreaSqm = Number(
    sheets
      .flatMap((s) => s.reusableOffcuts)
      .reduce((sum, off) => sum + off.areaSqm, 0)
      .toFixed(3),
  );
  const averageUtilizationPercent =
    sheets.length > 0
      ? Number(
          (
            sheets.reduce((sum, s) => sum + s.utilizationPercent, 0) / sheets.length
          ).toFixed(1),
        )
      : 0;

  return {
    sheetLengthMm,
    sheetWidthMm,
    trimMarginMm,
    sawKerfMm,
    totalSheets: sheets.length,
    totalPartsPlaced: expanded.length,
    averageUtilizationPercent,
    totalReusableOffcutAreaSqm,
    recipeGroups,
    sheets,
  };
}
