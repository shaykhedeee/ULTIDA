import { Part, SemanticType, TemplateCompileInput, TemplateCompileResult } from './types.js';
import { compileLightingElements } from './lighting-compiler.js';
import {
  DEFAULT_CARCASS_THICKNESS_MM,
  DEFAULT_BACK_PANEL_THICKNESS_MM,
  DEFAULT_SHELF_THICKNESS_MM,
  TARGET_SHUTTER_WIDTH_MM,
} from './constants.js';

const MAT = {
  carcass: 'mat-laminate-oak',
  shutter: 'mat-acrylic-matte',
  back: 'mat-fluted-panel',
  glass: 'mat-tinted-glass-grey',
  profile: 'mat-profile-black-anodized',
  hardware: 'mat-hardware-steel',
  led: 'mat-led-warm',
  counter: 'mat-quartz-white',
  panel: 'mat-laminate-wenge',
  shelf: 'mat-laminate-oak',
};

function makePart(
  instanceId: string,
  templateVersionId: string,
  subId: string,
  name: string,
  xMm: number,
  yMm: number,
  zMm: number,
  widthMm: number,
  depthMm: number,
  heightMm: number,
  semanticType: SemanticType,
  materialId: string,
  sku: string,
  face: Part['anchor']['face'] = 'front',
): Part {
  const safeW = Math.max(4, Math.round(widthMm * 100) / 100);
  const safeD = Math.max(4, Math.round(depthMm * 100) / 100);
  const safeH = Math.max(4, Math.round(heightMm * 100) / 100);
  const dims = [safeW, safeD, safeH].sort((a, b) => b - a);
  return {
    id: `${instanceId}-${subId}`,
    templateVersionId,
    instanceId,
    name,
    transform: {
      xMm: Math.max(0, Math.round(xMm * 100) / 100),
      yMm: Math.max(0, Math.round(yMm * 100) / 100),
      zMm: Math.max(0, Math.round(zMm * 100) / 100),
      rotationDeg: 0,
    },
    size: { widthMm: safeW, depthMm: safeD, heightMm: safeH },
    anchor: { face },
    meta: {
      semanticType,
      parentId: null,
      materialSlot: { id: materialId, code: materialId, name },
      drawing: {
        layer:
          semanticType === 'shutter'
            ? 'A-MOD-SHUTTER'
            : semanticType === 'drawer'
              ? 'A-MOD-DRAWER'
              : semanticType === 'back_panel'
                ? 'A-MOD-BACK'
                : semanticType === 'countertop'
                  ? 'A-MOD-COUNTER'
                  : semanticType === 'shelf'
                    ? 'A-MOD-SHELF'
                    : semanticType === 'glass'
                      ? 'A-MOD-GLASS'
                      : semanticType === 'profile'
                        ? 'A-MOD-PROFILE'
                        : semanticType === 'hardware'
                          ? 'A-ANNO-HARDWARE'
                          : 'A-MOD-CARCASS',
        sortOrder: 1,
      },
      bom: {
        sku,
        qty: 1,
        unit: 'pc',
        lengthMm: dims[0],
        widthMm: dims[1],
        heightMm: safeH,
        thicknessMm: dims[2],
      },
    },
  };
}

function appendDrawerAssembly(
  parts: Part[],
  instanceId: string,
  templateVersionId: string,
  drawerCount: number,
  totalW: number,
  totalD: number,
  zStartMm: number,
  stackHeightMm: number,
  t: number,
) {
  const gap = 3;
  const frontH = Math.max(80, (stackHeightMm - gap * (drawerCount - 1)) / drawerCount);
  const boxW = Math.max(120, totalW - t * 2 - 26);
  const boxD = Math.max(180, totalD - t - 40);
  const boxSideT = 16;
  const boxBottomT = 12;

  for (let i = 0; i < drawerCount; i += 1) {
    const idx = i + 1;
    const zMm = zStartMm + i * (frontH + gap);
    const boxH = Math.max(60, frontH - 24);
    const boxX = t + 13;
    const boxY = t;
    const boxZ = zMm + 12;

    // 1. Drawer Front (semanticType: 'drawer')
    parts.push(
      makePart(
        instanceId,
        templateVersionId,
        `drawer-front-${idx}`,
        `Drawer Front ${idx}`,
        0,
        0,
        zMm,
        totalW,
        t,
        frontH,
        'drawer',
        MAT.shutter,
        'DRAWER-FRONT-18MM',
        'front',
      ),
    );
    // 2. Drawer Box Left Side
    parts.push(
      makePart(
        instanceId,
        templateVersionId,
        `drawer-box-left-${idx}`,
        `Drawer ${idx} Box Left Side`,
        boxX,
        boxY,
        boxZ,
        boxSideT,
        boxD,
        boxH,
        'panel',
        MAT.carcass,
        'DRAWER-BOX-SIDE-16MM',
        'left',
      ),
    );
    // 3. Drawer Box Right Side
    parts.push(
      makePart(
        instanceId,
        templateVersionId,
        `drawer-box-right-${idx}`,
        `Drawer ${idx} Box Right Side`,
        boxX + boxW - boxSideT,
        boxY,
        boxZ,
        boxSideT,
        boxD,
        boxH,
        'panel',
        MAT.carcass,
        'DRAWER-BOX-SIDE-16MM',
        'right',
      ),
    );
    // 4. Drawer Box Back Panel
    parts.push(
      makePart(
        instanceId,
        templateVersionId,
        `drawer-box-back-${idx}`,
        `Drawer ${idx} Box Back`,
        boxX + boxSideT,
        boxY + boxD - boxSideT,
        boxZ + boxBottomT,
        Math.max(60, boxW - boxSideT * 2),
        boxSideT,
        Math.max(40, boxH - boxBottomT),
        'panel',
        MAT.carcass,
        'DRAWER-BOX-BACK-16MM',
        'back',
      ),
    );
    // 5. Drawer Box Bottom Panel
    parts.push(
      makePart(
        instanceId,
        templateVersionId,
        `drawer-box-bottom-${idx}`,
        `Drawer ${idx} Box Bottom`,
        boxX + boxSideT,
        boxY,
        boxZ,
        Math.max(60, boxW - boxSideT * 2),
        boxD,
        boxBottomT,
        'panel',
        MAT.carcass,
        'DRAWER-BOX-BOTTOM-12MM',
        'bottom',
      ),
    );
  }
}

export function compileCatalogUnit(input: TemplateCompileInput): TemplateCompileResult {
  const p = (input.parameters ?? {}) as Record<string, any>;
  const instanceId = input.instanceId ?? 'unit-1';
  const templateId = String(input.templateVersionId ?? '').toLowerCase();
  const family = String(p.family ?? input.family ?? '').toLowerCase();

  const totalW = Number(p.totalWidthMm ?? p.widthMm ?? 600);
  const totalD = Number(p.totalDepthMm ?? p.depthMm ?? 600);
  const totalH = Number(p.totalHeightMm ?? p.heightMm ?? 750);
  const wallW = Number(input.wall?.widthMm ?? Math.max(3600, totalW));
  const wallH = Number(input.wall?.heightMm ?? Math.max(3000, totalH));

  const blocking: string[] = [];
  const warning: string[] = [];

  if (!Number.isFinite(totalW) || !Number.isFinite(totalD) || !Number.isFinite(totalH) || totalW < 100 || totalD < 20 || totalH < 100) {
    blocking.push('Module dimensions must be finite positive millimetre values within a buildable envelope.');
  }
  if (totalW > wallW) {
    blocking.push(`Module width (${totalW}mm) exceeds available wall width (${wallW}mm).`);
  }
  if (wallH > 0 && totalH > wallH) {
    blocking.push(`Module height (${totalH}mm) exceeds available wall height (${wallH}mm).`);
  }
  if (blocking.length > 0) {
    return {
      templateVersionId: input.templateVersionId,
      instanceId,
      valid: false,
      blockingViolations: blocking,
      warningViolations: warning,
      parts: [],
      elements: [],
    };
  }

  const t = DEFAULT_CARCASS_THICKNESS_MM;
  const bp = DEFAULT_BACK_PANEL_THICKNESS_MM;
  const parts: Part[] = [];

  // ── 1. Feature Wall Cladding Panels ────────────────────────
  if (family === 'feature-wall' || templateId.startsWith('wall-')) {
    const bayCount = Math.max(2, Math.min(6, Math.round(totalW / 600)));
    const bayW = totalW / bayCount;
    const backingD = Math.min(12, Math.max(6, Math.floor(totalD * 0.35)));
    const faceD = Math.max(6, totalD - backingD);

    // Backing substrate boards
    for (let i = 0; i < bayCount; i += 1) {
      parts.push(
        makePart(
          instanceId,
          input.templateVersionId,
          `substrate-bay-${i + 1}`,
          `Feature Wall Backing Substrate ${i + 1}`,
          i * bayW,
          totalD - backingD,
          0,
          bayW,
          backingD,
          totalH,
          'back_panel',
          MAT.carcass,
          'WALL-SUBSTRATE-12MM',
          'back',
        ),
      );
      parts.push(
        makePart(
          instanceId,
          input.templateVersionId,
          `cladding-panel-${i + 1}`,
          `Cladding Face Panel ${i + 1}`,
          i * bayW,
          0,
          0,
          bayW,
          faceD,
          totalH,
          'panel',
          MAT.back,
          'WALL-CLADDING-PANEL',
          'front',
        ),
      );
    }
    // Top & bottom Z-cleat mounting rails
    parts.push(
      makePart(
        instanceId,
        input.templateVersionId,
        'cleat-top',
        'Top French Cleat Mounting Rail',
        0,
        totalD - backingD,
        totalH - 60,
        totalW,
        backingD,
        60,
        'carcass',
        MAT.carcass,
        'WALL-CLEAT-RAIL',
        'top',
      ),
    );
    parts.push(
      makePart(
        instanceId,
        input.templateVersionId,
        'cleat-bottom',
        'Bottom Alignment Rail',
        0,
        totalD - backingD,
        0,
        totalW,
        backingD,
        60,
        'carcass',
        MAT.carcass,
        'WALL-CLEAT-RAIL',
        'bottom',
      ),
    );
    return {
      templateVersionId: input.templateVersionId,
      instanceId,
      valid: true,
      blockingViolations: [],
      warningViolations: warning,
      parts,
      elements: parts,
    };
  }

  // ── 2. Kitchen Wall Cabinets (Upper Units) ─────────────────
  if (family === 'kitchen-wall' || templateId.startsWith('kit-wall-')) {
    const innerW = Math.max(80, totalW - t * 2);
    const innerH = Math.max(80, totalH - t * 2);
    const carcassD = Math.max(120, totalD - t);

    parts.push(
      makePart(instanceId, input.templateVersionId, 'carcass-bottom', 'Wall Cabinet Bottom Panel', 0, t, 0, totalW, carcassD, t, 'carcass', MAT.carcass, 'CARCASS-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'carcass-top', 'Wall Cabinet Top Panel', 0, t, totalH - t, totalW, carcassD, t, 'carcass', MAT.carcass, 'CARCASS-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'carcass-left', 'Wall Cabinet Left Gable', 0, t, t, t, carcassD, innerH, 'carcass', MAT.carcass, 'CARCASS-SIDE-18MM', 'left'),
      makePart(instanceId, input.templateVersionId, 'carcass-right', 'Wall Cabinet Right Gable', totalW - t, t, t, t, carcassD, innerH, 'carcass', MAT.carcass, 'CARCASS-SIDE-18MM', 'right'),
      makePart(instanceId, input.templateVersionId, 'back-panel', 'Wall Cabinet Back Panel', t, totalD - bp, t, innerW, bp, innerH, 'back_panel', MAT.carcass, 'BACK-6MM', 'back'),
    );

    const shelfCount = totalH >= 600 ? 2 : 1;
    for (let s = 0; s < shelfCount; s += 1) {
      const shelfZ = t + Math.round(((s + 1) * innerH) / (shelfCount + 1));
      parts.push(
        makePart(instanceId, input.templateVersionId, `shelf-${s + 1}`, `Adjustable Shelf ${s + 1}`, t, t + 10, shelfZ, innerW, Math.max(80, carcassD - bp - 10), DEFAULT_SHELF_THICKNESS_MM, 'shelf', MAT.shelf, 'SHELF-18MM', 'center'),
      );
    }

    if (templateId.includes('bifold')) {
      const leafH = (totalH - 3) / 2;
      parts.push(
        makePart(instanceId, input.templateVersionId, 'shutter-upper-leaf', 'Bi-Fold Upper Shutter Leaf', 0, 0, leafH + 3, totalW, t, leafH, 'shutter', MAT.shutter, 'SHUTTER-BIFOLD-18MM', 'front'),
        makePart(instanceId, input.templateVersionId, 'shutter-lower-leaf', 'Bi-Fold Lower Shutter Leaf', 0, 0, 0, totalW, t, leafH, 'shutter', MAT.shutter, 'SHUTTER-BIFOLD-18MM', 'front'),
      );
    } else if (templateId.includes('profile-glass')) {
      const doors = totalW >= 550 ? 2 : 1;
      const doorW = (totalW - (doors - 1) * 3) / doors;
      for (let d = 0; d < doors; d += 1) {
        const xMm = d * (doorW + 3);
        parts.push(
          makePart(instanceId, input.templateVersionId, `profile-frame-${d + 1}`, `Aluminium Profile Frame ${d + 1}`, xMm, 0, 0, doorW, t, totalH, 'profile', MAT.profile, 'ALU-PROFILE-20MM', 'front'),
          makePart(instanceId, input.templateVersionId, `glass-insert-${d + 1}`, `Fluted Glass Insert ${d + 1}`, xMm + 20, 4, 20, Math.max(60, doorW - 40), 4, Math.max(60, totalH - 40), 'glass', MAT.glass, 'GLASS-FLUTED-4MM', 'front'),
        );
      }
    } else {
      const doors = Math.max(1, Math.min(3, p.shutterCount ?? (totalW >= 550 ? 2 : 1)));
      const doorW = (totalW - (doors - 1) * 3) / doors;
      for (let d = 0; d < doors; d += 1) {
        parts.push(
          makePart(instanceId, input.templateVersionId, `shutter-${d + 1}`, `Wall Cabinet Shutter ${d + 1}`, d * (doorW + 3), 0, 0, doorW, t, totalH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
        );
      }
    }

    return {
      templateVersionId: input.templateVersionId,
      instanceId,
      valid: true,
      blockingViolations: [],
      warningViolations: warning,
      parts,
      elements: parts,
    };
  }

  // ── 3. Kitchen Tall Units (Appliance / Pantry / Fridge) ────
  if (family === 'kitchen-tall' || templateId.startsWith('kit-tall-')) {
    const plinthH = 100;
    const bodyH = Math.max(400, totalH - plinthH);
    const carcassD = Math.max(200, totalD - t);
    const innerW = Math.max(120, totalW - t * 2);

    parts.push(
      makePart(instanceId, input.templateVersionId, 'plinth-fascia', 'Tall Unit Plinth Fascia', 0, 30, 0, totalW, t, plinthH, 'filler', MAT.carcass, 'PLINTH-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'carcass-bottom', 'Tall Unit Bottom Panel', 0, t, plinthH, totalW, carcassD, t, 'carcass', MAT.carcass, 'CARCASS-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'carcass-top', 'Tall Unit Top Panel', 0, t, totalH - t, totalW, carcassD, t, 'carcass', MAT.carcass, 'CARCASS-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'carcass-left', 'Tall Unit Left Gable', 0, t, plinthH + t, t, carcassD, bodyH - t * 2, 'carcass', MAT.carcass, 'CARCASS-SIDE-18MM', 'left'),
      makePart(instanceId, input.templateVersionId, 'carcass-right', 'Tall Unit Right Gable', totalW - t, t, plinthH + t, t, carcassD, bodyH - t * 2, 'carcass', MAT.carcass, 'CARCASS-SIDE-18MM', 'right'),
      makePart(instanceId, input.templateVersionId, 'back-panel', 'Tall Unit Back Panel', t, totalD - bp, plinthH + t, innerW, bp, bodyH - t * 2, 'back_panel', MAT.carcass, 'BACK-6MM', 'back'),
    );

    if (templateId.includes('microwave')) {
      const lowerH = Math.min(680, Math.round(bodyH * 0.34));
      const nicheH = Math.min(760, Math.round(bodyH * 0.38));
      const upperZ = plinthH + lowerH + nicheH;
      const upperH = Math.max(180, totalH - upperZ);
      parts.push(
        makePart(instanceId, input.templateVersionId, 'oven-deck-shelf', 'Reinforced Oven Support Shelf', t, t, plinthH + lowerH, innerW, carcassD - bp, t, 'shelf', MAT.carcass, 'SHELF-OVEN-18MM', 'center'),
        makePart(instanceId, input.templateVersionId, 'microwave-deck-shelf', 'Microwave Support Shelf', t, t, plinthH + lowerH + Math.round(nicheH * 0.55), innerW, carcassD - bp, t, 'shelf', MAT.carcass, 'SHELF-MW-18MM', 'center'),
        makePart(instanceId, input.templateVersionId, 'upper-divider-shelf', 'Upper Cavity Divider Shelf', t, t, upperZ, innerW, carcassD - bp, t, 'shelf', MAT.carcass, 'SHELF-18MM', 'center'),
        makePart(instanceId, input.templateVersionId, 'lower-shutter', 'Lower Appliance Tower Shutter', 0, 0, plinthH, totalW, t, lowerH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
        makePart(instanceId, input.templateVersionId, 'upper-shutter', 'Upper Appliance Tower Shutter', 0, 0, upperZ, totalW, t, upperH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
      );
    } else if (templateId.includes('fridge')) {
      const loftH = Math.min(450, Math.max(260, Math.round(bodyH * 0.2)));
      const loftZ = totalH - loftH;
      parts.push(
        makePart(instanceId, input.templateVersionId, 'loft-shelf', 'Refrigerator Surround Loft Base', t, t, loftZ, innerW, carcassD - bp, t, 'shelf', MAT.carcass, 'SHELF-18MM', 'center'),
        makePart(instanceId, input.templateVersionId, 'loft-shutter-left', 'Fridge Loft Left Shutter', 0, 0, loftZ, (totalW - 3) / 2, t, loftH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
        makePart(instanceId, input.templateVersionId, 'loft-shutter-right', 'Fridge Loft Right Shutter', (totalW + 3) / 2, 0, loftZ, (totalW - 3) / 2, t, loftH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
      );
    } else {
      // Pantry pull-out tower
      for (let s = 0; s < 4; s += 1) {
        const zMm = plinthH + t + Math.round(((s + 1) * (bodyH - t * 2)) / 5);
        parts.push(
          makePart(instanceId, input.templateVersionId, `pantry-shelf-${s + 1}`, `Pantry Pull-Out Basket Tier ${s + 1}`, t + 10, t + 10, zMm, Math.max(80, innerW - 20), Math.max(120, carcassD - bp - 30), 24, 'shelf', MAT.hardware, 'PANTRY-BASKET-TIER', 'center'),
        );
      }
      parts.push(
        makePart(instanceId, input.templateVersionId, 'pantry-shutter', 'Full-Height Pantry Pull-Out Front', 0, 0, plinthH, totalW, t, bodyH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
      );
    }

    return {
      templateVersionId: input.templateVersionId,
      instanceId,
      valid: true,
      blockingViolations: [],
      warningViolations: warning,
      parts,
      elements: parts,
    };
  }

  // ── 4. Storage Units (Foyer / Balcony / Flex Storage) ──────
  if (family === 'storage' || templateId.startsWith('foyer-') || templateId.startsWith('balcony-') || templateId.startsWith('other-')) {
    const innerW = Math.max(80, totalW - t * 2);
    const innerH = Math.max(80, totalH - t * 2);
    const carcassD = Math.max(120, totalD - t);

    parts.push(
      makePart(instanceId, input.templateVersionId, 'carcass-bottom', 'Storage Carcass Bottom Panel', 0, t, 0, totalW, carcassD, t, 'carcass', MAT.carcass, 'CARCASS-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'carcass-top', 'Storage Carcass Top Panel', 0, t, totalH - t, totalW, carcassD, t, 'carcass', MAT.carcass, 'CARCASS-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'carcass-left', 'Storage Carcass Left Gable', 0, t, t, t, carcassD, innerH, 'carcass', MAT.carcass, 'CARCASS-SIDE-18MM', 'left'),
      makePart(instanceId, input.templateVersionId, 'carcass-right', 'Storage Carcass Right Gable', totalW - t, t, t, t, carcassD, innerH, 'carcass', MAT.carcass, 'CARCASS-SIDE-18MM', 'right'),
      makePart(instanceId, input.templateVersionId, 'back-panel', 'Storage Back Panel', t, totalD - bp, t, innerW, bp, innerH, 'back_panel', MAT.carcass, 'BACK-6MM', 'back'),
    );

    const shelfCount = totalH >= 1500 ? 4 : totalH >= 800 ? 2 : 1;
    for (let s = 0; s < shelfCount; s += 1) {
      const zMm = t + Math.round(((s + 1) * innerH) / (shelfCount + 1));
      parts.push(
        makePart(instanceId, input.templateVersionId, `shelf-${s + 1}`, `Storage Internal Shelf ${s + 1}`, t, t + 10, zMm, innerW, Math.max(80, carcassD - bp - 10), DEFAULT_SHELF_THICKNESS_MM, 'shelf', MAT.shelf, 'SHELF-18MM', 'center'),
      );
    }

    const shutterCount = Math.max(2, Math.min(4, Math.round(totalW / TARGET_SHUTTER_WIDTH_MM)));
    const shutterW = (totalW - (shutterCount - 1) * 3) / shutterCount;
    for (let i = 0; i < shutterCount; i += 1) {
      parts.push(
        makePart(instanceId, input.templateVersionId, `shutter-${i + 1}`, `Storage Shutter ${i + 1}`, i * (shutterW + 3), 0, 0, shutterW, t, totalH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
      );
    }

    return {
      templateVersionId: input.templateVersionId,
      instanceId,
      valid: true,
      blockingViolations: [],
      warningViolations: warning,
      parts,
      elements: parts,
    };
  }

  // ── 5. Kitchen Base & Corner Cabinets (Single Units) ───────
  const counterH = 20;
  const plinthH = Math.min(100, Math.max(60, Math.round(totalH * 0.12)));
  const carcassZ = plinthH;
  const carcassH = Math.max(240, totalH - plinthH - counterH);
  const carcassD = Math.max(180, totalD - t);
  const innerW = Math.max(80, totalW - t * 2);
  const railDepth = Math.min(100, Math.floor(carcassD * 0.25));

  // Common base carcass structure (bottom, left, right)
  parts.push(
    makePart(instanceId, input.templateVersionId, 'carcass-bottom', 'Carcass Bottom Panel', 0, t, carcassZ, totalW, carcassD, t, 'carcass', MAT.carcass, 'CARCASS-18MM', 'bottom'),
    makePart(instanceId, input.templateVersionId, 'carcass-left', 'Carcass Left Side Panel', 0, t, carcassZ + t, t, carcassD, carcassH - t, 'carcass', MAT.carcass, 'CARCASS-SIDE-18MM', 'left'),
    makePart(instanceId, input.templateVersionId, 'carcass-right', 'Carcass Right Side Panel', totalW - t, t, carcassZ + t, t, carcassD, carcassH - t, 'carcass', MAT.carcass, 'CARCASS-SIDE-18MM', 'right'),
  );

  const isSinkUnit = templateId.includes('sink') || p.archetype === 'sink_base';
  const isHobUnit = templateId.includes('hob') || p.archetype === 'hob_base';
  const isBottlePullout = templateId.includes('bottle') || totalW <= 300;
  const isCornerUnit = family === 'kitchen-corner' || templateId.includes('corner');
  const isThreeDrawer =
    templateId.includes('cutlery') ||
    templateId.includes('drawers') ||
    p.drawerCount === 3 ||
    (!isSinkUnit && !isHobUnit && !isBottlePullout && !isCornerUnit && p.drawerCount === undefined && templateId.includes('dr'));
  const isTwoDrawer =
    templateId.includes('tandem-2pot') ||
    templateId.includes('2pot') ||
    p.drawerCount === 2;

  if (isSinkUnit) {
    // Sink base has open plumbing access at back + service rails + waterproof drip tray
    parts.push(
      makePart(instanceId, input.templateVersionId, 'sink-service-rail-top', 'Rear Plumbing Service Stretcher Rail', t, totalD - t, carcassZ + carcassH - 100, innerW, t, 100, 'carcass', MAT.carcass, 'SINK-SERVICE-RAIL-18MM', 'back'),
      makePart(instanceId, input.templateVersionId, 'sink-apron-rail-front', 'Front Sink Apron Fascia Rail', t, t, carcassZ + carcassH - 120, innerW, t, 120, 'carcass', MAT.carcass, 'SINK-APRON-RAIL-18MM', 'front'),
      makePart(instanceId, input.templateVersionId, 'sink-drip-tray', 'Waterproof Aluminium Drip Tray Liner', t, t + 4, carcassZ + t, innerW, carcassD - 8, 4, 'panel', MAT.hardware, 'SINK-DRIP-TRAY', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'plinth-fascia', 'Plinth Skirting Fascia', 0, 35, 0, totalW, t, plinthH, 'filler', MAT.carcass, 'PLINTH-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'countertop-slab', 'Countertop Worktop Blank', 0, 0, totalH - counterH, totalW, totalD, counterH, 'countertop', MAT.counter, 'COUNTERTOP-20MM', 'top'),
    );
    const doorCount = totalW >= 650 ? 2 : 1;
    const doorW = (totalW - (doorCount - 1) * 3) / doorCount;
    for (let d = 0; d < doorCount; d += 1) {
      parts.push(
        makePart(instanceId, input.templateVersionId, `shutter-${d + 1}`, `Sink Cabinet Shutter ${d + 1}`, d * (doorW + 3), 0, carcassZ, doorW, t, carcassH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
      );
    }
  } else if (isThreeDrawer || isTwoDrawer) {
    const drawerCount = isThreeDrawer ? 3 : 2;
    parts.push(
      makePart(instanceId, input.templateVersionId, 'back-panel', 'Back Panel', t, totalD - bp, carcassZ + t, innerW, bp, carcassH - t, 'back_panel', MAT.carcass, 'BACK-6MM', 'back'),
      makePart(instanceId, input.templateVersionId, 'top-rail-front', 'Top Front Stretcher Rail', t, t, carcassZ + carcassH - t, innerW, railDepth, t, 'carcass', MAT.carcass, 'TOP-RAIL-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'top-rail-rear', 'Top Rear Stretcher Rail', t, totalD - bp - railDepth, carcassZ + carcassH - t, innerW, railDepth, t, 'carcass', MAT.carcass, 'TOP-RAIL-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'plinth-fascia', 'Plinth Skirting Fascia', 0, 35, 0, totalW, t, plinthH, 'filler', MAT.carcass, 'PLINTH-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'countertop-slab', 'Countertop Worktop Blank', 0, 0, totalH - counterH, totalW, totalD, counterH, 'countertop', MAT.counter, 'COUNTERTOP-20MM', 'top'),
    );
    appendDrawerAssembly(parts, instanceId, input.templateVersionId, drawerCount, totalW, totalD, carcassZ, carcassH, t);
  } else if (isHobUnit) {
    parts.push(
      makePart(instanceId, input.templateVersionId, 'back-panel', 'Back Panel', t, totalD - bp, carcassZ + t, innerW, bp, carcassH - t, 'back_panel', MAT.carcass, 'BACK-6MM', 'back'),
      makePart(instanceId, input.templateVersionId, 'heat-deflector-shield', 'Under-Hob Heat Deflector Shield Panel', t, t, carcassZ + carcassH - 65, innerW, carcassD - bp, t, 'panel', MAT.carcass, 'HOB-HEAT-SHIELD-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'plinth-fascia', 'Plinth Skirting Fascia', 0, 35, 0, totalW, t, plinthH, 'filler', MAT.carcass, 'PLINTH-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'countertop-slab', 'Countertop Worktop Blank', 0, 0, totalH - counterH, totalW, totalD, counterH, 'countertop', MAT.counter, 'COUNTERTOP-20MM', 'top'),
    );
    appendDrawerAssembly(parts, instanceId, input.templateVersionId, 2, totalW, totalD, carcassZ, carcassH - 70, t);
  } else if (isBottlePullout) {
    parts.push(
      makePart(instanceId, input.templateVersionId, 'back-panel', 'Back Panel', t, totalD - bp, carcassZ + t, innerW, bp, carcassH - t, 'back_panel', MAT.carcass, 'BACK-6MM', 'back'),
      makePart(instanceId, input.templateVersionId, 'top-rail-front', 'Top Stretcher Rail', t, t, carcassZ + carcassH - t, innerW, railDepth, t, 'carcass', MAT.carcass, 'TOP-RAIL-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'pullout-tray-lower', 'Lower Bottle Pull-Out Basket', t + 8, t + 15, carcassZ + t + 40, Math.max(40, innerW - 16), Math.max(120, carcassD - bp - 30), 60, 'shelf', MAT.hardware, 'BOTTLE-PULLOUT-TIER', 'center'),
      makePart(instanceId, input.templateVersionId, 'pullout-tray-upper', 'Upper Spice Pull-Out Basket', t + 8, t + 15, carcassZ + Math.round(carcassH * 0.52), Math.max(40, innerW - 16), Math.max(120, carcassD - bp - 30), 60, 'shelf', MAT.hardware, 'BOTTLE-PULLOUT-TIER', 'center'),
      makePart(instanceId, input.templateVersionId, 'pullout-shutter', 'Bottle Pull-Out Front Shutter', 0, 0, carcassZ, totalW, t, carcassH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
      makePart(instanceId, input.templateVersionId, 'plinth-fascia', 'Plinth Skirting Fascia', 0, 35, 0, totalW, t, plinthH, 'filler', MAT.carcass, 'PLINTH-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'countertop-slab', 'Countertop Worktop Blank', 0, 0, totalH - counterH, totalW, totalD, counterH, 'countertop', MAT.counter, 'COUNTERTOP-20MM', 'top'),
    );
  } else if (isCornerUnit) {
    const blindW = Math.round(totalW * 0.52);
    const doorW = totalW - blindW;
    parts.push(
      makePart(instanceId, input.templateVersionId, 'back-panel', 'Corner Cabinet Back Panel', t, totalD - bp, carcassZ + t, innerW, bp, carcassH - t, 'back_panel', MAT.carcass, 'BACK-6MM', 'back'),
      makePart(instanceId, input.templateVersionId, 'corner-top-panel', 'Corner Cabinet Top Panel', 0, t, carcassZ + carcassH - t, totalW, carcassD, t, 'carcass', MAT.carcass, 'CARCASS-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'blind-closure-panel', 'Blind Corner Closure Panel', 0, 0, carcassZ, blindW, t, carcassH, 'panel', MAT.carcass, 'CORNER-BLIND-PANEL-18MM', 'front'),
      makePart(instanceId, input.templateVersionId, 'corner-access-shutter', 'Corner Access Shutter', blindW, 0, carcassZ, doorW, t, carcassH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
      makePart(instanceId, input.templateVersionId, 'lemans-tray-1', 'LeMans Articulating Carousel Tray 1', t + 20, t + 20, carcassZ + Math.round(carcassH * 0.35), innerW - 40, carcassD - bp - 40, 24, 'shelf', MAT.hardware, 'LEMANS-TRAY', 'center'),
      makePart(instanceId, input.templateVersionId, 'lemans-tray-2', 'LeMans Articulating Carousel Tray 2', t + 20, t + 20, carcassZ + Math.round(carcassH * 0.68), innerW - 40, carcassD - bp - 40, 24, 'shelf', MAT.hardware, 'LEMANS-TRAY', 'center'),
      makePart(instanceId, input.templateVersionId, 'plinth-fascia', 'Plinth Skirting Fascia', 0, 35, 0, totalW, t, plinthH, 'filler', MAT.carcass, 'PLINTH-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'countertop-slab', 'Countertop Worktop Blank', 0, 0, totalH - counterH, totalW, totalD, counterH, 'countertop', MAT.counter, 'COUNTERTOP-20MM', 'top'),
    );
  } else {
    // Standard single/double door base cabinet (e.g. kit-base-600)
    const doorCount = totalW >= 700 ? 2 : 1;
    const doorW = (totalW - (doorCount - 1) * 3) / doorCount;
    parts.push(
      makePart(instanceId, input.templateVersionId, 'back-panel', 'Back Panel', t, totalD - bp, carcassZ + t, innerW, bp, carcassH - t, 'back_panel', MAT.carcass, 'BACK-6MM', 'back'),
      makePart(instanceId, input.templateVersionId, 'top-rail-front', 'Top Front Stretcher Rail', t, t, carcassZ + carcassH - t, innerW, railDepth, t, 'carcass', MAT.carcass, 'TOP-RAIL-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'top-rail-rear', 'Top Rear Stretcher Rail', t, totalD - bp - railDepth, carcassZ + carcassH - t, innerW, railDepth, t, 'carcass', MAT.carcass, 'TOP-RAIL-18MM', 'top'),
      makePart(instanceId, input.templateVersionId, 'internal-shelf', 'Adjustable Base Shelf', t, t + 10, carcassZ + Math.round(carcassH * 0.5), innerW, Math.max(120, carcassD - bp - 10), DEFAULT_SHELF_THICKNESS_MM, 'shelf', MAT.shelf, 'SHELF-18MM', 'center'),
      makePart(instanceId, input.templateVersionId, 'plinth-fascia', 'Plinth Skirting Fascia', 0, 35, 0, totalW, t, plinthH, 'filler', MAT.carcass, 'PLINTH-18MM', 'bottom'),
      makePart(instanceId, input.templateVersionId, 'countertop-slab', 'Countertop Worktop Blank', 0, 0, totalH - counterH, totalW, totalD, counterH, 'countertop', MAT.counter, 'COUNTERTOP-20MM', 'top'),
    );
    for (let d = 0; d < doorCount; d += 1) {
      parts.push(
        makePart(instanceId, input.templateVersionId, `shutter-${d + 1}`, `Base Cabinet Shutter ${d + 1}`, d * (doorW + 3), 0, carcassZ, doorW, t, carcassH, 'shutter', MAT.shutter, 'SHUTTER-18MM', 'front'),
      );
    }
  }

  parts.push(...compileLightingElements(input, { family }));

  return {
    templateVersionId: input.templateVersionId,
    instanceId,
    valid: true,
    blockingViolations: [],
    warningViolations: warning,
    parts,
    elements: parts,
  };
}
