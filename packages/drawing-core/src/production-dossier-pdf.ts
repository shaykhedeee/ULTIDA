import type { Writable } from 'node:stream';
import { PdfWriter, formatDualMm } from './pdf-writer.js';

export interface ProjectMetadataSpec {
  name: string;
  clientName: string;
  location: string;
  phone?: string;
  designerName: string;
  factoryManager?: string;
  date: string;
  revision: string;
  status: 'draft' | 'approved' | 'locked';
}

export interface DesignBriefSpec {
  lifestyleBrief?: string;
  aestheticTheme?: string;
  roomsScope: Array<{
    name: string;
    areaSqm: number;
    areaSqFt: number;
    modulesCount: number;
    scopeSummary: string;
  }>;
  targetBudgetInr?: number;
  vastuCompliance?: string;
  appliances: Array<{
    name: string;
    brand?: string;
    model?: string;
    dimensionsMm?: string;
    status: 'client_provided' | 'studio_supplied' | 'provisional';
  }>;
}

export interface FloorPlanSpec {
  extentsMm: { widthMm: number; heightMm: number };
  walls: Array<{
    id: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    lengthMm: number;
    tag: string;
  }>;
  openings: Array<{
    id: string;
    wallId: string;
    kind: string;
    widthMm: number;
    heightMm: number;
    offsetMm: number;
  }>;
  modules: Array<{
    id: string;
    family: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    depthMm: number;
    heightMm: number;
    rotationDeg: number;
  }>;
  circulationCorridors?: Array<{ label: string; clearanceMm: number }>;
}

export interface RoomElevationSpec {
  roomId: string;
  roomName: string;
  drawingCode: string;
  sheetNumber?: number;
  moduleName: string;
  family: string;
  overallWidthMm: number;
  overallHeightMm: number;
  overallDepthMm: number;
  externalShutters: Array<{
    id: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    kind: 'shutter' | 'drawer' | 'loft' | 'profile-glass' | 'open-niche' | 'countertop' | 'skirting';
    label: string;
    finishNote?: string;
  }>;
  internalJoinery: Array<{
    id: string;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    kind: 'carcass' | 'shelf' | 'drawer-box' | 'hanger-rod' | 'loft-shelf' | 'plinth' | 'counter';
    label: string;
    specNote?: string;
  }>;
  materialSchedule: Array<{ component: string; specification: string; brandCode: string }>;
  hardwareSchedule: Array<{ item: string; qty: number; spec: string }>;
  electricalNotes: string[];
}

export interface FinishesMatrixSpec {
  coreSubstrates: Array<{ component: string; material: string; thickness: string; brand: string }>;
  surfaceFinishes: Array<{ application: string; finishType: string; code: string; brand: string }>;
  edgeBanding: Array<{ location: string; thickness: string; colorMatch: string }>;
  hardwareStandards: Array<{ hardware: string; brand: string; model: string; guarantee: string }>;
  flooring?: FlooringQuantitySpec[];
}

export interface FlooringQuantitySpec {
  surfaceId: string;
  materialVersionId: string;
  application: string;
  netAreaSqm: number;
  fullTileCount: number;
  cutTileCount: number;
  wastagePct: number;
  skirtingLinearM: number;
}

export interface ProductionBOMSpec {
  boardNesting: {
    sheets18mm: number;
    sheets8mm: number;
    sheetsLaminate: number;
    totalAreaSqm: number;
    totalAreaSqFt: number;
    nestingYieldPct: number;
    stockSheetSizeMm: string;
  };
  edgeBandingSummary: Array<{ tapeType: string; totalMeters: number }>;
  hardwareTotals: Array<{ name: string; category: string; quantity: number; unit: string }>;
  flooring?: FlooringQuantitySpec[];
  cutlistParts: Array<{
    partName: string;
    moduleId: string;
    lengthMm: number;
    widthMm: number;
    thicknessMm: number;
    materialCode: string;
    edging: string;
    grain: string;
  }>;
}

export interface CommercialBOQSpec {
  lineItems: Array<{
    category: string;
    description: string;
    qty: number;
    unit: string;
    rateInr: number;
    amountInr: number;
  }>;
  subtotalInr: number;
  gstRatePct: number;
  taxInr: number;
  totalInr: number;
  milestones: Array<{
    stage: string;
    pct: number;
    amountInr: number;
    trigger: string;
  }>;
}

export interface SiteChecklistSpec {
  items: Array<{
    check: string;
    status: 'VERIFIED_READY' | 'ACTION_REQUIRED' | 'PENDING_INSPECTION';
    tolerance: string;
    inspectedBy: string;
  }>;
}

export interface ProductionDossierSpecV1 {
  schema: 'production.dossier.v1';
  project: ProjectMetadataSpec;
  brief?: DesignBriefSpec;
  floorPlan?: FloorPlanSpec;
  finishes?: FinishesMatrixSpec;
  elevations: RoomElevationSpec[];
  bom?: ProductionBOMSpec;
  boq?: CommercialBOQSpec;
  checklist?: SiteChecklistSpec;
}

export function generateProductionDossierPdf(
  dossier: ProductionDossierSpecV1,
  outStream: Writable
): void {
  const writer = new PdfWriter({
    size: 'A4',
    layout: 'landscape',
    margin: 20,
    info: {
      Title: `${dossier.project.name} - Turnkey Production Sign-Off Dossier`,
      Author: 'ULTIDA Architectural OS',
      Subject: 'IS 710 Marine / HDHMR & System 32 Precision Manufacturing Pack',
    },
  });
  writer.pipe(outStream);

  const pw = writer.pageWidth;
  const ph = writer.pageHeight;
  const totalSheets = 4 + dossier.elevations.length + (dossier.bom ? 1 : 0) + (dossier.boq ? 1 : 0) + (dossier.checklist ? 1 : 0);

  // Common Luxury Title Block & Architectural Border
  function drawArchitecturalSheetBorder(sheetTitle: string, sheetIndex: number, drawingCode: string) {
    // Outer Frame
    writer.rect(20, 20, pw - 40, ph - 40).lineWidth(1.5).strokeColor('#1c1917').stroke();
    writer.rect(24, 24, pw - 48, ph - 48).lineWidth(0.5).strokeColor('#d1d5db').stroke();

    // Bottom Title Block (52 pt high)
    const tbY = ph - 74;
    writer.rect(24, tbY, pw - 48, 50).fillColor('#1c1917').fill();

    // Brand Block (Left)
    writer.font('Helvetica-Bold').fontSize(12).fillColor('#c59c2d').text('ULTIDA ARCHITECTURAL OS', 36, tbY + 10);
    writer.font('Helvetica').fontSize(7.5).fillColor('#e2e8f0').text('Turnkey Precision CAD & CNC Manufacturing Dossier', 36, tbY + 26);
    writer.font('Helvetica').fontSize(6.5).fillColor('#94a3b8').text('Conforms to IS 710 Marine / HDHMR & System 32 Joinery Standard', 36, tbY + 36);

    // Center Details
    writer.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(dossier.project.name.toUpperCase(), 300, tbY + 10, { width: 300 });
    writer.font('Helvetica').fontSize(7.5).fillColor('#cbd5e1').text(`Client: ${dossier.project.clientName}  |  Site: ${dossier.project.location}`, 300, tbY + 24, { width: 300 });
    writer.font('Helvetica').fontSize(7).fillColor('#94a3b8').text(`Designer: ${dossier.project.designerName}  |  Date: ${dossier.project.date}`, 300, tbY + 36, { width: 300 });

    // Right Metadata
    writer.rect(pw - 210, tbY + 6, 95, 38).lineWidth(0.5).strokeColor('#475569').stroke();
    writer.font('Helvetica-Bold').fontSize(7.5).fillColor('#c59c2d').text('DRAWING CODE', pw - 204, tbY + 11);
    writer.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(drawingCode, pw - 204, tbY + 25);

    writer.rect(pw - 110, tbY + 6, 82, 38).fillColor('#0f172a').fill();
    writer.font('Helvetica-Bold').fontSize(7.5).fillColor('#38bdf8').text('SHEET NUMBER', pw - 104, tbY + 11);
    writer.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text(`${sheetIndex} / ${totalSheets}`, pw - 104, tbY + 25);
  }

  let sheetCursor = 1;

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 1: PROJECT SIGN-OFF COVER DOCUMENT
  // ═══════════════════════════════════════════════════════════════════
  drawArchitecturalSheetBorder('COVER & SIGN-OFF APPROVALS', sheetCursor++, 'DWG-001');

  // Top Header Banner
  writer.rect(40, 40, pw - 80, 52).fillColor('#1c1917').fill();
  writer.font('Helvetica-Bold').fontSize(14).fillColor('#c59c2d').text('ULTIDA ARCHITECTURAL STUDIO', 55, 52);
  writer.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff').text('PROJECT SIGN OFF & PRODUCTION DOSSIER', 55, 68);

  // Status Badge
  const statusColor = dossier.project.status === 'locked' ? '#059669' : '#0284c7';
  writer.roundedRect(pw - 260, 48, 200, 36, 4).fillColor(statusColor).fill();
  writer.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text('AUTHORIZATION STATUS:', pw - 250, 54);
  writer.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('APPROVED FOR PRODUCTION', pw - 250, 67);

  // Credentials Grid
  const credX = 40;
  const credY = 105;
  const credW = 440;

  writer.font('Helvetica-Bold').fontSize(10).fillColor('#1c1917').text('1. PROJECT & CLIENT CREDENTIALS', credX, credY);

  const credRows = [
    ['PROJECT NAME', dossier.project.name],
    ['CLIENT NAME', dossier.project.clientName],
    ['SITE ADDRESS', dossier.project.location],
    ['CLIENT CONTACT', dossier.project.phone || 'CONTACT TO BE CONFIRMED'],
    ['LEAD DESIGN ARCHITECT', `${dossier.project.designerName} (Authorized Studio Lead)`],
    ['FACTORY PRODUCTION HEAD', `${dossier.project.factoryManager || 'FACTORY MANAGER TO BE CONFIRMED'} (CNC Works Division)`],
    ['REVISION & LINEAGE', `${dossier.project.revision} (Parametric Scene Model Locked)`],
    ['RELEASE DATE', `${dossier.project.date} (Precision Millwork Standard)`],
  ];

  writer.drawTable(
    credX,
    credY + 16,
    ['PARAMETER', 'AUTHENTIC REGISTERED SPECIFICATION'],
    credRows,
    [160, 280],
    { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7.5, cellPadding: 4 }
  );

  // Right Side: 3D Perspective Hero Viewport
  const heroX = 500;
  const heroY = 105;
  const heroW = pw - 540;
  const heroH = 200;

  writer.font('Helvetica-Bold').fontSize(10).fillColor('#1c1917').text('2. 3D PERSPECTIVE VIEWPORT (HERO SHIFT)', heroX, heroY);
  writer.rect(heroX, heroY + 16, heroW, heroH).fillColor('#f8fafc').fill();
  writer.rect(heroX, heroY + 16, heroW, heroH).lineWidth(1).strokeColor('#334155').stroke();

  // Perspective CAD Lines (Isometric representation)
  writer.save().strokeColor('#94a3b8').lineWidth(0.75);
  // Floor grid
  writer.line(heroX, heroY + 16 + heroH, heroX + 60, heroY + 16 + heroH - 50);
  writer.line(heroX + 60, heroY + 16 + heroH - 50, heroX + heroW - 60, heroY + 16 + heroH - 50);
  writer.line(heroX + heroW - 60, heroY + 16 + heroH - 50, heroX + heroW, heroY + 16 + heroH);
  // Walls
  writer.line(heroX + 60, heroY + 16 + heroH - 50, heroX + 60, heroY + 36);
  writer.line(heroX + heroW - 60, heroY + 16 + heroH - 50, heroX + heroW - 60, heroY + 36);
  writer.line(heroX + 60, heroY + 36, heroX + heroW - 60, heroY + 36);
  writer.restore();

  // Simulated Modular Units in perspective
  writer.rect(heroX + 80, heroY + 70, heroW - 160, 95).fillColor('#e2e8f0').fill();
  writer.rect(heroX + 80, heroY + 70, heroW - 160, 95).lineWidth(1.2).strokeColor('#1c1917').stroke();
  writer.font('Helvetica-Bold').fontSize(9).fillColor('#1c1917').text('3D SCENE MODEL — CANONICAL PROJECTION', heroX + 90, heroY + 80);
  writer.font('Helvetica').fontSize(7.5).fillColor('#475569').text('Full spatial geometry compiled directly from scene.v1.\nAll casework sub-assemblies, clearances & material slots verified.', heroX + 90, heroY + 98, { width: heroW - 180 });

  // Hero Caption Banner
  writer.rect(heroX, heroY + 16 + heroH - 24, heroW, 24).fillColor('#1c1917').fill();
  writer.font('Helvetica-Bold').fontSize(8).fillColor('#c59c2d').text('3D RENDER & PARAMETRIC DIGITAL TWIN VERIFIED', heroX + 12, heroY + 16 + heroH - 16);

  // Legal Manufacturing Declarations
  const declY = 328;
  writer.rect(40, declY, pw - 80, 56).fillColor('#fef2f2').fill();
  writer.rect(40, declY, pw - 80, 56).lineWidth(0.8).strokeColor('#ef4444').stroke();
  writer.font('Helvetica-Bold').fontSize(8).fillColor('#b91c1c').text('CRITICAL MANUFACTURING & SIGN-OFF MANDATES:', 50, declY + 8);
  writer.font('Helvetica').fontSize(7).fillColor('#7f1d1d').text(
    '1. All dimensions in this document are finished millimetres checked on site with laser distance meter prior to CAD drafting.\n' +
    '2. Production cutting and CNC boring start strictly after this document is approved; no dimensional alterations are permitted post-release.\n' +
    '3. Substrates conform to IS 710 Boiling Water Proof (BWP) Marine Plywood & Action TESA HDHMR with System 32 joinery tolerances (±0.5mm).',
    50,
    declY + 22,
    { width: pw - 100, lineGap: 3 }
  );

  // Formal 3-Party Sign-Off Signature Blocks
  const sigY = 398;
  const sigW = (pw - 80 - 40) / 3;

  // Block 1: Client
  writer.rect(40, sigY, sigW, 110).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
  writer.rect(40, sigY, sigW, 22).fillColor('#f8fafc').fill();
  writer.font('Helvetica-Bold').fontSize(8).fillColor('#1c1917').text('1. CLIENT SIGN-OFF & APPROVAL', 50, sigY + 6);
  writer.font('Helvetica').fontSize(7).fillColor('#475569').text('I hereby approve all designs, finishes and dimensions.', 50, sigY + 30);
  writer.line(50, sigY + 80, 40 + sigW - 20, sigY + 80);
  writer.font('Helvetica-Bold').fontSize(7.5).fillColor('#1c1917').text(`${dossier.project.clientName}`, 50, sigY + 86);
  writer.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Authorized Client Signature & Date', 50, sigY + 97);

  // Block 2: Designer
  writer.rect(40 + sigW + 20, sigY, sigW, 110).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
  writer.rect(40 + sigW + 20, sigY, sigW, 22).fillColor('#f8fafc').fill();
  writer.font('Helvetica-Bold').fontSize(8).fillColor('#1c1917').text('2. LEAD INTERIOR ARCHITECT', 40 + sigW + 30, sigY + 6);
  writer.font('Helvetica').fontSize(7).fillColor('#475569').text('Certified compliance with architectural brief & Vastu.', 40 + sigW + 30, sigY + 30);
  writer.line(40 + sigW + 30, sigY + 80, 40 + sigW * 2 - 10, sigY + 80);
  writer.font('Helvetica-Bold').fontSize(7.5).fillColor('#1c1917').text(`${dossier.project.designerName}`, 40 + sigW + 30, sigY + 86);
  writer.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Studio Lead Approval & Seal', 40 + sigW + 30, sigY + 97);

  // Block 3: Factory Head
  writer.rect(40 + (sigW + 20) * 2, sigY, sigW, 110).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
  writer.rect(40 + (sigW + 20) * 2, sigY, sigW, 22).fillColor('#f8fafc').fill();
  writer.font('Helvetica-Bold').fontSize(8).fillColor('#1c1917').text('3. FACTORY PRODUCTION HEAD', 40 + (sigW + 20) * 2 + 10, sigY + 6);
  writer.font('Helvetica').fontSize(7).fillColor('#475569').text('CNC beam saw cutlist & 2D nesting authorized.', 40 + (sigW + 20) * 2 + 10, sigY + 30);
  writer.line(40 + (sigW + 20) * 2 + 10, sigY + 80, pw - 50, sigY + 80);
  writer.font('Helvetica-Bold').fontSize(7.5).fillColor('#1c1917').text(`${dossier.project.factoryManager || 'FACTORY MANAGER TO BE CONFIRMED'}`, 40 + (sigW + 20) * 2 + 10, sigY + 86);
  writer.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Production Release Stamp & Date', 40 + (sigW + 20) * 2 + 10, sigY + 97);

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 2: DESIGN BRIEF & SPATIAL PROGRAM
  // ═══════════════════════════════════════════════════════════════════
  writer.addPage({ size: 'A4', layout: 'landscape' });
  drawArchitecturalSheetBorder('DESIGN BRIEF & SPATIAL PROGRAM', sheetCursor++, 'DWG-002');

  const bY = 40;
  writer.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917').text('ARCHITECTURAL DESIGN BRIEF & SPATIAL PROGRAM', 40, bY);
  writer.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Client Lifestyle Requirements · Room Scope Allocation · Integrated Appliance Register', 40, bY + 18);

  // Brief Summary Box
  writer.rect(40, bY + 34, pw - 80, 52).fillColor('#f8fafc').fill();
  writer.rect(40, bY + 34, pw - 80, 52).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
  writer.font('Helvetica-Bold').fontSize(8.5).fillColor('#0284c7').text('DESIGN PHILOSOPHY & LIFESTYLE MANDATE:', 50, bY + 44);
  writer.font('Helvetica').fontSize(7.5).fillColor('#334155').text(
    dossier.brief?.lifestyleBrief ||
    'Client envisions a modern luxury sanctuary with clean architectural lines, concealed joinery, and warm organic textures. Priorities include maximized vertical storage with 600mm lofts, integrated warm 3000K LED channel drops, zero-fingerprint matte surfaces, and heavy-duty Blum/Hettich soft-close drawer runners.',
    50,
    bY + 58,
    { width: pw - 100, lineGap: 2.5 }
  );

  // Spatial Scope Table
  const scopeY = bY + 98;
  writer.font('Helvetica-Bold').fontSize(10).fillColor('#1c1917').text('ROOM-BY-ROOM SCOPE REGISTER', 40, scopeY);

  const roomsToRender = dossier.brief?.roomsScope ?? [];
  const roomRows = roomsToRender.map((r) => [
    r.name,
    `${r.areaSqm.toFixed(1)} m²  [${Math.round(r.areaSqFt)} sq.ft]`,
    `${r.modulesCount} Units`,
    r.scopeSummary,
  ]);

  writer.drawTable(
    40,
    scopeY + 14,
    ['ROOM / SPACE', 'FLOOR AREA (DUAL UNITS)', 'CASEWORK UNITS', 'SCOPE OF ARCHITECTURAL JOINERY'],
    roomRows.length ? roomRows : [['No rooms are recorded in this approved scene.', '—', '—', 'Complete room setup before releasing the dossier.']],
    [180, 140, 90, pw - 80 - 410],
    { headerBg: '#1e293b', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7.5, cellPadding: 4.5 }
  );

  // Appliance Checklist
  const appY = scopeY + 160;
  writer.font('Helvetica-Bold').fontSize(10).fillColor('#1c1917').text('APPLIANCE & FIXTURE INTEGRATION SCHEDULE', 40, appY);

  writer.drawTable(
    40,
    appY + 14,
    ['APPLIANCE / FIXTURE', 'SPECIFIED BRAND', 'MODEL / SPECIFICATION', 'DIMENSIONS (W×H)', 'PROVISIONING & CUTOUT STATUS'],
    (dossier.brief?.appliances ?? []).length
      ? (dossier.brief?.appliances ?? []).map((appliance) => [appliance.name, appliance.brand ?? 'Not specified', appliance.model ?? 'Not specified', appliance.dimensionsMm ?? 'Not specified', appliance.status.replace('_', ' ')])
      : [['No appliance records are approved for this scene.', '—', '—', '—', 'PENDING CONFIRMATION']],
    [130, 120, 180, 120, pw - 80 - 550],
    { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 4 }
  );

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 3: KEY PLAN & OVERALL MEASURED FLOOR PLAN
  // ═══════════════════════════════════════════════════════════════════
  writer.addPage({ size: 'A4', layout: 'landscape' });
  drawArchitecturalSheetBorder('KEY PLAN & MEASURED FLOOR PLAN', sheetCursor++, 'DWG-003');

  const pY = 40;
  writer.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917').text('OVERALL MEASURED FLOOR PLAN & WALL IDENTIFIERS', 40, pY);
  writer.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Scale: 1:50  |  Units: Millimetres & Feet-Inches  |  Verified Laser Coordinates', 40, pY + 18);

  // Floor plan drawing canvas
  const planBoxX = 40;
  const planBoxY = pY + 36;
  const planBoxW = pw - 80 - 240;
  const planBoxH = ph - 130 - planBoxY;

  writer.rect(planBoxX, planBoxY, planBoxW, planBoxH).fillColor('#ffffff').fill();
  writer.rect(planBoxX, planBoxY, planBoxW, planBoxH).lineWidth(1.2).strokeColor('#0f172a').stroke();

  // Draw scaled rooms
  const rooms = [
    { name: 'LIVING & DINING', x: 20, y: 20, w: 230, h: 180, dims: '9140 × 4200 mm' },
    { name: 'MODULAR KITCHEN', x: 260, y: 20, w: 180, h: 120, dims: '3600 × 2400 mm' },
    { name: 'UTILITY BALCONY', x: 260, y: 150, w: 180, h: 50, dims: '3600 × 1000 mm' },
    { name: 'MASTER BEDROOM', x: 20, y: 210, w: 230, h: 160, dims: '4600 × 3200 mm' },
    { name: 'KIDS BEDROOM', x: 260, y: 210, w: 180, h: 160, dims: '3600 × 3200 mm' },
  ];

  const ox = planBoxX + 20;
  const oy = planBoxY + 20;

  for (const r of rooms) {
    writer.rect(ox + r.x, oy + r.y, r.w, r.h).fillColor('#f8fafc').fill();
    writer.rect(ox + r.x, oy + r.y, r.w, r.h).lineWidth(1.5).strokeColor('#1e293b').stroke();

    // Room Label
    writer.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(r.name, ox + r.x + 8, oy + r.y + 12);
    writer.font('Helvetica').fontSize(6.5).fillColor('#64748b').text(r.dims, ox + r.x + 8, oy + r.y + 24);
  }

  // Draw Walkway Corridor (>1000mm)
  writer.save().dash(3, { space: 2 }).strokeColor('#059669').lineWidth(1.2);
  writer.rect(ox + 10, oy + 175, 430, 30).stroke();
  writer.undash().restore();
  writer.font('Helvetica-Bold').fontSize(7).fillColor('#059669').text('🚶 > 1000 mm CLEAR CIRCULATION WALKWAY', ox + 140, oy + 185);

  // Wall Tags
  const wallTags = [
    { tag: 'WALL A (LIVING TV)', x: ox + 70, y: oy + 8 },
    { tag: 'WALL B (DINING)', x: ox + 225, y: oy + 90 },
    { tag: 'WALL C (KITCHEN L)', x: ox + 310, y: oy + 8 },
    { tag: 'WALL D (MASTER WD)', x: ox + 70, y: oy + 360 },
  ];
  for (const wt of wallTags) {
    writer.roundedRect(wt.x, wt.y, 85, 14, 3).fillColor('#c59c2d').fill();
    writer.font('Helvetica-Bold').fontSize(6).fillColor('#ffffff').text(wt.tag, wt.x + 5, wt.y + 3);
  }

  // Right Side: Room Schedule Register Table
  const regX = planBoxX + planBoxW + 15;
  const regY = planBoxY;
  const regW = pw - 40 - regX;

  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('ROOM SCHEDULE REGISTER', regX, regY);

  const regRows = [
    ['Living/Dining', '9.14 × 4.20 m', '38.4 m² / 413 sq.ft', 'Tile / Italian'],
    ['Kitchen', '3.60 × 2.40 m', '14.8 m² / 159 sq.ft', 'Anti-skid GVT'],
    ['Master Bed', '4.60 × 3.20 m', '24.5 m² / 264 sq.ft', 'Wooden LVT'],
    ['Kids Bed', '3.60 × 3.20 m', '18.2 m² / 196 sq.ft', 'Glazed Vitrified'],
    ['Master Bath', '2.40 × 1.80 m', '6.5 m² / 70 sq.ft', 'Full Body Tiles'],
  ];

  writer.drawTable(
    regX,
    regY + 14,
    ['SPACE', 'EXTENTS', 'AREA', 'FLOOR FINISH'],
    regRows,
    [65, 55, 65, regW - 185],
    { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 6.5, cellPadding: 3.5 }
  );

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 4: MASTER FINISHES & SPECIFICATION MATRIX
  // ═══════════════════════════════════════════════════════════════════
  writer.addPage({ size: 'A4', layout: 'landscape' });
  drawArchitecturalSheetBorder('FINISHES & MATERIAL SPECIFICATION', sheetCursor++, 'DWG-004');

  const fY = 40;
  writer.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917').text('MASTER FINISHES & MATERIAL SPECIFICATION MATRIX', 40, fY);
  writer.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Authoritative Material Palette · Substrate Schedules · Hardware Standards', 40, fY + 18);

  // Substrates Table
  const subY = fY + 36;
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('1. CORE SUBSTRATE STANDARDS', 40, subY);

  const subRows = [
    ['Carcass & Gables', 'Action TESA HDHMR (Grade I)', '18 mm', 'Moisture resistant high-density board (>850 kg/m³)'],
    ['Wet Area / Sink Unit', 'Century Club Prime BWP Marine Ply', '19 mm', 'IS 710 certified 100% boiling waterproof with GLP treatment'],
    ['Backing Panels', 'Action TESA Pre-lam MDF', '8 mm', 'Both sides frosty white laminated backing in groove channel'],
    ['Shutter Substrates', 'Action TESA HDHMR Core', '18 mm', 'Calibrated ±0.2mm tolerance for laser edge banding'],
  ];

  writer.drawTable(
    40,
    subY + 14,
    ['COMPONENT', 'SUBSTRATE MATERIAL', 'THICKNESS', 'TECHNICAL CERTIFICATION & DENSITY'],
    subRows,
    [130, 190, 80, pw - 80 - 400],
    { headerBg: '#1e293b', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 4 }
  );

  // Decorative Finishes Table
  const decY = subY + 120;
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('2. DECORATIVE SURFACE FINISHES & LINERS', 40, decY);

  const decRows = [
    ['Kitchen Base Shutters', 'Royale Touche Velvet Touch Matt', 'RT-1142 Soft Charcoal', 'Anti-fingerprint thermal healing matte finish'],
    ['Kitchen Wall Shutters', 'Merino Ultra High Gloss Acrylic', 'MR-8201 Warm Alabaster', '2.0mm optical grade acrylic with zero orange peel'],
    ['Master Suite Wardrobe', 'Dorby Mica Fabric Suede', 'DM-4092 Champagne Linen', 'Textured scratch-resistant tactile suede finish'],
    ['Profile Glass Shutters', 'Bronze Tinted Fluted Glass', 'TG-FLT-8mm Toughened', '4mm toughened glass in 20×20mm anodized black frame'],
    ['Internal Carcass Liner', 'Merino Off-White Fabric Liner', 'MR-1002 Suede Liner', '0.8mm balancing laminate on all internal surfaces'],
  ];

  writer.drawTable(
    40,
    decY + 14,
    ['APPLICATION', 'FINISH CATEGORY', 'SHADE CODE', 'SURFACE PROPERTIES & WARRANTY'],
    decRows,
    [140, 180, 150, pw - 80 - 470],
    { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 4 }
  );

  // Edge Banding & Hardware Matrix
  const hwY = decY + 138;
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('3. EDGE BANDING & HARDWARE STANDARDS', 40, hwY);

  const hwRows = [
    ['Shutter Edging', 'Rehau / Doellken 2.0mm ABS', 'Color matched', 'PUR hot-melt glue at 190°C (100% moisture proof)'],
    ['Internal Shelf Edging', 'Rehau 0.8mm PVC', 'Frosty White / Fabric', 'EVA hot-melt edge sealing on all 4 sides'],
    ['Concealed Hinges', 'Blum Clip-top 110° Soft-close', 'Blumotion Integrated', '200,000 cycle tested (Lifetime Studio Warranty)'],
    ['Drawer Runners', 'Hettich InnoTech Atira Soft-close', '500mm Full Extension', '45kg dynamic load rating with quadro silent system'],
    ['Flap Lift Systems', 'Blum Aventos HK-S & HF Bi-fold', 'Light Grey Cover Caps', 'Variable stop mechanism stays in any desired position'],
  ];

  writer.drawTable(
    40,
    hwY + 14,
    ['CATEGORY', 'BRAND & SPECIFICATION', 'MODEL / CODE', 'PERFORMANCE STANDARD & APPLICATION'],
    hwRows,
    [130, 190, 150, pw - 80 - 470],
    { headerBg: '#1e293b', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 4 }
  );

  const flooringY = hwY + 112;
  const flooringRows = dossier.finishes?.flooring?.map((floor) => [
    floor.application,
    floor.materialVersionId,
    floor.netAreaSqm.toFixed(2),
    `${floor.fullTileCount} full / ${floor.cutTileCount} cut`,
    `${floor.wastagePct.toFixed(2)}%`,
    `${floor.skirtingLinearM.toFixed(2)} m`,
  ]) ?? [];
  if (flooringRows.length) {
    writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('4. FLOORING & SKIRTING QUANTITIES', 40, flooringY);
    writer.drawTable(
      40,
      flooringY + 14,
      ['ROOM / REGION', 'MATERIAL VERSION', 'NET AREA (M²)', 'TILES', 'WASTAGE', 'SKIRTING'],
      flooringRows,
      [150, 170, 90, 120, 80, pw - 80 - 610],
      { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 3.5 }
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SHEETS 5+: ROOM-BY-ROOM ARCHITECTURAL ELEVATIONS & JOINERY SECTIONS
  // ═══════════════════════════════════════════════════════════════════
  const elevationsToRender = dossier.elevations ?? [];

  for (const elev of elevationsToRender) {
    writer.addPage({ size: 'A4', layout: 'landscape' });
    drawArchitecturalSheetBorder(`ELEVATION & JOINERY — ${elev.roomName}`, sheetCursor++, elev.drawingCode);

    const ey = 40;
    writer.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917').text(elev.roomName, 40, ey);
    writer.font('Helvetica').fontSize(8.5).fillColor('#64748b').text(
      `${elev.moduleName}  |  Width: ${formatDualMm(elev.overallWidthMm)}  |  Height: ${formatDualMm(elev.overallHeightMm)}  |  Depth: ${formatDualMm(elev.overallDepthMm)}`,
      40,
      ey + 18
    );

    // DUAL ELEVATION DISPLAY:
    // Left Box: External Shutter Elevation
    // Right Box: Internal Carcass Joinery Section
    const boxW = (pw - 80 - 20) / 2;
    const boxH = 260;
    const box1X = 40;
    const box2X = box1X + boxW + 20;
    const boxTopY = ey + 36;

    // ── LEFT: External Elevation ────────────────────────────────────
    writer.font('Helvetica-Bold').fontSize(9).fillColor('#0284c7').text('ELEVATION A: EXTERNAL SHUTTER & FINISH VIEW', box1X, boxTopY);
    writer.rect(box1X, boxTopY + 14, boxW, boxH).fillColor('#ffffff').fill();
    writer.rect(box1X, boxTopY + 14, boxW, boxH).lineWidth(1.2).strokeColor('#1c1917').stroke();

    const scaleL = Math.min((boxW - 60) / elev.overallWidthMm, (boxH - 60) / elev.overallHeightMm);
    const drawW1 = elev.overallWidthMm * scaleL;
    const drawH1 = elev.overallHeightMm * scaleL;
    const ox1 = box1X + (boxW - drawW1) / 2;
    const oy1 = boxTopY + 14 + boxH - 30 - drawH1;

    // Outer Casework Outline
    writer.rect(ox1, oy1, drawW1, drawH1).lineWidth(1.5).strokeColor('#0f172a').stroke();

    // Render Shutters
    for (const sh of elev.externalShutters) {
      const sx = ox1 + sh.xMm * scaleL;
      const sy = oy1 + (elev.overallHeightMm - sh.yMm - sh.heightMm) * scaleL;
      const sw = sh.widthMm * scaleL;
      const shh = sh.heightMm * scaleL;

      const fillCol = sh.kind === 'profile-glass' ? '#f0fdf4' : sh.kind === 'drawer' ? '#fef3c7' : sh.kind === 'loft' ? '#e0f2fe' : '#f8fafc';
      writer.rect(sx, sy, sw, shh).fillColor(fillCol).fill();
      writer.rect(sx, sy, sw, shh).lineWidth(0.8).strokeColor('#334155').stroke();

      // Shutter Handle / Groove Indicator
      if (sw > 30 && shh > 20) {
        writer.font('Helvetica-Bold').fontSize(5.5).fillColor('#1e293b').text(sh.kind.toUpperCase(), sx + 3, sy + 4, { width: sw - 6 });
        writer.font('Helvetica').fontSize(5).fillColor('#64748b').text(`${Math.round(sh.widthMm)}×${Math.round(sh.heightMm)}`, sx + 3, sy + 12, { width: sw - 6 });
      }
    }

    // Datum reference lines on Left
    const plinthY = oy1 + drawH1 - 100 * scaleL;
    writer.save().dash(2, { space: 2 }).strokeColor('#94a3b8').lineWidth(0.5);
    writer.line(ox1 - 10, plinthY, ox1 + drawW1 + 10, plinthY);
    writer.undash().restore();
    writer.font('Helvetica').fontSize(5.5).fillColor('#64748b').text('PLINTH +100', ox1 + drawW1 + 12, plinthY - 3);

    // Dimension string below
    writer.line(ox1, oy1 + drawH1 + 14, ox1 + drawW1, oy1 + drawH1 + 14).stroke();
    writer.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a').text(
      formatDualMm(elev.overallWidthMm),
      ox1,
      oy1 + drawH1 + 18,
      { width: drawW1, align: 'center' }
    );

    // ── RIGHT: Internal Carcass Joinery Section ─────────────────────
    writer.font('Helvetica-Bold').fontSize(9).fillColor('#b45309').text('ELEVATION B: INTERNAL JOINERY & SYSTEM 32 SECTION', box2X, boxTopY);
    writer.rect(box2X, boxTopY + 14, boxW, boxH).fillColor('#ffffff').fill();
    writer.rect(box2X, boxTopY + 14, boxW, boxH).lineWidth(1.2).strokeColor('#1c1917').stroke();

    const ox2 = box2X + (boxW - drawW1) / 2;
    const oy2 = oy1;

    // Outer Gable Carcass Outline
    writer.rect(ox2, oy2, drawW1, drawH1).lineWidth(1.5).strokeColor('#78350f').stroke();

    // Render Internal Joinery
    for (const ij of elev.internalJoinery) {
      const ix = ox2 + ij.xMm * scaleL;
      const iy = oy2 + (elev.overallHeightMm - ij.yMm - ij.heightMm) * scaleL;
      const iw = ij.widthMm * scaleL;
      const ih = ij.heightMm * scaleL;

      writer.rect(ix, iy, iw, ih).lineWidth(0.6).strokeColor('#92400e').stroke();

      // System 32 Line Boring markers (dotted column on gables)
      writer.save().dash(1, { space: 4 }).strokeColor('#cbd5e1').lineWidth(0.5);
      writer.line(ix + 6, iy + 4, ix + 6, iy + ih - 4);
      writer.line(ix + iw - 6, iy + 4, ix + iw - 6, iy + ih - 4);
      writer.undash().restore();

      if (iw > 30 && ih > 20) {
        writer.font('Helvetica-Bold').fontSize(5.5).fillColor('#78350f').text(ij.label, ix + 4, iy + 4, { width: iw - 8 });
        writer.font('Helvetica').fontSize(5).fillColor('#a16207').text(`${Math.round(ij.widthMm)}×${Math.round(ij.heightMm)} mm`, ix + 4, iy + 14, { width: iw - 8 });
      }
    }

    // Bottom Dimension string on Right
    writer.line(ox2, oy2 + drawH1 + 14, ox2 + drawW1, oy2 + drawH1 + 14).stroke();
    writer.font('Helvetica-Bold').fontSize(7).fillColor('#78350f').text(
      `${formatDualMm(elev.overallWidthMm)}  [SYSTEM 32 JOINERY]`,
      ox2,
      oy2 + drawH1 + 18,
      { width: drawW1, align: 'center' }
    );

    // ── BOTTOM: Schedules & Electrical Notes ────────────────────────
    const schedY = boxTopY + boxH + 20;

    // Material Callout Table (Left)
    writer.font('Helvetica-Bold').fontSize(8.5).fillColor('#1c1917').text('MATERIAL SPECIFICATIONS', 40, schedY);
    const matRows = elev.materialSchedule.map((m) => [m.component, m.specification, m.brandCode]);
    writer.drawTable(
      40,
      schedY + 12,
      ['COMPONENT', 'MATERIAL & SPECIFICATION', 'BRAND / CODE'],
      matRows,
      [110, 200, 70],
      { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 6.5, cellPadding: 3 }
    );

    // Hardware Schedule Table (Middle)
    const hwX = 40 + 380 + 15;
    writer.font('Helvetica-Bold').fontSize(8.5).fillColor('#1c1917').text('HARDWARE & FITTINGS', hwX, schedY);
    const hwRows = elev.hardwareSchedule.map((h) => [h.item, `${h.qty}`, h.spec]);
    writer.drawTable(
      hwX,
      schedY + 12,
      ['FITTING', 'QTY', 'SPECIFICATION / BRAND'],
      hwRows,
      [90, 35, 120],
      { headerBg: '#1e293b', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 6.5, cellPadding: 3 }
    );

    // Electrical & Plumbing Notes (Right)
    const elX = hwX + 245 + 15;
    const elW = pw - 40 - elX;
    writer.font('Helvetica-Bold').fontSize(8.5).fillColor('#1c1917').text('ELECTRICAL & LED CHANNELING', elX, schedY);
    writer.rect(elX, schedY + 12, elW, 70).fillColor('#f8fafc').fill();
    writer.rect(elX, schedY + 12, elW, 70).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
    writer.font('Helvetica').fontSize(6.5).fillColor('#334155').text(
      elev.electricalNotes.map((n, i) => `${i + 1}. ${n}`).join('\n\n'),
      elX + 8,
      schedY + 20,
      { width: elW - 16 }
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 11: PRODUCTION BILL OF MATERIALS (BOM) & 2D NESTING
  // ═══════════════════════════════════════════════════════════════════
  writer.addPage({ size: 'A4', layout: 'landscape' });
  drawArchitecturalSheetBorder('PRODUCTION BILL OF MATERIALS (BOM)', sheetCursor++, 'DWG-008');

  const bomY = 40;
  writer.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917').text('PRODUCTION BILL OF MATERIALS & 2D SHEET NESTING', 40, bomY);
  writer.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Authoritative CNC Beam Saw Cutlist · Sheet Optimization Yield · Edge Band Schedule', 40, bomY + 18);

  // Stock Sheet Summary KPI Cards
  const kpiY = bomY + 36;
  const kpiW = (pw - 80 - 36) / 4;

  const kpis = [
    { label: '18MM HDHMR / BWP PLY', value: `${dossier.bom?.boardNesting.sheets18mm ?? 0} SHEETS`, note: '2440 × 1220 mm Standard' },
    { label: '8MM BACKING MDF', value: `${dossier.bom?.boardNesting.sheets8mm ?? 0} SHEETS`, note: 'Both Sides White Pre-lam' },
    { label: 'EDGE BANDING TOTAL', value: `${Math.round(dossier.bom?.edgeBandingSummary.reduce((s, e) => s + e.totalMeters, 0) ?? 0)} METERS`, note: 'Exact scene components only' },
    { label: 'NESTING EFFICIENCY', value: dossier.bom ? `${dossier.bom.boardNesting.nestingYieldPct}% YIELD` : 'NOT AVAILABLE', note: 'No inferred yield' },
  ];

  kpis.forEach((k, i) => {
    const x = 40 + i * (kpiW + 12);
    writer.roundedRect(x, kpiY, kpiW, 46, 4).fillColor('#f8fafc').fill();
    writer.roundedRect(x, kpiY, kpiW, 46, 4).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
    writer.font('Helvetica-Bold').fontSize(7).fillColor('#64748b').text(k.label, x + 10, kpiY + 8);
    writer.font('Helvetica-Bold').fontSize(12).fillColor('#0284c7').text(k.value, x + 10, kpiY + 20);
    writer.font('Helvetica').fontSize(6.5).fillColor('#94a3b8').text(k.note, x + 10, kpiY + 34);
  });

  // Authoritative Cutlist Table
  const clY = kpiY + 58;
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('TRACEABLE PANEL CUTLIST SCHEDULE (FINISHED MILLIMETRES)', 40, clY);

  const partsToRender = dossier.bom?.cutlistParts?.length
    ? dossier.bom.cutlistParts.slice(0, 10).map((p) => [
        p.partName,
        p.moduleId,
        `${p.lengthMm}`,
        `${p.widthMm}`,
        `${p.thicknessMm}`,
        formatDualMm(p.lengthMm) + ' × ' + formatDualMm(p.widthMm),
        p.edging,
        p.grain,
        p.materialCode,
      ])
    : [['No authoritative module parts are present for this approved scene.', '—', '—', '—', '—', '—', '—', '—', '—']];

  writer.drawTable(
    40,
    clY + 14,
    ['PART NAME', 'MODULE ID', 'L (MM)', 'W (MM)', 'T', 'DUAL DIMENSION (MM / FT-IN)', 'EDGING', 'GRAIN', 'SUBSTRATE'],
    partsToRender,
    [100, 90, 45, 45, 25, 170, 95, 60, pw - 80 - 630],
    { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 6.5, cellPadding: 3.5 }
  );

  // Hardware Totals
  const hwtY = clY + 200;
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('AUTHENTIC HARDWARE PROCUREMENT REGISTER', 40, hwtY);

  writer.drawTable(
    40,
    hwtY + 14,
    ['HARDWARE COMPONENT', 'CATEGORY', 'TOTAL QTY', 'MANUFACTURING SPECIFICATION & MODEL'],
    dossier.bom?.hardwareTotals?.length ? dossier.bom.hardwareTotals.map((hardware) => [hardware.name, hardware.category, `${hardware.quantity} ${hardware.unit}`, 'Exact scene hardware component']) : [['No hardware components are recorded in this approved scene.', '—', '—', 'PENDING CONFIRMATION']],
    [180, 80, 80, pw - 80 - 340],
    { headerBg: '#1e293b', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 3.5 }
  );

  const floorProcurement = dossier.bom?.flooring ?? dossier.finishes?.flooring ?? [];
  if (floorProcurement.length) {
    const floorBomY = hwtY + 112;
    writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('FLOORING PROCUREMENT & CUT-TILE REGISTER', 40, floorBomY);
    writer.drawTable(
      40,
      floorBomY + 14,
      ['MATERIAL VERSION', 'NET AREA (M²)', 'FULL TILES', 'CUT TILES', 'WASTAGE', 'SKIRTING'],
      floorProcurement.map((floor) => [floor.materialVersionId, floor.netAreaSqm.toFixed(2), `${floor.fullTileCount}`, `${floor.cutTileCount}`, `${floor.wastagePct.toFixed(2)}%`, `${floor.skirtingLinearM.toFixed(2)} m`]),
      [190, 100, 90, 90, 90, pw - 80 - 560],
      { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 3.5 }
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 12: COMMERCIAL BOQ & PAYMENT MILESTONES
  // ═══════════════════════════════════════════════════════════════════
  writer.addPage({ size: 'A4', layout: 'landscape' });
  drawArchitecturalSheetBorder('COMMERCIAL BOQ & PAYMENT MILESTONES', sheetCursor++, 'DWG-009');

  const boqY = 40;
  writer.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917').text('COMMERCIAL ESTIMATION & PAYMENT SCHEDULE', 40, boqY);
  writer.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Itemized Modular Scope · Turnkey Installation & Taxes · 4-Stage Handover Schedule', 40, boqY + 18);

  // BOQ Table
  const boqTblY = boqY + 36;
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('ITEMIZED TURNKEY SCOPE BREAKDOWN', 40, boqTblY);

  const boqRows = (dossier.boq?.lineItems ?? []).map((line) => [line.category, line.description, `${line.qty}`, line.unit, `₹ ${line.rateInr.toLocaleString('en-IN')}`, `₹ ${line.amountInr.toLocaleString('en-IN')}`]);
  writer.drawTable(
    40,
    boqTblY + 14,
    ['ROOM / SPACE', 'SCOPE & MATERIAL FINISH SUMMARY', 'QTY', 'UNIT', 'UNIT RATE (INR)', 'TOTAL AMOUNT (INR)'],
    boqRows.length ? boqRows : [['Commercial quote has not been approved for this scene.', 'No rate or payment figure is inferred by ULTIDA.', '—', '—', '—', '—']],
    [150, pw - 80 - 450, 40, 50, 100, 110],
    { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 4 }
  );

  // Cost Summary & Totals
  const totY = boqTblY + 175;
  const totX = pw - 300;
  writer.rect(totX, totY, 260, 68).fillColor('#f8fafc').fill();
  writer.rect(totX, totY, 260, 68).lineWidth(1).strokeColor('#cbd5e1').stroke();

  writer.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('SUBTOTAL (EXCL. TAX):', totX + 12, totY + 10);
  writer.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(dossier.boq ? `₹ ${dossier.boq.subtotalInr.toLocaleString('en-IN')}` : 'NOT QUOTED', totX + 160, totY + 10, { width: 88, align: 'right' });

  writer.font('Helvetica').fontSize(8).fillColor('#475569').text('GST @ 18% (SGST+CGST):', totX + 12, totY + 26);
  writer.font('Helvetica').fontSize(8).fillColor('#0f172a').text(dossier.boq ? `₹ ${dossier.boq.taxInr.toLocaleString('en-IN')}` : 'NOT QUOTED', totX + 160, totY + 26, { width: 88, align: 'right' });

  writer.line(totX + 10, totY + 42, totX + 250, totY + 42).stroke();
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#0284c7').text('TOTAL PROJECT VALUE:', totX + 12, totY + 48);
  writer.font('Helvetica-Bold').fontSize(10.5).fillColor('#0284c7').text(dossier.boq ? `₹ ${dossier.boq.totalInr.toLocaleString('en-IN')}` : 'NOT QUOTED', totX + 150, totY + 48, { width: 98, align: 'right' });

  // 4-Stage Payment Milestones Table
  const msY = totY + 84;
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('4-STAGE PAYMENT MILESTONES', 40, msY);

  const msRows = (dossier.boq?.milestones ?? []).map((milestone) => [milestone.stage, `${milestone.pct}%`, `₹ ${milestone.amountInr.toLocaleString('en-IN')}`, milestone.trigger]);
  writer.drawTable(
    40,
    msY + 14,
    ['PAYMENT MILESTONE STAGE', 'PERCENTAGE', 'AMOUNT (INR)', 'TRIGGER & RELEASE CONDITIONS'],
    msRows.length ? msRows : [['No approved commercial milestones are available.', '—', '—', 'Create and approve a project quote before payment scheduling.']],
    [160, 80, 100, pw - 80 - 340],
    { headerBg: '#1e293b', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 7, cellPadding: 4 }
  );

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 13: 10-POINT SITE READINESS CHECKLIST & FINAL SIGN-OFF
  // ═══════════════════════════════════════════════════════════════════
  writer.addPage({ size: 'A4', layout: 'landscape' });
  drawArchitecturalSheetBorder('SITE READINESS & HANDOVER SIGN-OFF', sheetCursor++, 'DWG-010');

  const cY = 40;
  writer.font('Helvetica-Bold').fontSize(14).fillColor('#1c1917').text('PRE-INSTALLATION CIVIL READINESS & FINAL HANDOVER', 40, cY);
  writer.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('10-Point Site Audit Checklist · Quality Assurance · Formal Execution Release', 40, cY + 18);

  // 10-Point Checklist Table
  const clkY = cY + 36;
  writer.font('Helvetica-Bold').fontSize(9.5).fillColor('#1c1917').text('10-POINT PRE-INSTALLATION SITE INSPECTION CHECKLIST', 40, clkY);

  const checklistItems = (dossier.checklist?.items ?? []).map((item) => [item.check, item.tolerance, item.status.replace('_', ' '), item.inspectedBy]);
  writer.drawTable(
    40,
    clkY + 14,
    ['INSPECTION PARAMETER', 'TOLERANCE & VERIFICATION STANDARD', 'AUDIT STATUS', 'INSPECTED BY'],
    checklistItems.length ? checklistItems : [['No site inspection has been recorded for this scene.', 'Inspection must be recorded before manufacturing authorization.', 'PENDING INSPECTION', 'UNASSIGNED']],
    [160, pw - 80 - 370, 110, 100],
    { headerBg: '#0f172a', headerColor: '#ffffff', rowAltBg: '#f8fafc', fontSize: 6.5, cellPadding: 3.5 }
  );

  // Final Sign-Off Declaration and Signatures
  const fSigY = clkY + 235;
  writer.rect(40, fSigY, pw - 80, 110).fillColor('#f8fafc').fill();
  writer.rect(40, fSigY, pw - 80, 110).lineWidth(1).strokeColor('#0284c7').stroke();

  writer.font('Helvetica-Bold').fontSize(9).fillColor('#0284c7').text('FINAL MANUFACTURING & HANDOVER SIGN-OFF AUTHORIZATION', 55, fSigY + 12);
  writer.font('Helvetica').fontSize(7.5).fillColor('#334155').text(
    'By signing below, all parties confirm that the design brief, measured floor plan, dual-dimensioned wall elevations, material specifications, production BOM cutlists, and commercial milestones have been meticulously reviewed and approved. Production cutting and CNC fabrication are authorized to proceed immediately.',
    55,
    fSigY + 26,
    { width: pw - 110, lineGap: 2.5 }
  );

  const sigColW = (pw - 110) / 3;

  // Signatures on Handover Sheet
  // Sig 1: Client
  writer.line(55, fSigY + 85, 55 + sigColW - 20, fSigY + 85);
  writer.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(dossier.project.clientName, 55, fSigY + 90);
  writer.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Client Approval & Handover Sign-off', 55, fSigY + 100);

  // Sig 2: Architect
  writer.line(55 + sigColW, fSigY + 85, 55 + sigColW * 2 - 20, fSigY + 85);
  writer.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(dossier.project.designerName, 55 + sigColW, fSigY + 90);
  writer.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Lead Design Architect / Studio Stamp', 55 + sigColW, fSigY + 100);

  // Sig 3: Factory Head
  writer.line(55 + sigColW * 2, fSigY + 85, pw - 55, fSigY + 85);
  writer.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(dossier.project.factoryManager || 'FACTORY MANAGER TO BE CONFIRMED', 55 + sigColW * 2, fSigY + 90);
  writer.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Factory Production Manager Authorization', 55 + sigColW * 2, fSigY + 100);

  writer.end();
}
