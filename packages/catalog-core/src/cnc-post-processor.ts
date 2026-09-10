/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ULTIDA CNC POST-PROCESSOR ENGINE
 * Generates production-ready machine code for industrial CNC machining centres:
 * 1. Homag WoodWOP (.mpr) — Homag & Weeke CNC nesting and boring centres
 * 2. Biesse bSolid / BiesseWorks (.cix) — Biesse Rover CID3 macro format
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type CncDrillHole = {
  id: string;
  xMm: number;
  yMm: number;
  diameterMm: number;
  depthMm: number;
  face: 'top' | 'bottom' | 'front' | 'rear' | 'left' | 'right';
  description?: string;
};

export type CncGroove = {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  widthMm: number;
  depthMm: number;
  description?: string;
};

export type CncPanel = {
  panelId: string;
  panelName: string;
  sku: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  material: string;
  finish: string;
  grain: 'length' | 'width' | 'none';
  edgebanding: {
    frontMm: number;
    rearMm: number;
    leftMm: number;
    rightMm: number;
  };
  holes: CncDrillHole[];
  grooves: CncGroove[];
};

export type CabinetCncPackage = {
  cabinetId: string;
  cabinetName: string;
  sku: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  panels: CncPanel[];
};

/**
 * Generates standard Homag WoodWOP 4.0 - 7.0 (.mpr) machine code.
 */
export function generateHomagWoodWopMpr(panel: CncPanel): string {
  const lines: string[] = [];

  // 1. Header block
  lines.push('[H');
  lines.push('VERSION="4.0"');
  lines.push('OP="1"');
  lines.push(`_BSX=${panel.lengthMm.toFixed(2)}`);
  lines.push(`_BSY=${panel.widthMm.toFixed(2)}`);
  lines.push(`_BSZ=${panel.thicknessMm.toFixed(2)}`);
  lines.push('_FRCH=0');
  lines.push(`_MAT="${panel.material.replace(/"/g, '')}"`);
  lines.push(`_COMMENT="ULTIDA CNC Post-Processor - ${panel.panelName} (${panel.sku})"`);
  lines.push(']');

  // 2. Workpiece setup & comments
  lines.push('[0001');
  lines.push('KL="KOPF"');
  lines.push(`KM="${panel.panelName}"`);
  lines.push(']');

  let opIndex = 100;

  // 3. Grooving operations (e.g. 6mm back panel rebate)
  for (const g of panel.grooves) {
    lines.push(`[${opIndex}`);
    lines.push('KL="NUTEN"');
    lines.push(`KM="${g.description ?? 'Back panel groove'}"`);
    lines.push('<100 \\Nuten\\');
    lines.push(`XA=${g.startX.toFixed(2)}`);
    lines.push(`YA=${g.startY.toFixed(2)}`);
    lines.push(`XE=${g.endX.toFixed(2)}`);
    lines.push(`YE=${g.endY.toFixed(2)}`);
    lines.push(`TI=${g.depthMm.toFixed(2)}`);
    lines.push(`BR=${g.widthMm.toFixed(2)}`);
    lines.push('F=10000');
    lines.push('S=18000');
    lines.push('T=101');
    lines.push(']');
    opIndex += 10;
  }

  // 4. Vertical drill holes (System 32 line boring & 35mm hinge cups)
  for (const h of panel.holes) {
    if (h.face === 'top') {
      lines.push(`[${opIndex}`);
      lines.push('KL="BOHRUNG"');
      lines.push(`KM="${h.description ?? `Vertical drill Dia ${h.diameterMm}mm`}"`);
      lines.push('<100 \\BohrVert\\');
      lines.push(`XA=${h.xMm.toFixed(2)}`);
      lines.push(`YA=${h.yMm.toFixed(2)}`);
      lines.push(`BM="LS"`);
      lines.push(`TI=${h.depthMm.toFixed(2)}`);
      lines.push(`DU=${h.diameterMm.toFixed(2)}`);
      lines.push('F=3000');
      lines.push('S=6000');
      lines.push('AN=1');
      lines.push(']');
      opIndex += 10;
    } else if (h.face === 'left' || h.face === 'right') {
      // Horizontal boring (Cam dowel / Minifix)
      lines.push(`[${opIndex}`);
      lines.push('KL="BOHRUNG_HORIZ"');
      lines.push(`KM="${h.description ?? `Horizontal drill Dia ${h.diameterMm}mm`}"`);
      lines.push('<100 \\BohrHoriz\\');
      lines.push(`XA=${h.xMm.toFixed(2)}`);
      lines.push(`YA=${h.yMm.toFixed(2)}`);
      lines.push(`ZA=${(panel.thicknessMm / 2).toFixed(2)}`);
      lines.push(`TI=${h.depthMm.toFixed(2)}`);
      lines.push(`DU=${h.diameterMm.toFixed(2)}`);
      lines.push(`WI=${h.face === 'left' ? '0' : '180'}`);
      lines.push('F=2500');
      lines.push('S=6000');
      lines.push('AN=1');
      lines.push(']');
      opIndex += 10;
    }
  }

  return lines.join('\r\n');
}

/**
 * Generates standard Biesse bSolid / BiesseWorks (.cix) CID3 macro code.
 */
export function generateBiesseCix(panel: CncPanel): string {
  const lines: string[] = [];

  // Program Identification Block
  lines.push('BEGIN ID CID3');
  lines.push(`\tPARAM,NAME=PRG,VALUE="${panel.sku}_${panel.panelId}"`);
  lines.push('\tPARAM,NAME=AUTHOR,VALUE="ULTIDA Architecture CAD/CAM"');
  lines.push(`\tPARAM,NAME=COMM,VALUE="${panel.panelName} - ${panel.material}"`);
  lines.push('END ID');

  // Workpiece Geometry Macro
  lines.push('BEGIN MACRO');
  lines.push('\tNAME=PANEL');
  lines.push(`\tPARAM,NAME=L,VALUE=${panel.lengthMm.toFixed(2)}`);
  lines.push(`\tPARAM,NAME=W,VALUE=${panel.widthMm.toFixed(2)}`);
  lines.push(`\tPARAM,NAME=T,VALUE=${panel.thicknessMm.toFixed(2)}`);
  lines.push(`\tPARAM,NAME=MAT,VALUE="${panel.material.replace(/"/g, '')}"`);
  lines.push(`\tPARAM,NAME=LCR,VALUE="1"`);
  lines.push('END MACRO');

  // Back panel groove
  for (const g of panel.grooves) {
    lines.push('BEGIN MACRO');
    lines.push('\tNAME=CUT_G');
    lines.push('\tPARAM,NAME=SIDE,VALUE=1');
    lines.push(`\tPARAM,NAME=X,VALUE=${g.startX.toFixed(2)}`);
    lines.push(`\tPARAM,NAME=Y,VALUE=${g.startY.toFixed(2)}`);
    lines.push(`\tPARAM,NAME=XE,VALUE=${g.endX.toFixed(2)}`);
    lines.push(`\tPARAM,NAME=YE,VALUE=${g.endY.toFixed(2)}`);
    lines.push(`\tPARAM,NAME=DP,VALUE=${g.depthMm.toFixed(2)}`);
    lines.push(`\tPARAM,NAME=TH,VALUE=${g.widthMm.toFixed(2)}`);
    lines.push('\tPARAM,NAME=OPT,VALUE="CUT"');
    lines.push('END MACRO');
  }

  // Drill Holes
  for (const h of panel.holes) {
    lines.push('BEGIN MACRO');
    lines.push('\tNAME=BG');
    lines.push(`\tPARAM,NAME=SIDE,VALUE=${h.face === 'top' ? '1' : h.face === 'left' ? '4' : '2'}`);
    lines.push(`\tPARAM,NAME=X,VALUE=${h.xMm.toFixed(2)}`);
    lines.push(`\tPARAM,NAME=Y,VALUE=${h.yMm.toFixed(2)}`);
    lines.push(`\tPARAM,NAME=Z,VALUE=${(panel.thicknessMm / 2).toFixed(2)}`);
    lines.push(`\tPARAM,NAME=D,VALUE=${h.diameterMm.toFixed(2)}`);
    lines.push(`\tPARAM,NAME=DP,VALUE=${h.depthMm.toFixed(2)}`);
    lines.push('END MACRO');
  }

  return lines.join('\r\n');
}

/**
 * Decomposes a standard cabinet into fully parametrised CNC panels with System 32 and hinge drilling.
 */
export function compileCabinetCncPackage(
  name: string,
  sku: string,
  widthMm: number,
  depthMm: number,
  heightMm: number,
  coreMaterial = 'Action TESA HDHMR 18mm'
): CabinetCncPackage {
  const carcassH = heightMm - 100; // Recessed plinth 100mm
  const carcassW = widthMm;
  const carcassD = depthMm;
  const internalW = widthMm - 36; // 18mm left gable + 18mm right gable

  // System 32 line boring hole coordinates
  const system32HolesFront: CncDrillHole[] = [];
  const system32HolesRear: CncDrillHole[] = [];
  const startY = 150;
  const endY = carcassH - 150;

  for (let y = startY; y <= endY; y += 32) {
    system32HolesFront.push({
      id: `sys32-f-${y}`,
      xMm: 37,
      yMm: y,
      diameterMm: 5.0,
      depthMm: 13.0,
      face: 'top',
      description: 'System 32 Front Pin Hole',
    });
    system32HolesRear.push({
      id: `sys32-r-${y}`,
      xMm: carcassD - 50,
      yMm: y,
      diameterMm: 5.0,
      depthMm: 13.0,
      face: 'top',
      description: 'System 32 Rear Pin Hole',
    });
  }

  // Hinge plate holes on gables (100mm from top, 100mm from bottom)
  const hingePlateHoles: CncDrillHole[] = [
    { id: 'hp-b-1', xMm: 37, yMm: 84, diameterMm: 5.0, depthMm: 13.0, face: 'top', description: 'Bottom Hinge Plate Hole 1' },
    { id: 'hp-b-2', xMm: 37, yMm: 116, diameterMm: 5.0, depthMm: 13.0, face: 'top', description: 'Bottom Hinge Plate Hole 2' },
    { id: 'hp-t-1', xMm: 37, yMm: carcassH - 116, diameterMm: 5.0, depthMm: 13.0, face: 'top', description: 'Top Hinge Plate Hole 1' },
    { id: 'hp-t-2', xMm: 37, yMm: carcassH - 84, diameterMm: 5.0, depthMm: 13.0, face: 'top', description: 'Top Hinge Plate Hole 2' },
  ];

  // Minifix horizontal cam dowel boring on bottom and top rails
  const minifixBores: CncDrillHole[] = [
    { id: 'mf-1', xMm: 50, yMm: 9, diameterMm: 8.0, depthMm: 34.0, face: 'left', description: 'Minifix Cam Dowel Front' },
    { id: 'mf-2', xMm: carcassD - 50, yMm: 9, diameterMm: 8.0, depthMm: 34.0, face: 'left', description: 'Minifix Cam Dowel Rear' },
  ];

  // Back panel groove
  const backGroove: CncGroove = {
    id: 'groove-back',
    startX: carcassD - 20,
    startY: 0,
    endX: carcassD - 20,
    endY: carcassH,
    widthMm: 6.0,
    depthMm: 8.0,
    description: 'Back Panel 6x8mm Rebated Groove',
  };

  // 1. Left Gable
  const leftGable: CncPanel = {
    panelId: 'GABLE_L',
    panelName: 'Left Gable End Panel',
    sku: `${sku}-P01`,
    lengthMm: carcassD,
    widthMm: carcassH,
    thicknessMm: 18,
    material: coreMaterial,
    finish: 'Balancing White Liner 0.8mm',
    grain: 'width',
    edgebanding: { frontMm: 2.0, rearMm: 0.8, leftMm: 1.0, rightMm: 1.0 },
    holes: [...system32HolesFront, ...system32HolesRear, ...hingePlateHoles],
    grooves: [backGroove],
  };

  // 2. Right Gable
  const rightGable: CncPanel = {
    panelId: 'GABLE_R',
    panelName: 'Right Gable End Panel',
    sku: `${sku}-P02`,
    lengthMm: carcassD,
    widthMm: carcassH,
    thicknessMm: 18,
    material: coreMaterial,
    finish: 'Balancing White Liner 0.8mm',
    grain: 'width',
    edgebanding: { frontMm: 2.0, rearMm: 0.8, leftMm: 1.0, rightMm: 1.0 },
    holes: [...system32HolesFront, ...system32HolesRear],
    grooves: [backGroove],
  };

  // 3. Bottom Base Panel
  const bottomPanel: CncPanel = {
    panelId: 'BASE_BTM',
    panelName: 'Bottom Base Shelf Panel',
    sku: `${sku}-P03`,
    lengthMm: internalW,
    widthMm: carcassD,
    thicknessMm: 18,
    material: coreMaterial,
    finish: 'Balancing White Liner 0.8mm',
    grain: 'length',
    edgebanding: { frontMm: 1.0, rearMm: 0.8, leftMm: 0, rightMm: 0 },
    holes: minifixBores,
    grooves: [
      {
        id: 'base-groove-back',
        startX: 0,
        startY: carcassD - 20,
        endX: internalW,
        endY: carcassD - 20,
        widthMm: 6.0,
        depthMm: 8.0,
        description: 'Bottom Back Panel Groove',
      },
    ],
  };

  // 4. Shutters / Doors with 35mm cup boring
  const shutterCount = widthMm >= 600 ? 2 : 1;
  const shutterW = Math.round(widthMm / shutterCount - 3);
  const shutterH = Math.round(carcassH - 4);

  const shutters: CncPanel[] = Array.from({ length: shutterCount }).map((_, idx) => ({
    panelId: `SHUTTER_${idx + 1}`,
    panelName: `Fascia Shutter Door ${idx + 1}`,
    sku: `${sku}-S0${idx + 1}`,
    lengthMm: shutterW,
    widthMm: shutterH,
    thicknessMm: 18,
    material: coreMaterial,
    finish: 'PU Fluted / Anti-Fingerprint Acrylic',
    grain: 'width',
    edgebanding: { frontMm: 2.0, rearMm: 2.0, leftMm: 2.0, rightMm: 2.0 },
    holes: [
      {
        id: 'cup-btm',
        xMm: 22.5,
        yMm: 100,
        diameterMm: 35.0,
        depthMm: 12.5,
        face: 'top',
        description: 'Blum Clip-Top 35mm Concealed Hinge Cup (Bottom)',
      },
      {
        id: 'cup-top',
        xMm: 22.5,
        yMm: shutterH - 100,
        diameterMm: 35.0,
        depthMm: 12.5,
        face: 'top',
        description: 'Blum Clip-Top 35mm Concealed Hinge Cup (Top)',
      },
    ],
    grooves: [],
  }));

  return {
    cabinetId: sku,
    cabinetName: name,
    sku,
    widthMm,
    depthMm,
    heightMm,
    panels: [leftGable, rightGable, bottomPanel, ...shutters],
  };
}
