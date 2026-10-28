import type { LaminateAwareNestingResult, LaminateRecipeSheetLayout, NestedPartPlacement } from './laminate-aware-nesting.js';

/**
 * Homag Cut Rite PTX format generator.
 * Cut Rite PTX is the industry-standard ASCII format accepted by Homag Holzma beam saws worldwide
 * (widely used in Bangalore, Mumbai, Pune, Delhi NCR modular manufacturing hubs).
 */
export function exportHomagCutRitePtx(
  nesting: LaminateAwareNestingResult,
  options?: {
    jobName?: string;
    customerName?: string;
    materialCodeOverride?: string;
  }
): string {
  const job = options?.jobName ?? 'ULTIDA_PRODUCTION';
  const customer = options?.customerName ?? 'RESIDENTIAL_CLIENT';
  const lines: string[] = [];

  // Header Section
  lines.push('[HEADER]');
  lines.push('VERSION=10.0');
  lines.push(`JOB=${job}`);
  lines.push(`CUSTOMER=${customer}`);
  lines.push(`UNITS=METRIC`);
  lines.push(`TOTAL_SHEETS=${nesting.totalSheets}`);
  lines.push(`TOTAL_PARTS=${nesting.totalPartsPlaced}`);
  lines.push(`AVG_UTILIZATION=${nesting.averageUtilizationPercent.toFixed(1)}%`);
  lines.push('');

  // Materials / Boards Section
  lines.push('[BOARDS]');
  for (const group of nesting.recipeGroups) {
    const code = options?.materialCodeOverride ?? group.recipeKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    lines.push(
      `BOARD_DEF;CODE=${code};L=${nesting.sheetLengthMm};W=${nesting.sheetWidthMm};THICK=${group.thicknessMm};MAT=${group.coreSubstrate};GRAIN=Y;TRIM=${nesting.trimMarginMm};KERF=${nesting.sawKerfMm}`
    );
  }
  lines.push('');

  // Parts List Section
  lines.push('[PARTS]');
  for (const sheet of nesting.sheets) {
    for (const p of sheet.placements) {
      const grain = p.grainDirection === 'vertical' ? 'Y' : 'N';
      lines.push(
        `PART_DEF;ID=${p.partId};LABEL=${p.partLabel};MODULE=${p.moduleTitle};L=${p.cutLengthMm};W=${p.cutWidthMm};GRAIN=${grain};FIN_L=${p.finishedLengthMm};FIN_W=${p.finishedWidthMm};EDGES=${p.stickerEdgeMap};RECIPE=${p.recipeKey}`
      );
    }
  }
  lines.push('');

  // Cutting Patterns / Sheets Section
  lines.push('[PATTERNS]');
  for (const sheet of nesting.sheets) {
    lines.push(`PATTERN_START;SHEET_ID=${sheet.sheetId};INDEX=${sheet.sheetIndex};RECIPE=${sheet.recipeKey};UTIL=${sheet.utilizationPercent.toFixed(1)}`);
    for (const p of sheet.placements) {
      lines.push(
        `CUT;PART_ID=${p.partId};X=${p.xMm.toFixed(1)};Y=${p.yMm.toFixed(1)};L=${p.cutLengthMm.toFixed(1)};W=${p.cutWidthMm.toFixed(1)};ROT=${p.rotated90 ? 1 : 0}`
      );
    }
    for (const off of sheet.reusableOffcuts) {
      lines.push(
        `OFFCUT;X=${off.xMm.toFixed(1)};Y=${off.yMm.toFixed(1)};L=${off.lengthMm.toFixed(1)};W=${off.widthMm.toFixed(1)};AREA_SQM=${off.areaSqm}`
      );
    }
    lines.push('PATTERN_END');
    lines.push('');
  }

  return lines.join('\r\n');
}

/**
 * Biesse OptiPlanning / Selco XML format generator.
 * Standard XML format for Biesse Selco beam saws and BiesseWorks / bSolid production lines.
 */
export function exportBiesseOptiPlanningXml(
  nesting: LaminateAwareNestingResult,
  options?: {
    jobName?: string;
    machineName?: string;
  }
): string {
  const job = options?.jobName ?? 'ULTIDA_PROJECT';
  const machine = options?.machineName ?? 'BIESSE_SELCO_SK4';

  const xmlLines: string[] = [];
  xmlLines.push('<?xml version="1.0" encoding="UTF-8"?>');
  xmlLines.push(`<OptiPlanning version="4.2" job="${escapeXml(job)}" machine="${escapeXml(machine)}">`);
  
  // General Summary
  xmlLines.push('  <Summary>');
  xmlLines.push(`    <TotalSheets>${nesting.totalSheets}</TotalSheets>`);
  xmlLines.push(`    <TotalParts>${nesting.totalPartsPlaced}</TotalParts>`);
  xmlLines.push(`    <AverageYieldPct>${nesting.averageUtilizationPercent.toFixed(2)}</AverageYieldPct>`);
  xmlLines.push(`    <TotalReusableOffcutSqm>${nesting.totalReusableOffcutAreaSqm}</TotalReusableOffcutSqm>`);
  xmlLines.push('  </Summary>');

  // Sheet Stocks
  xmlLines.push('  <StockSheets>');
  for (const group of nesting.recipeGroups) {
    xmlLines.push(
      `    <Stock id="${escapeXml(group.recipeKey)}" length="${nesting.sheetLengthMm}" width="${nesting.sheetWidthMm}" thickness="${group.thicknessMm}" material="${escapeXml(group.coreSubstrate)}" sheetsCount="${group.sheetCount}" />`
    );
  }
  xmlLines.push('  </StockSheets>');

  // Cutting Layouts
  xmlLines.push('  <CuttingLayouts>');
  for (const sheet of nesting.sheets) {
    xmlLines.push(
      `    <Layout id="${escapeXml(sheet.sheetId)}" sheetIndex="${sheet.sheetIndex}" stockRef="${escapeXml(sheet.recipeKey)}" yieldPct="${sheet.utilizationPercent.toFixed(2)}">`
    );
    xmlLines.push('      <Placements>');
    for (const p of sheet.placements) {
      xmlLines.push(
        `        <Part id="${escapeXml(p.partId)}" label="${escapeXml(p.partLabel)}" module="${escapeXml(p.moduleTitle)}" x="${p.xMm.toFixed(1)}" y="${p.yMm.toFixed(1)}" length="${p.cutLengthMm.toFixed(1)}" width="${p.cutWidthMm.toFixed(1)}" rotated="${p.rotated90 ? 1 : 0}" edgeBanding="${escapeXml(p.stickerEdgeMap)}" />`
      );
    }
    xmlLines.push('      </Placements>');

    if (sheet.reusableOffcuts.length > 0) {
      xmlLines.push('      <Offcuts>');
      for (const off of sheet.reusableOffcuts) {
        xmlLines.push(
          `        <Offcut x="${off.xMm.toFixed(1)}" y="${off.yMm.toFixed(1)}" length="${off.lengthMm.toFixed(1)}" width="${off.widthMm.toFixed(1)}" areaSqm="${off.areaSqm}" />`
        );
      }
      xmlLines.push('      </Offcuts>');
    }
    xmlLines.push('    </Layout>');
  }
  xmlLines.push('  </CuttingLayouts>');

  xmlLines.push('</OptiPlanning>');
  return xmlLines.join('\n');
}

/**
 * 1D Linear Nesting & Profile Optimizer for Aluminium Gola profiles, wardrobe sliding tracks, and LED channels.
 * Standard bar stock length in India: 3000mm (or 2440mm / 3660mm customizable).
 */
export interface LinearProfilePieceInput {
  pieceId: string;
  profileType: 'gola_j' | 'gola_c' | 'sliding_track_top' | 'sliding_track_bottom' | 'led_channel_recessed' | 'wardrobe_hanging_oval_rod';
  requiredLengthMm: number;
  label: string;
  moduleTitle?: string;
}

export interface LinearOptimizedBar {
  barIndex: number;
  barLengthMm: number;
  usedLengthMm: number;
  wasteLengthMm: number;
  utilizationPercent: number;
  pieces: Array<{
    pieceId: string;
    label: string;
    startMm: number;
    cutLengthMm: number;
  }>;
}

export interface LinearProfileNestingResult {
  profileType: string;
  standardBarLengthMm: number;
  sawKerfMm: number;
  totalBarsRequired: number;
  totalPiecesPlaced: number;
  averageUtilizationPercent: number;
  totalWasteMm: number;
  bars: LinearOptimizedBar[];
}

export function nestLinearProfiles(
  pieces: LinearProfilePieceInput[],
  options?: {
    standardBarLengthMm?: number;
    sawKerfMm?: number;
  }
): LinearProfileNestingResult[] {
  const barLen = options?.standardBarLengthMm ?? 3000;
  const kerf = options?.sawKerfMm ?? 4; // Standard cold saw / miter saw carbide kerf

  // Group by profile type
  const groups = new Map<string, LinearProfilePieceInput[]>();
  for (const piece of pieces) {
    if (piece.requiredLengthMm > barLen) {
      throw new Error(`Piece "${piece.label}" (${piece.requiredLengthMm}mm) exceeds standard bar length (${barLen}mm).`);
    }
    const list = groups.get(piece.profileType) ?? [];
    list.push(piece);
    groups.set(piece.profileType, list);
  }

  const results: LinearProfileNestingResult[] = [];

  for (const [profileType, groupPieces] of groups.entries()) {
    // First-Fit Decreasing (FFD) 1D Bin Packing with kerf
    const sorted = [...groupPieces].sort((a, b) => b.requiredLengthMm - a.requiredLengthMm);
    const bars: LinearOptimizedBar[] = [];

    for (const p of sorted) {
      let placed = false;
      for (const bar of bars) {
        const addedCut = bar.pieces.length === 0 ? p.requiredLengthMm : kerf + p.requiredLengthMm;
        if (bar.usedLengthMm + addedCut <= barLen) {
          const start = bar.pieces.length === 0 ? 0 : bar.usedLengthMm + kerf;
          bar.pieces.push({
            pieceId: p.pieceId,
            label: p.label,
            startMm: start,
            cutLengthMm: p.requiredLengthMm,
          });
          bar.usedLengthMm = start + p.requiredLengthMm;
          bar.wasteLengthMm = barLen - bar.usedLengthMm;
          bar.utilizationPercent = Number(((bar.usedLengthMm / barLen) * 100).toFixed(1));
          placed = true;
          break;
        }
      }

      if (!placed) {
        const newBar: LinearOptimizedBar = {
          barIndex: bars.length + 1,
          barLengthMm: barLen,
          usedLengthMm: p.requiredLengthMm,
          wasteLengthMm: barLen - p.requiredLengthMm,
          utilizationPercent: Number(((p.requiredLengthMm / barLen) * 100).toFixed(1)),
          pieces: [
            {
              pieceId: p.pieceId,
              label: p.label,
              startMm: 0,
              cutLengthMm: p.requiredLengthMm,
            },
          ],
        };
        bars.push(newBar);
      }
    }

    const totalBars = bars.length;
    const totalPieces = sorted.length;
    const avgUtil = totalBars > 0 ? Number((bars.reduce((sum, b) => sum + b.utilizationPercent, 0) / totalBars).toFixed(1)) : 0;
    const totalWaste = bars.reduce((sum, b) => sum + b.wasteLengthMm, 0);

    results.push({
      profileType,
      standardBarLengthMm: barLen,
      sawKerfMm: kerf,
      totalBarsRequired: totalBars,
      totalPiecesPlaced: totalPieces,
      averageUtilizationPercent: avgUtil,
      totalWasteMm: totalWaste,
      bars,
    });
  }

  return results;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
