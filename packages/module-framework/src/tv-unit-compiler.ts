import { Part, TemplateCompileInput, TemplateCompileResult, TvUnitParameters } from './types.js';
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
  if (totalHeight > wallHeight) {
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
