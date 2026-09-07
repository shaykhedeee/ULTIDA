import type { SceneV1, SceneModuleV1, SceneOpeningV1 } from './scene-types.js';

export interface ShopDrawingOptions {
  viewMode?: 'external' | 'internal' | 'both' | 'shop-sheet';
  unitTitle?: string;
  clientName?: string;
  projectName?: string;
  designerName?: string;
  checkedBy?: string;
  sheetDate?: string;
  sheetCode?: string;
  sheetNumber?: string;
  carcassCoreMaterial?: string;
  baseDepthMm?: number;
  wallDepthMm?: number;
  loftDepthMm?: number;
  laminateA?: string;
  laminateB?: string;
  internalFinish?: string;
  includeTopView?: boolean;
  /** Human-readable evidence source for the dimensions shown on this sheet. */
  provenance?: string;
  /** A drawing is production-ready only after its source geometry is approved. */
  measurementStatus?: 'measured' | 'derived' | 'reference' | 'unverified';
  revision?: string;
}

/**
 * Generates turnkey 2D architectural shop drawings matching authentic Indian modular woodworking
 * production standards (as exemplified in real client manufacturing dossiers like Mr. Sachin & Mrs. Sammitha).
 *
 * Includes:
 * - Dual Elevation modes (External shutters/finishes vs Internal carcass joinery)
 * - Top View Plan with wall masonry hatching and carcass depth lines
 * - Red engineering dimension chains (bay widths, datums, overall)
 * - Standard System 32 annotations (FS, AS EQ, Gola profile, fluted louvers, profile glass, cutlery/thali inlets)
 * - Authentic Carcass Legend, Laminate Matrix, and Architectural Title Block
 */
export function generateArchitecturalShopSheetSvg(
  scene: SceneV1,
  targetWallIdOrModuleId?: string,
  options: ShopDrawingOptions = {}
): string {
  const wall = (scene.walls ?? []).find((w) => w.id === targetWallIdOrModuleId) || scene.walls?.[0];
  const targetModule = (scene.modules ?? []).find((m) => m.id === targetWallIdOrModuleId);

  // Overall wall geometry
  const wallLengthMm = wall
    ? Math.round(Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm))
    : targetModule
    ? targetModule.widthMm + 600
    : 3200;
  const wallHeightMm = wall?.heightMm || 2718;

  const viewMode = options.viewMode ?? 'external';
  const includeTopView = options.includeTopView ?? true;

  // Title and metadata defaults
  const wallModules = (scene.modules ?? []).filter((m) => !wall || (wall.spaceIds && m.roomId && wall.spaceIds.includes(m.roomId)) || m.id === targetModule?.id);
  const primaryModule = targetModule || (scene.modules ?? [])[0];
  const family = primaryModule?.family || (options.unitTitle?.toLowerCase().includes('kitchen') ? 'kitchen-base' : 'modular-casework');
  const inferredTitle = targetModule
    ? `${targetModule.family.toUpperCase().replace(/-/g, ' ')} ${viewMode.toUpperCase()}:`
    : `WALL ELEVATION — ${(wall?.id || 'MAIN').toUpperCase()} ${viewMode.toUpperCase()}:`;

  const unitTitle = options.unitTitle || inferredTitle;
  const clientName = options.clientName || 'CLIENT NOT ASSIGNED';
  const projectName = options.projectName || `PROJECT ${scene.projectId}`;
  const designerName = options.designerName || 'UNASSIGNED';
  const checkedBy = options.checkedBy || 'PENDING';
  const coreMaterial = options.carcassCoreMaterial || 'MATERIAL TO BE CONFIRMED';
  const baseDepthMm = options.baseDepthMm || (family.includes('kitchen') ? 560 : family.includes('wardrobe') ? 580 : 430);
  const wallDepthMm = options.wallDepthMm || (family.includes('kitchen') ? 300 : 280);
  const loftDepthMm = options.loftDepthMm || (family.includes('kitchen') ? 450 : baseDepthMm);
  const laminateA = options.laminateA || 'FINISH TO BE CONFIRMED';
  const laminateB = options.laminateB || 'FINISH TO BE CONFIRMED';
  const internalFinish = options.internalFinish || 'FINISH TO BE CONFIRMED';
  const measurementStatus = options.measurementStatus ?? 'unverified';
  const provenance = options.provenance || `Scene ${scene.metadata.designVersion} · floor plan ${scene.floorPlanVersionId}`;
  const revision = options.revision || scene.metadata.designVersion;
  const constructionReady = (scene.metadata.status === 'approved' || scene.metadata.status === 'locked') && measurementStatus !== 'unverified';
  const approvalLabel = constructionReady ? 'APPROVED FOR PRODUCTION' : 'NOT FOR CONSTRUCTION — REVIEW REQUIRED';
  const approvalFill = constructionReady ? '#ecfdf5' : '#fef2f2';
  const approvalText = constructionReady ? '#047857' : '#b91c1c';

  // Canvas layout (1200 x 750 px standard architectural sheet)
  const sheetW = 1200;
  const sheetH = 750;

  // Header banner (Orange/Terracotta theme as in reference)
  const headerH = 34;
  const headerBg = '#e65100';

  // Drawing Viewport bounds
  const drawLeft = 40;
  const drawWidth = 840;
  const legendLeft = 890;
  const legendWidth = 280;

  // Vertical allocation in drawing area
  const topViewH = includeTopView ? 110 : 0;
  const topViewY = headerH + 16;

  const elevY = headerH + topViewH + 24;
  const elevH = sheetH - elevY - 45; // Leave room for bottom dimensions and border
  const originY = elevY + elevH - 30; // Floor line datum

  // Scaling helpers
  const scaleX = (drawWidth - 120) / Math.max(1200, wallLengthMm);
  const scaleY = (elevH - 70) / Math.max(1800, wallHeightMm);
  const scale = Math.min(scaleX, scaleY);

  const originX = drawLeft + 60;
  const tx = (mmX: number) => originX + mmX * scale;
  const ty = (mmY: number) => originY - mmY * scale;

  const wallDrawW = wallLengthMm * scale;
  const wallDrawH = wallHeightMm * scale;

  // Colors matching production reference
  const RED_DIM = '#d32f2f';
  const DARK_STROKE = '#1e293b';
  const WALL_HATCH = '#cbd5e1';
  const CARCASS_WOOD = '#fde68a';
  const SHUTTER_FILL = '#ffffff';
  const FLUTED_FILL = '#524942';
  const GLASS_FILL = '#f0fdf4';
  const GLASS_BORDER = '#0f172a';
  const GRANITE_FILL = '#334155';

  // ── Helper: Red Dimension with 45° Tick Marks ──────────────────────────
  function dimLine(x1: number, y1: number, x2: number, y2: number, label: string, offset = 0, isVertical = false): string {
    const tick = 4;
    if (isVertical) {
      const midY = (y1 + y2) / 2;
      return `<g class="cad-dim">
        <line x1="${x1 + offset}" y1="${y1}" x2="${x2 + offset}" y2="${y2}" stroke="${RED_DIM}" stroke-width="0.9" stroke-dasharray="none"/>
        <line x1="${x1 + offset - tick}" y1="${y1 - tick}" x2="${x1 + offset + tick}" y2="${y1 + tick}" stroke="${RED_DIM}" stroke-width="1.1"/>
        <line x1="${x2 + offset - tick}" y1="${y2 - tick}" x2="${x2 + offset + tick}" y2="${y2 + tick}" stroke="${RED_DIM}" stroke-width="1.1"/>
        <text x="${x1 + offset + 6}" y="${midY + 3}" fill="${RED_DIM}" font-size="8" font-family="Arial,sans-serif" font-weight="bold">${label}</text>
      </g>`;
    }
    const midX = (x1 + x2) / 2;
    return `<g class="cad-dim">
      <line x1="${x1}" y1="${y1 + offset}" x2="${x2}" y2="${y2 + offset}" stroke="${RED_DIM}" stroke-width="0.9" stroke-dasharray="none"/>
      <line x1="${x1 - tick}" y1="${y1 + offset - tick}" x2="${x1 + tick}" y2="${y1 + offset + tick}" stroke="${RED_DIM}" stroke-width="1.1"/>
      <line x1="${x2 - tick}" y1="${y2 + offset - tick}" x2="${x2 + tick}" y2="${y2 + offset + tick}" stroke="${RED_DIM}" stroke-width="1.1"/>
      <text x="${midX}" y="${y1 + offset - 4}" text-anchor="middle" fill="${RED_DIM}" font-size="8" font-family="Arial,sans-serif" font-weight="bold">${label}</text>
    </g>`;
  }

  // ── Helper: Dashed Leader Callout ───────────────────────────────────────
  function calloutLeader(targetX: number, targetY: number, textX: number, textY: number, label: string): string {
    return `<g class="cad-callout">
      <line x1="${targetX}" y1="${targetY}" x2="${textX}" y2="${textY}" stroke="${RED_DIM}" stroke-width="0.8" stroke-dasharray="3 2"/>
      <circle cx="${targetX}" cy="${targetY}" r="1.5" fill="${RED_DIM}"/>
      <text x="${textX > targetX ? textX + 4 : textX - 4}" y="${textY + 3}" text-anchor="${textX > targetX ? 'start' : 'end'}"
        fill="#0f172a" font-size="7.5" font-family="Arial,sans-serif" font-weight="bold">${label}</text>
    </g>`;
  }

  // ── 1. Top View Plan ───────────────────────────────────────────────────
  let topViewSvg = '';
  if (includeTopView) {
    const tvScale = scale * 0.9;
    const tvX = originX;
    const tvY = topViewY + 20;
    const tvWallW = wallLengthMm * tvScale;
    const tvWallD = 20;
    const tvModuleD = (baseDepthMm + 20) * tvScale;

    topViewSvg = `
    <!-- Top View Section -->
    <g class="top-view-plan">
      <text x="${drawLeft + 320}" y="${topViewY + 12}" fill="${RED_DIM}" font-size="13" font-family="Arial,sans-serif" font-weight="bold" letter-spacing="1">TOP VIEW</text>

      <!-- Rear Masonry Wall Hatch -->
      <rect x="${tvX}" y="${tvY}" width="${tvWallW}" height="${tvWallD}" fill="url(#diagonalHatch)" stroke="${DARK_STROKE}" stroke-width="1.2"/>

      <!-- Casework Footprint -->
      <rect x="${tvX}" y="${tvY + tvWallD}" width="${tvWallW}" height="${tvModuleD}" fill="#fafafa" stroke="${DARK_STROKE}" stroke-width="1.2"/>

      <!-- End Filler and Radius Corner -->
      <line x1="${tvX + tvWallW - 20 * tvScale}" y1="${tvY + tvWallD}" x2="${tvX + tvWallW - 20 * tvScale}" y2="${tvY + tvWallD + tvModuleD}" stroke="${DARK_STROKE}" stroke-width="0.8" stroke-dasharray="2 2"/>
      <path d="M${tvX} ${tvY + tvWallD + tvModuleD - 12} Q${tvX} ${tvY + tvWallD + tvModuleD} ${tvX + 12} ${tvY + tvWallD + tvModuleD}" fill="none" stroke="${DARK_STROKE}" stroke-width="1.2"/>

      <!-- Top View Dimension Chains -->
      ${dimLine(tvX, tvY - 8, tvX + tvWallW, tvY - 8, `${wallLengthMm}`)}
      ${dimLine(tvX + tvWallW + 8, tvY + tvWallD, tvX + tvWallW + 8, tvY + tvWallD + tvModuleD, `${baseDepthMm}`, 0, true)}
      ${dimLine(tvX + tvWallW + 28, tvY + tvWallD, tvX + tvWallW + 28, tvY + tvWallD + tvModuleD + 8, `${baseDepthMm + 20}`, 0, true)}
    </g>`;
  }

  // ── 2. Casework Modules & Elevation Geometry ───────────────────────────
  const modules = (scene.modules ?? []).filter((m) => !wall || m.roomId === wall.spaceIds?.[0] || m.id === targetModule?.id);
  const activeModules = modules.length ? modules : (targetModule ? [targetModule] : [
    { id: 'mod-1', family: 'kitchen-base', widthMm: Math.min(2400, wallLengthMm), depthMm: baseDepthMm, heightMm: 850, position: { xMm: 0, yMm: 0 } },
    { id: 'mod-2', family: 'kitchen-wall', widthMm: Math.min(2400, wallLengthMm), depthMm: wallDepthMm, heightMm: 670, position: { xMm: 0, yMm: 0, zMm: 1450 } },
    { id: 'mod-3', family: 'loft', widthMm: Math.min(2400, wallLengthMm), depthMm: loftDepthMm, heightMm: 558, position: { xMm: 0, yMm: 0, zMm: 2120 } }
  ]);

  let elevationItemsSvg = '';
  const horizontalDims: string[] = [];
  const callouts: string[] = [];

  // Ceiling and Floor Lines
  const fflY = ty(0);
  const ceilingY = ty(wallHeightMm);
  const plinthH = 100;
  const plinthY = ty(plinthH);
  const loftY = ty(wallHeightMm - 598);

  // Ceiling Filler Rafter Zone (50mm)
  const fillerH = 50 * scale;
  const ceilingFillerSvg = `
    <rect x="${originX}" y="${ceilingY}" width="${wallDrawW}" height="${fillerH}" fill="url(#rafterHatch)" stroke="${DARK_STROKE}" stroke-width="0.9"/>
    <text x="${originX + wallDrawW / 2}" y="${ceilingY + fillerH / 2 + 3}" text-anchor="middle" fill="#64748b" font-size="7" font-family="Arial,sans-serif">FALSE CEILING FILLER 50mm</text>
  `;

  // Plinth / Skirting Zone (100mm)
  const plinthDrawH = plinthH * scale;
  const skirtingSvg = `
    <rect x="${originX}" y="${originY - plinthDrawH}" width="${wallDrawW}" height="${plinthDrawH}" fill="#e2e8f0" stroke="${DARK_STROKE}" stroke-width="1"/>
    <text x="${originX + wallDrawW / 2}" y="${originY - plinthDrawH / 2 + 3}" text-anchor="middle" fill="#475569" font-size="7.5" font-family="Arial,sans-serif" font-weight="bold">SKIRTING 100mm</text>
  `;

  let currOffsetMm = 0;
  const baySegments: Array<{ xMm: number; wMm: number; label: string }> = [];

  const isKitchen = family.includes('kitchen') || activeModules.some(m => m.family.includes('kitchen'));
  const isWardrobe = family.includes('wardrobe') || activeModules.some(m => m.family.includes('wardrobe'));
  const isTvUnit = family.includes('tv') || activeModules.some(m => m.family.includes('tv'));

  if (isKitchen) {
    const baseW = wallLengthMm;
    const numBays = Math.max(3, Math.ceil(baseW / 600));
    const bayW = Math.floor(baseW / numBays);

    // Granite Countertop (40mm at +840mm)
    const graniteY = ty(850);
    const graniteH = 40 * scale;
    elevationItemsSvg += `<rect x="${originX}" y="${graniteY}" width="${wallDrawW}" height="${graniteH}" fill="${GRANITE_FILL}" stroke="${DARK_STROKE}" stroke-width="1.2"/>`;
    callouts.push(calloutLeader(originX + 80, graniteY + graniteH / 2, originX - 40, graniteY - 10, 'GRANITE 40mm'));

    // Gola Profile Channel
    const golaY = graniteY + graniteH;
    const golaH = 25 * scale;
    elevationItemsSvg += `<rect x="${originX}" y="${golaY}" width="${wallDrawW}" height="${golaH}" fill="#d97706" stroke="${DARK_STROKE}" stroke-width="0.8"/>`;
    callouts.push(calloutLeader(originX + 160, golaY + golaH / 2, originX - 40, golaY + 20, 'GOLA PROFILE'));

    // Base Units
    const baseCarcassY = golaY + golaH;
    const baseCarcassH = plinthY - baseCarcassY;

    for (let i = 0; i < numBays; i++) {
      const bx = originX + i * bayW * scale;
      const bw = (i === numBays - 1 ? baseW - i * bayW : bayW) * scale;
      const actualBayW = i === numBays - 1 ? baseW - i * bayW : bayW;
      baySegments.push({ xMm: currOffsetMm, wMm: actualBayW, label: `${actualBayW}` });
      currOffsetMm += actualBayW;

      if (viewMode === 'external') {
        if (i === 1) {
          const tierH = baseCarcassH / 3;
          elevationItemsSvg += `
            <rect x="${bx + 1}" y="${baseCarcassY + 1}" width="${bw - 2}" height="${tierH - 2}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1"/>
            <text x="${bx + bw / 2}" y="${baseCarcassY + tierH / 2 + 3}" text-anchor="middle" fill="#334155" font-size="6.5" font-weight="bold">CUTLERY INLET</text>
            <rect x="${bx + 1}" y="${baseCarcassY + tierH + 1}" width="${bw - 2}" height="${tierH - 2}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1"/>
            <text x="${bx + bw / 2}" y="${baseCarcassY + tierH * 1.5 + 3}" text-anchor="middle" fill="#334155" font-size="6.5" font-weight="bold">CUP AND SAUCER INLET</text>
            <rect x="${bx + 1}" y="${baseCarcassY + tierH * 2 + 1}" width="${bw - 2}" height="${tierH - 2}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1"/>
            <text x="${bx + bw / 2}" y="${baseCarcassY + tierH * 2.5 + 3}" text-anchor="middle" fill="#334155" font-size="6.5" font-weight="bold">THALLI INLET</text>
          `;
        } else {
          elevationItemsSvg += `
            <rect x="${bx + 1}" y="${baseCarcassY + 1}" width="${bw - 2}" height="${baseCarcassH - 2}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1"/>
            <text x="${bx + bw / 2}" y="${baseCarcassY + baseCarcassH / 2 + 3}" text-anchor="middle" fill="#64748b" font-size="7.5">SHUTTER B</text>
          `;
        }
      } else {
        elevationItemsSvg += `
          <rect x="${bx + 2}" y="${baseCarcassY + 2}" width="${bw - 4}" height="${baseCarcassH - 4}" fill="${CARCASS_WOOD}" stroke="#92400e" stroke-width="0.8" fill-opacity="0.25"/>
          <line x1="${bx + 8}" y1="${baseCarcassY + 10}" x2="${bx + 8}" y2="${baseCarcassY + baseCarcassH - 10}" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="1 3"/>
          <line x1="${bx + bw - 8}" y1="${baseCarcassY + 10}" x2="${bx + bw - 8}" y2="${baseCarcassY + baseCarcassH - 10}" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="1 3"/>
          <line x1="${bx + 2}" y1="${baseCarcassY + baseCarcassH / 2}" x2="${bx + bw - 2}" y2="${baseCarcassY + baseCarcassH / 2}" stroke="#78350f" stroke-width="1"/>
          <text x="${bx + bw / 2}" y="${baseCarcassY + baseCarcassH / 2 - 4}" text-anchor="middle" fill="#78350f" font-size="6.5" font-weight="bold">AS EQ</text>
        `;
      }
    }

    // Wall Units & Fluted Glass Shutters
    const wallUnitY = ty(2120);
    const wallUnitH = 670 * scale;
    const numWallBays = Math.max(3, Math.ceil(baseW / 450));
    const wallBayW = baseW / numWallBays;

    for (let j = 0; j < numWallBays; j++) {
      const wx = originX + j * wallBayW * scale;
      const ww = wallBayW * scale;
      const isGlass = j === 1 || j === 2;

      if (viewMode === 'external') {
        if (isGlass) {
          elevationItemsSvg += `
            <rect x="${wx + 1}" y="${wallUnitY + 1}" width="${ww - 2}" height="${wallUnitH - 2}" fill="${GLASS_FILL}" stroke="${GLASS_BORDER}" stroke-width="1.6"/>
            <line x1="${wx + ww * 0.3}" y1="${wallUnitY + 4}" x2="${wx + ww * 0.3}" y2="${wallUnitY + wallUnitH - 4}" stroke="#64748b" stroke-width="0.6" stroke-dasharray="2 2"/>
            <line x1="${wx + ww * 0.5}" y1="${wallUnitY + 4}" x2="${wx + ww * 0.5}" y2="${wallUnitY + wallUnitH - 4}" stroke="#64748b" stroke-width="0.6" stroke-dasharray="2 2"/>
            <line x1="${wx + ww * 0.7}" y1="${wallUnitY + 4}" x2="${wx + ww * 0.7}" y2="${wallUnitY + wallUnitH - 4}" stroke="#64748b" stroke-width="0.6" stroke-dasharray="2 2"/>
            <text x="${wx + ww / 2}" y="${wallUnitY + wallUnitH / 2 + 3}" text-anchor="middle" fill="#0f172a" font-size="6" font-weight="bold">PROFILE GLASS</text>
          `;
          if (j === 1) callouts.push(calloutLeader(wx + ww / 2, wallUnitY + 20, originX - 40, wallUnitY - 15, 'PROFILE SHUTTER WITH BLACK FLUTED GLASS'));
        } else {
          elevationItemsSvg += `
            <rect x="${wx + 1}" y="${wallUnitY + 1}" width="${ww - 2}" height="${wallUnitH - 2}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1"/>
            <text x="${wx + ww / 2}" y="${wallUnitY + wallUnitH / 2 + 3}" text-anchor="middle" fill="#64748b" font-size="7">SHUTTER</text>
          `;
        }
      } else {
        elevationItemsSvg += `
          <rect x="${wx + 2}" y="${wallUnitY + 2}" width="${ww - 4}" height="${wallUnitH - 4}" fill="${CARCASS_WOOD}" stroke="#92400e" stroke-width="0.8" fill-opacity="0.2"/>
          <line x1="${wx + 2}" y1="${wallUnitY + wallUnitH / 2}" x2="${wx + ww - 2}" y2="${wallUnitY + wallUnitH / 2}" stroke="#78350f" stroke-width="1"/>
          <text x="${wx + ww / 2}" y="${wallUnitY + wallUnitH / 2 - 4}" text-anchor="middle" fill="#78350f" font-size="6" font-weight="bold">FS</text>
        `;
      }
    }

    // Overhead Lofts (558mm)
    const loftDrawY = ty(wallHeightMm - 50);
    const loftDrawH = 558 * scale;
    const numLofts = Math.max(4, Math.ceil(baseW / 400));
    const loftW = baseW / numLofts;

    for (let k = 0; k < numLofts; k++) {
      const lx = originX + k * loftW * scale;
      const lw = loftW * scale;
      elevationItemsSvg += `
        <rect x="${lx + 1}" y="${loftDrawY + 1}" width="${lw - 2}" height="${loftDrawH - 2}" fill="${viewMode === 'external' ? '#f8fafc' : CARCASS_WOOD}" stroke="${DARK_STROKE}" stroke-width="0.9" fill-opacity="${viewMode === 'external' ? '1' : '0.25'}"/>
        <text x="${lx + lw / 2}" y="${loftDrawY + loftDrawH / 2 + 3}" text-anchor="middle" fill="#64748b" font-size="6.5">LOFT</text>
      `;
    }
  } else if (isWardrobe) {
    const wSpan = wallLengthMm;
    const dresserW = 400;
    const wardrobeW = wSpan - dresserW;
    const numBays = Math.max(2, Math.round(wardrobeW / 900));
    const bayW = Math.round(wardrobeW / numBays);

    // Dresser bay on Left
    const drX = originX;
    const drW = dresserW * scale;
    baySegments.push({ xMm: 0, wMm: dresserW, label: `${dresserW}` });
    currOffsetMm = dresserW;

    const mainH = 2000 * scale;
    const mainY = plinthY - mainH;

    if (viewMode === 'external') {
      const mirrorH = mainH - 3 * (65 * scale);
      elevationItemsSvg += `
        <rect x="${drX + 1}" y="${mainY}" width="${drW - 2}" height="${mirrorH}" fill="#e0f2fe" stroke="${DARK_STROKE}" stroke-width="1"/>
        <line x1="${drX + 10}" y1="${mainY + 15}" x2="${drX + drW - 10}" y2="${mainY + mirrorH - 15}" stroke="#93c5fd" stroke-width="0.8" stroke-dasharray="6 4"/>
        <text x="${drX + drW / 2}" y="${mainY + mirrorH / 2 + 3}" text-anchor="middle" fill="#0284c7" font-size="8" font-weight="bold">BEVELED MIRROR</text>

        <rect x="${drX + 1}" y="${mainY + mirrorH}" width="${drW - 2}" height="${65 * scale}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1"/>
        <text x="${drX + drW / 2}" y="${mainY + mirrorH + 35 * scale}" text-anchor="middle" fill="#334155" font-size="6.5">DRAWER 1</text>
        <rect x="${drX + 1}" y="${mainY + mirrorH + 65 * scale}" width="${drW - 2}" height="${65 * scale}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1"/>
        <text x="${drX + drW / 2}" y="${mainY + mirrorH + 95 * scale}" text-anchor="middle" fill="#334155" font-size="6.5">DRAWER 2</text>
        <rect x="${drX + 1}" y="${mainY + mirrorH + 130 * scale}" width="${drW - 2}" height="${65 * scale}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1"/>
        <text x="${drX + drW / 2}" y="${mainY + mirrorH + 160 * scale}" text-anchor="middle" fill="#334155" font-size="6.5">DRAWER 3</text>
      `;
      callouts.push(calloutLeader(drX + drW / 2, mainY + mirrorH + 40 * scale, originX - 40, mainY + mirrorH + 20, '45 DEGREE CUT FINGER GROOVING'));
    } else {
      elevationItemsSvg += `
        <rect x="${drX + 2}" y="${mainY + 2}" width="${drW - 4}" height="${mainH - 4}" fill="${CARCASS_WOOD}" stroke="#92400e" stroke-width="0.8" fill-opacity="0.25"/>
        <text x="${drX + drW / 2}" y="${mainY + mainH / 2 + 3}" text-anchor="middle" fill="#78350f" font-size="7" font-weight="bold">DRESSER CARCASS</text>
      `;
    }

    for (let b = 0; b < numBays; b++) {
      const bx = originX + (dresserW + b * bayW) * scale;
      const bw = bayW * scale;
      baySegments.push({ xMm: currOffsetMm, wMm: bayW, label: `${bayW}` });
      currOffsetMm += bayW;

      if (viewMode === 'external') {
        elevationItemsSvg += `
          <rect x="${bx + 1}" y="${mainY}" width="${bw - 2}" height="${mainH}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1.2"/>
          <line x1="${bx + bw / 2}" y1="${mainY}" x2="${bx + bw / 2}" y2="${mainY + mainH}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
          <line x1="${bx + bw / 2 - 8}" y1="${mainY + mainH / 2 - 60}" x2="${bx + bw / 2 - 8}" y2="${mainY + mainH / 2 + 60}" stroke="#b45309" stroke-width="2.2"/>
          <line x1="${bx + bw / 2 + 8}" y1="${mainY + mainH / 2 - 60}" x2="${bx + bw / 2 + 8}" y2="${mainY + mainH / 2 + 60}" stroke="#b45309" stroke-width="2.2"/>
          <text x="${bx + bw / 4}" y="${mainY + mainH * 0.75}" text-anchor="middle" fill="#64748b" font-size="7.5">SHUTTER B</text>
          <text x="${bx + bw * 0.75}" y="${mainY + mainH * 0.75}" text-anchor="middle" fill="#64748b" font-size="7.5">SHUTTER B</text>
        `;
      } else {
        const hangerH = 1050 * scale;
        elevationItemsSvg += `
          <rect x="${bx + 2}" y="${mainY + 2}" width="${bw - 4}" height="${mainH - 4}" fill="${CARCASS_WOOD}" stroke="#92400e" stroke-width="1" fill-opacity="0.2"/>
          <line x1="${bx + 8}" y1="${mainY + 30}" x2="${bx + bw - 8}" y2="${mainY + 30}" stroke="#475569" stroke-width="2.5"/>
          <text x="${bx + bw / 2}" y="${mainY + hangerH / 2}" text-anchor="middle" fill="#78350f" font-size="7" font-weight="bold">HANGER SPACE 1050mm</text>
          <line x1="${bx + 2}" y1="${mainY + hangerH}" x2="${bx + bw - 2}" y2="${mainY + hangerH}" stroke="#78350f" stroke-width="1.2"/>
          <rect x="${bx + 6}" y="${mainY + mainH - 120 * scale}" width="${bw - 12}" height="${55 * scale}" fill="#ffffff" stroke="#92400e" stroke-width="0.8"/>
          <text x="${bx + bw / 2}" y="${mainY + mainH - 90 * scale}" text-anchor="middle" fill="#78350f" font-size="6">LOCKABLE CASH DRAWER</text>
          <rect x="${bx + 6}" y="${mainY + mainH - 60 * scale}" width="${bw - 12}" height="${55 * scale}" fill="#ffffff" stroke="#92400e" stroke-width="0.8"/>
          <text x="${bx + bw / 2}" y="${mainY + mainH - 30 * scale}" text-anchor="middle" fill="#78350f" font-size="6">SAREE ORGANIZER DRAWER</text>
        `;
      }
    }

    // Top Lofts (575mm)
    const loftYw = ty(wallHeightMm - 50);
    const loftHw = 575 * scale;
    const numLoftBays = numBays + 1;
    const lBayW = wSpan / numLoftBays;
    for (let lb = 0; lb < numLoftBays; lb++) {
      const lx = originX + lb * lBayW * scale;
      const lw = lBayW * scale;
      elevationItemsSvg += `
        <rect x="${lx + 1}" y="${loftYw}" width="${lw - 2}" height="${loftHw}" fill="${viewMode === 'external' ? '#ffffff' : CARCASS_WOOD}" stroke="${DARK_STROKE}" stroke-width="1" fill-opacity="${viewMode === 'external' ? '1' : '0.25'}"/>
        <text x="${lx + lw / 2}" y="${loftYw + loftHw / 2 + 3}" text-anchor="middle" fill="#64748b" font-size="7">LOFT</text>
      `;
    }
  } else {
    // General / TV Console / Feature Unit
    const modW = wallLengthMm;
    baySegments.push({ xMm: 0, wMm: modW, label: `${modW}` });

    const cW = modW * scale;
    const cH = (targetModule?.heightMm || 2100) * scale;
    const cY = plinthY - cH;

    if (viewMode === 'external') {
      elevationItemsSvg += `
        <rect x="${originX}" y="${cY}" width="${400 * scale}" height="${cH}" fill="${FLUTED_FILL}" stroke="${DARK_STROKE}" stroke-width="1.2"/>
        <text x="${originX + 200 * scale}" y="${cY + cH / 2}" text-anchor="middle" fill="#ffffff" font-size="7" font-weight="bold">FLUTED PANEL</text>

        <rect x="${originX + 400 * scale}" y="${cY}" width="${(modW - 850) * scale}" height="${cH}" fill="#f8fafc" stroke="${DARK_STROKE}" stroke-width="1"/>
        <line x1="${originX + 400 * scale + 60}" y1="${cY + 20}" x2="${originX + 400 * scale + 60}" y2="${cY + cH - 20}" stroke="#000000" stroke-width="1.4"/>
        <line x1="${originX + (modW - 550) * scale}" y1="${cY + 20}" x2="${originX + (modW - 550) * scale}" y2="${cY + cH - 20}" stroke="#000000" stroke-width="1.4"/>
        <text x="${originX + 400 * scale + ((modW - 850) * scale) / 2}" y="${cY + cH / 2}" text-anchor="middle" fill="#334155" font-size="8" font-weight="bold">4MM GROOVING WITH BLACK PAINT</text>

        <rect x="${originX + (modW - 450) * scale}" y="${cY}" width="${450 * scale}" height="${cH}" fill="${GLASS_FILL}" stroke="${GLASS_BORDER}" stroke-width="1.8"/>
        <text x="${originX + (modW - 225) * scale}" y="${cY + cH / 2}" text-anchor="middle" fill="#0f172a" font-size="6.5" font-weight="bold">ALUMINUM SHUTTER WITH PLAIN GLASS</text>

        <rect x="${originX}" y="${plinthY - 300 * scale}" width="${cW}" height="${300 * scale}" fill="${SHUTTER_FILL}" stroke="${DARK_STROKE}" stroke-width="1.4"/>
        <text x="${originX + cW / 2}" y="${plinthY - 140 * scale}" text-anchor="middle" fill="#1e293b" font-size="8" font-weight="bold">45 DEGREE CUT FACIA DRAWERS</text>
      `;
      callouts.push(calloutLeader(originX + 150, plinthY - 150 * scale, originX - 40, plinthY - 180 * scale, '45 DEGREE CUT FACIA'));
      callouts.push(calloutLeader(originX + (modW - 200) * scale, cY + 40, originX + cW + 30, cY - 10, 'ALUMINUM SHUTTER WITH PLAIN GLASS'));
      callouts.push(calloutLeader(originX + 200 * scale, cY + 80, originX - 40, cY + 60, 'FLUTED PANEL'));
    } else {
      elevationItemsSvg += `
        <rect x="${originX + 2}" y="${cY + 2}" width="${cW - 4}" height="${cH - 4}" fill="${CARCASS_WOOD}" stroke="#92400e" stroke-width="1.2" fill-opacity="0.25"/>
        <line x1="${originX + cW / 2}" y1="${cY + 2}" x2="${originX + cW / 2}" y2="${cY + cH - 2}" stroke="#78350f" stroke-width="1.2"/>
        <line x1="${originX + 2}" y1="${cY + cH / 2}" x2="${originX + cW - 2}" y2="${cY + cH / 2}" stroke="#78350f" stroke-width="1.2"/>
        <text x="${originX + cW / 4}" y="${cY + cH / 2 - 6}" text-anchor="middle" fill="#78350f" font-size="7" font-weight="bold">AS EQ</text>
        <text x="${originX + (3 * cW) / 4}" y="${cY + cH / 2 - 6}" text-anchor="middle" fill="#78350f" font-size="7" font-weight="bold">FS</text>
      `;
    }
  }

  // ── 3. Horizontal Dimension Chains (Below Elevation) ───────────────────
  const hDimY1 = originY + 18;
  for (const seg of baySegments) {
    if (seg.wMm < 20) continue;
    horizontalDims.push(dimLine(tx(seg.xMm), hDimY1, tx(seg.xMm + seg.wMm), hDimY1, seg.label));
  }
  const hDimY2 = originY + 38;
  horizontalDims.push(dimLine(tx(0), hDimY2, tx(wallLengthMm), hDimY2, `${wallLengthMm}`));

  // ── 4. Vertical Dimension Chains ──────────────────────────────────────
  const vDimX1 = originX + wallDrawW + 16;
  const vDimX2 = vDimX1 + 28;
  const verticalDims: string[] = [];

  verticalDims.push(dimLine(vDimX1, ty(0), vDimX1, ty(plinthH), `${plinthH}`, 0, true));
  if (isKitchen) {
    verticalDims.push(dimLine(vDimX1, ty(plinthH), vDimX1, ty(850), '750', 0, true));
    verticalDims.push(dimLine(vDimX1, ty(850), vDimX1, ty(1450), '600', 0, true));
    verticalDims.push(dimLine(vDimX1, ty(1450), vDimX1, ty(2120), '670', 0, true));
    verticalDims.push(dimLine(vDimX1, ty(2120), vDimX1, ty(wallHeightMm - 50), '548', 0, true));
    verticalDims.push(dimLine(vDimX1, ty(wallHeightMm - 50), vDimX1, ty(wallHeightMm), '50', 0, true));
  } else {
    verticalDims.push(dimLine(vDimX1, ty(plinthH), vDimX1, ty(2100), '2000', 0, true));
    verticalDims.push(dimLine(vDimX1, ty(2100), vDimX1, ty(wallHeightMm - 50), `${wallHeightMm - 2150}`, 0, true));
    verticalDims.push(dimLine(vDimX1, ty(wallHeightMm - 50), vDimX1, ty(wallHeightMm), '50', 0, true));
  }
  verticalDims.push(dimLine(vDimX2, ty(0), vDimX2, ty(wallHeightMm), `${wallHeightMm}`, 0, true));

  // ── 5. Standard Right-Side Legend & Title Block ─────────────────────────
  const legendX = legendLeft;
  const legendY = headerH + 16;

  const legendSvg = `
    <!-- Right Legend & Matrix Area -->
    <g class="cad-legend-block" font-family="Arial,sans-serif">
      <!-- Section 1: CARCASS SPECIFICATION -->
      <rect x="${legendX}" y="${legendY}" width="${legendWidth}" height="135" fill="#ffffff" stroke="${DARK_STROKE}" stroke-width="1.2"/>
      <rect x="${legendX}" y="${legendY}" width="${legendWidth}" height="20" fill="#f1f5f9" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 14}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0f172a" letter-spacing="1">LEGEND</text>

      <rect x="${legendX}" y="${legendY + 20}" width="${legendWidth}" height="18" fill="#e2e8f0" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 33}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0f172a">CARCASS</text>

      <line x1="${legendX + 110}" y1="${legendY + 38}" x2="${legendX + 110}" y2="${legendY + 135}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 62}" x2="${legendX + legendWidth}" y2="${legendY + 62}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 86}" x2="${legendX + legendWidth}" y2="${legendY + 86}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 110}" x2="${legendX + legendWidth}" y2="${legendY + 110}" stroke="${DARK_STROKE}" stroke-width="0.8"/>

      <text x="${legendX + 6}" y="${legendY + 53}" font-size="7" font-weight="bold" fill="#1e293b">UNIT DEPTH :</text>
      <text x="${legendX + 116}" y="${legendY + 53}" font-size="7" fill="#334155">${baseDepthMm}+20MM</text>

      <text x="${legendX + 6}" y="${legendY + 77}" font-size="7" font-weight="bold" fill="#1e293b">WALL / UPPER :</text>
      <text x="${legendX + 116}" y="${legendY + 77}" font-size="7" fill="#334155">${wallDepthMm}+20MM</text>

      <text x="${legendX + 6}" y="${legendY + 101}" font-size="7" font-weight="bold" fill="#1e293b">LOFT DEPTH :</text>
      <text x="${legendX + 116}" y="${legendY + 101}" font-size="7" fill="#334155">${loftDepthMm}+20MM</text>

      <text x="${legendX + 6}" y="${legendY + 125}" font-size="7" font-weight="bold" fill="#1e293b">CORE MATERIAL :</text>
      <text x="${legendX + 116}" y="${legendY + 125}" font-size="6.5" font-weight="bold" fill="#0f172a">${coreMaterial}</text>

      <!-- Section 2: LAMINATE SCHEDULE -->
      <rect x="${legendX}" y="${legendY + 145}" width="${legendWidth}" height="145" fill="#ffffff" stroke="${DARK_STROKE}" stroke-width="1.2"/>
      <rect x="${legendX}" y="${legendY + 145}" width="${legendWidth}" height="20" fill="#e2e8f0" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 159}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0f172a">LAMINATE</text>

      <line x1="${legendX + 110}" y1="${legendY + 165}" x2="${legendX + 110}" y2="${legendY + 290}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 195}" x2="${legendX + legendWidth}" y2="${legendY + 195}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 225}" x2="${legendX + legendWidth}" y2="${legendY + 225}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 255}" x2="${legendX + legendWidth}" y2="${legendY + 255}" stroke="${DARK_STROKE}" stroke-width="0.8"/>

      <text x="${legendX + 6}" y="${legendY + 182}" font-size="6.5" font-weight="bold" fill="#1e293b">EXPOSED PANEL &amp;</text>
      <text x="${legendX + 6}" y="${legendY + 191}" font-size="6" fill="#64748b">TOP PLY (A) :</text>
      <text x="${legendX + 116}" y="${legendY + 186}" font-size="7" font-weight="bold" fill="#0f172a">${laminateA}</text>

      <text x="${legendX + 6}" y="${legendY + 213}" font-size="7" font-weight="bold" fill="#1e293b">SHUTTERS (B) :</text>
      <text x="${legendX + 116}" y="${legendY + 213}" font-size="7" font-weight="bold" fill="#0f172a">${laminateB}</text>

      <text x="${legendX + 6}" y="${legendY + 242}" font-size="6.5" font-weight="bold" fill="#1e293b">ACCENT / FLUTE :</text>
      <text x="${legendX + 116}" y="${legendY + 242}" font-size="6.5" fill="#334155">CHARCOAL PU / BRONZE GLASS</text>

      <text x="${legendX + 6}" y="${legendY + 274}" font-size="6.5" font-weight="bold" fill="#1e293b">INTERNAL FINISH :</text>
      <text x="${legendX + 116}" y="${legendY + 274}" font-size="7" font-weight="bold" fill="#0f172a">${internalFinish}</text>

      <!-- Section 3: ABBREVIATIONS & NOTES -->
      <rect x="${legendX}" y="${legendY + 300}" width="${legendWidth}" height="80" fill="#f8fafc" stroke="${DARK_STROKE}" stroke-width="0.9"/>
      <text x="${legendX + 8}" y="${legendY + 314}" font-size="6.5" font-weight="bold" fill="#475569">FS: FIXED SHELF</text>
      <text x="${legendX + 8}" y="${legendY + 328}" font-size="6.5" font-weight="bold" fill="#475569">AS: ADJUSTABLE SHELF</text>
      <text x="${legendX + 8}" y="${legendY + 342}" font-size="6.5" font-weight="bold" fill="#475569">EQ: EQUAL DISTANCE</text>
      <text x="${legendX + 8}" y="${legendY + 356}" font-size="6.5" font-weight="bold" fill="#475569">D: FACIA: DRAWER</text>
      <text x="${legendX + 8}" y="${legendY + 370}" font-size="6" fill="#94a3b8">ALL DIMENSIONS IN MILLIMETRES (UNLESS NOTED)</text>

      <!-- Section 4: ARCHITECTURAL TITLE BLOCK -->
      <rect x="${legendX}" y="${legendY + 390}" width="${legendWidth}" height="240" fill="#ffffff" stroke="${DARK_STROKE}" stroke-width="1.4"/>

      <!-- Sheet Title Sub-Box -->
      <rect x="${legendX}" y="${legendY + 390}" width="${legendWidth}" height="35" fill="#f8fafc" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 406}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0f172a">
        ${family.toUpperCase().replace(/-/g, ' ')} ELEVATION
      </text>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 418}" text-anchor="middle" font-size="7" fill="#64748b">
        ${viewMode === 'external' ? 'EXTERNAL FINISH & SHUTTER VIEW' : 'INTERNAL CARCASS & SYSTEM 32 VIEW'}
      </text>

      <!-- Client & Project -->
      <line x1="${legendX}" y1="${legendY + 430}" x2="${legendX + legendWidth}" y2="${legendY + 430}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 444}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#0f172a">${clientName}</text>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 456}" text-anchor="middle" font-size="7" fill="#64748b">${projectName}</text>

      <!-- Drawn by & Checked by -->
      <line x1="${legendX + 110}" y1="${legendY + 465}" x2="${legendX + 110}" y2="${legendY + 505}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 465}" x2="${legendX + legendWidth}" y2="${legendY + 465}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 485}" x2="${legendX + legendWidth}" y2="${legendY + 485}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <line x1="${legendX}" y1="${legendY + 505}" x2="${legendX + legendWidth}" y2="${legendY + 505}" stroke="${DARK_STROKE}" stroke-width="0.8"/>

      <text x="${legendX + 8}" y="${legendY + 478}" font-size="7" font-weight="bold" fill="#334155">DRWN</text>
      <text x="${legendX + 116}" y="${legendY + 478}" font-size="7" font-weight="bold" fill="#0f172a">${designerName}</text>

      <text x="${legendX + 8}" y="${legendY + 498}" font-size="7" font-weight="bold" fill="#334155">CHKD</text>
      <text x="${legendX + 116}" y="${legendY + 498}" font-size="7" font-weight="bold" fill="#0f172a">${checkedBy}</text>

      <rect x="${legendX}" y="${legendY + 505}" width="${legendWidth}" height="22" fill="${approvalFill}" stroke="${DARK_STROKE}" stroke-width="0.8"/>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 520}" text-anchor="middle" font-size="6.6" font-weight="bold" fill="${approvalText}" letter-spacing="0.4">
        ${approvalLabel}
      </text>

      <!-- Studio Address -->
      <text x="${legendX + legendWidth / 2}" y="${legendY + 545}" text-anchor="middle" font-size="6" fill="#64748b">
        ULTIDA ARCHITECTURAL STUDIO · BENGALURU
      </text>
      <text x="${legendX + legendWidth / 2}" y="${legendY + 557}" text-anchor="middle" font-size="5.5" fill="#94a3b8">
        REV ${revision} · SCENE ${scene.metadata.designVersion} · UNITS: MM
      </text>

      <text x="${legendX + legendWidth / 2}" y="${legendY + 568}" text-anchor="middle" font-size="5.4" fill="#94a3b8">
        ${measurementStatus.toUpperCase()} GEOMETRY · DO NOT SCALE DRAWING
      </text>

      <!-- Finish Swatch Chips (A & B) -->
      <g transform="translate(${legendX + 25}, ${legendY + 580})">
        <!-- Chip A -->
        <rect x="0" y="0" width="105" height="38" fill="#d4a373" stroke="${DARK_STROKE}" stroke-width="0.8" rx="2"/>
        <text x="6" y="14" fill="#ffffff" font-size="8" font-weight="bold">A</text>
        <text x="24" y="14" fill="#ffffff" font-size="5.5">VIRGO 6344</text>
        <text x="24" y="24" fill="#faedcd" font-size="5">SMOKED WALNUT</text>

        <!-- Chip B -->
        <rect x="120" y="0" width="105" height="38" fill="#fdfbf7" stroke="${DARK_STROKE}" stroke-width="0.8" rx="2"/>
        <text x="126" y="14" fill="#0f172a" font-size="8" font-weight="bold">B</text>
        <text x="144" y="14" fill="#0f172a" font-size="5.5">VIRGO 1409</text>
        <text x="144" y="24" fill="#64748b" font-size="5">FROSTY WHITE SHG</text>
      </g>
    </g>
  `;

  // ── 6. Outer Architectural Frame & Assembly ─────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 45° Diagonal Masonry Hatch -->
    <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="10" stroke="${WALL_HATCH}" stroke-width="1.2"/>
    </pattern>
    <!-- Rafter Hatch -->
    <pattern id="rafterHatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(-45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" stroke-width="0.8"/>
    </pattern>
  </defs>

  <!-- Sheet Background -->
  <rect width="${sheetW}" height="${sheetH}" fill="#ffffff"/>

  <!-- Top Accent Header Banner (Terracotta reference style) -->
  <rect x="0" y="0" width="${sheetW}" height="${headerH}" fill="${headerBg}"/>
  <text x="24" y="23" fill="#ffffff" font-family="Arial,sans-serif" font-size="16" font-weight="bold" letter-spacing="1">
    ${unitTitle}
  </text>
  <text x="${sheetW - 24}" y="22" text-anchor="end" fill="#ffedd5" font-family="Arial,sans-serif" font-size="9.5" font-weight="bold">
    WALL ${wall?.id || 'UNASSIGNED'} · REV ${revision} · UNITS: MM · DO NOT SCALE
  </text>

  <!-- Outer Architectural Border Frame -->
  <rect x="12" y="${headerH + 8}" width="${sheetW - 24}" height="${sheetH - headerH - 20}" fill="none" stroke="${DARK_STROKE}" stroke-width="1.4"/>
  <rect x="15" y="${headerH + 11}" width="${sheetW - 30}" height="${sheetH - headerH - 26}" fill="none" stroke="#94a3b8" stroke-width="0.5"/>

  <!-- Top View Plan -->
  ${topViewSvg}

  <!-- Main Wall Elevation Area -->
  <g class="cad-elevation-view">
    <!-- Wall Outline -->
    <rect x="${originX}" y="${ceilingY}" width="${wallDrawW}" height="${wallDrawH}" fill="#fcfcfc" stroke="${DARK_STROKE}" stroke-width="2"/>

    <!-- Ceiling Rafter Filler -->
    ${ceilingFillerSvg}

    <!-- Floor Line -->
    <line x1="${originX - 20}" y1="${originY}" x2="${originX + wallDrawW + 20}" y2="${originY}" stroke="${DARK_STROKE}" stroke-width="2.5"/>

    <!-- Plinth / Skirting -->
    ${skirtingSvg}

    <!-- Casework Items -->
    ${elevationItemsSvg}

    <!-- Leader Callouts -->
    ${callouts.join('\n    ')}

    <!-- Horizontal Dimensions -->
    ${horizontalDims.join('\n    ')}

    <!-- Vertical Dimensions -->
    ${verticalDims.join('\n    ')}
  </g>

  <!-- Right Specification Matrix & Title Block -->
  ${legendSvg}

  <!-- Geometry provenance is carried on every sheet, independent of render imagery. -->
  <text x="28" y="${sheetH - 10}" fill="#64748b" font-family="Arial,sans-serif" font-size="5.5">
    PROVENANCE: ${provenance.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')} · IMAGE RENDERS ARE VISUAL REFERENCES ONLY.
  </text>
</svg>`;
}
