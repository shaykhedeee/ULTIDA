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

export type GrainDirection = 'horizontal' | 'vertical' | 'none';

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
  externalFinishCodeA?: string;
  externalFinishCodeB?: string;
  internalFinishCode?: string;
  backPanelMaterial?: string;
  carcassThicknessMm?: number;
  backPanelThicknessMm?: number;
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
  auditIssues: DrawingCutlistAuditIssue[];
}

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

  const overallW = Math.max(100, Math.round(input.overallWidthMm));
  const overallH = Math.max(100, Math.round(input.overallHeightMm));
  const carcassDepth = Math.max(100, Math.round(input.depthMm));
  const plinthH = Math.max(0, input.plinthHeightMm ?? 100);
  const loftH = Math.max(0, input.loftHeightMm ?? 0);

  const tCarcass = input.carcassThicknessMm ?? 18;
  const tBack = input.backPanelThicknessMm ?? 9;
  const tShutter = input.shutterThicknessMm ?? 18;
  const reveal = input.revealGapMm ?? 2;
  const fillerL = input.dummyFillerLeftMm ?? 0;
  const fillerR = input.dummyFillerRightMm ?? 0;

  const matCarcass = input.carcassCoreMaterial || 'HDHMR-18-WHITE';
  const matLaminateA = input.externalFinishCodeA || 'LAM-EXT-PRIMARY';
  const matLaminateB = input.externalFinishCodeB || matLaminateA;
  const matBack = input.backPanelMaterial || 'MDF-09-WHITE';

  const panels: AnalyzedCutlistPanel[] = [];
  const hardware: AnalyzedHardwareItem[] = [];
  const auditIssues: DrawingCutlistAuditIssue[] = [];

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
      materialCode: matLaminateA,
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
      materialCode: matLaminateA,
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
      materialCode: matLaminateA,
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
      widthMm: carcassDepth,
      thicknessMm: tCarcass,
      quantity: 1,
      materialCode: matCarcass,
      grainDirection: 'vertical',
      edging: '1L (Front exposed) + 1W (Bottom)',
      edgeSchedule: { l1Mm: baseCarcassH, l2Mm: 0, w1Mm: carcassDepth, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
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
      widthMm: carcassDepth,
      thicknessMm: tCarcass,
      quantity: 1,
      materialCode: matCarcass,
      grainDirection: 'vertical',
      edging: '1L (Front exposed) + 1W (Bottom)',
      edgeSchedule: { l1Mm: baseCarcassH, l2Mm: 0, w1Mm: carcassDepth, w2Mm: 0, tapeType: 'PVC-08MM', tapeThicknessMm: 0.8 },
      notes: 'Pre-drilled System 32 32mm pitch line boring',
    }
  );

  const internalWidth = Math.max(0, carcassWidth - tCarcass * 2);
  const bottomPanelWidth = internalWidth;
  const bottomPanelDepth = carcassDepth;

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

  const backPanelW = bottomPanelWidth + 20;
  const backPanelH = baseCarcassH - 10;

  panels.push({
    id: `${unitId}-back-panel`,
    partInstanceId: `${unitId}-BCK-01`,
    moduleId: unitId,
    roomId,
    semanticType: 'back_panel',
    partName: 'Carcass Back Panel (Groove inserted)',
    lengthMm: backPanelH,
    widthMm: backPanelW,
    thicknessMm: tBack,
    quantity: 1,
    materialCode: matBack,
    grainDirection: 'vertical',
    edging: 'None (Captured in 10mm carcass groove)',
    edgeSchedule: { l1Mm: 0, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: 'NONE', tapeThicknessMm: 0 },
    notes: 'Slides into 10mm deep groove 20mm from rear edge',
  });

  const bays = input.bays.length > 0 ? input.bays : [{ widthMm: internalWidth, type: 'wardrobe-shelves' as const }];
  const bayTotalW = bays.reduce((sum, b) => sum + b.widthMm, 0);

  const partitionsCount = Math.max(0, bays.length - 1);
  const expectedTotalWidth = bayTotalW + partitionsCount * tCarcass;

  if (Math.abs(expectedTotalWidth - internalWidth) > 5) {
    auditIssues.push({
      severity: 'warning',
      code: 'BAY_WIDTH_MISMATCH',
      message: `Sum of bays (${bayTotalW}mm) + ${partitionsCount} partition(s) (${partitionsCount * tCarcass}mm) = ${expectedTotalWidth}mm, but internal carcass width is ${internalWidth}mm (difference: ${expectedTotalWidth - internalWidth}mm).`,
    });
  }

  for (let i = 0; i < partitionsCount; i++) {
    panels.push({
      id: `${unitId}-partition-${i + 1}`,
      partInstanceId: `${unitId}-DIV-0${i + 1}`,
      moduleId: unitId,
      roomId,
      semanticType: 'carcass_divider',
      partName: `Internal Vertical Divider (Bay ${i + 1} / ${i + 2})`,
      lengthMm: baseCarcassH - tCarcass * 2,
      widthMm: carcassDepth - 20,
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
    const shelfWidth = bayWidth;
    const shelfDepth = carcassDepth - 25;

    const fixedShelves = bay.shelvesCount ?? (bay.type === 'wardrobe-shelves' ? 1 : 0);
    const adjShelves = bay.adjustableShelvesCount ?? (bay.type === 'wardrobe-shelves' ? 3 : 1);

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
      const fasciaH = Math.round((750 / drawerCount) - reveal * 2);

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
        materialCode: matLaminateA,
        grainDirection: 'horizontal',
        edging: '2L + 2W (All 4 sides)',
        edgeSchedule: { l1Mm: bayWidth - reveal * 2, l2Mm: bayWidth - reveal * 2, w1Mm: fasciaH, w2Mm: fasciaH, tapeType: 'PVC-2MM', tapeThicknessMm: 2 },
        notes: 'External finish drawer face with 2mm PVC edge',
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
          thicknessMm: 9,
          quantity: drawerCount,
          materialCode: matBack,
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
        materialCode: finishCode,
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
    auditIssues,
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

  const bayCount = Math.max(1, Math.round(unitWidth / 600));
  const bayWidth = Math.round(unitWidth / bayCount);

  const bays: DrawingBaySpec[] = [];
  for (let i = 0; i < bayCount; i++) {
    const isDrawerBay = i === 0 && primaryModule?.family?.includes('wardrobe');
    bays.push({
      id: `bay-${i + 1}`,
      label: `Bay ${i + 1}`,
      widthMm: i === bayCount - 1 ? unitWidth - (bayWidth * (bayCount - 1)) : bayWidth,
      type: isDrawerBay ? 'drawers' : 'wardrobe-shelves',
      shelvesCount: 1,
      adjustableShelvesCount: 3,
      drawerCount: isDrawerBay ? 3 : 0,
      hasHangingRod: !isDrawerBay,
      shutterType: bayWidth > 550 ? 'double-door' : 'single-door',
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
    dummyFillerLeftMm: 30,
    dummyFillerRightMm: 30,
    carcassCoreMaterial: 'HDHMR-18-WHITE',
    externalFinishCodeA: 'LAM-SF-ROYAL-TEAK',
    externalFinishCodeB: 'LAM-GLOSS-CREAM',
    internalFinishCode: 'LAM-LINER-FABRIC',
    backPanelMaterial: 'MDF-09-WHITE',
  };
}
