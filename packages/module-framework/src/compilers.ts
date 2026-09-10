/**
 * module-framework — parametric compilers for the 7 remaining module families.
 * Each compiler returns a TemplateCompileResult with deterministic parts:
 * carcass, shutters, drawers, shelves, fillers, panels, glass, profiles,
 * countertops, hardware placeholders, lighting anchors.
 *
 * The TV-unit compiler lives in tv-unit-compiler.ts (the first vertical template).
 */
import { Part, TemplateCompileInput, TemplateCompileResult, type CategoryType } from './types.js';
import { compileLightingElements } from './lighting-compiler.js';
import {
  DEFAULT_CARCASS_THICKNESS_MM, DEFAULT_BACK_PANEL_THICKNESS_MM, DEFAULT_SHELF_THICKNESS_MM,
  DEFAULT_DRAWER_HEIGHT_MM, DEFAULT_WARDROBE_DEPTH_MM, TARGET_SHUTTER_WIDTH_MM,
} from './constants.js';

function baseParts(input: TemplateCompileInput, instanceId: string, wallW: number, wallH: number, totalW: number, totalH: number, totalD: number, carcassMat: string, shutterMat: string): Part[] {
  const t = DEFAULT_CARCASS_THICKNESS_MM;
  const bp = DEFAULT_BACK_PANEL_THICKNESS_MM;
  const innerH = totalH - t * 2;
  const parts: Part[] = [
    { id: `${instanceId}-carcass-bottom`, templateVersionId: input.templateVersionId, instanceId, name: 'Carcass Bottom Panel', transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: t }, anchor: { face: 'bottom' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: carcassMat, code: carcassMat, name: 'Carcass' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: t } } },
    { id: `${instanceId}-carcass-top`, templateVersionId: input.templateVersionId, instanceId, name: 'Carcass Top Panel', transform: { xMm: 0, yMm: 0, zMm: totalH - t, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: t }, anchor: { face: 'top' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: carcassMat, code: carcassMat, name: 'Carcass' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: t } } },
    { id: `${instanceId}-back-panel`, templateVersionId: input.templateVersionId, instanceId, name: 'Back Panel', transform: { xMm: 0, yMm: totalD - bp, zMm: 0, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: bp, heightMm: totalH }, anchor: { face: 'back' }, meta: { semanticType: 'back_panel', parentId: null, materialSlot: { id: carcassMat, code: carcassMat, name: 'Back Panel' }, drawing: { layer: 'A-MOD-BACK', sortOrder: 0 }, bom: { sku: 'BACK-6MM', qty: 1, unit: 'sqm', lengthMm: totalW, heightMm: totalH, thicknessMm: bp } } },
    { id: `${instanceId}-carcass-left`, templateVersionId: input.templateVersionId, instanceId, name: 'Carcass Left Side Panel', transform: { xMm: 0, yMm: 0, zMm: t, rotationDeg: 0 }, size: { widthMm: t, depthMm: totalD, heightMm: innerH }, anchor: { face: 'left' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: carcassMat, code: carcassMat, name: 'Carcass Side' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-SIDE-18MM', qty: 1, unit: 'pc', lengthMm: totalD, widthMm: innerH, thicknessMm: t } } },
    { id: `${instanceId}-carcass-right`, templateVersionId: input.templateVersionId, instanceId, name: 'Carcass Right Side Panel', transform: { xMm: totalW - t, yMm: 0, zMm: t, rotationDeg: 0 }, size: { widthMm: t, depthMm: totalD, heightMm: innerH }, anchor: { face: 'right' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: carcassMat, code: carcassMat, name: 'Carcass Side' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-SIDE-18MM', qty: 1, unit: 'pc', lengthMm: totalD, widthMm: innerH, thicknessMm: t } } },
  ];
  return parts;
}

function carcassSides(input: TemplateCompileInput, instanceId: string, idPrefix: string, totalW: number, totalH: number, totalD: number, carcassMat: string, zMm = 0): Part[] {
  const t = DEFAULT_CARCASS_THICKNESS_MM;
  const innerH = totalH - t * 2;
  const prefix = `${instanceId}-${idPrefix ? `${idPrefix}-` : ''}`;
  const make = (side: 'left' | 'right', xMm: number): Part => ({
    id: `${prefix}carcass-${side}`,
    templateVersionId: input.templateVersionId,
    instanceId,
    name: `${idPrefix ? `${idPrefix[0].toUpperCase()}${idPrefix.slice(1)} ` : ''}Carcass ${side === 'left' ? 'Left' : 'Right'} Side Panel`,
    transform: { xMm, yMm: 0, zMm: zMm + t, rotationDeg: 0 },
    size: { widthMm: t, depthMm: totalD, heightMm: innerH },
    anchor: { face: side },
    meta: {
      semanticType: 'carcass',
      parentId: null,
      materialSlot: { id: carcassMat, code: carcassMat, name: 'Carcass Side' },
      drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
      bom: { sku: 'CARCASS-SIDE-18MM', qty: 1, unit: 'pc', lengthMm: totalD, widthMm: innerH, thicknessMm: t },
    },
  });
  return [make('left', 0), make('right', totalW - t)];
}

function shutterRow(instanceId: string, templateVersionId: string, i: number, xPos: number, w: number, h: number, zBot: number, mat: string, totalD: number): Part[] {
  return [{ id: `${instanceId}-shutter-${i + 1}`, templateVersionId, instanceId, name: `Front Shutter ${i + 1}`, transform: { xMm: xPos, yMm: 0, zMm: zBot, rotationDeg: 0 }, size: { widthMm: w, depthMm: DEFAULT_CARCASS_THICKNESS_MM, heightMm: h }, anchor: { face: 'front' }, meta: { semanticType: 'shutter', parentId: null, materialSlot: { id: mat, code: mat, name: 'Shutter' }, drawing: { layer: 'A-MOD-SHUTTER', sortOrder: 2 }, bom: { sku: 'SHUTTER-18MM', qty: 1, unit: 'pc', lengthMm: w, heightMm: h, thicknessMm: DEFAULT_CARCASS_THICKNESS_MM } } }];
}

const COMPAT: Record<string, string> = {
  carcass: 'mat-laminate-oak', shutter: 'mat-acrylic-matte', back: 'mat-fluted-panel', glass: 'mat-tinted-glass-grey', profile: 'mat-profile-black-anodized', hardware: 'mat-hardware-steel', led: 'mat-led-warm', counter: 'mat-quartz-white', panel: 'mat-laminate-wenge', shelf: 'mat-laminate-oak',
};

// ── Wardrobe ────────────────────────────────────────────────
export function compileWardrobe(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  if (p?.isIsland || p?.archetype === 'dressing_island' || p?.archetype === 'jewellery_island' || input.templateVersionId?.includes('island')) {
    return compileIsland(input);
  }
  const instanceId = input.instanceId ?? 'wardrobe-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm, totalH = p.totalHeightMm ?? 2400, totalD = p.totalDepthMm ?? DEFAULT_WARDROBE_DEPTH_MM;
  const blocking: string[] = []; const warning: string[] = [];
  if (totalW > wallW) blocking.push(`Wardrobe width ${totalW}mm exceeds wall ${wallW}mm.`);
  if (totalH > wallH) blocking.push(`Wardrobe height ${totalH}mm exceeds wall ${wallH}mm.`);
  if (totalD < 550) warning.push('Wardrobe depth < 550mm restricts shutter opening.');
  const parts = baseParts(input, instanceId, wallW, wallH, totalW, totalH, totalD, COMPAT.carcass, COMPAT.shutter);
  const shutterCount = p.shutterCount ?? Math.max(2, Math.round(totalW / TARGET_SHUTTER_WIDTH_MM));
  const drawerCount = Math.max(0, Math.floor(p.drawerCount ?? 0));
  const drawerHeightMm = Math.max(120, Number(p.drawerHeightMm ?? DEFAULT_DRAWER_HEIGHT_MM));
  const loftHeightMm = p.includeLoft ? Math.max(250, Number(p.loftHeightMm ?? 600)) : 0;
  const storageHeightMm = totalH - loftHeightMm;
  const drawerStackHeightMm = drawerCount * drawerHeightMm;
  const shutterH = storageHeightMm - DEFAULT_CARCASS_THICKNESS_MM * 2 - drawerStackHeightMm;
  if (loftHeightMm >= totalH - DEFAULT_CARCASS_THICKNESS_MM * 2 || shutterH < 300) blocking.push('Wardrobe loft and drawer configuration leaves insufficient height for shutters.');
  const shutterW = totalW / shutterCount;
  for (let i = 0; i < shutterCount; i++) parts.push(...shutterRow(instanceId, input.templateVersionId, i, i * shutterW, shutterW, shutterH, DEFAULT_CARCASS_THICKNESS_MM + drawerStackHeightMm, COMPAT.shutter, totalD));
  for (let index = 0; index < drawerCount; index += 1) {
    parts.push({ id: `${instanceId}-drawer-${index + 1}`, templateVersionId: input.templateVersionId, instanceId, name: `Wardrobe Drawer ${index + 1}`, transform: { xMm: DEFAULT_CARCASS_THICKNESS_MM, yMm: 0, zMm: DEFAULT_CARCASS_THICKNESS_MM + index * drawerHeightMm, rotationDeg: 0 }, size: { widthMm: totalW - DEFAULT_CARCASS_THICKNESS_MM * 2, depthMm: totalD - 40, heightMm: drawerHeightMm }, anchor: { face: 'front' }, meta: { semanticType: 'drawer', parentId: `${instanceId}-carcass-bottom`, materialSlot: { id: COMPAT.shutter, code: COMPAT.shutter, name: 'Drawer Front' }, drawing: { layer: 'A-MOD-DRAWER', sortOrder: 3 }, bom: { sku: 'WARDROBE-DRAWER', qty: 1, unit: 'pc', lengthMm: totalW - 36, widthMm: totalD - 40, heightMm: drawerHeightMm, thicknessMm: DEFAULT_CARCASS_THICKNESS_MM } } });
  }
  const addFiller = (side: 'left' | 'right', widthMm: number) => {
    if (!Number.isFinite(widthMm) || widthMm <= 0) return;
    parts.push({ id: `${instanceId}-filler-${side}`, templateVersionId: input.templateVersionId, instanceId, name: `Wardrobe ${side === 'left' ? 'Left' : 'Right'} Wall Filler`, transform: { xMm: side === 'left' ? -widthMm : totalW, yMm: 0, zMm: 0, rotationDeg: 0 }, size: { widthMm, depthMm: totalD, heightMm: totalH }, anchor: { face: side }, meta: { semanticType: 'filler', parentId: null, materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Wall Filler' }, drawing: { layer: 'A-MOD-FILLER', sortOrder: 1 }, bom: { sku: 'WARDROBE-WALL-FILLER', qty: 1, unit: 'pc', lengthMm: totalH, widthMm, thicknessMm: DEFAULT_CARCASS_THICKNESS_MM } } });
  };
  addFiller('left', Number(p.leftFillerMm ?? 0));
  addFiller('right', Number(p.rightFillerMm ?? 0));
  if (loftHeightMm > 0) parts.push({ id: `${instanceId}-loft`, templateVersionId: input.templateVersionId, instanceId, name: 'Wardrobe Loft Storage', transform: { xMm: 0, yMm: 0, zMm: totalH - loftHeightMm, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: DEFAULT_CARCASS_THICKNESS_MM, heightMm: loftHeightMm }, anchor: { face: 'front' }, meta: { semanticType: 'loft', parentId: null, materialSlot: { id: COMPAT.shutter, code: COMPAT.shutter, name: 'Loft Shutter' }, drawing: { layer: 'A-MOD-LOFT', sortOrder: 2 }, bom: { sku: 'WARDROBE-LOFT-SHUTTER', qty: 1, unit: 'pc', lengthMm: totalW, heightMm: loftHeightMm, thicknessMm: DEFAULT_CARCASS_THICKNESS_MM } } });
  if (p.lighting === 'profile_led' || p.lighting === 'both') parts.push({ id: `${instanceId}-led-channel`, templateVersionId: input.templateVersionId, instanceId, name: 'Wardrobe Sensor LED Channel', transform: { xMm: DEFAULT_CARCASS_THICKNESS_MM, yMm: totalD - 24, zMm: storageHeightMm - 24, rotationDeg: 0 }, size: { widthMm: totalW - DEFAULT_CARCASS_THICKNESS_MM * 2, depthMm: 12, heightMm: 12 }, anchor: { face: 'front' }, meta: { semanticType: 'lighting_channel', parentId: null, materialSlot: { id: COMPAT.led, code: COMPAT.led, name: 'Warm LED' }, drawing: { layer: 'A-ANNO-LIGHTING', sortOrder: 4 }, bom: { sku: 'LED-3000K-CHANNEL', qty: 1, unit: 'pc', lengthMm: totalW - DEFAULT_CARCASS_THICKNESS_MM * 2 } } });
  // internal shelf + hanging rod (shelf semantic)
  parts.push({ id: `${instanceId}-shelf-1`, templateVersionId: input.templateVersionId, instanceId, name: 'Internal Shelf', transform: { xMm: DEFAULT_CARCASS_THICKNESS_MM, yMm: DEFAULT_CARCASS_THICKNESS_MM, zMm: totalH / 2, rotationDeg: 0 }, size: { widthMm: totalW - DEFAULT_CARCASS_THICKNESS_MM * 2, depthMm: totalD - DEFAULT_CARCASS_THICKNESS_MM * 2, heightMm: DEFAULT_SHELF_THICKNESS_MM }, anchor: { face: 'center' }, meta: { semanticType: 'shelf', parentId: `${instanceId}-carcass-bottom`, materialSlot: { id: COMPAT.shelf, code: COMPAT.shelf, name: 'Shelf' }, drawing: { layer: 'A-MOD-SHELF', sortOrder: 2 }, bom: { sku: 'SHELF-18MM', qty: 1, unit: 'sqm', lengthMm: totalW - 36, widthMm: totalD - 36, thicknessMm: DEFAULT_SHELF_THICKNESS_MM } } });
  parts.push(...compileLightingElements(input, { family: 'wardrobe' }));
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: warning, parts, elements: parts };
}

// ── Crockery unit ───────────────────────────────────────────
export function compileCrockery(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'crockery-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm, totalH = p.totalHeightMm ?? 2100, totalD = p.totalDepthMm ?? 400;
  const blocking: string[] = []; const warning: string[] = [];
  if (totalW > wallW) blocking.push(`Crockery width ${totalW}mm exceeds wall ${wallW}mm.`);
  if (wallH > 0 && totalH > wallH) blocking.push(`Crockery height ${totalH}mm exceeds wall height ${wallH}mm.`);

  // A crockery unit is deliberately divided into a durable low cabinet, a
  // display band, and an upper storage/display zone. This keeps its scene
  // geometry legible instead of turning a detailed composition into one box.
  const t = DEFAULT_CARCASS_THICKNESS_MM;
  const bp = DEFAULT_BACK_PANEL_THICKNESS_MM;
  const drawers = Math.max(0, Math.min(3, p.drawerCount ?? 2));
  const baseH = Math.min(860, Math.max(640, Math.round(totalH * 0.34)));
  const displayBandH = Math.min(420, Math.max(260, Math.round(totalH * 0.16)));
  const upperH = totalH - baseH - displayBandH;
  const shutterCount = Math.max(2, p.shutterCount ?? Math.round(totalW / TARGET_SHUTTER_WIDTH_MM));
  const shutterW = (totalW - (shutterCount - 1) * 3) / shutterCount;
  const profileGlass = p.profileGlassOption === true || p.glassProfile === true || p.shutterStyle === 'profile-glass';
  const parts: Part[] = carcassSides(input, instanceId, '', totalW, totalH, totalD, COMPAT.carcass);
  const add = (id: string, name: string, xMm: number, yMm: number, zMm: number, widthMm: number, depthMm: number, heightMm: number, semanticType: Part['meta']['semanticType'], materialId: string, layer: string, sku: string) => parts.push({
    id: `${instanceId}-${id}`, templateVersionId: input.templateVersionId, instanceId, name,
    transform: { xMm, yMm, zMm, rotationDeg: 0 }, size: { widthMm, depthMm, heightMm }, anchor: { face: 'front' },
    meta: { semanticType, parentId: null, materialSlot: { id: materialId, code: materialId, name: name.includes('Glass') ? 'Profile Glass' : 'Assigned Finish' }, drawing: { layer, sortOrder: parts.length + 1 }, bom: { sku, qty: 1, unit: 'pc', lengthMm: widthMm, widthMm: depthMm, heightMm, thicknessMm: depthMm <= 30 ? depthMm : t } },
  });

  add('back', 'Crockery Feature Back Panel', 0, totalD - bp, 0, totalW, bp, totalH, 'back_panel', COMPAT.back, 'A-MOD-BACK', 'CROCKERY-BACK');
  add('base-bottom', 'Crockery Base Bottom Panel', 0, 0, 0, totalW, totalD, t, 'carcass', COMPAT.carcass, 'A-MOD-CARCASS', 'CROCKERY-BASE-BOTTOM');
  add('base-top', 'Crockery Base Top Panel', 0, 0, baseH - t, totalW, totalD, t, 'carcass', COMPAT.carcass, 'A-MOD-CARCASS', 'CROCKERY-BASE-TOP');
  for (let drawer = 0; drawer < drawers; drawer += 1) {
    add(`drawer-${drawer + 1}`, `Crockery Drawer ${drawer + 1}`, t, 0, t + drawer * DEFAULT_DRAWER_HEIGHT_MM, totalW - t * 2, totalD - 50, DEFAULT_DRAWER_HEIGHT_MM, 'drawer', COMPAT.shutter, 'A-MOD-DRAWER', 'CROCKERY-DRAWER');
  }
  const baseShutterH = Math.max(160, baseH - t * 2 - drawers * DEFAULT_DRAWER_HEIGHT_MM);
  for (let index = 0; index < shutterCount; index += 1) {
    const xMm = index * (shutterW + 3);
    add(`base-shutter-${index + 1}`, `Crockery Base Shutter ${index + 1}`, xMm, 0, t + drawers * DEFAULT_DRAWER_HEIGHT_MM, shutterW, t, baseShutterH, 'shutter', COMPAT.shutter, 'A-MOD-SHUTTER', 'CROCKERY-BASE-SHUTTER');
    add(`handle-${index + 1}`, `Crockery Profile Handle ${index + 1}`, xMm + shutterW - 34, 9, baseH / 2, 18, 18, 160, 'hardware', COMPAT.hardware, 'A-ANNO-HARDWARE', 'PROFILE-HANDLE');
  }

  add('display-counter', 'Crockery Display Counter', 0, 0, baseH, totalW, totalD, 25, 'countertop', COMPAT.counter, 'A-MOD-COUNTER', 'CROCKERY-COUNTER');
  add('display-shelf', 'Open Crockery Display Shelf', t, 80, baseH + displayBandH - t, totalW - t * 2, totalD - 120, t, 'shelf', COMPAT.shelf, 'A-MOD-SHELF', 'CROCKERY-DISPLAY-SHELF');
  if (p.lighting === 'profile_led' || p.lighting === 'both') add('display-led', 'Warm Display LED Channel', t + 40, totalD - 24, baseH + displayBandH - 28, totalW - t * 2 - 80, 12, 12, 'lighting_channel', COMPAT.led, 'A-ANNO-LIGHTING', 'LED-3000K');

  const upperZ = baseH + displayBandH;
  const upperDoorH = Math.max(220, upperH - t * 2);
  for (let index = 0; index < shutterCount; index += 1) {
    const xMm = index * (shutterW + 3);
    if (profileGlass && index >= shutterCount - Math.max(1, Math.ceil(shutterCount / 2))) {
      add(`upper-glass-${index + 1}`, `Profile Glass Display Door ${index + 1}`, xMm + t, 0, upperZ + t, shutterW - t * 2, 4, upperDoorH, 'glass', COMPAT.glass, 'A-MOD-GLASS', 'CROCKERY-GLASS-DOOR');
      add(`upper-profile-${index + 1}`, `Aluminium Display Profile ${index + 1}`, xMm, 4, upperZ, shutterW, 20, upperH, 'profile', COMPAT.profile, 'A-MOD-PROFILE', 'ALU-PROFILE');
    } else {
      add(`upper-shutter-${index + 1}`, `Crockery Upper Shutter ${index + 1}`, xMm, 0, upperZ + t, shutterW, t, upperDoorH, 'shutter', COMPAT.shutter, 'A-MOD-SHUTTER', 'CROCKERY-UPPER-SHUTTER');
    }
  }
  for (let shelf = 0; shelf < 2; shelf += 1) add(`upper-shelf-${shelf + 1}`, `Upper Display Shelf ${shelf + 1}`, t, 90, upperZ + 230 + shelf * Math.max(260, Math.round(upperH / 3)), totalW - t * 2, totalD - 120, t, 'shelf', COMPAT.shelf, 'A-MOD-SHELF', 'CROCKERY-UPPER-SHELF');
  if (p.includeLoft) add('top-filler', 'Crockery Top Filler', 0, 0, totalH - 50, totalW, totalD, 50, 'filler', COMPAT.carcass, 'A-MOD-FILLER', 'CROCKERY-TOP-FILLER');
  parts.push(...compileLightingElements(input, { family: 'crockery' }));
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: warning, parts, elements: parts };
}

// ── Study unit ──────────────────────────────────────────────
export function compileStudy(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'study-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm, totalH = p.totalHeightMm ?? 1800, totalD = p.totalDepthMm ?? 550;
  const blocking: string[] = []; if (totalW > wallW) blocking.push(`Study width ${totalW}mm exceeds wall ${wallW}mm.`);
  const parts = baseParts(input, instanceId, wallW, wallH, totalW, totalH, totalD, COMPAT.carcass, COMPAT.shutter);
  parts.push({ id: `${instanceId}-drawer-top`, templateVersionId: input.templateVersionId, instanceId, name: 'Study Drawer', transform: { xMm: 0, yMm: 0, zMm: DEFAULT_CARCASS_THICKNESS_MM, rotationDeg: 0 }, size: { widthMm: totalW - DEFAULT_CARCASS_THICKNESS_MM * 2, depthMm: totalD - 60, heightMm: DEFAULT_DRAWER_HEIGHT_MM }, anchor: { face: 'front' }, meta: { semanticType: 'drawer', parentId: `${instanceId}-carcass-bottom`, materialSlot: { id: COMPAT.shutter, code: COMPAT.shutter, name: 'Drawer' }, drawing: { layer: 'A-MOD-DRAWER', sortOrder: 3 }, bom: { sku: 'DRAWER-BOX', qty: 1, unit: 'pc', lengthMm: totalW - 36, heightMm: DEFAULT_DRAWER_HEIGHT_MM } } });
  parts.push(...compileLightingElements(input, { family: 'study' }));
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: [], parts, elements: parts };
}

// ── Pooja unit ──────────────────────────────────────────────
export function compilePooja(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'pooja-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm, totalH = p.totalHeightMm ?? 2100, totalD = p.totalDepthMm ?? 350;
  const blocking: string[] = []; if (totalW > wallW) blocking.push(`Pooja width ${totalW}mm exceeds wall ${wallW}mm.`);
  const parts = baseParts(input, instanceId, wallW, wallH, totalW, totalH, totalD, COMPAT.carcass, COMPAT.shutter);
  parts.push({ id: `${instanceId}-tray`, templateVersionId: input.templateVersionId, instanceId, name: 'Pooja Tray', transform: { xMm: totalW / 2 - 75, yMm: totalD / 2, zMm: 900, rotationDeg: 0 }, size: { widthMm: 150, depthMm: 150, heightMm: 75 }, anchor: { face: 'center' }, meta: { semanticType: 'shelf', parentId: `${instanceId}-carcass-bottom`, materialSlot: { id: COMPAT.shelf, code: COMPAT.shelf, name: 'Tray' }, drawing: { layer: 'A-MOD-SHELF', sortOrder: 2 }, bom: { sku: 'POOJA-TRAY', qty: 1, unit: 'pc' } } });
  const shutterCount = 1; const shutterW = totalW; const shutterH = totalH - DEFAULT_CARCASS_THICKNESS_MM * 2;
  parts.push(...shutterRow(instanceId, input.templateVersionId, 0, 0, shutterW, shutterH, DEFAULT_CARCASS_THICKNESS_MM, 'mat-gold-accent', totalD));
  parts.push(...compileLightingElements(input, { family: 'pooja' }));
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: [], parts, elements: parts };
}

// ── Kitchen (base + upper + countertop) ─────────────────────
export function compileKitchen(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  if (p?.isIsland || p?.archetype === 'island' || input.templateVersionId?.includes('island')) {
    return compileIsland(input);
  }
  const instanceId = input.instanceId ?? 'kitchen-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm, baseH = p.baseHeightMm ?? 900, totalD = p.totalDepthMm ?? 600, upperH = p.upperHeightMm ?? 720;
  const blocking: string[] = []; const warning: string[] = [];
  if (totalW > wallW) blocking.push(`Kitchen width ${totalW}mm exceeds wall ${wallW}mm.`);
  const parts: Part[] = [];
  // base carcass + shutters
  parts.push({ id: `${instanceId}-base-carcass`, templateVersionId: input.templateVersionId, instanceId, name: 'Base Carcass', transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: baseH }, anchor: { face: 'bottom' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Base Carcass' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: DEFAULT_CARCASS_THICKNESS_MM } } });
  parts.push(...carcassSides(input, instanceId, 'base', totalW, baseH, totalD, COMPAT.carcass));
  const baseShutters = p.baseShutterCount ?? Math.max(2, Math.round(totalW / TARGET_SHUTTER_WIDTH_MM));
  const bsW = totalW / baseShutters;
  for (let i = 0; i < baseShutters; i++) parts.push(...shutterRow(instanceId, input.templateVersionId, i, i * bsW, bsW, baseH - DEFAULT_CARCASS_THICKNESS_MM, DEFAULT_CARCASS_THICKNESS_MM, COMPAT.shutter, totalD));
  // countertop
  parts.push({ id: `${instanceId}-countertop`, templateVersionId: input.templateVersionId, instanceId, name: 'Countertop', transform: { xMm: 0, yMm: 0, zMm: baseH, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: 40 }, anchor: { face: 'top' }, meta: { semanticType: 'countertop', parentId: `${instanceId}-base-carcass`, materialSlot: { id: COMPAT.counter, code: COMPAT.counter, name: 'Countertop' }, drawing: { layer: 'A-MOD-COUNTER', sortOrder: 4 }, bom: { sku: 'QUARTZ-40MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: 40 } } });
  // upper cabinets
  parts.push({ id: `${instanceId}-upper-carcass`, templateVersionId: input.templateVersionId, instanceId, name: 'Upper Carcass', transform: { xMm: 0, yMm: 0, zMm: baseH + 100, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD - 300, heightMm: upperH }, anchor: { face: 'top' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Upper Carcass' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD - 300, thicknessMm: DEFAULT_CARCASS_THICKNESS_MM } } });
  parts.push(...carcassSides(input, instanceId, 'upper', totalW, upperH, totalD - 300, COMPAT.carcass, baseH + 100));
  if (!input.wall.id && warning.length === 0) warning.push('Kitchen requires plumbing service point.');
  parts.push(...compileLightingElements(input, { family: 'kitchen' }));
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: warning, parts, elements: parts };
}

// ── Bed (panel-built storage bed + headboard) ───────────────
export function compileBed(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'bed-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm ?? 1600, platformH = Math.max(350, p.platformHeightMm ?? Math.min(450, p.totalHeightMm ?? 450)), totalD = p.totalDepthMm ?? 2100;
  const headboardH = Math.max(900, p.headboardHeightMm ?? (p.totalHeightMm && p.totalHeightMm > 700 ? p.totalHeightMm : 1100));
  const t = DEFAULT_CARCASS_THICKNESS_MM;
  const blocking: string[] = [];
  const warning: string[] = [];
  if (totalW > wallW) blocking.push(`Bed width ${totalW}mm exceeds wall ${wallW}mm.`);
  if (wallH > 0 && headboardH > wallH) blocking.push(`Headboard height ${headboardH}mm exceeds wall height ${wallH}mm.`);
  if (totalD < 1850) warning.push('Bed length below 1850mm requires mattress verification.');
  const parts: Part[] = [];
  const addPanel = (id: string, name: string, xMm: number, yMm: number, zMm: number, widthMm: number, depthMm: number, heightMm: number, semanticType: Part['meta']['semanticType'], materialId = COMPAT.carcass, sku = 'BED-PANEL-18MM', anchorFace: Part['anchor']['face'] = 'bottom') => parts.push({
    id: `${instanceId}-${id}`, templateVersionId: input.templateVersionId, instanceId, name,
    transform: { xMm, yMm, zMm, rotationDeg: 0 }, size: { widthMm, depthMm, heightMm }, anchor: { face: anchorFace },
    meta: { semanticType, parentId: null, materialSlot: { id: materialId, code: materialId, name: semanticType === 'panel' ? 'Headboard finish' : 'Bed carcass' }, drawing: { layer: semanticType === 'panel' ? 'A-MOD-PANEL' : 'A-MOD-CARCASS', sortOrder: parts.length + 1 }, bom: { sku, qty: 1, unit: 'pc', lengthMm: Math.max(widthMm, depthMm, heightMm), widthMm: [widthMm, depthMm, heightMm].sort((a, b) => b - a)[1], thicknessMm: t } },
  });

  // Exact sheet parts: the visible bed envelope is reconstructed from these
  // rails and deck panels by scene.v1, so render geometry and fabrication data
  // stay in sync.
  addPanel('carcass-left', 'Bed Carcass Left Side Panel', 0, 0, 0, t, totalD, platformH, 'carcass', COMPAT.carcass, 'CARCASS-SIDE-18MM', 'left');
  addPanel('carcass-right', 'Bed Carcass Right Side Panel', totalW - t, 0, 0, t, totalD, platformH, 'carcass', COMPAT.carcass, 'CARCASS-SIDE-18MM', 'right');
  addPanel('foot-rail', 'Storage Bed Foot Rail', t, totalD - t, 0, totalW - t * 2, t, platformH, 'carcass');
  addPanel('head-rail', 'Storage Bed Head Rail', t, 0, 0, totalW - t * 2, t, platformH, 'carcass');
  addPanel('centre-partition', 'Hydraulic Storage Centre Partition', totalW / 2 - t / 2, t, 0, t, totalD - t * 2, platformH - t, 'carcass');
  const deckGap = 4;
  const deckWidth = (totalW - t * 2 - deckGap) / 2;
  addPanel('deck-left', 'Hydraulic Bed Deck Left', t, t, platformH - t, deckWidth, totalD - t * 2, t, 'panel', COMPAT.panel, 'BED-DECK-18MM');
  addPanel('deck-right', 'Hydraulic Bed Deck Right', t + deckWidth + deckGap, t, platformH - t, deckWidth, totalD - t * 2, t, 'panel', COMPAT.panel, 'BED-DECK-18MM');
  addPanel('headboard-panel', 'Bed Headboard Panel', 0, 0, 0, totalW, t, headboardH, 'panel', COMPAT.panel, 'HEADBOARD-PANEL-18MM');
  if (p.headboardStyle === 'extended' || p.archetype === 'extended_headboard') {
    const wingWidth = Math.min(450, Math.max(300, Math.round(totalW * 0.22)));
    addPanel('headboard-wing-left', 'Extended Headboard Left Wing', -wingWidth, 0, 0, wingWidth, t, headboardH, 'panel', COMPAT.panel, 'HEADBOARD-WING-18MM');
    addPanel('headboard-wing-right', 'Extended Headboard Right Wing', totalW, 0, 0, wingWidth, t, headboardH, 'panel', COMPAT.panel, 'HEADBOARD-WING-18MM');
  }
  parts.push({ id: `${instanceId}-hydraulic-pair`, templateVersionId: input.templateVersionId, instanceId, name: 'Hydraulic Lift Mechanism Pair', transform: { xMm: totalW / 2, yMm: totalD / 2, zMm: platformH - 80, rotationDeg: 0 }, size: { widthMm: 40, depthMm: 420, heightMm: 80 }, anchor: { face: 'center' }, meta: { semanticType: 'hardware', parentId: null, materialSlot: { id: COMPAT.hardware, code: COMPAT.hardware, name: 'Hydraulic hardware' }, drawing: { layer: 'A-ANNO-HARDWARE', sortOrder: parts.length + 1 }, bom: { sku: 'HW-BED-HYDRAULIC-PAIR', qty: 1, unit: 'set' } } });
  parts.push(...compileLightingElements(input, { family: 'bed' }));
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: warning, parts, elements: parts };
}

// ── Utility (tall units + sink base) ────────────────────────
export function compileUtility(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'utility-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm, totalH = p.totalHeightMm ?? 2100, totalD = p.totalDepthMm ?? 600;
  const blocking: string[] = []; if (totalW > wallW) blocking.push(`Utility width ${totalW}mm exceeds wall ${wallW}mm.`);
  const parts = baseParts(input, instanceId, wallW, wallH, totalW, totalH, totalD, COMPAT.carcass, COMPAT.shutter);
  const shutterCount = p.shutterCount ?? Math.max(2, Math.round(totalW / TARGET_SHUTTER_WIDTH_MM));
  const shutterW = totalW / shutterCount; const shutterH = totalH - DEFAULT_CARCASS_THICKNESS_MM * 2;
  for (let i = 0; i < shutterCount; i++) parts.push(...shutterRow(instanceId, input.templateVersionId, i, i * shutterW, shutterW, shutterH, DEFAULT_CARCASS_THICKNESS_MM, COMPAT.shutter, totalD));
  // tall filler at top
  parts.push({ id: `${instanceId}-filler`, templateVersionId: input.templateVersionId, instanceId, name: 'Top Filler', transform: { xMm: 0, yMm: 0, zMm: totalH - 50, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: 50 }, anchor: { face: 'top' }, meta: { semanticType: 'filler', parentId: null, materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Filler' }, drawing: { layer: 'A-MOD-FILLER', sortOrder: 1 }, bom: { sku: 'FILLER-50MM', qty: 1, unit: 'sqm', lengthMm: totalW, heightMm: 50 } } });
  parts.push(...compileLightingElements(input, { family: 'utility' }));
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: [], parts, elements: parts };
}

// ── Freestanding Lighting (Floor, Table, Pendant, Sconce Luminaires) ──
export function compileFreestandingLighting(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'freestanding-light-1';
  const totalW = Number(p.totalWidthMm ?? p.widthMm ?? 400);
  const totalD = Number(p.totalDepthMm ?? p.depthMm ?? 400);
  const totalH = Number(p.totalHeightMm ?? p.heightMm ?? 1600);
  const parts: Part[] = [
    {
      id: `${instanceId}-base-stand`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Luminaire Base & Stand',
      transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 },
      size: { widthMm: totalW, depthMm: totalD, heightMm: Math.min(60, totalH * 0.05) },
      anchor: { face: 'bottom' },
      meta: {
        semanticType: 'hardware',
        parentId: null,
        materialSlot: { id: 'mat-metal-brass', code: 'BRASS', name: 'Luminaire Body' },
        drawing: { layer: 'A-ANNO-LIGHTING', sortOrder: 1 },
        bom: { sku: 'LUMINAIRE-STAND', qty: 1, unit: 'pc', heightMm: totalH },
      },
    },
    ...compileLightingElements(input, { family: 'freestanding-lighting' }),
  ];
  return {
    templateVersionId: input.templateVersionId,
    instanceId,
    valid: true,
    blockingViolations: [],
    warningViolations: [],
    parts,
    elements: parts,
  };
}

// ── Island (Kitchen Breakfast Waterfall & Wardrobe Dressing Islands) ──
export function compileIsland(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'island-1';
  const totalW = Number(p.totalWidthMm ?? 1800);
  const totalH = Number(p.totalHeightMm ?? 850);
  const totalD = Number(p.totalDepthMm ?? 900);
  const isDressing = Boolean(
    p.islandType === 'dressing' ||
    p.archetype === 'dressing_island' ||
    p.archetype === 'jewellery_island' ||
    input.templateVersionId?.includes('wardrobe') ||
    input.templateVersionId?.includes('jewellery')
  );

  const t = DEFAULT_CARCASS_THICKNESS_MM;
  const parts: Part[] = [];
  const blocking: string[] = [];
  const warning: string[] = [];

  const overhangMm = Number(p.overhangMm ?? 300);
  const drawerCount = Number(p.drawerCount ?? 3);
  for (const [name, value] of [['width', totalW], ['height', totalH], ['depth', totalD]] as const) {
    if (!Number.isFinite(value) || value <= 0) blocking.push(`Island ${name} must be a finite positive millimetre value.`);
  }
  if (totalW < 600) blocking.push(`Island width ${totalW}mm is too narrow for modular fabrication.`);
  if (totalD < 600) blocking.push('Island depth must be at least 600mm.');
  if (totalH < 300) blocking.push('Island height must be at least 300mm.');
  if (totalW > input.wall.widthMm) blocking.push('Finished island width exceeds the available width.');
  if (totalH > input.wall.heightMm) blocking.push('Finished island height exceeds the available height.');
  if (!isDressing && (!Number.isFinite(overhangMm) || overhangMm < 250 || totalD - overhangMm < 300)) {
    blocking.push('Island overhang must be finite, at least 250mm, and leave at least 300mm storage depth.');
  }
  if (isDressing && (!Number.isSafeInteger(drawerCount) || drawerCount < 2 || drawerCount > 12 || (totalH - 140 - t) / drawerCount <= 4)) {
    blocking.push('Dressing island requires 2–12 whole drawers with positive clear height.');
  }
  // Bound emitted geometry and loop counts before constructing parts.
  if (totalW > 12000 || totalD > 12000 || totalH > 6000) blocking.push('Island dimensions exceed the supported compiler envelope (12000 × 12000 × 6000mm).');
  if (blocking.length) return { templateVersionId: input.templateVersionId, instanceId, valid: false, blockingViolations: blocking, warningViolations: warning, parts: [], elements: [] };

  if (isDressing) {
    // ── Luxury Dressing Island (Glass top reveal + velvet jewellery organizers + tandem drawers) ──
    parts.push({
      id: `${instanceId}-carcass-bottom`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Dressing Island Base Panel',
      transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 },
      size: { widthMm: totalW, depthMm: totalD, heightMm: t },
      anchor: { face: 'bottom' },
      meta: {
        semanticType: 'carcass',
        parentId: null,
        materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Carcass Bottom' },
        drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
        bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: t },
      },
    });
    parts.push({
      id: `${instanceId}-carcass-left`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Dressing Island Left Gable',
      transform: { xMm: 0, yMm: 0, zMm: t, rotationDeg: 0 },
      size: { widthMm: t, depthMm: totalD, heightMm: totalH - t - 30 },
      anchor: { face: 'left' },
      meta: {
        semanticType: 'carcass',
        parentId: null,
        materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Carcass Side' },
        drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
        bom: { sku: 'CARCASS-SIDE-18MM', qty: 1, unit: 'pc', lengthMm: totalD, widthMm: totalH - t - 30, thicknessMm: t },
      },
    });
    parts.push({
      id: `${instanceId}-carcass-right`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Dressing Island Right Gable',
      transform: { xMm: totalW - t, yMm: 0, zMm: t, rotationDeg: 0 },
      size: { widthMm: t, depthMm: totalD, heightMm: totalH - t - 30 },
      anchor: { face: 'right' },
      meta: {
        semanticType: 'carcass',
        parentId: null,
        materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Carcass Side' },
        drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
        bom: { sku: 'CARCASS-SIDE-18MM', qty: 1, unit: 'pc', lengthMm: totalD, widthMm: totalH - t - 30, thicknessMm: t },
      },
    });
    parts.push({
      id: `${instanceId}-carcass-divider`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Dressing Island Centre Divider',
      transform: { xMm: totalW / 2 - t / 2, yMm: 0, zMm: t, rotationDeg: 0 },
      size: { widthMm: t, depthMm: totalD, heightMm: totalH - t - 30 },
      anchor: { face: 'center' },
      meta: {
        semanticType: 'carcass',
        parentId: null,
        materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Carcass Partition' },
        drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
        bom: { sku: 'CARCASS-PARTITION-18MM', qty: 1, unit: 'pc', lengthMm: totalD, widthMm: totalH - t - 30, thicknessMm: t },
      },
    });

    const glassThickness = 10;
    parts.push({
      id: `${instanceId}-glass-top`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Ultra-Clear Toughened Glass Display Top',
      transform: { xMm: 0, yMm: 0, zMm: totalH - glassThickness, rotationDeg: 0 },
      size: { widthMm: totalW, depthMm: totalD, heightMm: glassThickness },
      anchor: { face: 'top' },
      meta: {
        semanticType: 'glass',
        parentId: null,
        materialSlot: { id: COMPAT.glass, code: COMPAT.glass, name: 'Toughened Glass Top' },
        drawing: { layer: 'A-MOD-GLASS', sortOrder: 5 },
        bom: { sku: 'GLASS-TOP-TOUGHENED-10MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: glassThickness },
      },
    });
    parts.push({
      id: `${instanceId}-glass-reveal-profile`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Brushed Brass Recessed Reveal Lip Profile',
      transform: { xMm: 0, yMm: 0, zMm: totalH - 30, rotationDeg: 0 },
      size: { widthMm: totalW, depthMm: totalD, heightMm: 20 },
      anchor: { face: 'top' },
      meta: {
        semanticType: 'profile',
        parentId: null,
        materialSlot: { id: 'mat-brass-satin', code: 'BRASS', name: 'Profile Reveal' },
        drawing: { layer: 'A-MOD-PROFILE', sortOrder: 4 },
        bom: { sku: 'ALU-REVEAL-PROFILE', qty: 1, unit: 'pc', lengthMm: (totalW + totalD) * 2 },
      },
    });

    const bayW = (totalW - t * 3) / 2;
    for (let bay = 0; bay < 2; bay++) {
      const bayX = t + bay * (bayW + t);
      parts.push({
        id: `${instanceId}-jewellery-organizer-bay-${bay + 1}`,
        templateVersionId: input.templateVersionId,
        instanceId,
        name: `Velvet-Lined Jewellery & Watch Organiser Bay ${bay + 1}`,
        transform: { xMm: bayX, yMm: 20, zMm: totalH - 120, rotationDeg: 0 },
        size: { widthMm: bayW, depthMm: totalD - 40, heightMm: 80 },
        anchor: { face: 'front' },
        meta: {
          semanticType: 'drawer',
          parentId: `${instanceId}-carcass-bottom`,
          materialSlot: { id: 'mat-velvet-slate', code: 'VELVET', name: 'Jewellery Velvet Insert' },
          drawing: { layer: 'A-MOD-DRAWER', sortOrder: 3 },
          bom: { sku: 'JEWELLERY-VELVET-ORGANIZER', qty: 1, unit: 'set', lengthMm: bayW, widthMm: totalD - 40, heightMm: 80 },
        },
      });

      const lowerDrawerCount = drawerCount;
      const remainingH = totalH - 140 - t;
      const lowerDrawerH = remainingH / lowerDrawerCount;
      for (let d = 0; d < lowerDrawerCount; d++) {
        parts.push({
          id: `${instanceId}-tandem-drawer-bay-${bay + 1}-${d + 1}`,
          templateVersionId: input.templateVersionId,
          instanceId,
          name: `Soft-Close Tandem Drawer Bay ${bay + 1} Tier ${d + 1}`,
          transform: { xMm: bayX, yMm: 0, zMm: t + d * lowerDrawerH, rotationDeg: 0 },
          size: { widthMm: bayW, depthMm: totalD - 30, heightMm: lowerDrawerH - 4 },
          anchor: { face: 'front' },
          meta: {
            semanticType: 'drawer',
            parentId: `${instanceId}-carcass-bottom`,
            materialSlot: { id: COMPAT.shutter, code: COMPAT.shutter, name: 'Drawer Front' },
            drawing: { layer: 'A-MOD-DRAWER', sortOrder: 3 },
            bom: { sku: 'WARDROBE-TANDEM-DRAWER', qty: 1, unit: 'pc', lengthMm: bayW, widthMm: totalD - 30, heightMm: lowerDrawerH - 4, thicknessMm: t },
          },
        });
      }
    }
    parts.push(...compileLightingElements(input, { family: 'wardrobe' }));
  } else {
    // ── Gourmet Kitchen / Breakfast Island with Waterfall Stone & Stool Overhang ──
    const storageDepth = totalD - overhangMm;
    const stoneThick = 40;
    const baseH = totalH - stoneThick;
    // Declared width is the FINISHED envelope, including both stone legs.
    const carcassW = totalW - 2 * stoneThick;

    parts.push({
      id: `${instanceId}-island-base`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Island Carcass Base Bottom',
      transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 },
      size: { widthMm: carcassW, depthMm: storageDepth, heightMm: t },
      anchor: { face: 'bottom' },
      meta: {
        semanticType: 'carcass',
        parentId: null,
        materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Island Base' },
        drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
        bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: carcassW, widthMm: storageDepth, thicknessMm: t },
      },
    });

    parts.push({
      id: `${instanceId}-carcass-left`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Island Carcass Left Gable',
      transform: { xMm: 0, yMm: 0, zMm: t, rotationDeg: 0 },
      size: { widthMm: t, depthMm: storageDepth, heightMm: baseH - t },
      anchor: { face: 'left' },
      meta: {
        semanticType: 'carcass',
        parentId: null,
        materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Carcass Side' },
        drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
        bom: { sku: 'CARCASS-SIDE-18MM', qty: 1, unit: 'pc', lengthMm: storageDepth, widthMm: baseH - t, thicknessMm: t },
      },
    });
    parts.push({
      id: `${instanceId}-carcass-right`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Island Carcass Right Gable',
      transform: { xMm: carcassW - t, yMm: 0, zMm: t, rotationDeg: 0 },
      size: { widthMm: t, depthMm: storageDepth, heightMm: baseH - t },
      anchor: { face: 'right' },
      meta: {
        semanticType: 'carcass',
        parentId: null,
        materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Carcass Side' },
        drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
        bom: { sku: 'CARCASS-SIDE-18MM', qty: 1, unit: 'pc', lengthMm: storageDepth, widthMm: baseH - t, thicknessMm: t },
      },
    });

    parts.push({
      id: `${instanceId}-island-divider`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Double-Sided Carcass Dividing Spine',
      transform: { xMm: t, yMm: storageDepth - t, zMm: t, rotationDeg: 0 },
      size: { widthMm: carcassW - t * 2, depthMm: t, heightMm: baseH - t },
      anchor: { face: 'back' },
      meta: {
        semanticType: 'carcass',
        parentId: null,
        materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Divider Spine' },
        drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 },
        bom: { sku: 'CARCASS-SPINE-18MM', qty: 1, unit: 'sqm', lengthMm: carcassW - t * 2, widthMm: baseH - t, thicknessMm: t },
      },
    });

    const bayCount = Math.max(2, Math.round(carcassW / 600));
    const bayW = (carcassW - (bayCount + 1) * t) / bayCount;
    for (let b = 0; b < bayCount; b++) {
      const bX = t + b * (bayW + t);
      const drawerH = (baseH - t * 2) / 2;
      for (let d = 0; d < 2; d++) {
        parts.push({
          id: `${instanceId}-front-drawer-${b + 1}-${d + 1}`,
          templateVersionId: input.templateVersionId,
          instanceId,
          name: `Island Prep Tandem Drawer Bay ${b + 1} Tier ${d + 1}`,
          transform: { xMm: bX, yMm: 0, zMm: t + d * drawerH, rotationDeg: 0 },
          size: { widthMm: bayW, depthMm: storageDepth - 40, heightMm: drawerH - 4 },
          anchor: { face: 'front' },
          meta: {
            semanticType: 'drawer',
            parentId: `${instanceId}-island-base`,
            materialSlot: { id: COMPAT.shutter, code: COMPAT.shutter, name: 'Drawer Front' },
            drawing: { layer: 'A-MOD-DRAWER', sortOrder: 2 },
            bom: { sku: 'ISLAND-TANDEM-DRAWER', qty: 1, unit: 'pc', lengthMm: bayW, widthMm: storageDepth - 40, heightMm: drawerH - 4, thicknessMm: t },
          },
        });
      }
    }

    // Move carcass into the clear space between the stone legs.
    for (const part of parts) part.transform.xMm += stoneThick;
    // Waterfall Countertop Slabs (butt joint; no unmodelled mitre claim).
    parts.push({
      id: `${instanceId}-countertop-top`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: '40mm Waterfall Sintered Stone Top Slab',
      transform: { xMm: 0, yMm: 0, zMm: baseH, rotationDeg: 0 },
      size: { widthMm: totalW, depthMm: totalD, heightMm: stoneThick },
      anchor: { face: 'top' },
      meta: {
        semanticType: 'countertop',
        parentId: null,
        materialSlot: { id: COMPAT.counter, code: COMPAT.counter, name: 'Countertop Stone' },
        drawing: { layer: 'A-MOD-COUNTER', sortOrder: 4 },
        bom: { sku: 'SINTERED-WATERFALL-TOP-40MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: stoneThick },
      },
    });

    parts.push({
      id: `${instanceId}-countertop-waterfall-left`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Left Vertical Waterfall Stone Slab',
      transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 },
      size: { widthMm: stoneThick, depthMm: totalD, heightMm: baseH },
      anchor: { face: 'left' },
      meta: {
        semanticType: 'countertop',
        parentId: null,
        materialSlot: { id: COMPAT.counter, code: COMPAT.counter, name: 'Waterfall Slab' },
        drawing: { layer: 'A-MOD-COUNTER', sortOrder: 4 },
        bom: { sku: 'SINTERED-WATERFALL-LEG-40MM', qty: 1, unit: 'sqm', lengthMm: totalD, widthMm: baseH, thicknessMm: stoneThick },
      },
    });

    parts.push({
      id: `${instanceId}-countertop-waterfall-right`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: 'Right Vertical Waterfall Stone Slab',
      transform: { xMm: totalW - stoneThick, yMm: 0, zMm: 0, rotationDeg: 0 },
      size: { widthMm: stoneThick, depthMm: totalD, heightMm: baseH },
      anchor: { face: 'right' },
      meta: {
        semanticType: 'countertop',
        parentId: null,
        materialSlot: { id: COMPAT.counter, code: COMPAT.counter, name: 'Waterfall Slab' },
        drawing: { layer: 'A-MOD-COUNTER', sortOrder: 4 },
        bom: { sku: 'SINTERED-WATERFALL-LEG-40MM', qty: 1, unit: 'sqm', lengthMm: totalD, widthMm: baseH, thicknessMm: stoneThick },
      },
    });

    // Cantilever Overhang Supports
    parts.push({
      id: `${instanceId}-overhang-supports`,
      templateVersionId: input.templateVersionId,
      instanceId,
      name: '300mm Breakfast Stool Cantilever Steel Support Rails',
      transform: { xMm: 100, yMm: storageDepth, zMm: baseH - 40, rotationDeg: 0 },
      size: { widthMm: totalW - 200, depthMm: overhangMm - 20, heightMm: 30 },
      anchor: { face: 'center' },
      meta: {
        semanticType: 'hardware',
        parentId: null,
        materialSlot: { id: COMPAT.hardware, code: COMPAT.hardware, name: 'Structural Cleats' },
        drawing: { layer: 'A-ANNO-HARDWARE', sortOrder: 5 },
        bom: { sku: 'HW-ISLAND-OVERHANG-BRACKET', qty: 2, unit: 'pc', lengthMm: overhangMm },
      },
    });
    parts.push(...compileLightingElements(input, { family: 'kitchen' }));
  }

  return {
    templateVersionId: input.templateVersionId,
    instanceId,
    valid: blocking.length === 0,
    blockingViolations: blocking,
    warningViolations: warning,
    parts,
    elements: parts,
  };
}

export const COMPILER_REGISTRY: Record<CategoryType, (input: TemplateCompileInput) => TemplateCompileResult> = {
  tv_unit: (i) => compileTvUnitFromRegistry(i),
  wardrobe: compileWardrobe,
  crockery_unit: compileCrockery,
  study_unit: compileStudy,
  pooja_unit: compilePooja,
  kitchen: compileKitchen,
  bed: compileBed,
  utility: compileUtility,
  freestanding_lighting: compileFreestandingLighting,
  island: compileIsland,
};

// re-import to avoid circular at top
import { compileTvUnit } from './tv-unit-compiler.js';
function compileTvUnitFromRegistry(i: TemplateCompileInput) { return compileTvUnit(i); }

export type ModuleCompiler = (input: TemplateCompileInput) => TemplateCompileResult;

