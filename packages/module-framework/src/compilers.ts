/**
 * module-framework — parametric compilers for the 7 remaining module families.
 * Each compiler returns a TemplateCompileResult with deterministic parts:
 * carcass, shutters, drawers, shelves, fillers, panels, glass, profiles,
 * countertops, hardware placeholders, lighting anchors.
 *
 * The TV-unit compiler lives in tv-unit-compiler.ts (the first vertical template).
 */
import { Part, TemplateCompileInput, TemplateCompileResult, type CategoryType } from './types.js';
import {
  DEFAULT_CARCASS_THICKNESS_MM, DEFAULT_BACK_PANEL_THICKNESS_MM, DEFAULT_SHELF_THICKNESS_MM,
  DEFAULT_DRAWER_HEIGHT_MM, DEFAULT_WARDROBE_DEPTH_MM, TARGET_SHUTTER_WIDTH_MM,
} from './constants.js';

function baseParts(input: TemplateCompileInput, instanceId: string, wallW: number, wallH: number, totalW: number, totalH: number, totalD: number, carcassMat: string, shutterMat: string): Part[] {
  const t = DEFAULT_CARCASS_THICKNESS_MM;
  const bp = DEFAULT_BACK_PANEL_THICKNESS_MM;
  const parts: Part[] = [
    { id: `${instanceId}-carcass-bottom`, templateVersionId: input.templateVersionId, instanceId, name: 'Carcass Bottom Panel', transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: t }, anchor: { face: 'bottom' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: carcassMat, code: carcassMat, name: 'Carcass' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: t } } },
    { id: `${instanceId}-carcass-top`, templateVersionId: input.templateVersionId, instanceId, name: 'Carcass Top Panel', transform: { xMm: 0, yMm: 0, zMm: totalH - t, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: t }, anchor: { face: 'top' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: carcassMat, code: carcassMat, name: 'Carcass' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: t } } },
    { id: `${instanceId}-back-panel`, templateVersionId: input.templateVersionId, instanceId, name: 'Back Panel', transform: { xMm: 0, yMm: totalD - bp, zMm: 0, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: bp, heightMm: totalH }, anchor: { face: 'back' }, meta: { semanticType: 'back_panel', parentId: null, materialSlot: { id: carcassMat, code: carcassMat, name: 'Back Panel' }, drawing: { layer: 'A-MOD-BACK', sortOrder: 0 }, bom: { sku: 'BACK-6MM', qty: 1, unit: 'sqm', lengthMm: totalW, heightMm: totalH, thicknessMm: bp } } },
  ];
  return parts;
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
  const instanceId = input.instanceId ?? 'wardrobe-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm, totalH = p.totalHeightMm ?? 2400, totalD = p.totalDepthMm ?? DEFAULT_WARDROBE_DEPTH_MM;
  const blocking: string[] = []; const warning: string[] = [];
  if (totalW > wallW) blocking.push(`Wardrobe width ${totalW}mm exceeds wall ${wallW}mm.`);
  if (totalH > wallH) blocking.push(`Wardrobe height ${totalH}mm exceeds wall ${wallH}mm.`);
  if (totalD < 550) warning.push('Wardrobe depth < 550mm restricts shutter opening.');
  const parts = baseParts(input, instanceId, wallW, wallH, totalW, totalH, totalD, COMPAT.carcass, COMPAT.shutter);
  const shutterCount = p.shutterCount ?? Math.max(2, Math.round(totalW / TARGET_SHUTTER_WIDTH_MM));
  const shutterW = totalW / shutterCount; const shutterH = totalH - DEFAULT_CARCASS_THICKNESS_MM * 2;
  for (let i = 0; i < shutterCount; i++) parts.push(...shutterRow(instanceId, input.templateVersionId, i, i * shutterW, shutterW, shutterH, DEFAULT_CARCASS_THICKNESS_MM, COMPAT.shutter, totalD));
  // internal shelf + hanging rod (shelf semantic)
  parts.push({ id: `${instanceId}-shelf-1`, templateVersionId: input.templateVersionId, instanceId, name: 'Internal Shelf', transform: { xMm: DEFAULT_CARCASS_THICKNESS_MM, yMm: DEFAULT_CARCASS_THICKNESS_MM, zMm: totalH / 2, rotationDeg: 0 }, size: { widthMm: totalW - DEFAULT_CARCASS_THICKNESS_MM * 2, depthMm: totalD - DEFAULT_CARCASS_THICKNESS_MM * 2, heightMm: DEFAULT_SHELF_THICKNESS_MM }, anchor: { face: 'center' }, meta: { semanticType: 'shelf', parentId: `${instanceId}-carcass-bottom`, materialSlot: { id: COMPAT.shelf, code: COMPAT.shelf, name: 'Shelf' }, drawing: { layer: 'A-MOD-SHELF', sortOrder: 2 }, bom: { sku: 'SHELF-18MM', qty: 1, unit: 'sqm', lengthMm: totalW - 36, widthMm: totalD - 36, thicknessMm: DEFAULT_SHELF_THICKNESS_MM } } });
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: warning, parts };
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
  const parts: Part[] = [];
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
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: warning, parts };
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
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: [], parts };
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
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: [], parts };
}

// ── Kitchen (base + upper + countertop) ─────────────────────
export function compileKitchen(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'kitchen-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm, baseH = p.baseHeightMm ?? 900, totalD = p.totalDepthMm ?? 600, upperH = p.upperHeightMm ?? 720;
  const blocking: string[] = []; const warning: string[] = [];
  if (totalW > wallW) blocking.push(`Kitchen width ${totalW}mm exceeds wall ${wallW}mm.`);
  const parts: Part[] = [];
  // base carcass + shutters
  parts.push({ id: `${instanceId}-base-carcass`, templateVersionId: input.templateVersionId, instanceId, name: 'Base Carcass', transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: baseH }, anchor: { face: 'bottom' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Base Carcass' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: DEFAULT_CARCASS_THICKNESS_MM } } });
  const baseShutters = p.baseShutterCount ?? Math.max(2, Math.round(totalW / TARGET_SHUTTER_WIDTH_MM));
  const bsW = totalW / baseShutters;
  for (let i = 0; i < baseShutters; i++) parts.push(...shutterRow(instanceId, input.templateVersionId, i, i * bsW, bsW, baseH - DEFAULT_CARCASS_THICKNESS_MM, DEFAULT_CARCASS_THICKNESS_MM, COMPAT.shutter, totalD));
  // countertop
  parts.push({ id: `${instanceId}-countertop`, templateVersionId: input.templateVersionId, instanceId, name: 'Countertop', transform: { xMm: 0, yMm: 0, zMm: baseH, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: 40 }, anchor: { face: 'top' }, meta: { semanticType: 'countertop', parentId: `${instanceId}-base-carcass`, materialSlot: { id: COMPAT.counter, code: COMPAT.counter, name: 'Countertop' }, drawing: { layer: 'A-MOD-COUNTER', sortOrder: 4 }, bom: { sku: 'QUARTZ-40MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD, thicknessMm: 40 } } });
  // upper cabinets
  parts.push({ id: `${instanceId}-upper-carcass`, templateVersionId: input.templateVersionId, instanceId, name: 'Upper Carcass', transform: { xMm: 0, yMm: 0, zMm: baseH + 100, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD - 300, heightMm: upperH }, anchor: { face: 'top' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Upper Carcass' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'CARCASS-18MM', qty: 1, unit: 'sqm', lengthMm: totalW, widthMm: totalD - 300, thicknessMm: DEFAULT_CARCASS_THICKNESS_MM } } });
  if (!input.wall.id && warning.length === 0) warning.push('Kitchen requires plumbing service point.');
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: warning, parts };
}

// ── Bed (bed base + headboard) ──────────────────────────────
export function compileBed(input: TemplateCompileInput): TemplateCompileResult {
  const p = input.parameters as any;
  const instanceId = input.instanceId ?? 'bed-1';
  const wallW = input.wall.widthMm, wallH = input.wall.heightMm;
  const totalW = p.totalWidthMm ?? 1600, totalH = p.totalHeightMm ?? 450, totalD = p.totalDepthMm ?? 2000;
  const blocking: string[] = []; if (totalW > wallW) blocking.push(`Bed width ${totalW}mm exceeds wall ${wallW}mm.`);
  const parts: Part[] = [];
  parts.push({ id: `${instanceId}-base`, templateVersionId: input.templateVersionId, instanceId, name: 'Bed Base', transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: totalD, heightMm: totalH }, anchor: { face: 'bottom' }, meta: { semanticType: 'carcass', parentId: null, materialSlot: { id: COMPAT.carcass, code: COMPAT.carcass, name: 'Bed Base' }, drawing: { layer: 'A-MOD-CARCASS', sortOrder: 1 }, bom: { sku: 'BED-BASE', qty: 1, unit: 'pc', lengthMm: totalW, widthMm: totalD, thicknessMm: totalH } } });
  parts.push({ id: `${instanceId}-headboard`, templateVersionId: input.templateVersionId, instanceId, name: 'Headboard', transform: { xMm: 0, yMm: 0, zMm: 0, rotationDeg: 0 }, size: { widthMm: totalW, depthMm: 80, heightMm: 1100 }, anchor: { face: 'back' }, meta: { semanticType: 'panel', parentId: `${instanceId}-base`, materialSlot: { id: COMPAT.panel, code: COMPAT.panel, name: 'Headboard' }, drawing: { layer: 'A-MOD-PANEL', sortOrder: 5 }, bom: { sku: 'HEADBOARD', qty: 1, unit: 'pc', lengthMm: totalW, heightMm: 1100, thicknessMm: 80 } } });
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: [], parts };
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
  return { templateVersionId: input.templateVersionId, instanceId, valid: blocking.length === 0, blockingViolations: blocking, warningViolations: [], parts };
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
};

// re-import to avoid circular at top
import { compileTvUnit } from './tv-unit-compiler.js';
function compileTvUnitFromRegistry(i: TemplateCompileInput) { return compileTvUnit(i); }

export type ModuleCompiler = (input: TemplateCompileInput) => TemplateCompileResult;
