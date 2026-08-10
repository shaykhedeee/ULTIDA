import { Part, SemanticType, TemplateCompileInput, TemplateCompileResult, TvUnitParameters } from './types.js';
import {
  FINGER_GROOVE_GAP_MM,
  LOFT_FILLER_MM,
  FLOATING_TV_BASE_CLEARANCE_MM,
  TARGET_SHUTTER_WIDTH_MM,
  DEFAULT_CARCASS_THICKNESS_MM,
  DEFAULT_BACK_PANEL_THICKNESS_MM,
  ALUMINIUM_PROFILE_WIDTH_MM,
} from './constants.js';

/**
 * Parametric TV Unit Module Compiler
 * Generates exact 3D construction parts (carcasses, shutters, drawers, shelves, fillers, back panels, profiles, glass, lighting, hardware)
 */
export function compileTvUnit(input: TemplateCompileInput): TemplateCompileResult {
  const params = input.parameters as TvUnitParameters;
  const instanceId = input.instanceId ?? 'tv-unit-1';
  const blockingViolations: string[] = [];
  const warningViolations: string[] = [];

  const wallWidth = input.wall.widthMm;
  const wallHeight = input.wall.heightMm;
  const totalWidth = params.totalWidthMm;
  const totalDepth = params.totalDepthMm;
  const totalHeight = params.totalHeightMm;

  // 1. Hard Rule: Wall-fit validation
  if (totalWidth > wallWidth) {
    blockingViolations.push(`TV unit total width (${totalWidth}mm) exceeds wall width (${wallWidth}mm).`);
  }
  if (wallHeight > 0 && totalHeight > wallHeight) {
    blockingViolations.push(`TV unit total height (${totalHeight}mm) exceeds wall height (${wallHeight}mm).`);
  }

  const carcassThick = params.carcassThicknessMm ?? DEFAULT_CARCASS_THICKNESS_MM;
  const shutterThick = params.shutterThicknessMm ?? DEFAULT_CARCASS_THICKNESS_MM;
  const backThick = params.backPanelThicknessMm ?? DEFAULT_BACK_PANEL_THICKNESS_MM;
  const gap = params.fingerGrooveGapMm ?? FINGER_GROOVE_GAP_MM;
  const baseClearance = params.baseType === 'floating' ? (params.floorClearanceMm ?? FLOATING_TV_BASE_CLEARANCE_MM) : 0;
  const loftFiller = params.loftFillerMm ?? LOFT_FILLER_MM;

  const matCarcass = params.materialZones?.carcass ?? 'mat-laminate-oak';
  const matShutter = params.materialZones?.shutters ?? 'mat-acrylic-matte';
  const matBack = params.materialZones?.backPanel ?? 'mat-fluted-panel';

  // A full TV wall is not a single tall cupboard. Compile its functional
  // zones separately so 3D, renders, drawings and cutlists all describe the
  // same low storage, TV field, display bay and lighting anchors.
  if (totalHeight >= 1400) {
    return compileTvWallComposition(input, params, { carcass: matCarcass, shutter: matShutter, back: matBack }, blockingViolations, warningViolations);
  }

  const parts: Part[] = [];

  // Calculate shutter count using target width if not explicitly provided
  const shutterCount = params.shutterCount ?? Math.max(1, Math.round(totalWidth / TARGET_SHUTTER_WIDTH_MM));

  // 1. Carcass Bottom Panel
  parts.push({
    id: `${instanceId}-carcass-bottom`,
    templateVersionId: input.templateVersionId,
    instanceId,
    name: 'Carcass Bottom Panel',
    transform: { xMm: 0, yMm: 0, zMm: baseClearance, rotationDeg: 0 },
    size: { widthMm: totalWidth, depthMm: totalDepth - shutterThick, heightMm: carcassThick },
    anchor: { face: 'bottom' },
    meta: {
      semanticType: 'carcass',
      parentId: null,
      materialSlot: { id: matCarcass, code: matCarcass, name: 'Carcass Finish' },
      drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
      bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalWidth, widthMm: totalDepth - shutterThick, thicknessMm: carcassThick }
    }
  });

  // 2. Carcass Top Panel
  parts.push({
    id: `${instanceId}-carcass-top`,
    templateVersionId: input.templateVersionId,
    instanceId,
    name: 'Carcass Top Panel',
    transform: { xMm: 0, yMm: 0, zMm: baseClearance + totalHeight - carcassThick, rotationDeg: 0 },
    size: { widthMm: totalWidth, depthMm: totalDepth - shutterThick, heightMm: carcassThick },
    anchor: { face: 'top' },
    meta: {
      semanticType: 'carcass',
      parentId: null,
      materialSlot: { id: matCarcass, code: matCarcass, name: 'Carcass Finish' },
      drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
      bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalWidth, widthMm: totalDepth - shutterThick, thicknessMm: carcassThick }
    }
  });

  // 3. Back Panel
  const backPanelWidth = params.backPanelSize?.widthMm ?? totalWidth;
  const backPanelHeight = params.backPanelSize?.heightMm ?? totalHeight;
  parts.push({
    id: `${instanceId}-back-panel`,
    templateVersionId: input.templateVersionId,
    instanceId,
    name: 'Back Panel',
    transform: { xMm: 0, yMm: totalDepth - shutterThick - backThick, zMm: baseClearance, rotationDeg: 0 },
    size: { widthMm: backPanelWidth, depthMm: backThick, heightMm: backPanelHeight },
    anchor: { face: 'back' },
    meta: {
      semanticType: 'back_panel',
      parentId: null,
      materialSlot: { id: matBack, code: matBack, name: 'Back Panel Finish' },
      drawing: { layer: 'A-MOD-BACK', sortOrder: 0 },
      bom: { sku: 'BACK-6MM', qty: 1, unit: 'sqm', lengthMm: backPanelWidth, heightMm: backPanelHeight, thicknessMm: backThick }
    }
  });

  // 4. Equal Shutter Distribution calculation
  const totalShutterGaps = gap * (shutterCount - 1);
  const totalShutterWidth = totalWidth - totalShutterGaps;
  const individualShutterWidth = totalShutterWidth / shutterCount;
  const shutterHeight = totalHeight - (carcassThick * 2);

  for (let i = 0; i < shutterCount; i++) {
    const xPos = i * (individualShutterWidth + gap);
    
    // Check for profile glass option on specific shutters
    const isProfileGlass = params.profileGlassOption && i === shutterCount - 1;

    if (isProfileGlass) {
      // Profile Glass Shutter
      parts.push({
        id: `${instanceId}-shutter-profile-frame-${i + 1}`,
        templateVersionId: input.templateVersionId,
        instanceId,
        name: `Profile Glass Aluminium Frame ${i + 1}`,
        transform: { xMm: xPos, yMm: 0, zMm: baseClearance + carcassThick, rotationDeg: 0 },
        size: { widthMm: individualShutterWidth, depthMm: shutterThick, heightMm: shutterHeight },
        anchor: { face: 'front' },
        meta: {
          semanticType: 'profile',
          parentId: null,
          materialSlot: { id: 'mat-profile-black-anodized', code: 'ALU-BLK', name: 'Black Anodized Profile' },
          drawing: { layer: 'A-MOD-PROFILE', sortOrder: 2 },
          bom: { sku: 'ALU-PROFILE-20MM', qty: 1, unit: 'm', lengthMm: (individualShutterWidth + shutterHeight) * 2 }
        }
      });

      parts.push({
        id: `${instanceId}-shutter-glass-insert-${i + 1}`,
        templateVersionId: input.templateVersionId,
        instanceId,
        name: `Tinted Glass Insert ${i + 1}`,
        transform: { xMm: xPos + ALUMINIUM_PROFILE_WIDTH_MM, yMm: shutterThick / 2, zMm: baseClearance + carcassThick + ALUMINIUM_PROFILE_WIDTH_MM, rotationDeg: 0 },
        size: { widthMm: individualShutterWidth - (ALUMINIUM_PROFILE_WIDTH_MM * 2), depthMm: 4, heightMm: shutterHeight - (ALUMINIUM_PROFILE_WIDTH_MM * 2) },
        anchor: { face: 'front' },
        meta: {
          semanticType: 'glass',
          parentId: `${instanceId}-shutter-profile-frame-${i + 1}`,
          materialSlot: { id: 'mat-tinted-glass-grey', code: 'GLASS-GREY', name: 'Fluted Grey Tinted Glass' },
          drawing: { layer: 'A-MOD-GLASS', sortOrder: 3 },
          bom: { sku: 'GLASS-TINTED-4MM', qty: 1, unit: 'sqm', lengthMm: individualShutterWidth - 40, heightMm: shutterHeight - 40, thicknessMm: 4 }
        }
      });
    } else {
      // Standard Solid Shutter
      parts.push({
        id: `${instanceId}-shutter-${i + 1}`,
        templateVersionId: input.templateVersionId,
        instanceId,
        name: `Front Shutter ${i + 1}`,
        transform: { xMm: xPos, yMm: 0, zMm: baseClearance + carcassThick, rotationDeg: 0 },
        size: { widthMm: individualShutterWidth, depthMm: shutterThick, heightMm: shutterHeight },
        anchor: { face: 'front' },
        meta: {
          semanticType: 'shutter',
          parentId: null,
          materialSlot: { id: matShutter, code: matShutter, name: 'Shutter Finish' },
          drawing: { layer: 'A-MOD-SHUTTER', sortOrder: 2 },
          bom: { sku: 'SHUTTER-18MM', qty: 1, unit: 'pc', lengthMm: individualShutterWidth, heightMm: shutterHeight, thicknessMm: shutterThick }
        }
      });
    }
  }

  // 5. Fillers (Loft / Top Filler if overhead storage enabled)
  if (params.overheadStorage) {
    parts.push({
      id: `${instanceId}-loft-filler`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Loft Top Filler Panel',
      transform: { xMm: 0, yMm: 0, zMm: baseClearance + totalHeight, rotationDeg: 0 },
      size: { widthMm: totalWidth, depthMm: totalDepth, heightMm: loftFiller },
      anchor: { face: 'top' },
      meta: {
        semanticType: 'filler',
        parentId: null,
        materialSlot: { id: matCarcass, code: matCarcass, name: 'Loft Filler' },
        drawing: { layer: 'A-MOD-FILLER', sortOrder: 1 },
        bom: { sku: 'FILLER-50MM', qty: 1, unit: 'sqm', lengthMm: totalWidth, heightMm: loftFiller }
      }
    });
  }

  // 6. Optional Internal Shelves
  if (params.shelfOption) {
    parts.push({
      id: `${instanceId}-internal-shelf-1`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Internal Adjustable Shelf',
      transform: { xMm: carcassThick, yMm: carcassThick, zMm: baseClearance + (totalHeight / 2), rotationDeg: 0 },
      size: { widthMm: totalWidth - (carcassThick * 2), depthMm: totalDepth - shutterThick - (carcassThick * 2), heightMm: carcassThick },
      anchor: { face: 'center' },
      meta: {
        semanticType: 'shelf',
        parentId: `${instanceId}-carcass-bottom`,
        materialSlot: { id: matCarcass, code: matCarcass, name: 'Shelf Laminate' },
        drawing: { layer: 'A-MOD-SHELF', sortOrder: 2 },
        bom: { sku: 'SHELF-18MM', qty: 1, unit: 'sqm', lengthMm: totalWidth - 36, widthMm: totalDepth - 54, thicknessMm: carcassThick }
      }
    });
  }

  // 7. Lighting Channels (Profile LED / Spotlights)
  if (params.lighting === 'profile_led' || params.lighting === 'both') {
    parts.push({
      id: `${instanceId}-profile-led-bottom`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Under-Carcass Profile LED Lighting Strip',
      transform: { xMm: 0, yMm: totalDepth / 2, zMm: baseClearance, rotationDeg: 0 },
      size: { widthMm: totalWidth, depthMm: 15, heightMm: 10 },
      anchor: { face: 'bottom' },
      meta: {
        semanticType: 'lighting_channel',
        parentId: `${instanceId}-carcass-bottom`,
        materialSlot: { id: 'mat-led-warm', code: 'LED-3000K', name: '3000K Warm Profile LED' },
        drawing: { layer: 'A-ANNO-LIGHTING', sortOrder: 4 },
        bom: { sku: 'LED-STRIP-WARM', qty: 1, unit: 'm', lengthMm: totalWidth }
      }
    });
  }

  // 8. Hardware Placeholders (Soft-close hinges / undermount runners)
  for (let i = 0; i < shutterCount; i++) {
    parts.push({
      id: `${instanceId}-hinge-${i + 1}-top`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: `Soft-Close Concealed Hinge Shutter ${i + 1}`,
      transform: { xMm: i * (individualShutterWidth + gap), yMm: 0, zMm: baseClearance + totalHeight - 100, rotationDeg: 0 },
      size: { widthMm: 35, depthMm: 35, heightMm: 12 },
      anchor: { face: 'front' },
      meta: {
        semanticType: 'hardware',
        parentId: `${instanceId}-shutter-${i + 1}`,
        materialSlot: { id: 'mat-hardware-steel', code: 'HW-HINGE', name: 'Soft Close Hinge' },
        drawing: { layer: 'A-ANNO-HARDWARE', sortOrder: 5 },
        bom: { sku: 'HW-SOFT-CLOSE-HINGE', qty: 2, unit: 'pc' }
      }
    });
  }

  const valid = blockingViolations.length === 0;

  return {
    templateVersionId: input.templateVersionId,
    instanceId,
    valid,
    blockingViolations,
    warningViolations,
    parts
  };
}

function compileTvWallComposition(
  input: TemplateCompileInput,
  params: TvUnitParameters,
  materials: { carcass: string; shutter: string; back: string },
  blockingViolations: string[],
  warningViolations: string[],
): TemplateCompileResult {
  const instanceId = input.instanceId ?? 'tv-wall-1';
  const totalWidth = params.totalWidthMm;
  const totalDepth = params.totalDepthMm;
  const totalHeight = params.totalHeightMm;
  const thick = params.carcassThicknessMm ?? DEFAULT_CARCASS_THICKNESS_MM;
  const baseClearance = params.baseType === 'floating' ? (params.floorClearanceMm ?? FLOATING_TV_BASE_CLEARANCE_MM) : 0;
  const baseHeight = Math.min(620, Math.max(460, Math.round(totalHeight * 0.24)));
  const hasDisplayTower = params.profileGlassOption === true;
  const towerWidth = hasDisplayTower ? Math.min(540, Math.max(360, Math.round(totalWidth * 0.22))) : 0;
  const tvFieldWidth = totalWidth - towerWidth - (hasDisplayTower ? thick : 0);
  const tvFieldHeight = Math.min(980, Math.max(620, totalHeight - baseHeight - 260));
  const displayShutterCount = Math.max(2, Math.round(totalWidth / TARGET_SHUTTER_WIDTH_MM));
  const parts: Part[] = [];
  const add = (id: string, name: string, xMm: number, yMm: number, zMm: number, widthMm: number, depthMm: number, heightMm: number, semanticType: SemanticType, materialId: string, layer: string, sku: string) => {
    parts.push({
      id: `${instanceId}-${id}`, templateVersionId: input.templateVersionId, instanceId, name,
      transform: { xMm, yMm, zMm, rotationDeg: 0 }, size: { widthMm, depthMm, heightMm }, anchor: { face: 'front' },
      meta: { semanticType, parentId: null, materialSlot: { id: materialId, code: materialId, name: name.includes('Glass') ? 'Display Glass' : 'Assigned Finish' }, drawing: { layer, sortOrder: parts.length + 1 }, bom: { sku, qty: 1, unit: 'pc', lengthMm: widthMm, widthMm: depthMm, heightMm, thicknessMm: depthMm <= 30 ? depthMm : thick } },
    });
  };

  // Full-height backing defines the TV field without hiding it behind shutters.
  add('back-panel', 'TV Feature Back Panel', 0, totalDepth - DEFAULT_BACK_PANEL_THICKNESS_MM, baseClearance, totalWidth, DEFAULT_BACK_PANEL_THICKNESS_MM, totalHeight, 'back_panel', materials.back, 'A-MOD-BACK', 'TV-BACK-PANEL');
  add('base-bottom', 'Low Storage Bottom Panel', 0, 0, baseClearance, totalWidth, totalDepth, thick, 'carcass', materials.carcass, 'A-MOD-CARCASS', 'TV-BASE-BOTTOM');
  add('base-top', 'Low Storage Top Panel', 0, 0, baseClearance + baseHeight - thick, totalWidth, totalDepth, thick, 'carcass', materials.carcass, 'A-MOD-CARCASS', 'TV-BASE-TOP');

  const shutterWidth = (totalWidth - (displayShutterCount - 1) * FINGER_GROOVE_GAP_MM) / displayShutterCount;
  for (let index = 0; index < displayShutterCount; index += 1) {
    const xMm = index * (shutterWidth + FINGER_GROOVE_GAP_MM);
    add(`base-shutter-${index + 1}`, `Low Storage Shutter ${index + 1}`, xMm, 0, baseClearance + thick, shutterWidth, thick, baseHeight - thick * 2, 'shutter', materials.shutter, 'A-MOD-SHUTTER', 'TV-BASE-SHUTTER');
    add(`handle-${index + 1}`, `Profile Handle ${index + 1}`, xMm + shutterWidth - 34, thick / 2, baseClearance + baseHeight / 2, 18, 18, 160, 'hardware', 'mat-hardware-steel', 'A-ANNO-HARDWARE', 'PROFILE-HANDLE');
  }

  const tvFieldX = hasDisplayTower ? 0 : Math.max(0, Math.round(totalWidth * 0.12));
  const finalTvFieldWidth = hasDisplayTower ? tvFieldWidth - 80 : Math.round(totalWidth * 0.76);
  const tvFieldZ = baseClearance + baseHeight + 100;
  add('tv-recess', 'TV Service and Cable Recess', tvFieldX, totalDepth - 24, tvFieldZ, finalTvFieldWidth, 24, tvFieldHeight, 'back_panel', materials.back, 'A-MOD-SERVICE', 'TV-CABLE-RECESS');
  add('tv-shelf', 'TV Floating Display Shelf', tvFieldX + 80, totalDepth * 0.38, tvFieldZ - 34, Math.max(720, finalTvFieldWidth - 160), 280, thick, 'shelf', materials.carcass, 'A-MOD-SHELF', 'TV-DISPLAY-SHELF');

  if (hasDisplayTower) {
    const towerX = totalWidth - towerWidth;
    add('display-tower-left', 'Display Tower Side', towerX, 0, baseClearance + baseHeight, thick, totalDepth, totalHeight - baseHeight, 'carcass', materials.carcass, 'A-MOD-CARCASS', 'TV-DISPLAY-SIDE');
    add('display-tower-right', 'Display Tower Side', totalWidth - thick, 0, baseClearance + baseHeight, thick, totalDepth, totalHeight - baseHeight, 'carcass', materials.carcass, 'A-MOD-CARCASS', 'TV-DISPLAY-SIDE');
    add('display-glass', 'Profile Glass Display Shutter', towerX + thick, 0, baseClearance + baseHeight + thick, towerWidth - thick * 2, 4, totalHeight - baseHeight - thick * 2, 'glass', 'mat-tinted-glass-grey', 'A-MOD-GLASS', 'TV-DISPLAY-GLASS');
    for (let shelf = 0; shelf < 3; shelf += 1) add(`display-shelf-${shelf + 1}`, `Display Shelf ${shelf + 1}`, towerX + thick, 90, baseClearance + baseHeight + 260 + shelf * 360, towerWidth - thick * 2, totalDepth - 120, thick, 'shelf', materials.carcass, 'A-MOD-SHELF', 'TV-DISPLAY-SHELF');
  }

  if (params.lighting === 'profile_led' || params.lighting === 'both') {
    add('led-tv-field', 'Warm LED TV Field Anchor', tvFieldX + 40, totalDepth - 32, tvFieldZ + tvFieldHeight + 20, Math.max(400, finalTvFieldWidth - 80), 12, 12, 'lighting_channel', 'mat-led-warm', 'A-ANNO-LIGHTING', 'LED-3000K');
    if (hasDisplayTower) add('led-display', 'Warm LED Display Anchor', totalWidth - towerWidth + 26, totalDepth - 28, baseClearance + baseHeight + 40, 12, 12, totalHeight - baseHeight - 80, 'lighting_channel', 'mat-led-warm', 'A-ANNO-LIGHTING', 'LED-3000K');
  }
  if (params.overheadStorage) add('top-filler', 'Top Filler / Loft Closure', 0, 0, baseClearance + totalHeight - 50, totalWidth, totalDepth, 50, 'filler', materials.carcass, 'A-MOD-FILLER', 'TV-TOP-FILLER');

  return { templateVersionId: input.templateVersionId, instanceId, valid: blockingViolations.length === 0, blockingViolations, warningViolations, parts };
}
