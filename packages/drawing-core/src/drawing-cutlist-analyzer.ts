/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ULTIDA DRAWING CUTLIST ANALYZER & HARDWARE JOB LIST ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Authoritative 2D Drawing-to-Cutlist generator conforming to System 32
 * Indian modular woodworking and architectural manufacturing standards.
 *
 * Takes 2D drawings (External elevation + Internal joinery section) as input,
 * deeply analyzes carcass anatomy, shutter reveals, shelf patterns, and
 * generates an exact panel cutlist and full hardware job schedule.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { SceneV1, SceneModuleV1 } from './scene-types.js';
import { z } from 'zod';

export type GrainDirection = 'horizontal' | 'vertical' | 'none';
export type CabinetDimensionUnit = 'mm' | 'cm' | 'm' | 'ft' | 'in';

/** Convert an explicitly unit-labelled dimension to millimetres. Fractional mm
 * are retained here; fabrication rows are rounded only when cut dimensions are emitted. */
export function cabinetDimensionToMm(value: number, unit: CabinetDimensionUnit): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError('Cabinet dimensions must be positive finite numbers.');
  const factor: Record<CabinetDimensionUnit, number> = { mm: 1, cm: 10, m: 1000, ft: 304.8, in: 25.4 };
  return value * factor[unit];
}

export type CutlistPartSemanticType =
  | 'carcass_gable'
  | 'carcass_top_bottom'
  | 'carcass_divider'
  | 'shelf_fixed'
  | 'shelf_adjustable'
  | 'back_panel'
  | 'shutter'
  | 'drawer_fascia'
  | 'drawer_side'
  | 'drawer_back'
  | 'drawer_bottom'
  | 'dummy_filler'
  | 'skirting_fascia';

export interface AnalyzedCutlistPanel {
  id: string;
  partInstanceId: string;
  moduleId: string;
  roomId: string;
  semanticType: CutlistPartSemanticType;
  partName: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  quantity: number;
  materialCode: string;
  materialName?: string;
  grainDirection: GrainDirection;
  edging: string;
  edgeSchedule: {
    l1Mm: number;
    l2Mm: number;
    w1Mm: number;
    w2Mm: number;
    tapeType: string;
    tapeThicknessMm: number;
  };
  notes?: string;
  /** Bottom elevation from finished floor level for internal components. */
  installElevationsFromFloorMm?: number[];
  externalFaceFinishCode?: string;
  /** Surface materials are tracked separately from the substrate so laminate
   * sheets are not confused with the structural board cutlist. */
  faceFinishes?: Array<{ face: 'A' | 'B'; finishCode: string; areaSqm: number }>;
}

export interface LaminateTakeoff {
  finishCode: string;
  faceCount: number;
  netAreaSqm: number;
}

export interface AnalyzedHardwareItem {
  id: string;
  name: string;
  category: 'hinge' | 'slide' | 'fastener' | 'handle' | 'leg' | 'accessory';
  specification: string;
  quantity: number;
  unit: 'pcs' | 'pair' | 'set' | 'meter';
  assignedBay?: string;
  notes?: string;
}

export interface AnalyzedEdgeBandingSchedule {
  tapeType: string;
  tapeThicknessMm: number;
  totalMeters: number;
  application: string;
}

export interface SheetOptimizationEstimate {
  materialCode: string;
  thicknessMm: number;
  totalAreaSqm: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  estimatedSheets: number;
  yieldEfficiencyPercent: number;
}

export interface DrawingCutlistAuditIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location?: string;
}

export interface DrawingBaySpec {
  id?: string;
  label?: string;
  widthMm: number;
  type?: 'wardrobe-shelves' | 'wardrobe-hanging' | 'drawers' | 'base-cabinet' | 'overhead' | 'open-niche' | 'custom';
  shelvesCount?: number;
  adjustableShelvesCount?: number;
  drawerCount?: number;
  hasHangingRod?: boolean;
  shutterType?: 'single-door' | 'double-door' | 'sliding' | 'open' | 'glass-profile' | 'fluted';
  /** Clear vertical hanging height, measured from drawer-bank top to underside of its cap shelf. */
  hangingClearHeightMm?: number;
  /** Nominal drawer-front module pitch; visible fascia is reduced by reveal gaps. */
  drawerFrontHeightMm?: number;
  /** Extra shelf panels above the hanging-cap shelf, distributed in the remaining top zone. */
  shelvesInRemainderZone?: number;
}

export interface WardrobeBayVerticalSchedule {
  bayId: string;
  clearBayWidthMm: number;
  drawerCount: number;
  drawerFrontHeightMm: number;
  drawerBankBottomMm: number;
  drawerBankTopMm: number;
  hangingClearHeightMm: number;
  hangingClearBottomMm: number;
  hangingClearTopMm: number;
  hangingRodElevationMm: number | null;
  shelfBottomElevationsMm: number[];
  remainingShelfZoneHeightMm: number;
}

export interface DrawingCutlistInput {
  unitId?: string;
  unitTitle?: string;
  roomId?: string;
  wallId?: string;
  overallWidthMm: number;
  overallHeightMm: number;
  depthMm: number;
  plinthHeightMm?: number;
  loftHeightMm?: number;
  bays: DrawingBaySpec[];
  carcassCoreMaterial?: string;
  shutterCoreMaterial?: string;
  externalFinishCodeA?: string;
  externalFinishCodeB?: string;
  internalFinishCode?: string;
  backPanelMaterial?: string;
  drawerBottomMaterial?: string;
  drawerBottomThicknessMm?: number;
  carcassThicknessMm?: number;
  backPanelThicknessMm?: number;
  backPanelMount?: 'captured-groove' | 'overlay-structural';
  assumptions?: string[];
  shutterThicknessMm?: number;
  dummyFillerLeftMm?: number;
  dummyFillerRightMm?: number;
  revealGapMm?: number;
}

export interface DrawingCutlistAnalysisResult {
  unitId: string;
  unitTitle: string;
  roomId: string;
  wallId: string;
  overallWidthMm: number;
  overallHeightMm: number;
  depthMm: number;
  summary: {
    totalPanels: number;
    uniqueParts: number;
    totalAreaSqm: number;
    materialsCount: number;
    totalEdgeBandMeters: number;
    estimatedSheetsTotal: number;
  };
  panels: AnalyzedCutlistPanel[];
  hardware: AnalyzedHardwareItem[];
  edgeBanding: AnalyzedEdgeBandingSchedule[];
  sheetEstimates: SheetOptimizationEstimate[];
  laminateTakeoff: LaminateTakeoff[];
  wardrobeBaySchedules: WardrobeBayVerticalSchedule[];
  auditIssues: DrawingCutlistAuditIssue[];
}

/** Strict boundary for authenticated draft-workbook requests. */
export const DrawingCutlistInputSchema = z.object({
  unitId: z.string().max(120).optional(),
  unitTitle: z.string().max(180).optional(),
  roomId: z.string().max(120).optional(),
  wallId: z.string().max(120).optional(),
  overallWidthMm: z.number().finite().positive().max(12000),
  overallHeightMm: z.number().finite().positive().max(4000),
  depthMm: z.number().finite().positive().max(1800),
  plinthHeightMm: z.number().finite().min(0).max(500).optional(),
  loftHeightMm: z.number().finite().min(0).max(1800).optional(),
  bays: z.array(z.object({
    id: z.string().max(120).optional(), label: z.string().max(120).optional(),
    widthMm: z.number().finite().positive().max(12000),
    type: z.enum(['wardrobe-shelves', 'wardrobe-hanging', 'drawers', 'base-cabinet', 'overhead', 'open-niche', 'custom']).optional(),
    shelvesCount: z.number().int().min(0).max(30).optional(),
    adjustableShelvesCount: z.number().int().min(0).max(30).optional(),
    drawerCount: z.number().int().min(0).max(12).optional(),
    hasHangingRod: z.boolean().optional(),
    shutterType: z.enum(['single-door', 'double-door', 'sliding', 'open', 'glass-profile', 'fluted']).optional(),
    hangingClearHeightMm: z.number().finite().min(0).max(2500).optional(),
    drawerFrontHeightMm: z.number().finite().positive().max(500).optional(),
    shelvesInRemainderZone: z.number().int().min(0).max(8).optional(),
  }).strict()).min(1).max(12),
  carcassCoreMaterial: z.string().max(120).optional(), shutterCoreMaterial: z.string().max(120).optional(),
  externalFinishCodeA: z.string().max(120).optional(), externalFinishCodeB: z.string().max(120).optional(),
  internalFinishCode: z.string().max(120).optional(), backPanelMaterial: z.string().max(120).optional(),
  drawerBottomMaterial: z.string().max(120).optional(),
  drawerBottomThicknessMm: z.number().finite().positive().max(50).optional(),
  carcassThicknessMm: z.number().finite().positive().max(50).optional(),
  backPanelThicknessMm: z.number().finite().positive().max(50).optional(),
  backPanelMount: z.enum(['captured-groove', 'overlay-structural']).optional(),
  assumptions: z.array(z.string().max(300)).max(30).optional(),
  shutterThicknessMm: z.number().finite().positive().max(50).optional(),
  dummyFillerLeftMm: z.number().finite().min(0).max(1000).optional(),
  dummyFillerRightMm: z.number().finite().min(0).max(1000).optional(),
  revealGapMm: z.number().finite().min(0).max(10).optional(),
}).strict();

export function calculateHingesPerDoor(doorHeightMm: number): number {
  if (doorHeightMm <= 900) return 2;
  if (doorHeightMm <= 1600) return 3;
  if (doorHeightMm <= 2000) return 4;
  return 5;
}

export function analyze2DDrawingsToCutlist(input: DrawingCutlistInput): DrawingCutlistAnalysisResult {
  const unitId = input.unitId || 'unit-001';
  const unitTitle = input.unitTitle || 'Modular Cabinetry';
  const roomId = input.roomId || 'room-main';
  const wallId = input.wallId || 'wall-main';

  for (const [label, value] of [['width', input.overallWidthMm], ['height', input.overallHeightMm], ['depth', input.depthMm]] as const) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`Cabinet ${label} must be a positive measured dimension in millimetres.`);
  }
  const overallW = Math.round(input.overallWidthMm);
  const overallH = Math.round(input.overallHeightMm);
  const carcassDepth = Math.round(input.depthMm);
  const plinthH = input.plinthHeightMm ?? 100;
  const loftH = input.loftHeightMm ?? 0;

  const tCarcass = input.carcassThicknessMm ?? 18;
  const tBack = input.backPanelThicknessMm ?? 6;
  const backPanelMount = input.backPanelMount ?? (tBack === 18 ? 'overlay-structural' : 'captured-groove');
  const tShutter = input.shutterThicknessMm ?? 18;
  const reveal = input.revealGapMm ?? 2;
  const fillerL = input.dummyFillerLeftMm ?? 0;
  const fillerR = input.dummyFillerRightMm ?? 0;

  const matCarcass = input.carcassCoreMaterial || 'HDHMR-18-WHITE';
  const matLaminateA = input.externalFinishCodeA || '';
  const matLaminateB = input.externalFinishCodeB || matLaminateA;
  const matBack = input.backPanelMaterial || 'MDF-06-WHITE';
  const matDrawerBottom = input.drawerBottomMaterial || 'MDF-09-WHITE';
  const tDrawerBottom = input.drawerBottomThicknessMm ?? 9;

  const panels: AnalyzedCutlistPanel[] = [];
  const hardware: AnalyzedHardwareItem[] = [];
  const auditIssues: DrawingCutlistAuditIssue[] = [];
  for (const assumption of input.assumptions ?? []) {
    auditIssues.push({ severity: 'warning', code: 'DESIGN_ASSUMPTION_REQUIRES_CONFIRMATION', message: assumption });
  }
  if (unitId.startsWith('preset-')) {
    auditIssues.push({ severity: 'warning', code: 'PRESET_IS_NOT_SITE_MEASURED', message: 'Preset geometry is a design proposal, not a site-measured or construction-approved cutlist.' });
  }
  if (!input.externalFinishCodeA || !input.internalFinishCode) {
    auditIssues.push({ severity: 'warning', code: 'FINISH_CODE_UNCONFIRMED', message: 'Enter actual external and internal finish codes; no laminate material quantity is included for a missing finish.' });
  }
  if (input.bays.some((bay) => (bay.drawerCount ?? (bay.type === 'drawers' ? 3 : 0)) > 0) && !input.drawerBottomMaterial) {
    auditIssues.push({ severity: 'warning', code: 'DRAWER_BOTTOM_BOARD_ASSUMED', message: 'Drawer bottoms use a 9mm white MDF default. Confirm the drawer-bottom board code and thickness.' });
  }

  if (![6, 18].includes(tBack) || (tBack === 6 && backPanelMount !== 'captured-groove') || (tBack === 18 && backPanelMount !== 'overlay-structural')) {
    throw new RangeError('Choose a 6mm captured-groove back or an 18mm overlay structural back; other thickness/mount combinations need a separately engineered detail.');
  }
  if (![tCarcass, tShutter, tDrawerBottom].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Carcass and shutter board thicknesses must be positive finite measurements.');
  }
  if (![plinthH, loftH, fillerL, fillerR, reveal].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new RangeError('Plinth, loft, fillers, and reveal must be non-negative finite dimensions.');
  }

  const carcassWidth = overallW - fillerL - fillerR;
  if (carcassWidth <= tCarcass * 2) {
    auditIssues.push({
      severity: 'error',
      code: 'CARCASS_WIDTH_TOO_SMALL',
      message: `Overall width ${overallW}mm minus fillers (${fillerL}+${fillerR}mm) is smaller than gable thickness (${tCarcass * 2}mm).`,
    });
  }

  const mainCarcassHeight = overallH - plinthH;
  const baseCarcassH = loftH > 0 ? mainCarcassHeight - loftH : mainCarcassHeight;
  if (baseCarcassH <= tCarcass * 2 || carcassDepth <= (tBack === 18 ? tBack : 100)) {
    throw new RangeError('Cabinet dimensions leave no usable carcass after the selected board thicknesses.');
  }
  const carcassMemberDepth = tBack === 18 ? carcassDepth - tBack : carcassDepth;

  if (fillerL > 0) {
    panels.push({
      id: `${unitId}-filler-left`,
      partInstanceId: `${unitId}-FIL-L`,
      moduleId: unitId,
      roomId,
      semanticType: 'dummy_filler',
      partName: 'Left Wall Scribe / Dummy Filler',
      lengthMm: overallH,
      widthMm: fillerL,
      thicknessMm: tShutter,
      quantity: 1,
      materialCode: input.shutterCoreMaterial || matCarcass,
      externalFaceFinishCode: matLaminateA || undefined,
      grainDirection: 'vertical',
      edging: '1L (Front)',
      edgeSchedule: { l1Mm: overallH, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-2MM', tapeThicknessMm: 2 },
      notes: 'Scribe to site wall on installation',
    });
  }
  if (fillerR > 0) {
    panels.push({
      id: `${unitId}-filler-right`,
      partInstanceId: `${unitId}-FIL-R`,
      moduleId: unitId,
      roomId,
      semanticType: 'dummy_filler',
      partName: 'Right Wall Scribe / Dummy Filler',
      lengthMm: overallH,
      widthMm: fillerR,
      thicknessMm: tShutter,
      quantity: 1,
      materialCode: input.shutterCoreMaterial || matCarcass,
      externalFaceFinishCode: matLaminateA || undefined,
      grainDirection: 'vertical',
      edging: '1L (Front)',
      edgeSchedule: { l1Mm: overallH, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-2MM', tapeThicknessMm: 2 },
      notes: 'Scribe to site wall on installation',
    });
  }

  if (plinthH > 0) {
    panels.push({
      id: `${unitId}-skirting-fascia`,
      partInstanceId: `${unitId}-SKT-01`,
      moduleId: unitId,
      roomId,
      semanticType: 'skirting_fascia',
      partName: 'Plinth Skirting Fascia',
      lengthMm: carcassWidth,
      widthMm: plinthH,
      thicknessMm: tCarcass,
      quantity: 1,
      materialCode: input.shutterCoreMaterial || matCarcass,
      externalFaceFinishCode: matLaminateA || undefined,
      grainDirection: 'horizontal',
      edging: '1L (Top)',
      edgeSchedule: { l1Mm: carcassWidth, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
      notes: 'Detachable plinth cover with PVC clips',
    });

    const legsCount = Math.max(4, Math.ceil(carcassWidth / 600) * 2);
    hardware.push({
      id: `${unitId}-hw-plinth-legs`,
      name: 'Adjustable PVC Plinth Legs (100mm)',
      category: 'leg',
      specification: 'Height adjustable 95-120mm with screw base & skirting clips',
      quantity: legsCount,
      unit: 'pcs',
      notes: 'Supports cabinet base level on uneven site floors',
    });
  }

  panels.push(
    {
      id: `${unitId}-gable-left`,
      partInstanceId: `${unitId}-GBL-L`,
      moduleId: unitId,
      roomId,
      semanticType: 'carcass_gable',
      partName: 'Left Outer Gable',
      lengthMm: baseCarcassH,
      widthMm: carcassMemberDepth,
      thicknessMm: tCarcass,
      quantity: 1,
      materialCode: matCarcass,
      externalFaceFinishCode: matLaminateA || undefined,
      grainDirection: 'vertical',
      edging: '1L (Front exposed) + 1W (Bottom)',
      edgeSchedule: { l1Mm: baseCarcassH, l2Mm: 0, w1Mm: carcassMemberDepth, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
      notes: 'Pre-drilled System 32 32mm pitch line boring',
    },
    {
      id: `${unitId}-gable-right`,
      partInstanceId: `${unitId}-GBL-R`,
      moduleId: unitId,
      roomId,
      semanticType: 'carcass_gable',
      partName: 'Right Outer Gable',
      lengthMm: baseCarcassH,
      widthMm: carcassMemberDepth,
      thicknessMm: tCarcass,
      quantity: 1,
      materialCode: matCarcass,
      externalFaceFinishCode: matLaminateA || undefined,
      grainDirection: 'vertical',
      edging: '1L (Front exposed) + 1W (Bottom)',
      edgeSchedule: { l1Mm: baseCarcassH, l2Mm: 0, w1Mm: carcassMemberDepth, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
      notes: 'Pre-drilled System 32 32mm pitch line boring',
    }
  );

  const internalWidth = Math.max(0, carcassWidth - tCarcass * 2);
  const bottomPanelWidth = internalWidth;
  const bottomPanelDepth = carcassMemberDepth;

  panels.push(
    {
      id: `${unitId}-carcass-bottom`,
      partInstanceId: `${unitId}-BTM-01`,
      moduleId: unitId,
      roomId,
      semanticType: 'carcass_top_bottom',
      partName: 'Carcass Bottom Base Panel',
      lengthMm: bottomPanelWidth,
      widthMm: bottomPanelDepth,
      thicknessMm: tCarcass,
      quantity: 1,
      materialCode: matCarcass,
      grainDirection: 'horizontal',
      edging: '1L (Front)',
      edgeSchedule: { l1Mm: bottomPanelWidth, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
      notes: 'Carries floor load to plinth legs',
    },
    {
      id: `${unitId}-carcass-top`,
      partInstanceId: `${unitId}-TOP-01`,
      moduleId: unitId,
      roomId,
      semanticType: 'carcass_top_bottom',
      partName: loftH > 0 ? 'Carcass Mid/Top Separator Panel' : 'Carcass Top Ceiling Panel',
      lengthMm: bottomPanelWidth,
      widthMm: bottomPanelDepth,
      thicknessMm: tCarcass,
      quantity: 1,
      materialCode: matCarcass,
      grainDirection: 'horizontal',
      edging: '1L (Front)',
      edgeSchedule: { l1Mm: bottomPanelWidth, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
      notes: 'Fixed with Minifix cams & dowels',
    }
  );

  hardware.push({
    id: `${unitId}-hw-minifix-cams`,
    name: 'Minifix Connecting Bolts & Cams (15mm)',
    category: 'fastener',
    specification: 'Zinc die-cast 15mm cam + M6 steel connecting bolt',
    quantity: 16,
    unit: 'pcs',
    notes: 'Rigid knockdown joinery for top & bottom panels',
  });

  hardware.push({
    id: `${unitId}-hw-dowels`,
    name: 'Fluted Wooden Dowels (8x30mm)',
    category: 'fastener',
    specification: 'Pre-glued compressed beechwood',
    quantity: 16,
    unit: 'pcs',
    notes: 'Anti-shear alignment dowels',
  });

  const backPanelW = tBack === 6 ? bottomPanelWidth + 20 : carcassWidth;
  const backPanelH = tBack === 6 ? baseCarcassH - 10 : baseCarcassH;

  panels.push({
    id: `${unitId}-back-panel`,
    partInstanceId: `${unitId}-BCK-01`,
    moduleId: unitId,
    roomId,
    semanticType: 'back_panel',
    partName: tBack === 6 ? '6mm Carcass Back Panel (Captured in groove)' : '18mm Structural Back Panel (Overlay)',
    lengthMm: backPanelH,
    widthMm: backPanelW,
    thicknessMm: tBack,
    quantity: 1,
    materialCode: matBack,
    grainDirection: 'vertical',
    edging: tBack === 6 ? 'None (Captured in 10mm carcass groove)' : 'Rear perimeter edge, overlay fixing',
    edgeSchedule: { l1Mm: 0, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'NONE', tapeThicknessMm: 0 },
    notes: tBack === 6
      ? '6mm board captured in 10mm deep groove 20mm from rear edge; carcass depth remains unchanged.'
      : '18mm structural overlay; carcass members are shortened by 18mm so finished outside depth stays at the entered dimension.',
  });

  const bays = input.bays.length > 0 ? input.bays : [{ widthMm: internalWidth, type: 'wardrobe-shelves' as const }];
  const bayTotalW = bays.reduce((sum, b) => sum + b.widthMm, 0);

  const partitionsCount = Math.max(0, bays.length - 1);
  const expectedTotalWidth = bayTotalW + partitionsCount * tCarcass;

  if (Math.abs(expectedTotalWidth - internalWidth) > 5) {
    auditIssues.push({
      severity: 'error',
      code: 'BAY_WIDTH_MISMATCH',
      message: `Sum of bays (${bayTotalW}mm) + ${partitionsCount} partition(s) (${partitionsCount * tCarcass}mm) = ${expectedTotalWidth}mm, but internal carcass width is ${internalWidth}mm (difference: ${expectedTotalWidth - internalWidth}mm).`,
    });
  }

  if (!input.bays.length || input.bays.some((bay) => !Number.isFinite(bay.widthMm) || bay.widthMm <= 0)) {
    throw new RangeError('Add positive measured clear widths for every cabinet bay before generating a cutlist.');
  }
  if (Math.abs(expectedTotalWidth - internalWidth) > 0.5) {
    throw new RangeError(`Bay schedule is unresolved: clear bay widths plus dividers total ${expectedTotalWidth}mm, but usable internal width is ${internalWidth}mm. Adjust the bays before generating fabrication sizes.`);
  }

  const wardrobeBaySchedules = bays
    .map((bay, index) => resolveWardrobeBayVerticalSchedule(bay, index, input))
    .filter((schedule): schedule is WardrobeBayVerticalSchedule => schedule !== null);

  for (let i = 0; i < partitionsCount; i++) {
    panels.push({
      id: `${unitId}-partition-${i + 1}`,
      partInstanceId: `${unitId}-DIV-0${i + 1}`,
      moduleId: unitId,
      roomId,
      semanticType: 'carcass_divider',
      partName: `Internal Vertical Divider (Bay ${i + 1} / ${i + 2})`,
      lengthMm: baseCarcassH - tCarcass * 2,
      widthMm: carcassMemberDepth - 20,
      thicknessMm: tCarcass,
      quantity: 1,
      materialCode: matCarcass,
      grainDirection: 'vertical',
      edging: '1L (Front)',
      edgeSchedule: { l1Mm: baseCarcassH - tCarcass * 2, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
      notes: 'Double-sided System 32 5mm shelf pin holes',
    });

    hardware.push({
      id: `${unitId}-hw-partition-cams-${i + 1}`,
      name: 'Partition Minifix Cams & Dowels',
      category: 'fastener',
      specification: '8 cams + 8 dowels per partition',
      quantity: 16,
      unit: 'pcs',
      assignedBay: `Bay ${i + 1}`,
    });
  }

  let totalHingesCount = 0;
  let totalShelfPinsCount = 0;

  bays.forEach((bay, index) => {
    const bayNum = index + 1;
    const bayWidth = bay.widthMm;
    const shelfWidth = bayWidth - 2;
    const shelfDepth = carcassMemberDepth - 25;

    const verticalSchedule = wardrobeBaySchedules.find((schedule) => schedule.bayId === (bay.id ?? `bay-${bayNum}`));
    const fixedShelves = verticalSchedule
      ? verticalSchedule.shelfBottomElevationsMm.length
      : bay.shelvesCount ?? (bay.type === 'wardrobe-shelves' ? 1 : 0);
    const adjShelves = verticalSchedule ? 0 : bay.adjustableShelvesCount ?? (bay.type === 'wardrobe-shelves' ? 3 : 1);

    if (fixedShelves > 0) {
      panels.push({
        id: `${unitId}-bay${bayNum}-fixed-shelf`,
        partInstanceId: `${unitId}-B${bayNum}-FS`,
        moduleId: unitId,
        roomId,
        semanticType: 'shelf_fixed',
        partName: `Bay ${bayNum} Fixed Shelf (Structural)`,
        lengthMm: shelfWidth,
        widthMm: shelfDepth,
        thicknessMm: tCarcass,
        quantity: fixedShelves,
        installElevationsFromFloorMm: verticalSchedule?.shelfBottomElevationsMm,
        materialCode: matCarcass,
        grainDirection: 'horizontal',
        edging: '1L (Front)',
        edgeSchedule: { l1Mm: shelfWidth, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
        notes: 'Fixed shelf with Minifix or Confirmat',
      });
      hardware.push({
        id: `${unitId}-hw-fs-fasteners-bay${bayNum}`,
        name: 'Confirmat Structural Screws (7x50mm)',
        category: 'fastener',
        specification: 'Countersunk zinc-plated',
        quantity: fixedShelves * 4,
        unit: 'pcs',
        assignedBay: `Bay ${bayNum}`,
      });
    }

    if (adjShelves > 0) {
      panels.push({
        id: `${unitId}-bay${bayNum}-adj-shelf`,
        partInstanceId: `${unitId}-B${bayNum}-AS`,
        moduleId: unitId,
        roomId,
        semanticType: 'shelf_adjustable',
        partName: `Bay ${bayNum} Adjustable Shelf (AS EQ)`,
        lengthMm: shelfWidth - 2,
        widthMm: shelfDepth - 5,
        thicknessMm: tCarcass,
        quantity: adjShelves,
        materialCode: matCarcass,
        grainDirection: 'horizontal',
        edging: '1L (Front)',
        edgeSchedule: { l1Mm: shelfWidth - 2, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
        notes: 'System 32 adjustable shelf pins',
      });

      totalShelfPinsCount += adjShelves * 4;
    }

    if (bay.hasHangingRod || bay.type === 'wardrobe-hanging') {
      hardware.push({
        id: `${unitId}-hw-rod-bay${bayNum}`,
        name: 'Oval Wardrobe Hanging Rail with End Brackets',
        category: 'accessory',
        specification: `30x15mm chrome/graphite oval tube with center support, Length: ${bayWidth - 5}mm`,
        quantity: 1,
        unit: 'set',
        assignedBay: `Bay ${bayNum}`,
      });
    }

    const drawerCount = bay.drawerCount ?? (bay.type === 'drawers' ? 3 : 0);
    if (drawerCount > 0) {
      const runnerLen = carcassDepth >= 550 ? 500 : carcassDepth >= 500 ? 450 : 350;
      const drawerPitch = bay.drawerFrontHeightMm ?? (750 / drawerCount);
      const fasciaH = Math.round(drawerPitch - reveal * 2);

      panels.push({
        id: `${unitId}-bay${bayNum}-drawer-fascia`,
        partInstanceId: `${unitId}-B${bayNum}-DF`,
        moduleId: unitId,
        roomId,
        semanticType: 'drawer_fascia',
        partName: `Bay ${bayNum} Drawer Front Fascia`,
        lengthMm: bayWidth - reveal * 2,
        widthMm: fasciaH,
        thicknessMm: tShutter,
        quantity: drawerCount,
        installElevationsFromFloorMm: verticalSchedule
          ? Array.from({ length: drawerCount }, (_, drawerIndex) => Math.round(verticalSchedule.drawerBankBottomMm + drawerIndex * drawerPitch + reveal))
          : undefined,
        materialCode: input.shutterCoreMaterial || matCarcass,
        externalFaceFinishCode: matLaminateA || undefined,
        grainDirection: 'horizontal',
        edging: '2L + 2W (All 4 sides)',
        edgeSchedule: { l1Mm: bayWidth - reveal * 2, l2Mm: bayWidth - reveal * 2, w1Mm: fasciaH, w2Mm: fasciaH, tapeType: 'PVC-2MM', tapeThicknessMm: 2 },
        notes: bay.drawerFrontHeightMm
          ? `Nominal ${drawerPitch}mm drawer-front pitch; fascia cut height includes ${reveal}mm reveals at top and bottom.`
          : 'External finish drawer face with 2mm PVC edge',
      });

      const boxSideH = Math.min(180, fasciaH - 40);
      const boxInnerW = bayWidth - 26;
      panels.push(
        {
          id: `${unitId}-bay${bayNum}-drawer-sides`,
          partInstanceId: `${unitId}-B${bayNum}-DS`,
          moduleId: unitId,
          roomId,
          semanticType: 'drawer_side',
          partName: `Bay ${bayNum} Drawer Box Side`,
          lengthMm: runnerLen,
          widthMm: boxSideH,
          thicknessMm: 12,
          quantity: drawerCount * 2,
          materialCode: 'PLY-12-WHITE',
          grainDirection: 'horizontal',
          edging: '1L (Top edge)',
          edgeSchedule: { l1Mm: runnerLen, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
        },
        {
          id: `${unitId}-bay${bayNum}-drawer-back`,
          partInstanceId: `${unitId}-B${bayNum}-DB`,
          moduleId: unitId,
          roomId,
          semanticType: 'drawer_back',
          partName: `Bay ${bayNum} Drawer Box Back`,
          lengthMm: boxInnerW - 24,
          widthMm: boxSideH,
          thicknessMm: 12,
          quantity: drawerCount,
          materialCode: 'PLY-12-WHITE',
          grainDirection: 'horizontal',
          edging: '1L (Top edge)',
          edgeSchedule: { l1Mm: boxInnerW - 24, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
        },
        {
          id: `${unitId}-bay${bayNum}-drawer-bottom`,
          partInstanceId: `${unitId}-B${bayNum}-DBTM`,
          moduleId: unitId,
          roomId,
          semanticType: 'drawer_bottom',
          partName: `Bay ${bayNum} Drawer Box Bottom`,
          lengthMm: boxInnerW,
          widthMm: runnerLen,
          thicknessMm: tDrawerBottom,
          quantity: drawerCount,
          materialCode: matDrawerBottom,
          grainDirection: 'none',
          edging: 'None',
          edgeSchedule: { l1Mm: 0, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'NONE', tapeThicknessMm: 0 },
        }
      );

      hardware.push({
        id: `${unitId}-hw-drawer-runners-bay${bayNum}`,
        name: `Soft-Close Telescopic Drawer Runners (${runnerLen}mm)`,
        category: 'slide',
        specification: '45kg rated full-extension with integrated soft-close dampener',
        quantity: drawerCount,
        unit: 'pair',
        assignedBay: `Bay ${bayNum}`,
      });
    }

    const shutterType = bay.shutterType || (bayWidth > 600 ? 'double-door' : 'single-door');
    if (shutterType !== 'open') {
      const isDouble = shutterType === 'double-door';
      const doorCount = isDouble ? 2 : 1;
      const doorW = isDouble
        ? Math.round((bayWidth - reveal * 3) / 2)
        : bayWidth - reveal * 2;
      const doorH = baseCarcassH - reveal * 2;

      const finishCode = shutterType === 'fluted' ? matLaminateB : matLaminateA;
      const partDescription = shutterType === 'glass-profile'
        ? `Bay ${bayNum} Profile Glass Shutter`
        : shutterType === 'fluted'
        ? `Bay ${bayNum} Fluted Louver Shutter`
        : `Bay ${bayNum} Shutter Door`;

      panels.push({
        id: `${unitId}-bay${bayNum}-shutter`,
        partInstanceId: `${unitId}-B${bayNum}-SHT`,
        moduleId: unitId,
        roomId,
        semanticType: 'shutter',
        partName: partDescription,
        lengthMm: doorH,
        widthMm: doorW,
        thicknessMm: tShutter,
        quantity: doorCount,
        materialCode: input.shutterCoreMaterial || matCarcass,
        externalFaceFinishCode: finishCode || undefined,
        grainDirection: 'vertical',
        edging: '2L + 2W (All 4 perimeter edges)',
        edgeSchedule: { l1Mm: doorH, l2Mm: doorH, w1Mm: doorW, w2Mm: doorW, tapeType: 'PVC-2MM', tapeThicknessMm: 2 },
        notes: `External front face with 2mm PVC impact edge, ${doorCount} door(s)`,
      });

      const hingesPerLeaf = calculateHingesPerDoor(doorH);
      totalHingesCount += hingesPerLeaf * doorCount;

      hardware.push({
        id: `${unitId}-hw-handles-bay${bayNum}`,
        name: 'Slim Edge Profile Handle (Gola / J-Pull)',
        category: 'handle',
        specification: 'Matte black / brushed brass 200mm extruded aluminum profile',
        quantity: doorCount,
        unit: 'pcs',
        assignedBay: `Bay ${bayNum}`,
      });
    }
  });

  if (totalShelfPinsCount > 0) {
    hardware.push({
      id: `${unitId}-hw-shelf-pins`,
      name: 'System 32 Shelf Support Pins with Rubber O-Ring',
      category: 'fastener',
      specification: '5mm steel nickel-plated pin with anti-rattle silicone ring',
      quantity: totalShelfPinsCount,
      unit: 'pcs',
      notes: '4 pins per adjustable shelf',
    });
  }

  if (totalHingesCount > 0) {
    hardware.push({
      id: `${unitId}-hw-soft-close-hinges`,
      name: 'Concealed Soft-Close Clip-On Hinges (0-Crank / Full Overlay)',
      category: 'hinge',
      specification: '110° opening with 3D cam height/depth adjustment plate (IS 710 rated)',
      quantity: totalHingesCount,
      unit: 'pcs',
      notes: 'Calculated according to door height standards',
    });
  }

  // Structural board and decorative surfaces are separate BOM layers. A
  // cabinet panel can carry different finishes on its two faces; quantities
  // below are derived from the same cut dimensions shown in the panel list.
  const laminateAreaByFinish = new Map<string, { faceCount: number; areaSqm: number }>();
  for (const panel of panels) {
    const faceArea = (panel.lengthMm * panel.widthMm * panel.quantity) / 1_000_000;
    const finishes: Array<{ face: 'A' | 'B'; finishCode: string }> = [];
    if (panel.semanticType === 'carcass_gable') {
      if (panel.externalFaceFinishCode) finishes.push({ face: 'A', finishCode: panel.externalFaceFinishCode });
      if (input.internalFinishCode) finishes.push({ face: 'B', finishCode: input.internalFinishCode });
    } else if (['carcass_top_bottom', 'carcass_divider', 'shelf_fixed', 'shelf_adjustable'].includes(panel.semanticType)) {
      if (panel.semanticType === 'carcass_top_bottom') {
        if (input.internalFinishCode) finishes.push({ face: 'A', finishCode: input.internalFinishCode });
        if (matLaminateA) finishes.push({ face: 'B', finishCode: matLaminateA });
      } else if (input.internalFinishCode) {
        finishes.push({ face: 'A', finishCode: input.internalFinishCode }, { face: 'B', finishCode: input.internalFinishCode });
      }
    } else if (['shutter', 'drawer_fascia', 'dummy_filler', 'skirting_fascia'].includes(panel.semanticType)) {
      const externalFinish = panel.externalFaceFinishCode;
      if (externalFinish) finishes.push({ face: 'A', finishCode: externalFinish });
      if (input.internalFinishCode) finishes.push({ face: 'B', finishCode: input.internalFinishCode });
    } else if (panel.semanticType === 'back_panel' && input.internalFinishCode) {
      finishes.push({ face: 'A', finishCode: input.internalFinishCode });
    }
    panel.faceFinishes = finishes.map((finish) => ({ ...finish, areaSqm: Math.round(faceArea * 10000) / 10000 }));
    for (const finish of finishes) {
      const current = laminateAreaByFinish.get(finish.finishCode) ?? { faceCount: 0, areaSqm: 0 };
      current.faceCount += panel.quantity;
      current.areaSqm += faceArea;
      laminateAreaByFinish.set(finish.finishCode, current);
    }
  }
  const laminateTakeoff: LaminateTakeoff[] = [...laminateAreaByFinish.entries()].map(([finishCode, value]) => ({
    finishCode,
    faceCount: value.faceCount,
    netAreaSqm: Math.round(value.areaSqm * 1000) / 1000,
  }));

  const edgeMetersByType: Record<string, { tapeType: string; tapeThicknessMm: number; meters: number; app: string }> = {};

  for (const p of panels) {
    const tape = p.edgeSchedule.tapeType;
    if (!tape || tape === 'NONE') continue;
    const totalMm = (p.edgeSchedule.l1Mm + p.edgeSchedule.l2Mm + p.edgeSchedule.w1Mm + p.edgeSchedule.w2Mm) * p.quantity;
    const meters = totalMm / 1000;
    if (!edgeMetersByType[tape]) {
      edgeMetersByType[tape] = {
        tapeType: tape,
        tapeThicknessMm: p.edgeSchedule.tapeThicknessMm,
        meters: 0,
        app: tape.includes('2MM') ? 'External Doors & Visible Edges (Impact Resistant)' : 'Internal Carcass & Shelf Edges',
      };
    }
    edgeMetersByType[tape].meters += meters;
  }

  const edgeBanding: AnalyzedEdgeBandingSchedule[] = Object.values(edgeMetersByType).map((e) => ({
    tapeType: e.tapeType,
    tapeThicknessMm: e.tapeThicknessMm,
    totalMeters: Math.round(e.meters * 10) / 10,
    application: e.app,
  }));

  const SHEET_W = 2440;
  const SHEET_H = 1220;
  const KERF = 4;
  const TRIM = 10;
  const usableSheetAreaSqm = ((SHEET_W - TRIM * 2) * (SHEET_H - TRIM * 2)) / 1_000_000;

  const areaByMaterial: Record<string, { thicknessMm: number; totalAreaSqm: number }> = {};
  for (const p of panels) {
    const panelAreaSqm = ((p.lengthMm + KERF) * (p.widthMm + KERF) * p.quantity) / 1_000_000;
    if (!areaByMaterial[p.materialCode]) {
      areaByMaterial[p.materialCode] = { thicknessMm: p.thicknessMm, totalAreaSqm: 0 };
    }
    areaByMaterial[p.materialCode].totalAreaSqm += panelAreaSqm;
  }

  const sheetEstimates: SheetOptimizationEstimate[] = Object.entries(areaByMaterial).map(([code, data]) => {
    const rawSheets = data.totalAreaSqm / usableSheetAreaSqm;
    const estimatedSheets = Math.max(1, Math.ceil(rawSheets * 1.08));
    const efficiency = Math.min(96, Math.round((data.totalAreaSqm / (estimatedSheets * usableSheetAreaSqm)) * 100));
    return {
      materialCode: code,
      thicknessMm: data.thicknessMm,
      totalAreaSqm: Math.round(data.totalAreaSqm * 100) / 100,
      sheetWidthMm: SHEET_W,
      sheetHeightMm: SHEET_H,
      estimatedSheets,
      yieldEfficiencyPercent: efficiency,
    };
  });

  const totalPanelsCount = panels.reduce((sum, p) => sum + p.quantity, 0);
  const totalAreaAllPanels = panels.reduce((sum, p) => sum + ((p.lengthMm * p.widthMm * p.quantity) / 1_000_000), 0);
  const totalEdgeMeters = edgeBanding.reduce((sum, e) => sum + e.totalMeters, 0);
  const totalEstimatedSheets = sheetEstimates.reduce((sum, s) => sum + s.estimatedSheets, 0);

  return {
    unitId,
    unitTitle,
    roomId,
    wallId,
    overallWidthMm: overallW,
    overallHeightMm: overallH,
    depthMm: carcassDepth,
    summary: {
      totalPanels: totalPanelsCount,
      uniqueParts: panels.length,
      totalAreaSqm: Math.round(totalAreaAllPanels * 100) / 100,
      materialsCount: Object.keys(areaByMaterial).length,
      totalEdgeBandMeters: Math.round(totalEdgeMeters * 10) / 10,
      estimatedSheetsTotal: totalEstimatedSheets,
    },
    panels,
    hardware,
    edgeBanding,
    sheetEstimates,
    laminateTakeoff,
    wardrobeBaySchedules,
    auditIssues,
  };
}

/** Resolve the exact vertical zones once; the cutlist and elevation use this same schedule. */
export function resolveWardrobeBayVerticalSchedule(
  bay: DrawingBaySpec,
  index: number,
  input: Pick<DrawingCutlistInput, 'overallHeightMm' | 'plinthHeightMm' | 'loftHeightMm' | 'carcassThicknessMm' | 'revealGapMm'>,
): WardrobeBayVerticalSchedule | null {
  const hasVerticalStandard = bay.hangingClearHeightMm !== undefined || bay.drawerFrontHeightMm !== undefined || bay.shelvesInRemainderZone !== undefined;
  if (!hasVerticalStandard) return null;
  const carcassT = input.carcassThicknessMm ?? 18;
  const plinth = input.plinthHeightMm ?? 100;
  const loft = input.loftHeightMm ?? 0;
  const reveal = input.revealGapMm ?? 2;
  const baseHeight = input.overallHeightMm - plinth - loft;
  const clearBottom = plinth + carcassT;
  const clearTop = plinth + baseHeight - carcassT;
  const clearHeight = clearTop - clearBottom;
  const drawerCount = bay.drawerCount ?? (bay.type === 'drawers' ? 3 : 0);
  const drawerPitch = bay.drawerFrontHeightMm ?? (drawerCount > 0 ? 750 / drawerCount : 0);
  const drawerBankBottom = clearBottom;
  const drawerBankTop = drawerBankBottom + drawerCount * drawerPitch;
  const hangingHeight = bay.hangingClearHeightMm ?? 0;
  const hangingBottom = drawerCount > 0 ? drawerBankTop : clearBottom;
  const hangingTop = hangingBottom + hangingHeight;
  const capShelfCount = hangingHeight > 0 ? 1 : 0;
  const extraShelfCount = bay.shelvesInRemainderZone ?? 0;
  const extraShelves = Math.floor(extraShelfCount);
  if (!Number.isInteger(drawerCount) || drawerCount < 0 || drawerCount > 12 ||
      !Number.isInteger(extraShelfCount) || extraShelfCount < 0 || extraShelfCount > 8 ||
      !Number.isFinite(drawerPitch) || (drawerCount > 0 && drawerPitch <= 2 * reveal) ||
      !Number.isFinite(hangingHeight) || hangingHeight < 0) {
    throw new RangeError(`Bay ${bay.label ?? index + 1} has an invalid drawer, shelf, or hanging-zone schedule.`);
  }
  const shelfZoneBottom = hangingHeight > 0 ? hangingTop + carcassT : drawerBankTop;
  const remainingHeight = clearTop - shelfZoneBottom;
  if (drawerBankTop + hangingHeight + capShelfCount * carcassT > clearTop ||
      remainingHeight < extraShelves * carcassT) {
    throw new RangeError(`Bay ${bay.label ?? index + 1} does not have enough clear height for ${drawerCount} × ${drawerPitch}mm drawer fronts and ${hangingHeight}mm hanging clearance. Reduce a zone or increase the cabinet height.`);
  }
  const shelfBottomElevationsMm: number[] = [];
  if (hangingHeight > 0) shelfBottomElevationsMm.push(hangingTop);
  if (extraShelves > 0) {
    const freeSpan = remainingHeight - extraShelves * carcassT;
    for (let shelfIndex = 0; shelfIndex < extraShelves; shelfIndex++) {
      shelfBottomElevationsMm.push(Math.round(shelfZoneBottom + freeSpan * (shelfIndex + 1) / (extraShelves + 1) + carcassT * shelfIndex));
    }
  }
  const shelfZoneHeight = Math.max(0, clearTop - (shelfBottomElevationsMm.length ? shelfBottomElevationsMm[0] + carcassT : shelfZoneBottom));
  return {
    bayId: bay.id ?? `bay-${index + 1}`,
    clearBayWidthMm: bay.widthMm,
    drawerCount,
    drawerFrontHeightMm: drawerPitch,
    drawerBankBottomMm: drawerBankBottom,
    drawerBankTopMm: drawerBankTop,
    hangingClearHeightMm: hangingHeight,
    hangingClearBottomMm: hangingBottom,
    hangingClearTopMm: hangingTop,
    hangingRodElevationMm: hangingHeight > 0 ? Math.round(hangingBottom + hangingHeight * 0.92) : null,
    shelfBottomElevationsMm,
    remainingShelfZoneHeightMm: Math.max(0, shelfZoneHeight),
  };
}

export function extractDrawingCutlistFromScene(
  scene: SceneV1,
  targetWallIdOrModuleId?: string
): DrawingCutlistInput {
  const wall = (scene.walls ?? []).find((w) => w.id === targetWallIdOrModuleId) || scene.walls?.[0];
  const targetModule = (scene.modules ?? []).find((m) => m.id === targetWallIdOrModuleId);

  const wallLength = wall
    ? Math.round(Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm))
    : targetModule
    ? targetModule.widthMm + 600
    : 2400;

  const wallHeight = wall?.heightMm || 2700;

  const modulesOnWall = (scene.modules ?? []).filter((m: SceneModuleV1) => {
    if (targetModule) return m.id === targetModule.id;
    if (wall?.spaceIds && m.roomId) return wall.spaceIds.includes(m.roomId);
    return true;
  });

  const primaryModule = targetModule || modulesOnWall[0];
  const unitWidth = primaryModule?.widthMm || Math.min(2400, wallLength - 100);
  const unitHeight = primaryModule?.heightMm || Math.min(2400, wallHeight - 300);
  const unitDepth = primaryModule?.depthMm || (primaryModule?.family?.includes('wardrobe') ? 580 : primaryModule?.family?.includes('kitchen') ? 560 : 450);

  const fillerLeft = 0;
  const fillerRight = 0;
  const tCarcass = 18;
  const bayCount = Math.max(1, Math.round(unitWidth / 600));
  const internalWidth = unitWidth - fillerLeft - fillerRight - tCarcass * 2;
  const clearBayTotal = internalWidth - (bayCount - 1) * tCarcass;
  const baseBayWidth = Math.floor(clearBayTotal / bayCount);

  const bays: DrawingBaySpec[] = [];
  for (let i = 0; i < bayCount; i++) {
    const isDrawerBay = i === 0 && primaryModule?.family?.includes('wardrobe');
    bays.push({
      id: `bay-${i + 1}`,
      label: `Bay ${i + 1}`,
      widthMm: i === bayCount - 1 ? clearBayTotal - baseBayWidth * (bayCount - 1) : baseBayWidth,
      type: isDrawerBay ? 'drawers' : 'wardrobe-shelves',
      shelvesCount: 1,
      adjustableShelvesCount: 3,
      drawerCount: isDrawerBay ? 3 : 0,
      hasHangingRod: !isDrawerBay,
      shutterType: baseBayWidth > 550 ? 'double-door' : 'single-door',
    });
  }

  return {
    unitId: primaryModule?.id || (wall ? `unit-${wall.id}` : 'unit-main'),
    unitTitle: primaryModule?.family ? primaryModule.family.replace(/-/g, ' ').toUpperCase() : (wall ? `ELEVATION — ${wall.id.toUpperCase()}` : 'MAIN CASEWORK'),
    roomId: primaryModule?.roomId || wall?.spaceIds?.[0] || 'room-01',
    wallId: wall?.id || 'wall-01',
    overallWidthMm: unitWidth,
    overallHeightMm: unitHeight,
    depthMm: unitDepth,
    plinthHeightMm: 100,
    loftHeightMm: unitHeight > 2400 ? 500 : 0,
    bays,
    dummyFillerLeftMm: fillerLeft,
    dummyFillerRightMm: fillerRight,
    carcassCoreMaterial: 'HDHMR-18-WHITE',
    externalFinishCodeA: 'LAM-SF-ROYAL-TEAK',
    externalFinishCodeB: 'LAM-GLOSS-CREAM',
    internalFinishCode: 'LAM-LINER-FABRIC',
    backPanelMaterial: 'MDF-06-WHITE',
    backPanelThicknessMm: 6,
    drawerBottomMaterial: 'MDF-09-WHITE',
    drawerBottomThicknessMm: 9,
    assumptions: ['Bay composition, shelf/drawer count, plinth, and hardware are inferred from module family; confirm them against a dimensioned internal elevation before fabrication.'],
  };
}

export const DRAWING_CUTLIST_PRESETS: Record<string, DrawingCutlistInput> = {
  wardrobe_4door: {
    unitId: 'preset-wardrobe-4door',
    unitTitle: '4-Door Master Wardrobe with Loft & Internal Drawers',
    roomId: 'master-bedroom',
    wallId: 'wall-a',
    overallWidthMm: 2400,
    overallHeightMm: 2400,
    depthMm: 600,
    plinthHeightMm: 100,
    loftHeightMm: 450,
    dummyFillerLeftMm: 30,
    dummyFillerRightMm: 30,
    carcassCoreMaterial: 'HDHMR-18-WHITE',
    externalFinishCodeA: 'LAM-SF-ROYAL-TEAK',
    externalFinishCodeB: 'LAM-GLOSS-CREAM',
    internalFinishCode: 'LAM-FABRIC-LINER',
    backPanelMaterial: 'MDF-09-WHITE',
    bays: [
      { id: 'bay-1', label: 'Bay 1 (Drawers & Shelves)', widthMm: 756, type: 'drawers', shelvesCount: 1, adjustableShelvesCount: 2, drawerCount: 3, hasHangingRod: false, shutterType: 'single-door' },
      { id: 'bay-2', label: 'Bay 2 (Double Hanging)', widthMm: 756, type: 'wardrobe-hanging', shelvesCount: 1, adjustableShelvesCount: 1, drawerCount: 0, hasHangingRod: true, shutterType: 'single-door' },
      { id: 'bay-3', label: 'Bay 3 (Full Shelves)', widthMm: 756, type: 'wardrobe-shelves', shelvesCount: 1, adjustableShelvesCount: 4, drawerCount: 0, hasHangingRod: false, shutterType: 'single-door' },
    ],
  },
  kitchen_base: {
    unitId: 'preset-kitchen-base',
    unitTitle: 'Modular Kitchen Base Run (Cutlery + Pots + Sink)',
    roomId: 'kitchen',
    wallId: 'wall-kitchen-base',
    overallWidthMm: 2100,
    overallHeightMm: 850,
    depthMm: 580,
    plinthHeightMm: 100,
    loftHeightMm: 0,
    dummyFillerLeftMm: 25,
    dummyFillerRightMm: 25,
    carcassCoreMaterial: 'BWP-PLY-18-WHITE',
    externalFinishCodeA: 'ACRYLIC-CHARCOAL-18',
    externalFinishCodeB: 'ACRYLIC-WHITE-18',
    internalFinishCode: 'LAM-OFFWHITE-08',
    backPanelMaterial: 'BWP-PLY-06-WHITE',
    backPanelThicknessMm: 6,
    bays: [
      { id: 'bay-1', label: 'Bay 1 (Cutlery Organizer)', widthMm: 580, type: 'drawers', shelvesCount: 0, adjustableShelvesCount: 0, drawerCount: 3, hasHangingRod: false, shutterType: 'open' },
      { id: 'bay-2', label: 'Bay 2 (Tandem Pot Drawers)', widthMm: 680, type: 'drawers', shelvesCount: 0, adjustableShelvesCount: 0, drawerCount: 2, hasHangingRod: false, shutterType: 'open' },
      { id: 'bay-3', label: 'Bay 3 (Under-Sink Base)', widthMm: 718, type: 'base-cabinet', shelvesCount: 1, adjustableShelvesCount: 0, drawerCount: 0, hasHangingRod: false, shutterType: 'double-door' },
    ],
  },
  tv_console: {
    unitId: 'preset-tv-console',
    unitTitle: 'Floating TV Entertainment Console with Acoustic Slats',
    roomId: 'living-room',
    wallId: 'wall-tv',
    overallWidthMm: 2400,
    overallHeightMm: 450,
    depthMm: 400,
    plinthHeightMm: 0,
    loftHeightMm: 0,
    dummyFillerLeftMm: 0,
    dummyFillerRightMm: 0,
    carcassCoreMaterial: 'HDHMR-18-CHARCOAL',
    externalFinishCodeA: 'PU-MATTE-GRAPHITE',
    externalFinishCodeB: 'SLAT-WALNUT-ACOUSTIC',
    internalFinishCode: 'LAM-GREY-FABRIC',
    backPanelMaterial: 'MDF-09-BLACK',
    backPanelThicknessMm: 6,
    bays: [
      { id: 'bay-1', label: 'Left Fluted Shutter', widthMm: 776, type: 'custom', shelvesCount: 0, adjustableShelvesCount: 1, drawerCount: 0, hasHangingRod: false, shutterType: 'fluted' },
      { id: 'bay-2', label: 'Center Media Open Niche', widthMm: 776, type: 'open-niche', shelvesCount: 1, adjustableShelvesCount: 0, drawerCount: 0, hasHangingRod: false, shutterType: 'open' },
      { id: 'bay-3', label: 'Right Fluted Shutter', widthMm: 776, type: 'custom', shelvesCount: 0, adjustableShelvesCount: 1, drawerCount: 0, hasHangingRod: false, shutterType: 'fluted' },
    ],
  },
  crockery_unit: {
    unitId: 'preset-crockery-unit',
    unitTitle: 'Full-Height Dining Crockery & Wine Bar',
    roomId: 'dining-room',
    wallId: 'wall-crockery',
    overallWidthMm: 1800,
    overallHeightMm: 2200,
    depthMm: 450,
    plinthHeightMm: 100,
    loftHeightMm: 400,
    dummyFillerLeftMm: 30,
    dummyFillerRightMm: 30,
    carcassCoreMaterial: 'HDHMR-18-DARK-OAK',
    externalFinishCodeA: 'GLASS-FLUTED-PROFILE',
    externalFinishCodeB: 'LAM-BRONZE-METALLIC',
    internalFinishCode: 'LAM-SMOKED-WALNUT',
    backPanelMaterial: 'MIRROR-BRONZE-06',
    backPanelThicknessMm: 6,
    bays: [
      { id: 'bay-1', label: 'Glass Crockery Tower A', widthMm: 843, type: 'wardrobe-shelves', shelvesCount: 1, adjustableShelvesCount: 4, drawerCount: 2, hasHangingRod: false, shutterType: 'glass-profile' },
      { id: 'bay-2', label: 'Glass Crockery Tower B', widthMm: 843, type: 'wardrobe-shelves', shelvesCount: 1, adjustableShelvesCount: 4, drawerCount: 0, hasHangingRod: false, shutterType: 'glass-profile' },
    ],
  },
};

/**
 * Generates an authoritative 2D CAD/Architectural SVG drawing
 * rendering either External Elevation, Internal Carcass Section,
 * or both side-by-side with complete System 32 joinery and dimension lines.
 */
export function generateDrawingCutlistSvg(
  input: DrawingCutlistInput,
  viewMode: 'external' | 'internal' | 'both' = 'both'
): string {
  const isBoth = viewMode === 'both';
  const totalSvgW = isBoth ? 1160 : 620;
  const totalSvgH = 600;

  const panelW = 460;
  const panelH = 400;

  const overallW = Math.max(100, input.overallWidthMm);
  const overallH = Math.max(100, input.overallHeightMm);
  const plinthH = Math.max(0, input.plinthHeightMm ?? 100);
  const loftH = Math.max(0, input.loftHeightMm ?? 0);
  const fillerL = input.dummyFillerLeftMm ?? 0;
  const fillerR = input.dummyFillerRightMm ?? 0;

  const scale = Math.min((panelW - 60) / overallW, (panelH - 80) / overallH);

  function renderElevationPanel(offsetX: number, mode: 'external' | 'internal'): string {
    const originX = offsetX + 50;
    const originY = 60;

    const unitPxW = overallW * scale;
    const unitPxH = overallH * scale;
    const plinthPxH = plinthH * scale;
    const loftPxH = loftH * scale;
    const fillerPxL = fillerL * scale;
    const fillerPxR = fillerR * scale;

    const carcassPxW = unitPxW - fillerPxL - fillerPxR;
    const carcassPxH = unitPxH - plinthPxH;
    const baseCarcassPxH = loftPxH > 0 ? carcassPxH - loftPxH : carcassPxH;

    const topY = originY;
    const loftBottomY = topY + loftPxH;
    const baseBottomY = topY + carcassPxH;
    const groundY = originY + unitPxH;

    const unitLeftX = originX;
    const carcassLeftX = unitLeftX + fillerPxL;
    const carcassRightX = carcassLeftX + carcassPxW;
    const unitRightX = carcassRightX + fillerPxR;

    let svg = '';

    // Title banner
    const titleText = mode === 'external' ? 'EXTERNAL ELEVATION (FINISHED)' : 'INTERNAL CARCASS SECTION (SYSTEM 32)';
    svg += `
      <g transform="translate(${originX}, 28)">
        <rect x="0" y="0" width="${unitPxW}" height="22" rx="4" fill="${mode === 'external' ? '#78350f' : '#1e3a8a'}" />
        <text x="${unitPxW / 2}" y="15" fill="#ffffff" font-size="10.5" font-weight="700" text-anchor="middle" letter-spacing="0.06em">
          ${titleText}
        </text>
      </g>
    `;

    // Dimension lines (Top width)
    svg += `
      <g stroke="#78716c" stroke-width="0.8">
        <!-- Top Overall Width -->
        <line x1="${unitLeftX}" y1="${originY - 12}" x2="${unitRightX}" y2="${originY - 12}" />
        <line x1="${unitLeftX}" y1="${originY - 16}" x2="${unitLeftX}" y2="${originY - 8}" />
        <line x1="${unitRightX}" y1="${originY - 16}" x2="${unitRightX}" y2="${originY - 8}" />
        <text x="${unitLeftX + unitPxW / 2}" y="${originY - 15}" fill="#44403c" font-size="9" font-weight="700" text-anchor="middle">
          ${overallW} mm
        </text>

        <!-- Left Overall Height -->
        <line x1="${unitLeftX - 16}" y1="${topY}" x2="${unitLeftX - 16}" y2="${groundY}" />
        <line x1="${unitLeftX - 20}" y1="${topY}" x2="${unitLeftX - 12}" y2="${topY}" />
        <line x1="${unitLeftX - 20}" y1="${groundY}" x2="${unitLeftX - 12}" y2="${groundY}" />
        <text x="${unitLeftX - 22}" y="${topY + unitPxH / 2}" fill="#44403c" font-size="9" font-weight="700" text-anchor="middle" transform="rotate(-90 ${unitLeftX - 22} ${topY + unitPxH / 2})">
          ${overallH} mm
        </text>
      </g>
    `;

    // Plinth at base
    if (plinthH > 0) {
      svg += `
        <rect x="${carcassLeftX}" y="${baseBottomY}" width="${carcassPxW}" height="${plinthPxH}" fill="#382e25" stroke="#1c1611" stroke-width="1.2" />
        <text x="${carcassLeftX + carcassPxW / 2}" y="${baseBottomY + plinthPxH / 2 + 3}" fill="#ffffff" font-size="8" font-weight="600" text-anchor="middle">
          PLINTH ${plinthH}mm
        </text>
      `;
    }

    // Dummy Fillers Left & Right
    if (fillerL > 0) {
      svg += `
        <rect x="${unitLeftX}" y="${topY}" width="${fillerPxL}" height="${carcassPxH}" fill="#e7ded3" stroke="#bfae98" stroke-dasharray="3 2" />
        <text x="${unitLeftX + fillerPxL / 2}" y="${topY + carcassPxH / 2}" fill="#786d5e" font-size="7" font-weight="700" text-anchor="middle" transform="rotate(-90 ${unitLeftX + fillerPxL / 2} ${topY + carcassPxH / 2})">
          FILLER ${fillerL}mm
        </text>
      `;
    }
    if (fillerR > 0) {
      svg += `
        <rect x="${carcassRightX}" y="${topY}" width="${fillerPxR}" height="${carcassPxH}" fill="#e7ded3" stroke="#bfae98" stroke-dasharray="3 2" />
        <text x="${carcassRightX + fillerPxR / 2}" y="${topY + carcassPxH / 2}" fill="#786d5e" font-size="7" font-weight="700" text-anchor="middle" transform="rotate(-90 ${carcassRightX + fillerPxR / 2} ${topY + carcassPxH / 2})">
          FILLER ${fillerR}mm
        </text>
      `;
    }

    const bays = input.bays.length > 0 ? input.bays : [{ widthMm: overallW - fillerL - fillerR, type: 'wardrobe-shelves' as const }];
    let curX = carcassLeftX;

    if (mode === 'external') {
      // ── External Elevation Mode: Shutters with 2mm reveals, handles, and swing lines ──
      bays.forEach((bay, bi) => {
        const bayPxW = bay.widthMm * scale;
        const shutterPxW = bayPxW - 2; // 2mm reveal

        // Main Shutter
        const isDouble = bay.shutterType === 'double-door';
        const doorCount = isDouble ? 2 : 1;
        const singleDoorW = shutterPxW / doorCount;

        for (let di = 0; di < doorCount; di++) {
          const doorX = curX + di * singleDoorW + 1;
          const doorY = loftPxH > 0 ? loftBottomY + 1 : topY + 1;
          const doorH = baseCarcassPxH - 2;

          const isGlass = bay.shutterType === 'glass-profile';
          const isFluted = bay.shutterType === 'fluted';

          svg += `
            <rect x="${doorX}" y="${doorY}" width="${singleDoorW - 2}" height="${doorH}" rx="2"
              fill="${isGlass ? 'rgba(219, 234, 254, 0.5)' : isFluted ? '#d97706' : '#d4a373'}"
              stroke="#8c6218" stroke-width="1.2" />
          `;

          // Fluted lines or glass reflection
          if (isFluted) {
            for (let fx = doorX + 4; fx < doorX + singleDoorW - 4; fx += 5) {
              svg += `<line x1="${fx}" y1="${doorY + 2}" x2="${fx}" y2="${doorY + doorH - 2}" stroke="#b45309" stroke-width="0.7" />`;
            }
          }

          // Door swing line (architectural dashed triangle)
          const hingeLeft = isDouble ? di === 0 : true;
          const hingeX = hingeLeft ? doorX : doorX + singleDoorW - 2;
          const latchX = hingeLeft ? doorX + singleDoorW - 2 : doorX;
          const midDoorY = doorY + doorH / 2;

          svg += `
            <polyline points="${hingeX},${doorY} ${latchX},${midDoorY} ${hingeX},${doorY + doorH}"
              fill="none" stroke="rgba(140, 98, 24, 0.45)" stroke-width="0.8" stroke-dasharray="4 3" />
          `;

          // Handle
          const handleX = hingeLeft ? doorX + singleDoorW - 8 : doorX + 6;
          svg += `
            <rect x="${handleX}" y="${midDoorY - 20}" width="3" height="40" rx="1.5" fill="#1c1917" />
          `;
        }

        // Loft Shutter
        if (loftPxH > 0) {
          const loftDoorH = loftPxH - 2;
          svg += `
            <rect x="${curX + 1}" y="${topY + 1}" width="${shutterPxW}" height="${loftDoorH}" rx="1"
              fill="#e6ccb2" stroke="#8c6218" stroke-width="1" />
            <text x="${curX + bayPxW / 2}" y="${topY + loftDoorH / 2 + 3}" fill="#78350f" font-size="7.5" font-weight="700" text-anchor="middle">
              LOFT ${loftH}mm
            </text>
          `;
        }

        // Bottom Bay Width text
        svg += `
          <text x="${curX + bayPxW / 2}" y="${groundY + 14}" fill="#57534e" font-size="8" font-weight="600" text-anchor="middle">
            ${bay.widthMm} mm
          </text>
        `;

        curX += bayPxW;
      });
    } else {
      // ── Internal Carcass Section Mode: 18mm panels, System 32 hole pattern, FS, AS EQ, Drawers ──
      const tGablePx = Math.max(2.5, 18 * scale);

      // Outer Gables (18mm)
      svg += `
        <!-- Left Outer Gable -->
        <rect x="${carcassLeftX}" y="${loftBottomY}" width="${tGablePx}" height="${baseCarcassPxH}" fill="#faf6ef" stroke="#44403c" stroke-width="1.2" />
        <!-- Right Outer Gable -->
        <rect x="${carcassRightX - tGablePx}" y="${loftBottomY}" width="${tGablePx}" height="${baseCarcassPxH}" fill="#faf6ef" stroke="#44403c" stroke-width="1.2" />
        <!-- Base Bottom Panel -->
        <rect x="${carcassLeftX + tGablePx}" y="${baseBottomY - tGablePx}" width="${carcassPxW - tGablePx * 2}" height="${tGablePx}" fill="#ede5d8" stroke="#44403c" stroke-width="1.2" />
        <!-- Top Ceiling Panel -->
        <rect x="${carcassLeftX + tGablePx}" y="${loftBottomY}" width="${carcassPxW - tGablePx * 2}" height="${tGablePx}" fill="#ede5d8" stroke="#44403c" stroke-width="1.2" />
      `;

      let innerX = carcassLeftX + tGablePx;

      bays.forEach((bay, bi) => {
        const bayPxW = bay.widthMm * scale;
        const bayRightX = innerX + bayPxW;
        const verticalSchedule = resolveWardrobeBayVerticalSchedule(bay, bi, input);

        // Internal divider if not last bay
        if (bi < bays.length - 1) {
          svg += `
            <rect x="${bayRightX - tGablePx / 2}" y="${loftBottomY + tGablePx}" width="${tGablePx}" height="${baseCarcassPxH - tGablePx * 2}" fill="#ede5d8" stroke="#44403c" stroke-width="1" />
          `;
        }

        // System 32 Holes line boring along sides (dots)
        const holeStartX = innerX + 4;
        const holeEndX = bayRightX - 4;
        for (let hy = loftBottomY + 25; hy < baseBottomY - 25; hy += 12) {
          svg += `
            <circle cx="${holeStartX}" cy="${hy}" r="0.8" fill="#a8a29e" />
            <circle cx="${holeEndX}" cy="${hy}" r="0.8" fill="#a8a29e" />
          `;
        }

        // Drawers pack
        const drawerCount = bay.drawerCount ?? (bay.type === 'drawers' ? 3 : 0);
        if (drawerCount > 0) {
          const drawerPitchMm = verticalSchedule?.drawerFrontHeightMm ?? (750 / drawerCount);
          const drawerBaseMm = verticalSchedule?.drawerBankBottomMm ?? (plinthH + tGablePx / scale);
          const revealMm = input.revealGapMm ?? 2;
          for (let d = 0; d < drawerCount; d++) {
            const fasciaBottomMm = drawerBaseMm + d * drawerPitchMm + revealMm;
            const fasciaHeightMm = drawerPitchMm - 2 * revealMm;
            const dy = groundY - (fasciaBottomMm + fasciaHeightMm) * scale;
            svg += `
              <rect x="${innerX + 6}" y="${dy}" width="${bayPxW - 12}" height="${fasciaHeightMm * scale}" rx="2"
                fill="#fdfbf7" stroke="#78716c" stroke-width="1" />
              <text x="${innerX + bayPxW / 2}" y="${dy + fasciaHeightMm * scale / 2 + 2}" fill="#57534e" font-size="6.5" font-weight="600" text-anchor="middle">DRAWER ${d + 1} · ${Math.round(drawerPitchMm)} PITCH</text>
            `;
          }
        }

        // Hanging rod
        if (bay.hasHangingRod || bay.type === 'wardrobe-hanging') {
          const rodY = verticalSchedule?.hangingRodElevationMm != null
            ? groundY - verticalSchedule.hangingRodElevationMm * scale
            : loftBottomY + baseCarcassPxH * 0.35;
          svg += `
            <line x1="${innerX + 5}" y1="${rodY}" x2="${bayRightX - 5}" y2="${rodY}" stroke="#64748b" stroke-width="2.5" />
            <circle cx="${innerX + 6}" cy="${rodY}" r="3" fill="#334155" />
            <circle cx="${bayRightX - 6}" cy="${rodY}" r="3" fill="#334155" />
            <text x="${innerX + bayPxW / 2}" y="${rodY - 5}" fill="#475569" font-size="7" font-weight="700" text-anchor="middle">
              OVAL ROD · ${verticalSchedule ? `${verticalSchedule.hangingClearHeightMm}mm CLEAR` : 'POSITION TBC'}
            </text>
          `;
        }

        // Fixed & Adjustable Shelves
        const fixedCount = verticalSchedule ? verticalSchedule.shelfBottomElevationsMm.length : bay.shelvesCount ?? 1;
        const adjCount = verticalSchedule ? 0 : bay.adjustableShelvesCount ?? 2;

        if (fixedCount > 0) {
          const elevations = verticalSchedule?.shelfBottomElevationsMm ?? [plinthH + baseCarcassPxH / scale * 0.22];
          elevations.forEach((elevationMm, shelfIndex) => {
            const fsY = groundY - (elevationMm + (input.carcassThicknessMm ?? 18)) * scale;
            svg += `
              <rect x="${innerX}" y="${fsY}" width="${bayPxW}" height="${tGablePx}" fill="#d6c6b2" stroke="#57483b" stroke-width="0.8" />
              <text x="${innerX + bayPxW / 2}" y="${fsY - 2}" fill="#78350f" font-size="6.5" font-weight="700" text-anchor="middle">${verticalSchedule ? (shelfIndex === 0 && verticalSchedule.hangingClearHeightMm ? 'HANG CLEAR TOP / SHELF' : 'UPPER STORAGE SHELF') : 'FS (FIXED SHELF)'}</text>
            `;
          });
        }

        if (adjCount > 0) {
          const availH = baseCarcassPxH * 0.6;
          const step = availH / (adjCount + 1);
          for (let s = 1; s <= adjCount; s++) {
            const asY = loftBottomY + baseCarcassPxH * 0.3 + s * step;
            if (asY < baseBottomY - 40) {
              svg += `
                <rect x="${innerX + 2}" y="${asY}" width="${bayPxW - 4}" height="${tGablePx * 0.9}" rx="1" fill="#f5f0e6" stroke="#8c7a6b" stroke-width="0.8" />
                <circle cx="${innerX + 3}" cy="${asY + tGablePx * 0.9}" r="1.5" fill="#c59c2d" />
                <circle cx="${bayRightX - 3}" cy="${asY + tGablePx * 0.9}" r="1.5" fill="#c59c2d" />
                <text x="${innerX + bayPxW / 2}" y="${asY - 2}" fill="#8c7a6b" font-size="6" font-weight="600" text-anchor="middle">
                  AS EQ (${s})
                </text>
              `;
            }
          }
        }

        // Loft space
        if (loftPxH > 0) {
          svg += `
            <rect x="${innerX}" y="${topY + tGablePx}" width="${bayPxW}" height="${loftPxH - tGablePx * 2}" fill="#faf6ef" stroke="#44403c" stroke-width="0.8" />
            <text x="${innerX + bayPxW / 2}" y="${topY + loftPxH / 2 + 2}" fill="#78716c" font-size="7.5" font-weight="600" text-anchor="middle">
              LOFT CARCASS
            </text>
          `;
        }

        if (verticalSchedule) {
          const labelX = bayRightX - 5;
          svg += `<text x="${labelX}" y="${groundY - verticalSchedule.drawerBankTopMm * scale - 5}" text-anchor="end" fill="#7c2d12" font-size="6.5" font-weight="700">${verticalSchedule.drawerCount} × ${Math.round(verticalSchedule.drawerFrontHeightMm)} mm</text>`;
          if (verticalSchedule.hangingClearHeightMm > 0) {
            svg += `<text x="${labelX}" y="${groundY - (verticalSchedule.hangingClearBottomMm + verticalSchedule.hangingClearTopMm) * scale / 2}" text-anchor="end" fill="#1d4ed8" font-size="6.5" font-weight="700">${verticalSchedule.hangingClearHeightMm} mm CLEAR</text>`;
          }
          svg += `<text x="${innerX + bayPxW / 2}" y="${topY + 14}" text-anchor="middle" fill="#57534e" font-size="6.5">SHELF ZONE ${Math.round(verticalSchedule.remainingShelfZoneHeightMm)} mm</text>`;
        }
        svg += `<text x="${innerX + bayPxW / 2}" y="${groundY + 14}" text-anchor="middle" fill="#57534e" font-size="8" font-weight="600">${Math.round(bay.widthMm)} mm CLEAR BAY</text>`;
        innerX += bayPxW;
      });
    }

    return svg;
  }

  const svgContent = isBoth
    ? `${renderElevationPanel(10, 'external')}
       <line x1="570" y1="20" x2="570" y2="530" stroke="#dcd1c2" stroke-width="1" stroke-dasharray="4 4" />
       ${renderElevationPanel(590, 'internal')}`
    : renderElevationPanel(10, viewMode);

  const finishesLine = [
    `Core: ${input.carcassCoreMaterial || 'TBC'}`,
    `External: ${input.externalFinishCodeA || 'TBC'}`,
    `Internal: ${input.internalFinishCode || 'TBC'}`,
    `Back: ${input.backPanelThicknessMm ?? 6}mm ${input.backPanelMount ?? 'captured-groove'} · ${input.backPanelMaterial || 'TBC'}`,
  ].join('  |  ');
  const footer = `<rect x="16" y="542" width="${totalSvgW - 32}" height="38" rx="4" fill="#f8f4ed" stroke="#d6c6b2"/><text x="26" y="557" font-size="8" font-weight="700" fill="#44403c">FINISH / CONSTRUCTION LEGEND</text><text x="26" y="570" font-size="7" fill="#57534e">${xmlEscapeSvg(finishesLine)}</text><text x="${totalSvgW - 24}" y="557" text-anchor="end" font-size="7" font-weight="700" fill="#b91c1c">DIMENSIONED DRAFT · CONFIRM BEFORE FABRICATION</text>`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSvgW} ${totalSvgH}" width="100%" height="100%">
      <defs>
        <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <line x1="0" y1="20" x2="20" y2="20" stroke="#f2ede4" stroke-width="0.5" />
          <line x1="20" y1="0" x2="20" y2="20" stroke="#f2ede4" stroke-width="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#ffffff" />
      <rect width="100%" height="100%" fill="url(#cad-grid)" opacity="0.85" />
      ${svgContent}
      ${footer}
    </svg>
  `;
}

function xmlEscapeSvg(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
