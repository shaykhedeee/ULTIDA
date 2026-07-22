import type { SceneV1 } from '@ultida/scene-core';
import PDFDocument from 'pdfkit';

export type DrawingLine = { id: string; layer: 'walls' | 'modules' | 'openings'; x1: number; y1: number; x2: number; y2: number };
export type ProjectedOpening = { id: string; kind: string; wallId: string; offsetMm: number; widthMm: number; heightMm: number };
export type ProjectedModule = { id: string; family: string; roomId: string; xMm: number; yMm: number; widthMm: number; depthMm: number; heightMm: number; rotationDeg: number; wallId?: string; offsetAlongWallMm?: number };
export type WallElevationProjection = { wallId: string; lengthMm: number; heightMm: number; openings: ProjectedOpening[]; modules: ProjectedModule[] };
export type DrawingPackageProjection = {
  schema: 'drawing.projection.v1';
  units: 'mm';
  projectId: string;
  floorPlanVersionId: string;
  sceneStatus: SceneV1['metadata']['status'];
  lines: DrawingLine[];
  openings: ProjectedOpening[];
  modules: ProjectedModule[];
  elevations: WallElevationProjection[];
  warnings: string[];
};

function finitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function wallLength(wall: SceneV1['walls'][number]) {
  return Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm);
}

function moduleWallPosition(module: SceneV1['modules'][number], wall: SceneV1['walls'][number]) {
  const length = wallLength(wall);
  if (!length) return { distance: Number.POSITIVE_INFINITY, offset: 0 };
  const ux = (wall.end.xMm - wall.start.xMm) / length;
  const uy = (wall.end.yMm - wall.start.yMm) / length;
  const px = module.position.xMm - wall.start.xMm;
  const py = module.position.yMm - wall.start.yMm;
  const offset = Math.max(0, Math.min(length, px * ux + py * uy));
  const projectedX = wall.start.xMm + offset * ux;
  const projectedY = wall.start.yMm + offset * uy;
  return { distance: Math.hypot(module.position.xMm - projectedX, module.position.yMm - projectedY), offset };
}

function rotatedRectangle(x: number, y: number, width: number, depth: number, rotationDeg: number) {
  const angle = rotationDeg * Math.PI / 180;
  const cos = Math.cos(angle); const sin = Math.sin(angle);
  const point = (localX: number, localY: number) => ({ x: x + localX * cos - localY * sin, y: y + localX * sin + localY * cos });
  return [point(0, 0), point(width, 0), point(width, depth), point(0, depth)];
}

function openingLine(opening: ProjectedOpening, walls: SceneV1['walls']) {
  const wall = walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) return null;
  const length = wallLength(wall);
  if (!finitePositive(length) || opening.offsetMm + opening.widthMm > length + 0.01) return null;
  const ux = (wall.end.xMm - wall.start.xMm) / length;
  const uy = (wall.end.yMm - wall.start.yMm) / length;
  const start = { x: wall.start.xMm + ux * opening.offsetMm, y: wall.start.yMm + uy * opening.offsetMm };
  const end = { x: start.x + ux * opening.widthMm, y: start.y + uy * opening.widthMm };
  return { id: opening.id, layer: 'openings' as const, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

export function buildDrawingProjection(scene: SceneV1): DrawingPackageProjection {
  const warnings: string[] = [];
  const lines: DrawingLine[] = [];
  for (const wall of scene.walls ?? []) {
    if (!finitePositive(wallLength(wall))) {
      warnings.push(`Wall ${wall.id} has zero or invalid length and was skipped.`);
      continue;
    }
    lines.push({ id: wall.id, layer: 'walls', x1: wall.start.xMm, y1: wall.start.yMm, x2: wall.end.xMm, y2: wall.end.yMm });
  }
  const modules: ProjectedModule[] = [];
  for (const module of scene.modules ?? []) {
    if (![module.widthMm, module.depthMm, module.heightMm].every(finitePositive)) {
      warnings.push(`Module ${module.id} has invalid dimensions and was skipped.`);
      continue;
    }
    const nearest = (scene.walls ?? []).map((wall) => ({ wall, ...moduleWallPosition(module, wall) })).sort((a, b) => a.distance - b.distance)[0];
    const projected: ProjectedModule = { id: module.id, family: module.family, roomId: module.roomId, xMm: module.position.xMm, yMm: module.position.yMm, widthMm: module.widthMm, depthMm: module.depthMm, heightMm: module.heightMm, rotationDeg: module.rotationDeg, wallId: nearest?.wall.id, offsetAlongWallMm: nearest?.offset };
    modules.push(projected);
    const corners = rotatedRectangle(projected.xMm, projected.yMm, projected.widthMm, projected.depthMm, projected.rotationDeg);
    corners.forEach((corner, index) => {
      const next = corners[(index + 1) % corners.length];
      lines.push({ id: `${module.id}-${index + 1}`, layer: 'modules', x1: corner.x, y1: corner.y, x2: next.x, y2: next.y });
    });
  }
  const openings: ProjectedOpening[] = (scene.openings ?? []).map((opening) => ({ id: opening.id, kind: opening.kind, wallId: opening.wallId, offsetMm: opening.offsetMm, widthMm: opening.widthMm, heightMm: opening.heightMm }));
  for (const opening of openings) {
    const line = openingLine(opening, scene.walls ?? []);
    if (line) lines.push(line);
    else warnings.push(`Opening ${opening.id} could not be projected onto its wall and was skipped.`);
  }
  const elevations = (scene.walls ?? []).filter((wall) => finitePositive(wallLength(wall))).map((wall) => ({
    wallId: wall.id,
    lengthMm: wallLength(wall),
    heightMm: wall.heightMm,
    openings: openings.filter((opening) => opening.wallId === wall.id),
    modules: modules.filter((module) => module.wallId === wall.id).sort((a, b) => (a.offsetAlongWallMm ?? 0) - (b.offsetAlongWallMm ?? 0))
  }));
  return { schema: 'drawing.projection.v1', units: 'mm', projectId: scene.projectId, floorPlanVersionId: scene.floorPlanVersionId, sceneStatus: scene.metadata?.status ?? 'draft', lines, openings, modules, elevations, warnings };
}

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer: string) {
  return [
    '0', 'LINE',
    '8', layer,
    '10', String(x1),
    '20', String(y1),
    '30', '0',
    '11', String(x2),
    '21', String(y2),
    '31', '0'
  ];
}

function dxfText(value: string, x: number, y: number, height: number, layer: string) {
  return ['0', 'TEXT', '8', layer, '10', String(x), '20', String(y), '30', '0', '40', String(height), '1', value.replace(/[^\x20-\x7E]/g, '?'), '7', 'STANDARD'];
}

function dxfLayer(name: string, color: number, lineType = 'CONTINUOUS') {
  return ['0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', lineType];
}

export function exportSceneToDxf(scene: SceneV1): string {
  return exportProjectionToDxf(buildDrawingProjection(scene));
}

export function exportProjectionToDxf(projection: DrawingPackageProjection): string {
  const entities: string[] = [];
  const layerFor = (layer: DrawingLine['layer']) => layer === 'walls' ? 'A-WALL' : layer === 'modules' ? 'A-MOD' : 'A-OPENING';
  for (const line of projection.lines) entities.push(...dxfLine(line.x1, line.y1, line.x2, line.y2, layerFor(line.layer)));
  const points = projection.lines.flatMap((line) => [{ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }]);
  const minX = points.length ? Math.min(...points.map((point) => point.x)) : 0;
  const minY = points.length ? Math.min(...points.map((point) => point.y)) : 0;
  const maxX = points.length ? Math.max(...points.map((point) => point.x)) : 1000;
  const maxY = points.length ? Math.max(...points.map((point) => point.y)) : 1000;
  entities.push(...dxfText(`ULTIDA | APPROVED SCENE | PLAN ${projection.floorPlanVersionId}`, minX, maxY + 300, 120, 'A-ANNO'));
  entities.push(...dxfText('UNITS: MILLIMETRES | EDIT LAYERS: A-WALL, A-OPENING, A-MOD', minX, maxY + 140, 60, 'A-ANNO'));

  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS',
    '70', '4', // Millimeters
    '9', '$EXTMIN', '10', String(minX), '20', String(minY), '30', '0',
    '9', '$EXTMAX', '10', String(maxX), '20', String(maxY + 500), '30', '0',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '5',
    ...dxfLayer('0', 7),
    ...dxfLayer('A-WALL', 7),
    ...dxfLayer('A-OPENING', 1),
    ...dxfLayer('A-MOD', 30),
    ...dxfLayer('A-ANNO', 8),
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
    ...entities,
    '0', 'ENDSEC',
    '0', 'EOF',
    ''
  ].join('\r\n');
}

export type DrawingTemplateSettings = {
  sheetSize?: 'A4' | 'A3' | 'A2' | 'A1';
  orientation?: 'landscape' | 'portrait';
  scale?: '1:20' | '1:50' | '1:100' | 'auto';
  titleBlock?: {
    companyName?: string;
    projectName?: string;
    clientName?: string;
    drawingTitle?: string;
    sheetNumber?: string;
    date?: string;
    drawnBy?: string;
  };
  dimensionStyle?: {
    showDimensions?: boolean;
    showModuleLabels?: boolean;
    showOpeningLabels?: boolean;
  };
  layerColors?: {
    walls?: string;
    modules?: string;
    openings?: string;
    annotations?: string;
    dimensions?: string;
  };
};

export function generateWallElevationsSvg(scene: SceneV1, wallId: string, options?: DrawingTemplateSettings): string {
  const projection = buildDrawingProjection(scene);
  const wall = projection.elevations.find((candidate) => candidate.wallId === wallId);
  if (!wall) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><text x="20" y="40" fill="red">Wall ${wallId} not found</text></svg>`;
  }

  const wallColor = options?.layerColors?.walls ?? '#38291f';
  const modColor = options?.layerColors?.modules ?? '#c59c2d';
  const openingColor = options?.layerColors?.openings ?? '#7a4b2d';
  const title = options?.titleBlock?.drawingTitle ?? `Wall ${wallId} Elevation`;
  const company = options?.titleBlock?.companyName ?? 'ULTIDA / Altera';

  const moduleRects = wall.modules.map((module) => {
    const x = module.offsetAlongWallMm ?? 0;
    const y = wall.heightMm - module.heightMm;
    const label = options?.dimensionStyle?.showModuleLabels !== false
      ? `<text x="${x + 10}" y="${y + 30}" font-family="sans-serif" font-size="24" fill="${wallColor}">${module.family} ${Math.round(module.widthMm)}mm</text>`
      : '';
    return `<rect data-module-id="${module.id}" x="${x}" y="${y}" width="${module.widthMm}" height="${module.heightMm}" class="module"/>${label}`;
  }).join('');

  const openingRects = wall.openings.map((opening) => {
    const x = opening.offsetMm;
    const y = wall.heightMm - opening.heightMm;
    const label = options?.dimensionStyle?.showOpeningLabels !== false
      ? `<text x="${x + 5}" y="${y - 10}" font-family="sans-serif" font-size="20" fill="${openingColor}">${opening.kind} ${Math.round(opening.widthMm)}mm</text>`
      : '';
    return `<rect data-opening-id="${opening.id}" x="${x}" y="${y}" width="${opening.widthMm}" height="${opening.heightMm}" class="opening"/>${label}`;
  }).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -160 ${wall.lengthMm + 200} ${wall.heightMm + 300}" width="100%" height="100%">`,
    `  <style>.wall{fill:#f3f4f6;stroke:${wallColor};stroke-width:8}.module{fill:${modColor};fill-opacity:.3;stroke:${wallColor};stroke-width:5}.opening{fill:#fff;stroke:${openingColor};stroke-width:5}</style>`,
    `  <rect x="0" y="0" width="${wall.lengthMm}" height="${wall.heightMm}" class="wall" />`,
    `  ${openingRects}${moduleRects}`,
    `  <line x1="-50" y1="${wall.heightMm}" x2="${wall.lengthMm + 50}" y2="${wall.heightMm}" stroke="#1f2937" stroke-width="6" />`,
    `  <text x="0" y="-80" font-family="sans-serif" font-size="28" fill="#4b5563">${company}</text>`,
    `  <text x="0" y="-40" font-family="sans-serif" font-size="44" font-weight="bold" fill="#111827">${title}: ${Math.round(wall.lengthMm)} x ${wall.heightMm} mm</text>`,
    `</svg>`
  ].join('\n');
}

export function exportWallElevationToDxf(scene: SceneV1, wallId: string, options?: DrawingTemplateSettings): string {
  const projection = buildDrawingProjection(scene);
  const wall = projection.elevations.find((candidate) => candidate.wallId === wallId);
  const entities: string[] = [];

  if (!wall) {
    entities.push(...dxfText(`ERROR: Wall ${wallId} not found in scene`, 0, 0, 50, 'A-ANNO'));
    return [
      '0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC',
      '0', 'EOF', ''
    ].join('\r\n');
  }

  // Wall perimeter
  entities.push(...dxfLine(0, 0, wall.lengthMm, 0, 'A-WALL'));
  entities.push(...dxfLine(wall.lengthMm, 0, wall.lengthMm, wall.heightMm, 'A-WALL'));
  entities.push(...dxfLine(wall.lengthMm, wall.heightMm, 0, wall.heightMm, 'A-WALL'));
  entities.push(...dxfLine(0, wall.heightMm, 0, 0, 'A-WALL'));

  // Openings
  for (const opening of wall.openings) {
    const x1 = opening.offsetMm;
    const x2 = opening.offsetMm + opening.widthMm;
    const y1 = 0;
    const y2 = opening.heightMm;
    entities.push(...dxfLine(x1, y1, x2, y1, 'A-OPENING'));
    entities.push(...dxfLine(x2, y1, x2, y2, 'A-OPENING'));
    entities.push(...dxfLine(x2, y2, x1, y2, 'A-OPENING'));
    entities.push(...dxfLine(x1, y2, x1, y1, 'A-OPENING'));
    if (options?.dimensionStyle?.showOpeningLabels !== false) {
      entities.push(...dxfText(`${opening.kind} (${Math.round(opening.widthMm)}mm)`, x1 + 10, y2 + 20, 40, 'A-ANNO'));
    }
  }

  // Modules
  for (const module of wall.modules) {
    const x1 = module.offsetAlongWallMm ?? 0;
    const x2 = x1 + module.widthMm;
    const y1 = 0; // Elevation from floor
    const y2 = module.heightMm;
    entities.push(...dxfLine(x1, y1, x2, y1, 'A-MOD'));
    entities.push(...dxfLine(x2, y1, x2, y2, 'A-MOD'));
    entities.push(...dxfLine(x2, y2, x1, y2, 'A-MOD'));
    entities.push(...dxfLine(x1, y2, x1, y1, 'A-MOD'));
    if (options?.dimensionStyle?.showModuleLabels !== false) {
      entities.push(...dxfText(`${module.family} ${Math.round(module.widthMm)}x${module.heightMm}`, x1 + 10, y1 + 30, 40, 'A-ANNO'));
    }
  }

  // Dimension Line
  if (options?.dimensionStyle?.showDimensions !== false) {
    const dimY = -150;
    entities.push(...dxfLine(0, dimY, wall.lengthMm, dimY, 'A-DIM'));
    entities.push(...dxfLine(0, dimY - 30, 0, dimY + 30, 'A-DIM'));
    entities.push(...dxfLine(wall.lengthMm, dimY - 30, wall.lengthMm, dimY + 30, 'A-DIM'));
    entities.push(...dxfText(`${Math.round(wall.lengthMm)} MM`, wall.lengthMm / 2 - 100, dimY + 40, 50, 'A-DIM'));
  }

  // Header & Title Block
  const title = options?.titleBlock?.drawingTitle ?? `WALL ${wallId} ELEVATION`;
  const company = options?.titleBlock?.companyName ?? 'ULTIDA / Altera';
  entities.push(...dxfText(`${company} | ${title}`, 0, wall.heightMm + 200, 80, 'A-ANNO'));
  entities.push(...dxfText(`WALL LENGTH: ${Math.round(wall.lengthMm)} MM | HEIGHT: ${wall.heightMm} MM`, 0, wall.heightMm + 80, 50, 'A-ANNO'));

  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS', '70', '4', // Millimeters
    '9', '$EXTMIN', '10', '0', '20', '-300', '30', '0',
    '9', '$EXTMAX', '10', String(wall.lengthMm), '20', String(wall.heightMm + 400), '30', '0',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '6',
    ...dxfLayer('0', 7),
    ...dxfLayer('A-WALL', 7),
    ...dxfLayer('A-OPENING', 1),
    ...dxfLayer('A-MOD', 30),
    ...dxfLayer('A-ANNO', 8),
    ...dxfLayer('A-DIM', 5),
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
    ...entities,
    '0', 'ENDSEC',
    '0', 'EOF',
    ''
  ].join('\r\n');
}

export function generateDrawingPackageSvg(scene: SceneV1): string {
  const projection = buildDrawingProjection(scene);
  const maxWallLength = Math.max(1000, ...projection.elevations.map((wall) => wall.lengthMm));
  const elevationHeight = projection.elevations.reduce((sum, wall) => sum + wall.heightMm + 300, 0);
  const floorLines = projection.lines.map((line) => `<line data-entity-id="${line.id}" class="${line.layer}" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"/>`).join('');
  let cursorY = 0;
  const elevations = projection.elevations.map((wall) => {
    const modules = wall.modules.map((module) => `<rect data-module-id="${module.id}" x="${module.offsetAlongWallMm ?? 0}" y="${wall.heightMm - module.heightMm}" width="${module.widthMm}" height="${module.heightMm}" class="module"/>`).join('');
    const openings = wall.openings.map((opening) => `<rect data-opening-id="${opening.id}" x="${opening.offsetMm}" y="${wall.heightMm - opening.heightMm}" width="${opening.widthMm}" height="${opening.heightMm}" class="opening"/>`).join('');
    const group = `<g data-wall-id="${wall.wallId}" transform="translate(0 ${cursorY})"><text x="0" y="-35">Wall ${wall.wallId} / ${Math.round(wall.lengthMm)} x ${wall.heightMm} mm</text><rect x="0" y="0" width="${wall.lengthMm}" height="${wall.heightMm}" class="wall-face"/>${openings}${modules}</g>`;
    cursorY += wall.heightMm + 300;
    return group;
  }).join('');
  const floorOffset = maxWallLength + 500;
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -150 ${maxWallLength * 2 + 700} ${Math.max(elevationHeight, maxWallLength) + 300}"><title>ULTIDA drawing package ${projection.floorPlanVersionId}</title><desc>Generated from drawing.projection.v1 for ${projection.projectId}</desc><style>.walls,.wall-face{stroke:#38291f;stroke-width:8;fill:none}.modules,.module{stroke:#38291f;stroke-width:5;fill:#c59c2d;fill-opacity:.25}.opening{stroke:#7a4b2d;stroke-width:5;fill:#fff}text{font:42px sans-serif;fill:#38291f}</style><g id="wall-elevations">${elevations}</g><g id="floor-plan" transform="translate(${floorOffset} 0)"><text x="0" y="-35">Floor plan / millimetres</text>${floorLines}</g></svg>`;
}

export function generateWallElevationsPdf(scene: SceneV1, outStream: any, options?: DrawingTemplateSettings) {
  return generateProjectionPdf(buildDrawingProjection(scene), outStream);
}

export function generateProjectionPdf(projection: DrawingPackageProjection, outStream: NodeJS.WritableStream) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24, info: { Title: `ULTIDA Production Drawings - ${projection.floorPlanVersionId}`, Author: 'ULTIDA', Subject: 'Approved scene production drawing package' } });
  doc.pipe(outStream);
  const pageWidth = 842; const pageHeight = 595;
  const drawFrame = (sheetTitle: string, sheetNumber: number, totalSheets: number, subtitle: string) => {
    doc.rect(20, 20, pageWidth - 40, pageHeight - 40).lineWidth(0.75).stroke('#38291f');
    doc.rect(20, pageHeight - 78, pageWidth - 40, 58).lineWidth(0.75).stroke('#38291f');
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#38291f').text('ULTIDA', 34, pageHeight - 62);
    doc.font('Helvetica-Bold').fontSize(9).text(sheetTitle, 92, pageHeight - 62);
    doc.font('Helvetica').fontSize(6.5).fillColor('#53463d').text(subtitle, 92, pageHeight - 47, { width: 420 });
    doc.fontSize(6.5).text(`PROJECT: ${projection.projectId}`, 560, pageHeight - 62, { width: 245, align: 'right' });
    doc.text(`PLAN: ${projection.floorPlanVersionId} | UNITS: MM | STATUS: ${projection.sceneStatus.toUpperCase()}`, 560, pageHeight - 47, { width: 245, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#38291f').text(`SHEET ${sheetNumber} / ${totalSheets}`, 560, pageHeight - 34, { width: 245, align: 'right' });
  };
  // Only walls carrying furniture/modules receive an elevation sheet.
  const furnitureWalls = projection.elevations.filter((wall) => wall.modules.length > 0);
  const totalSheets = Math.max(1, furnitureWalls.length + 1);
  drawFrame('DRAWING INDEX AND FLOOR PLAN', 1, totalSheets, 'Generated from immutable drawing.projection.v1. Verify all review warnings before release.');
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#38291f').text('Production Drawing Package', 48, 50);
  doc.font('Helvetica').fontSize(10).fillColor('#53463d').text('Floor plan overview and wall elevation register', 48, 82);
  const floorLines = projection.lines.filter((line) => line.layer !== 'openings');
  const floorPoints = floorLines.flatMap((line) => [{ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }]);
  if (floorPoints.length) {
    const minX = Math.min(...floorPoints.map((point) => point.x)); const minY = Math.min(...floorPoints.map((point) => point.y));
    const maxX = Math.max(...floorPoints.map((point) => point.x)); const maxY = Math.max(...floorPoints.map((point) => point.y));
    const scale = Math.min(440 / Math.max(1, maxX - minX), 300 / Math.max(1, maxY - minY));
    const originX = 42; const originY = 125;
    for (const line of projection.lines) {
      doc.save().lineWidth(line.layer === 'walls' ? 1.6 : line.layer === 'openings' ? 2.4 : 1).strokeColor(line.layer === 'walls' ? '#38291f' : line.layer === 'openings' ? '#9b2c2c' : '#b7791f');
      doc.moveTo(originX + (line.x1 - minX) * scale, originY + (line.y1 - minY) * scale).lineTo(originX + (line.x2 - minX) * scale, originY + (line.y2 - minY) * scale).stroke().restore();
    }
    doc.font('Helvetica').fontSize(7).fillColor('#53463d').text(`Floor plan extents: ${Math.round(maxX - minX)} x ${Math.round(maxY - minY)} mm`, originX, 445);
  } else {
    doc.font('Helvetica').fontSize(10).fillColor('#9b2c2c').text('No valid floor plan geometry was available.', 48, 155);
  }
  const scheduleX = 510;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#38291f').text('WALL ELEVATION REGISTER', scheduleX, 155);
  let scheduleY = 182;
  for (const wall of furnitureWalls) {
    doc.rect(scheduleX, scheduleY, 290, 30).lineWidth(.4).stroke('#c4b8aa');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#38291f').text(wall.wallId, scheduleX + 10, scheduleY + 8);
    doc.font('Helvetica').fontSize(7).fillColor('#53463d').text(`${Math.round(wall.lengthMm)} x ${wall.heightMm} mm`, scheduleX + 88, scheduleY + 7);
    doc.text(`${wall.modules.length} modules | ${wall.openings.length} openings`, scheduleX + 88, scheduleY + 18);
    scheduleY += 34;
  }
  if (projection.warnings.length) doc.font('Helvetica-Bold').fontSize(7).fillColor('#9b2c2c').text(`REVIEW REQUIRED: ${projection.warnings.join(' ')}`, 42, 465, { width: 740 });
  furnitureWalls.forEach((wall, index) => {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
    drawFrame(`WALL ELEVATION - ${wall.wallId}`, index + 2, totalSheets, 'Module faces and opening positions are projected from the approved scene.');
    doc.font('Helvetica-Bold').fontSize(19).fillColor('#38291f').text(`Wall ${wall.wallId}`, 48, 52);
    doc.font('Helvetica').fontSize(10).fillColor('#53463d').text(`${Math.round(wall.lengthMm)} mm long x ${wall.heightMm} mm high`, 48, 78);
    const originX = 48; const originY = 110; const availableWidth = 730; const availableHeight = 385;
    const scale = Math.min(availableWidth / wall.lengthMm, availableHeight / wall.heightMm);
    doc.rect(originX, originY, wall.lengthMm * scale, wall.heightMm * scale).lineWidth(1.5).stroke('#38291f');
    for (const opening of wall.openings) {
      doc.rect(originX + opening.offsetMm * scale, originY + (wall.heightMm - opening.heightMm) * scale, opening.widthMm * scale, opening.heightMm * scale).lineWidth(1.2).stroke('#9b2c2c');
      doc.font('Helvetica').fontSize(7).fillColor('#9b2c2c').text(`${opening.kind} ${Math.round(opening.widthMm)}`, originX + opening.offsetMm * scale, originY + (wall.heightMm - opening.heightMm) * scale - 12);
    }
    for (const module of wall.modules) {
      doc.rect(originX + (module.offsetAlongWallMm ?? 0) * scale, originY + (wall.heightMm - module.heightMm) * scale, module.widthMm * scale, module.heightMm * scale).fillOpacity(0.18).fillAndStroke('#c59c2d', '#38291f').fillOpacity(1);
      doc.font('Helvetica').fontSize(7).fillColor('#38291f').text(`${module.family} ${Math.round(module.widthMm)}`, originX + (module.offsetAlongWallMm ?? 0) * scale + 4, originY + (wall.heightMm - module.heightMm) * scale + 6, { width: Math.max(35, module.widthMm * scale - 8) });
    }
    doc.save().dash(3, { space: 2 }).strokeColor('#75665c').lineWidth(.5).moveTo(originX, originY + wall.heightMm * scale + 18).lineTo(originX + wall.lengthMm * scale, originY + wall.heightMm * scale + 18).stroke().undash().restore();
    doc.font('Helvetica').fontSize(8).fillColor('#53463d').text(`${Math.round(wall.lengthMm)} mm`, originX, originY + wall.heightMm * scale + 24, { width: wall.lengthMm * scale, align: 'center' });
  });
  doc.end();
}

export type CutlistPart = {
  id: string;
  moduleId: string;
  family: string;
  partName: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  edging: 'front_only' | 'all_sides' | 'none';
  quantity: number;
  status: string;
};

export type HardwareItem = {
  name: string;
  quantity: number;
  unit: string;
};

export type NestingResult = {
  plywoodSheets18mm: number;
  mdfSheets8mm: number;
  wastageFactor: number;
};

export function generateFullProductionCutlist(scene: SceneV1) {
  const parts: CutlistPart[] = [];
  const hardware: HardwareItem[] = [];
  const fillers: any[] = [];

  let totalPanelArea18mm = 0;
  let totalPanelArea8mm = 0;

  for (const module of scene.modules ?? []) {
    const w = module.widthMm;
    const d = module.depthMm;
    const h = module.heightMm;

    // Side Panels
    parts.push({ id: `${module.id}-left`, moduleId: module.id, family: module.family, partName: 'side-panel-left', lengthMm: h, widthMm: d, thicknessMm: 18, edging: 'front_only', quantity: 1, status: 'review_required' });
    parts.push({ id: `${module.id}-right`, moduleId: module.id, family: module.family, partName: 'side-panel-right', lengthMm: h, widthMm: d, thicknessMm: 18, edging: 'front_only', quantity: 1, status: 'review_required' });
    totalPanelArea18mm += h * d * 2;

    // Top & Bottom Panels
    const innerWidth = w - 36;
    parts.push({ id: `${module.id}-top`, moduleId: module.id, family: module.family, partName: 'top-panel', lengthMm: innerWidth, widthMm: d, thicknessMm: 18, edging: 'front_only', quantity: 1, status: 'review_required' });
    parts.push({ id: `${module.id}-bottom`, moduleId: module.id, family: module.family, partName: 'bottom-panel', lengthMm: innerWidth, widthMm: d, thicknessMm: 18, edging: 'front_only', quantity: 1, status: 'review_required' });
    totalPanelArea18mm += innerWidth * d * 2;

    // Back Panel (8mm MDF)
    parts.push({ id: `${module.id}-back`, moduleId: module.id, family: module.family, partName: 'back-panel', lengthMm: h, widthMm: w, thicknessMm: 8, edging: 'none', quantity: 1, status: 'review_required' });
    totalPanelArea8mm += h * w;

    // Door/Shutter Panels if applicable
    if (['wardrobe', 'kitchen', 'cabinet'].includes(module.family)) {
      const doorCount = w >= 900 ? 2 : 1;
      const doorWidth = Math.round(w / doorCount) - 4;
      const doorHeight = h - 6;
      for (let i = 0; i < doorCount; i++) {
        parts.push({ id: `${module.id}-door-${i + 1}`, moduleId: module.id, family: module.family, partName: `door-shutter-${i + 1}`, lengthMm: doorHeight, widthMm: doorWidth, thicknessMm: 18, edging: 'all_sides', quantity: 1, status: 'review_required' });
        totalPanelArea18mm += doorHeight * doorWidth;
      }

      // Add hinges: 2 hinges per door, or 4 if tall wardrobe door
      const hingesPerDoor = doorHeight > 1200 ? 4 : 2;
      const existingHinges = hardware.find(item => item.name === 'Auto-close hinge');
      if (existingHinges) {
        existingHinges.quantity += doorCount * hingesPerDoor;
      } else {
        hardware.push({ name: 'Auto-close hinge', quantity: doorCount * hingesPerDoor, unit: 'pcs' });
      }

      // Add Handles
      const existingHandles = hardware.find(item => item.name === 'Stainless steel handle');
      if (existingHandles) {
        existingHandles.quantity += doorCount;
      } else {
        hardware.push({ name: 'Stainless steel handle', quantity: doorCount, unit: 'pcs' });
      }
    }
  }

  // Nesting Sheet calculation: 2440 x 1220 mm standard plywood sheets
  const sheetArea = 2440 * 1220; // 2,976,800 sq mm
  const nesting: NestingResult = {
    plywoodSheets18mm: Math.max(1, Math.ceil(totalPanelArea18mm / (sheetArea * 0.8))), // 80% yield efficiency
    mdfSheets8mm: Math.max(1, Math.ceil(totalPanelArea8mm / (sheetArea * 0.85))), // 85% yield efficiency
    wastageFactor: 0.20
  };

  return { parts, hardware, fillers, nesting };
}
