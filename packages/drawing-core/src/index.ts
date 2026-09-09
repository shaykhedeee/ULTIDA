import { PdfWriter } from './pdf-writer.js';
import type { Writable } from 'node:stream';
import type { SceneV1, SceneWallV1, SceneOpeningV1, SceneModuleV1, SceneModulePartV1, SceneRoomV1 } from './scene-types.js';
export * from './scene-types.js';
export * from './elevation-sheet.js';
export * from './pdf-writer.js';
export * from './production-dossier-pdf.js';
export * from './production-workbook.js';
import { generateArchitecturalShopSheetSvg, type ShopDrawingOptions } from './shop-drawing-renderer.js';

export const ULTIDA_DRAWING_STANDARD_V1 = {
  schema: 'drawing.standard.v1' as const,
  units: 'mm' as const,
  panelThicknessMm: 18,
  wardrobeCarcassDepthMm: 560,
  wardrobeBackThicknessMm: 20,
  graniteThicknessMm: 20,
  dummyRevealMm: 30,
  defaultLightKelvin: 3000,
  layers: {
    walls: 'A-WALL', modules: 'A-MOD', openings: 'A-OPENING',
    dimensions: 'A-DIM', annotations: 'A-ANNO', hatch: 'A-HATCH'
  },
  colors: { dimensions: '#ff3030', walls: '#1f2937', modules: '#153e75', annotations: '#111827' }
};
export type UltidaDrawingStandardV1 = typeof ULTIDA_DRAWING_STANDARD_V1;

export function deriveWardrobeDepthMm(carcassDepthMm = ULTIDA_DRAWING_STANDARD_V1.wardrobeCarcassDepthMm, backThicknessMm = ULTIDA_DRAWING_STANDARD_V1.wardrobeBackThicknessMm) {
  if (!Number.isFinite(carcassDepthMm) || !Number.isFinite(backThicknessMm) || carcassDepthMm <= 0 || backThicknessMm < 0) {
    throw new Error('Wardrobe depth inputs must be finite millimetre values.');
  }
  return carcassDepthMm + backThicknessMm;
}

export type DimensionChainV1 = { axis: 'horizontal' | 'vertical'; originMm: number; segmentsMm: number[]; overallMm: number; label?: string };

export function buildDimensionChain(axis: DimensionChainV1['axis'], segmentsMm: number[], originMm = 0, label?: string): DimensionChainV1 {
  if (!segmentsMm.length || segmentsMm.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Dimension chains require positive finite segments.');
  const overallMm = segmentsMm.reduce((sum, value) => sum + value, 0);
  return { axis, originMm, segmentsMm: [...segmentsMm], overallMm, label };
}

export type ElevationViewKindV1 = 'external' | 'internal' | 'top' | 'section';
export type ElevationElementV1 = {
  id: string;
  kind: 'wall' | 'loft' | 'shutter' | 'sliding-shutter' | 'open-unit' | 'drawer' | 'hanger-space' | 'shelf' | 'skirting' | 'filler' | 'profile-glass' | 'light' | 'appliance' | 'countertop';
  xMm: number; yMm: number; widthMm: number; heightMm: number;
  label?: string; materialSlot?: string; quantity?: number;
};
export type ElevationSheetSpecV1 = {
  schema: 'elevation.sheet.v1'; view: ElevationViewKindV1; title: string; units: 'mm';
  overallWidthMm: number; overallHeightMm: number; horizontalChain: DimensionChainV1; verticalChain: DimensionChainV1;
  elements: ElevationElementV1[]; sourceSceneVersionId: string; warnings: string[];
};

export function validateElevationSheet(spec: ElevationSheetSpecV1) {
  const issues: string[] = [];
  if (spec.horizontalChain.overallMm !== spec.overallWidthMm) issues.push('Horizontal dimension chain does not equal overall width.');
  if (spec.verticalChain.overallMm !== spec.overallHeightMm) issues.push('Vertical dimension chain does not equal overall height.');
  for (const element of spec.elements) {
    if (![element.xMm, element.yMm, element.widthMm, element.heightMm].every(Number.isFinite) || element.widthMm <= 0 || element.heightMm <= 0) issues.push(`Element ${element.id} has invalid geometry.`);
    if (element.xMm < 0 || element.yMm < 0 || element.xMm + element.widthMm > spec.overallWidthMm || element.yMm + element.heightMm > spec.overallHeightMm) issues.push(`Element ${element.id} exceeds the elevation boundary.`);
    if (element.kind === 'profile-glass' && !element.materialSlot) issues.push(`Profile-glass element ${element.id} requires a material slot.`);
  }
  return { valid: issues.length === 0, issues };
}

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

/** A scene stores wall centre-lines. Coincident centre-lines are duplicates, not two walls. */
function wallsCoincide(a: SceneV1['walls'][number], b: SceneV1['walls'][number], toleranceMm = 0.5) {
  const close = (left: { xMm: number; yMm: number }, right: { xMm: number; yMm: number }) =>
    Math.abs(left.xMm - right.xMm) <= toleranceMm && Math.abs(left.yMm - right.yMm) <= toleranceMm;
  return (close(a.start, b.start) && close(a.end, b.end)) || (close(a.start, b.end) && close(a.end, b.start));
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
  const exportedWalls: SceneV1['walls'] = [];
  for (const wall of scene.walls ?? []) {
    if (!finitePositive(wallLength(wall))) {
      warnings.push(`Wall ${wall.id} has zero or invalid length and was skipped.`);
      continue;
    }
    const duplicateOf = exportedWalls.find((candidate) => wallsCoincide(candidate, wall));
    if (duplicateOf) {
      warnings.push(`Wall ${wall.id} duplicates canonical wall ${duplicateOf.id} and was skipped to prevent double-wall exports.`);
      continue;
    }
    exportedWalls.push(wall);
    lines.push({ id: wall.id, layer: 'walls', x1: wall.start.xMm, y1: wall.start.yMm, x2: wall.end.xMm, y2: wall.end.yMm });
  }
  const modules: ProjectedModule[] = [];
  for (const module of scene.modules ?? []) {
    if (![module.widthMm, module.depthMm, module.heightMm].every(finitePositive)) {
      warnings.push(`Module ${module.id} has invalid dimensions and was skipped.`);
      continue;
    }
    const nearest = (scene.walls ?? []).map((wall: SceneWallV1) => ({ wall, ...moduleWallPosition(module, wall) })).sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance)[0];
    const projected: ProjectedModule = { id: module.id, family: module.family, roomId: module.roomId ?? '', xMm: module.position.xMm, yMm: module.position.yMm, widthMm: module.widthMm, depthMm: module.depthMm, heightMm: module.heightMm, rotationDeg: module.rotationDeg ?? 0, wallId: nearest?.wall.id, offsetAlongWallMm: nearest?.offset };
    modules.push(projected);
    const corners = rotatedRectangle(projected.xMm, projected.yMm, projected.widthMm, projected.depthMm, projected.rotationDeg);
    corners.forEach((corner, index) => {
      const next = corners[(index + 1) % corners.length];
      lines.push({ id: `${module.id}-${index + 1}`, layer: 'modules', x1: corner.x, y1: corner.y, x2: next.x, y2: next.y });
    });
  }
  const openings: ProjectedOpening[] = (scene.openings ?? []).map((opening: SceneOpeningV1) => ({ id: opening.id, kind: opening.kind, wallId: opening.wallId, offsetMm: opening.offsetMm, widthMm: opening.widthMm, heightMm: opening.heightMm }));
  for (const opening of openings) {
    const line = openingLine(opening, scene.walls ?? []);
    if (line) lines.push(line);
    else warnings.push(`Opening ${opening.id} could not be projected onto its wall and was skipped.`);
  }
  const elevations = (scene.walls ?? []).filter((wall: SceneWallV1) => finitePositive(wallLength(wall))).map((wall: SceneWallV1) => ({
    wallId: wall.id,
    lengthMm: wallLength(wall),
    heightMm: wall.heightMm ?? 2700,
    openings: openings.filter((opening: ProjectedOpening) => opening.wallId === wall.id),
    modules: modules.filter((module: ProjectedModule) => module.wallId === wall.id).sort((a: ProjectedModule, b: ProjectedModule) => (a.offsetAlongWallMm ?? 0) - (b.offsetAlongWallMm ?? 0))
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

/**
 * Export the editable floor-plan review model before a scene exists.
 *
 * This is deliberately a separate contract from exportSceneToDxf: an Initial
 * Design plan is useful for CAD review, but it is not a fabrication drawing.
 * Coordinates are source pixels multiplied by the reviewed mm-per-pixel scale.
 */
export type PlanDraftDxfElement = {
  id: string;
  kind: 'wall' | 'room' | 'door' | 'window' | 'fixture' | 'column' | 'beam' | 'service' | 'annotation';
  label?: string;
  geometry?: {
    x1?: number; y1?: number; x2?: number; y2?: number;
    x?: number; y?: number; width?: number; height?: number;
    polygon?: Array<{ x: number; y: number }>;
  };
  widthMm?: number;
  heightMm?: number;
  sillMm?: number;
  headMm?: number;
  offsetAlongWallMm?: number;
};

export type PlanDraftDxfInput = {
  planVersionId: string;
  geometryMode: 'initial_design' | 'final_production';
  mmPerPixel: number;
  ceilingHeightMm?: number;
  elements: PlanDraftDxfElement[];
  warnings?: string[];
};

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function planDraftLayer(kind: PlanDraftDxfElement['kind']) {
  if (kind === 'wall') return 'A-WALL';
  if (kind === 'room') return 'A-ROOM';
  if (kind === 'door' || kind === 'window') return 'A-OPENING';
  if (kind === 'fixture' || kind === 'column' || kind === 'beam' || kind === 'service') return 'A-FIXTURE';
  return 'A-ANNO';
}

function planDraftRect(geometry: NonNullable<PlanDraftDxfElement['geometry']>, scale: number, layer: string) {
  if (![geometry.x, geometry.y, geometry.width, geometry.height].every(finite)) return [];
  const x = geometry.x! * scale;
  const y = geometry.y! * scale;
  const width = geometry.width! * scale;
  const height = geometry.height! * scale;
  if (width <= 0 || height <= 0) return [];
  return [
    ...dxfLine(x, y, x + width, y, layer),
    ...dxfLine(x + width, y, x + width, y + height, layer),
    ...dxfLine(x + width, y + height, x, y + height, layer),
    ...dxfLine(x, y + height, x, y, layer),
  ];
}

export function exportPlanDraftToDxf(input: PlanDraftDxfInput): string {
  if (!input.planVersionId || !['initial_design', 'final_production'].includes(input.geometryMode)) throw new Error('A plan version and geometry mode are required.');
  if (!finite(input.mmPerPixel) || input.mmPerPixel <= 0) throw new Error('A positive calibration scale is required.');
  const scale = input.mmPerPixel;
  const entities: string[] = [];
  const points: Array<{ x: number; y: number }> = [];
  const warnings = [...(input.warnings ?? [])];
  const accepted = new Set<string>();
  for (const element of input.elements ?? []) {
    if (!element?.id || accepted.has(element.id)) continue;
    accepted.add(element.id);
    const geometry = element.geometry ?? {};
    const layer = planDraftLayer(element.kind);
    if (element.kind === 'wall' && [geometry.x1, geometry.y1, geometry.x2, geometry.y2].every(finite)) {
      const x1 = geometry.x1! * scale; const y1 = geometry.y1! * scale;
      const x2 = geometry.x2! * scale; const y2 = geometry.y2! * scale;
      if (Math.hypot(x2 - x1, y2 - y1) < 0.5) { warnings.push(`Wall ${element.id} has negligible length and was skipped.`); continue; }
      entities.push(...dxfLine(x1, y1, x2, y2, layer)); points.push({ x: x1, y: y1 }, { x: x2, y: y2 });
    } else if (element.kind === 'room' && Array.isArray(geometry.polygon) && geometry.polygon.length >= 3) {
      const polygon = geometry.polygon.filter((point) => finite(point?.x) && finite(point?.y)).map((point) => ({ x: point.x * scale, y: point.y * scale }));
      if (polygon.length < 3) { warnings.push(`Room ${element.id} has an invalid boundary and was skipped.`); continue; }
      polygon.forEach((point, index) => { const next = polygon[(index + 1) % polygon.length]; entities.push(...dxfLine(point.x, point.y, next.x, next.y, layer)); points.push(point); });
    } else if (element.kind === 'door' || element.kind === 'window' || element.kind === 'fixture' || element.kind === 'column' || element.kind === 'beam' || element.kind === 'service') {
      const rect = planDraftRect(geometry, scale, layer);
      if (!rect.length) { warnings.push(`Element ${element.id} has no drawable rectangle and was skipped.`); continue; }
      entities.push(...rect);
      points.push({ x: (geometry.x ?? 0) * scale, y: (geometry.y ?? 0) * scale }, { x: ((geometry.x ?? 0) + (geometry.width ?? 0)) * scale, y: ((geometry.y ?? 0) + (geometry.height ?? 0)) * scale });
    } else if (element.kind === 'annotation' && finite(geometry.x) && finite(geometry.y)) {
      const x = geometry.x! * scale; const y = geometry.y! * scale;
      entities.push(...dxfText(element.label ?? element.id, x, y, Math.max(25, 40 * scale), layer)); points.push({ x, y });
    }
  }
  const minX = points.length ? Math.min(...points.map((point) => point.x)) : 0;
  const minY = points.length ? Math.min(...points.map((point) => point.y)) : 0;
  const maxX = points.length ? Math.max(...points.map((point) => point.x)) : 1000;
  const maxY = points.length ? Math.max(...points.map((point) => point.y)) : 1000;
  const label = input.geometryMode === 'initial_design' ? 'PROVISIONAL INITIAL DESIGN' : 'REVIEWED FINAL PRODUCTION';
  entities.push(...dxfText(`ULTIDA | ${label} | PLAN ${input.planVersionId}`, minX, maxY + 300, 120, 'A-ANNO'));
  entities.push(...dxfText('UNITS: MILLIMETRES | PLAN REVIEW EXPORT - NOT A FABRICATION RELEASE', minX, maxY + 140, 60, 'A-ANNO'));
  warnings.slice(0, 12).forEach((warning, index) => entities.push(...dxfText(`WARNING: ${warning}`, minX, minY - 120 - index * 60, 40, 'A-ANNO')));
  return [
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4',
    '9', '$EXTMIN', '10', String(minX), '20', String(minY - 900), '30', '0',
    '9', '$EXTMAX', '10', String(maxX), '20', String(maxY + 500), '30', '0', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '8',
    ...dxfLayer('0', 7), ...dxfLayer('A-WALL', 7), ...dxfLayer('A-ROOM', 3), ...dxfLayer('A-OPENING', 1), ...dxfLayer('A-FIXTURE', 30), ...dxfLayer('A-ANNO', 8), ...dxfLayer('A-DIM', 5),
    '0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC', '0', 'EOF', ''
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

  // ── System 32 datums (Indian modular standard) ────────────────────────────
  const PLINTH_H = 100;
  const COUNTER_H = 850;
  const LINTEL_H = 2100;
  const LOFT_H = wall.heightMm - 600;

  // Wall perimeter (A-WALL)
  entities.push(...dxfLine(0, 0, wall.lengthMm, 0, 'A-WALL'));
  entities.push(...dxfLine(wall.lengthMm, 0, wall.lengthMm, wall.heightMm, 'A-WALL'));
  entities.push(...dxfLine(wall.lengthMm, wall.heightMm, 0, wall.heightMm, 'A-WALL'));
  entities.push(...dxfLine(0, wall.heightMm, 0, 0, 'A-WALL'));

  // Ceiling hatch lines (diagonal, A-DATUM layer, lightweight)
  for (let d = 0; d <= wall.lengthMm + 600; d += 200) {
    const x1 = Math.max(0, d - 600);
    const y1 = Math.min(wall.heightMm, wall.heightMm - (d - 600 > 0 ? 0 : 600 - d));
    const x2 = Math.min(wall.lengthMm, d);
    const y2 = Math.max(LOFT_H, wall.heightMm - (d > 0 ? Math.min(600, d) : 0));
    if (x1 < x2) entities.push(...dxfLine(x1, y1, x2, y2, 'A-DATUM'));
  }

  // System 32 datum reference lines (A-DATUM)
  [PLINTH_H, COUNTER_H, LINTEL_H, LOFT_H].forEach((h, i) => {
    const labels = ['PLINTH 100mm', 'COUNTER 850mm', 'LINTEL 2100mm', `LOFT ${LOFT_H}mm`];
    entities.push(...dxfLine(-200, h, wall.lengthMm + 50, h, 'A-DATUM'));
    entities.push(...dxfText(labels[i], wall.lengthMm + 60, h + 15, 40, 'A-ANNO'));
  });

  // Openings (A-OPENING)
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
      entities.push(...dxfText(`${opening.kind.toUpperCase()} (${Math.round(opening.widthMm)}mm)`, x1 + 10, y2 + 50, 45, 'A-ANNO'));
      // Opening width dim line
      const dimY = -100;
      entities.push(...dxfLine(x1, dimY, x2, dimY, 'A-DIM'));
      entities.push(...dxfLine(x1, dimY - 25, x1, dimY + 25, 'A-DIM'));
      entities.push(...dxfLine(x2, dimY - 25, x2, dimY + 25, 'A-DIM'));
      entities.push(...dxfText(`${Math.round(opening.widthMm)}`, (x1 + x2) / 2 - 50, dimY + 35, 40, 'A-DIM'));
    }
  }

  // Modules with zone sub-elements (A-MOD, A-SKIRTING, A-ZONE)
  let prevEndMm = 0;
  for (const module of wall.modules) {
    const x1 = module.offsetAlongWallMm ?? 0;
    const x2 = x1 + module.widthMm;
    const y1 = 0;
    const y2 = module.heightMm;
    const isTall = module.heightMm > 1800;
    const isBase = module.heightMm <= 900;

    // Main module outline (A-MOD)
    entities.push(...dxfLine(x1, y1, x2, y1, 'A-MOD'));
    entities.push(...dxfLine(x2, y1, x2, y2, 'A-MOD'));
    entities.push(...dxfLine(x2, y2, x1, y2, 'A-MOD'));
    entities.push(...dxfLine(x1, y2, x1, y1, 'A-MOD'));

    // Skirting/Plinth zone (100mm)
    entities.push(...dxfLine(x1, PLINTH_H, x2, PLINTH_H, 'A-SKIRTING'));
    entities.push(...dxfText('SKIRTING', x1 + 10, PLINTH_H / 2 - 15, 30, 'A-SKIRTING'));

    // Drawer zone (base units: 220mm above plinth)
    if (isBase) {
      const drawerTop = PLINTH_H + 220;
      entities.push(...dxfLine(x1, drawerTop, x2, drawerTop, 'A-ZONE'));
      entities.push(...dxfText('DRAWER', x1 + 10, (PLINTH_H + drawerTop) / 2 - 15, 35, 'A-ZONE'));
    }

    // Loft zone (tall units: top 600mm)
    if (isTall) {
      entities.push(...dxfLine(x1, LOFT_H, x2, LOFT_H, 'A-ZONE'));
      entities.push(...dxfText('LOFT', x1 + 10, (LOFT_H + module.heightMm) / 2 - 15, 35, 'A-ZONE'));
    }

    if (options?.dimensionStyle?.showModuleLabels !== false) {
      entities.push(...dxfText(`${module.family.toUpperCase()} ${Math.round(module.widthMm)}x${Math.round(module.depthMm ?? 600)}x${Math.round(module.heightMm)}mm`, x1 + 10, y2 / 2 + 20, 45, 'A-ANNO'));
    }

    // Segment horizontal dim above module
    if (x1 > prevEndMm + 5) {
      // Gap (filler) dim
      const gapDimY = -200;
      entities.push(...dxfLine(prevEndMm, gapDimY, x1, gapDimY, 'A-DIM'));
      entities.push(...dxfLine(prevEndMm, gapDimY - 25, prevEndMm, gapDimY + 25, 'A-DIM'));
      entities.push(...dxfLine(x1, gapDimY - 25, x1, gapDimY + 25, 'A-DIM'));
      entities.push(...dxfText(`${Math.round(x1 - prevEndMm)}`, (prevEndMm + x1) / 2 - 40, gapDimY + 35, 40, 'A-DIM'));
    }
    const modDimY = -200;
    entities.push(...dxfLine(x1, modDimY, x2, modDimY, 'A-DIM'));
    entities.push(...dxfLine(x1, modDimY - 25, x1, modDimY + 25, 'A-DIM'));
    entities.push(...dxfLine(x2, modDimY - 25, x2, modDimY + 25, 'A-DIM'));
    entities.push(...dxfText(`${Math.round(module.widthMm)}`, (x1 + x2) / 2 - 50, modDimY + 35, 45, 'A-DIM'));
    prevEndMm = x2;
  }

  // ── Overall dimension chain ────────────────────────────────────────────────
  if (options?.dimensionStyle?.showDimensions !== false) {
    // Bottom horizontal overall
    const dimY = -350;
    entities.push(...dxfLine(0, dimY, wall.lengthMm, dimY, 'A-DIM'));
    entities.push(...dxfLine(0, dimY - 40, 0, dimY + 40, 'A-DIM'));
    entities.push(...dxfLine(wall.lengthMm, dimY - 40, wall.lengthMm, dimY + 40, 'A-DIM'));
    entities.push(...dxfText(`${Math.round(wall.lengthMm)} MM`, wall.lengthMm / 2 - 120, dimY + 50, 60, 'A-DIM'));

    // Right-side vertical dimensions (A-DIM-VERT)
    const vX = wall.lengthMm + 250;
    // Plinth
    entities.push(...dxfLine(vX, 0, vX, PLINTH_H, 'A-DIM'));
    entities.push(...dxfLine(vX - 25, 0, vX + 25, 0, 'A-DIM'));
    entities.push(...dxfLine(vX - 25, PLINTH_H, vX + 25, PLINTH_H, 'A-DIM'));
    entities.push(...dxfText(`${PLINTH_H}`, vX + 35, PLINTH_H / 2, 35, 'A-DIM'));
    // Shutter zone
    entities.push(...dxfLine(vX + 100, PLINTH_H, vX + 100, LINTEL_H, 'A-DIM'));
    entities.push(...dxfLine(vX + 75, PLINTH_H, vX + 125, PLINTH_H, 'A-DIM'));
    entities.push(...dxfLine(vX + 75, LINTEL_H, vX + 125, LINTEL_H, 'A-DIM'));
    entities.push(...dxfText(`${LINTEL_H - PLINTH_H}`, vX + 135, (PLINTH_H + LINTEL_H) / 2, 40, 'A-DIM'));
    // Overall height
    entities.push(...dxfLine(vX + 200, 0, vX + 200, wall.heightMm, 'A-DIM'));
    entities.push(...dxfLine(vX + 175, 0, vX + 225, 0, 'A-DIM'));
    entities.push(...dxfLine(vX + 175, wall.heightMm, vX + 225, wall.heightMm, 'A-DIM'));
    entities.push(...dxfText(`${wall.heightMm}`, vX + 235, wall.heightMm / 2, 55, 'A-DIM'));
  }

  // Header & Title Block
  const title = options?.titleBlock?.drawingTitle ?? `WALL ${wallId} ELEVATION`;
  const company = options?.titleBlock?.companyName ?? 'ULTIDA / Altera';
  entities.push(...dxfText(`${company} | ${title}`, 0, wall.heightMm + 250, 90, 'A-ANNO'));
  entities.push(...dxfText(`WALL LENGTH: ${Math.round(wall.lengthMm)} MM | HEIGHT: ${wall.heightMm} MM | IS 710 BWP MARINE | SYSTEM 32`, 0, wall.heightMm + 120, 50, 'A-ANNO'));
  entities.push(...dxfText('UNITS: MILLIMETRES | SCALE 1:20 | LAYERS: A-WALL A-MOD A-OPENING A-DIM A-SKIRTING A-ZONE A-DATUM', 0, wall.heightMm + 60, 40, 'A-ANNO'));

  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS', '70', '4', // Millimeters
    '9', '$EXTMIN', '10', '-300', '20', '-500', '30', '0',
    '9', '$EXTMAX', '10', String(wall.lengthMm + 600), '20', String(wall.heightMm + 400), '30', '0',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '10',
    ...dxfLayer('0', 7),
    ...dxfLayer('A-WALL', 7),
    ...dxfLayer('A-OPENING', 1),
    ...dxfLayer('A-MOD', 30),
    ...dxfLayer('A-ANNO', 8),
    ...dxfLayer('A-DIM', 1),
    ...dxfLayer('A-DATUM', 8),
    ...dxfLayer('A-SKIRTING', 3),
    ...dxfLayer('A-ZONE', 6),
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

export function generateWallElevationsPdf(scene: SceneV1, outStream: Writable, options?: DrawingTemplateSettings) {
  return generateProjectionPdf(buildDrawingProjection(scene), outStream);
}

export function generateProjectionPdf(projection: DrawingPackageProjection, outStream: Writable, production?: ProductionSnapshotV1) {
  const doc = new PdfWriter({ size: 'A4', layout: 'landscape', margin: 24, info: { Title: `ULTIDA Production Drawings - ${projection.floorPlanVersionId}`, Author: 'ULTIDA', Subject: 'Approved scene production drawing package' } });
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
  const productionSheetCount = production ? 1 + Math.max(1, Math.ceil(production.parts.length / 25)) : 0;
  const totalSheets = Math.max(1, furnitureWalls.length + 1 + productionSheetCount);
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
    drawFrame(`WALL ELEVATION - ${wall.wallId}`, index + 2, totalSheets, 'System 32 parametric module faces, datum lines and opening clearances projected from the approved scene.');
    doc.font('Helvetica-Bold').fontSize(19).fillColor('#38291f').text(`Wall ${wall.wallId}`, 48, 50);
    doc.font('Helvetica').fontSize(9.5).fillColor('#53463d').text(`${Math.round(wall.lengthMm)} mm length × ${wall.heightMm} mm ceiling height  |  Scale: 1:25 (Fit to Sheet)  |  Layer: A-ELEV-OUTL`, 48, 74);
    const originX = 48; const originY = 100; const availableWidth = 730; const availableHeight = 370;
    const scale = Math.min(availableWidth / wall.lengthMm, availableHeight / wall.heightMm);

    // Outer Wall Outline (A-WALL-INTR / A-WALL-EXTR)
    doc.rect(originX, originY, wall.lengthMm * scale, wall.heightMm * scale).lineWidth(1.75).stroke('#2d211b');

    // Horizontal Datum Reference Lines (Plinth 100mm, Counter 850mm, Wall Unit 1450mm, Loft Top 2170mm)
    const plinthY = originY + (wall.heightMm - 100) * scale;
    const counterY = originY + (wall.heightMm - 850) * scale;
    const wallUnitY = originY + (wall.heightMm - 1450) * scale;
    const loftY = originY + (wall.heightMm - 2170) * scale;

    doc.save().dash(2, { space: 3 }).strokeColor('#bdaea0').lineWidth(0.5);
    doc.moveTo(originX, plinthY).lineTo(originX + wall.lengthMm * scale, plinthY).stroke();
    doc.moveTo(originX, counterY).lineTo(originX + wall.lengthMm * scale, counterY).stroke();
    doc.moveTo(originX, wallUnitY).lineTo(originX + wall.lengthMm * scale, wallUnitY).stroke();
    doc.moveTo(originX, loftY).lineTo(originX + wall.lengthMm * scale, loftY).stroke();
    doc.undash().restore();

    // Datum Labels
    doc.font('Helvetica').fontSize(6).fillColor('#8c7b6f');
    doc.text('PLINTH (100mm)', originX + wall.lengthMm * scale - 75, plinthY - 7);
    doc.text('COUNTER (850mm)', originX + wall.lengthMm * scale - 82, counterY - 7);
    doc.text('DADO CLEAR (1450mm)', originX + wall.lengthMm * scale - 98, wallUnitY - 7);
    doc.text('WALL UNIT (2170mm)', originX + wall.lengthMm * scale - 90, loftY - 7);

    // Openings (A-DOOR / A-GLAZ)
    for (const opening of wall.openings) {
      doc.rect(originX + opening.offsetMm * scale, originY + (wall.heightMm - opening.heightMm) * scale, opening.widthMm * scale, opening.heightMm * scale).lineWidth(1.2).stroke('#9b2c2c');
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#9b2c2c').text(`${opening.kind.toUpperCase()} ${Math.round(opening.widthMm)}mm`, originX + opening.offsetMm * scale, originY + (wall.heightMm - opening.heightMm) * scale - 11);
    }

    // Modular Units (A-FURN-BASE / A-FURN-OVER / A-FURN-SHUT)
    for (const module of wall.modules) {
      const isBase = module.family.includes('base') || module.family.includes('kitchen-base') || module.heightMm <= 850;
      const isTall = module.heightMm > 1800 || module.family.includes('tall') || module.family.includes('wardrobe');
      const isFeature = module.family.includes('feature') || module.family.includes('wall-');
      const layerTag = isTall ? 'A-FURN-TALL' : isBase ? 'A-FURN-BASE' : isFeature ? 'A-WALL-FEAT' : 'A-FURN-OVER';
      const modFill = isTall ? '#3b2f27' : isBase ? '#c59c2d' : isFeature ? '#4a5568' : '#e6c66e';

      doc.rect(originX + (module.offsetAlongWallMm ?? 0) * scale, originY + (wall.heightMm - module.heightMm) * scale, module.widthMm * scale, module.heightMm * scale)
        .fillOpacity(0.22)
        .fillAndStroke(modFill, '#2d211b')
        .fillOpacity(1);

      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#2d211b').text(`${module.family}`, originX + (module.offsetAlongWallMm ?? 0) * scale + 3, originY + (wall.heightMm - module.heightMm) * scale + 4, { width: Math.max(35, module.widthMm * scale - 6) });
      doc.font('Helvetica').fontSize(5.5).fillColor('#574b41').text(`${Math.round(module.widthMm)}×${Math.round(module.depthMm ?? 600)}×${Math.round(module.heightMm)}mm\n[${layerTag}]`, originX + (module.offsetAlongWallMm ?? 0) * scale + 3, originY + (wall.heightMm - module.heightMm) * scale + 13, { width: Math.max(35, module.widthMm * scale - 6) });
    }

    // Linear Bottom Dimension Line (A-DIMS)
    const dimY = originY + wall.heightMm * scale + 16;
    doc.save().strokeColor('#4a3b32').lineWidth(0.75).moveTo(originX, dimY).lineTo(originX + wall.lengthMm * scale, dimY).stroke();
    // Dimension Ticks
    doc.moveTo(originX, dimY - 4).lineTo(originX, dimY + 4).stroke();
    doc.moveTo(originX + wall.lengthMm * scale, dimY - 4).lineTo(originX + wall.lengthMm * scale, dimY + 4).stroke();
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#2d211b').text(`${Math.round(wall.lengthMm)} mm [A-DIMS]`, originX, dimY + 6, { width: wall.lengthMm * scale, align: 'center' });
  });
  if (production) {
    const firstProductionSheet = furnitureWalls.length + 2;
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
    drawFrame('PRODUCTION SUMMARY', firstProductionSheet, totalSheets, `Source scene ${production.sceneVersion}. Fabrication rules ${production.fabricationRules.version}.`);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#38291f').text('Manufacturing Package Summary', 48, 52);
    const materialGroups = new Map<string, { count: number; areaSqm: number }>();
    for (const part of production.parts) {
      const current = materialGroups.get(part.materialCode) ?? { count: 0, areaSqm: 0 };
      current.count += 1;
      current.areaSqm += (part.lengthMm * part.widthMm) / 1_000_000;
      materialGroups.set(part.materialCode, current);
    }
    const metrics = [
      ['Physical panels', String(production.parts.length)],
      ['Hardware lines', String(production.hardware.length)],
      ['Material groups', String(materialGroups.size)],
      ['Release status', production.status.replaceAll('_', ' ').toUpperCase()],
    ];
    metrics.forEach(([label, value], index) => {
      const x = 48 + index * 188;
      doc.roundedRect(x, 102, 166, 62, 5).fillAndStroke('#f6f0e8', '#d7c8b7');
      doc.font('Helvetica').fontSize(7).fillColor('#75665c').text(label.toUpperCase(), x + 12, 115);
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#38291f').text(value, x + 12, 133, { width: 142 });
    });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#38291f').text('MATERIAL / BOARD SUMMARY', 48, 194);
    let summaryY = 216;
    for (const [materialCode, group] of [...materialGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      doc.rect(48, summaryY, 470, 24).lineWidth(.35).stroke('#d7c8b7');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#38291f').text(materialCode, 58, summaryY + 8, { width: 250 });
      doc.font('Helvetica').text(`${group.count} panels`, 320, summaryY + 8, { width: 80 });
      doc.text(`${group.areaSqm.toFixed(3)} m²`, 410, summaryY + 8, { width: 90, align: 'right' });
      summaryY += 25;
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#38291f').text('FABRICATION RULES', 548, 194);
    const rules = production.fabricationRules;
    doc.font('Helvetica').fontSize(8).fillColor('#53463d').text([
      `Board: ${rules.carcassThicknessMm} mm carcass / ${rules.shutterThicknessMm} mm shutter`,
      `Back: ${rules.backPanelThicknessMm} mm`,
      `Edging: ${rules.visibleEdgeBandMm} mm visible / ${rules.internalEdgeBandMm} mm internal`,
      `Stock: ${rules.sheetWidthMm} × ${rules.sheetHeightMm} mm`,
      `Kerf: ${rules.kerfMm} mm | trim: ${rules.trimMm} mm`,
    ].join('\n'), 548, 218, { width: 240, lineGap: 7 });
    if (production.warnings.length) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#9b2c2c').text('REVIEW WARNINGS', 548, 350);
      doc.font('Helvetica').fontSize(7).text(production.warnings.map((warning) => `• ${warning}`).join('\n'), 548, 370, { width: 240, height: 120 });
    }

    doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
    drawFrame('PANEL CUTLIST', firstProductionSheet + 1, totalSheets, 'Every row is one traceable physical panel from the approved scene. Dimensions are finished millimetres.');
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#38291f').text('Scene-linked Panel Cutlist', 48, 48);
    const columns = [48, 190, 300, 390, 455, 520, 580, 662, 745];
    const headers = ['PART', 'MODULE', 'MATERIAL', 'L', 'W', 'T', 'GRAIN', 'EDGE', 'STATUS'];
    headers.forEach((header, index) => doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#38291f').text(header, columns[index], 86, { width: index === 0 ? 138 : 82 }));
    let rowY = 104;
    const rowsPerPage = 25;
    production.parts.forEach((part, index) => {
      if (index > 0 && index % rowsPerPage === 0) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
        drawFrame('PANEL CUTLIST - CONTINUED', firstProductionSheet + 1 + Math.floor(index / rowsPerPage), totalSheets, 'Continuation sheet. Physical panel IDs remain linked to scene component IDs.');
        rowY = 52;
      }
      if (index % 2 === 0) doc.rect(43, rowY - 4, 755, 16).fill('#faf7f2');
      const values = [part.partName, part.moduleId, part.materialCode, part.lengthMm, part.widthMm, part.thicknessMm, part.grainDirection ?? 'none', part.edgeSchedule?.tapeType ?? 'none', part.status];
      values.forEach((value, valueIndex) => doc.font(valueIndex === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(5.8).fillColor('#38291f').text(String(value), columns[valueIndex], rowY, { width: valueIndex === 0 ? 138 : valueIndex === 1 ? 105 : 78 }));
      rowY += 17;
    });
  }
  doc.end();
}

export type EdgeSchedule = {
  l1Mm: number; // Length side 1
  l2Mm: number; // Length side 2
  w1Mm: number; // Width side 1
  w2Mm: number; // Width side 2
  tapeType: string; // e.g., '0.8mm PVC', '2.0mm PVC'
};

export type CutlistPart = {
  id: string;
  /** Unique physical panel identity. Quantity rows are expanded before nesting. */
  partInstanceId?: string;
  moduleId: string;
  roomId?: string;
  family: string;
  partName: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  edging: 'front_only' | 'all_sides' | 'none';
  edgeSchedule?: EdgeSchedule;
  grainDirection?: 'horizontal' | 'vertical' | 'none';
  materialCode: string;
  quantity: number;
  status: string;
  sourceSceneVersion?: string;
  semanticType?: string;
  sourcePartId?: string;
  sheetId?: string;
  placedPos?: { xMm: number; yMm: number; rotated: boolean };
};

export type FabricationRulesV1 = {
  schema: 'fabrication.rules.v1';
  version: string;
  carcassThicknessMm: 16 | 18;
  shutterThicknessMm: 16 | 18;
  backPanelThicknessMm: number;
  visibleEdgeBandMm: number;
  internalEdgeBandMm: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  kerfMm: number;
  trimMm: number;
};

export const DEFAULT_FABRICATION_RULES_V1: FabricationRulesV1 = {
  schema: 'fabrication.rules.v1', version: 'india-modular-v1',
  carcassThicknessMm: 18, shutterThicknessMm: 18, backPanelThicknessMm: 6,
  visibleEdgeBandMm: 2, internalEdgeBandMm: 0.8,
  sheetWidthMm: 2440, sheetHeightMm: 1220, kerfMm: 3, trimMm: 10,
};

export type ProductionPartInstanceV1 = CutlistPart & {
  partInstanceId: string;
  quantity: 1;
  sourcePartId: string;
  roomId: string;
  semanticType: string;
};

export type ProductionSnapshotV1 = {
  schema: 'production.snapshot.v1';
  projectId: string;
  sceneVersion: string;
  fabricationRules: FabricationRulesV1;
  status: 'review_required' | 'approved';
  parts: ProductionPartInstanceV1[];
  hardware: HardwareItem[];
  warnings: string[];
};

const SHEET_SEMANTICS = new Set(['carcass', 'shutter', 'shelf', 'filler', 'back', 'back_panel', 'panel', 'glass']);

function productionDimensions(part: SceneModulePartV1) {
  const dimensions = [part.widthMm, part.depthMm, part.heightMm].sort((a, b) => a - b);
  return { thicknessMm: dimensions[0], widthMm: dimensions[1], lengthMm: dimensions[2] };
}

function edgePolicy(semanticType: string, lengthMm: number, widthMm: number, rules: FabricationRulesV1): Pick<CutlistPart, 'edging' | 'edgeSchedule'> {
  if (semanticType === 'back' || semanticType === 'back_panel' || semanticType === 'glass') return { edging: 'none' };
  if (semanticType === 'shutter' || semanticType === 'panel' || semanticType === 'filler') {
    return { edging: 'all_sides', edgeSchedule: { l1Mm: lengthMm, l2Mm: lengthMm, w1Mm: widthMm, w2Mm: widthMm, tapeType: `${rules.visibleEdgeBandMm}mm PVC` } };
  }
  return { edging: 'front_only', edgeSchedule: { l1Mm: lengthMm, l2Mm: 0, w1Mm: 0, w2Mm: 0, tapeType: `${rules.internalEdgeBandMm}mm PVC` } };
}

/** Build the sole manufacturing snapshot from exact scene.v1 component geometry. */
export function buildProductionSnapshot(scene: SceneV1, rules: FabricationRulesV1 = DEFAULT_FABRICATION_RULES_V1): ProductionSnapshotV1 {
  if (!['approved', 'locked'].includes(scene.metadata.status)) throw new Error('SCENE_NOT_PRODUCTION_READY');
  if (!scene.moduleParts?.length) throw new Error('AUTHORITATIVE_MODULE_PARTS_REQUIRED');
  const moduleFamily = new Map<string, string>((scene.modules ?? []).map((module: SceneModuleV1) => [module.id, module.family]));
  const warnings: string[] = [];
  const hardware: HardwareItem[] = [];
  const parts: ProductionPartInstanceV1[] = [];
  for (const part of scene.moduleParts) {
    const semanticType = String(part.semanticType || 'component');
    if (semanticType === 'hardware') {
      hardware.push({ name: part.name, category: /hinge/i.test(part.name) ? 'hinge' : /slide|runner/i.test(part.name) ? 'slide' : /handle/i.test(part.name) ? 'handle' : 'accessory', quantity: 1, unit: 'each' });
      continue;
    }
    if (!SHEET_SEMANTICS.has(semanticType)) {
      warnings.push(`${part.name} (${semanticType}) is a non-sheet component and requires a separate purchasing or operation schedule.`);
      continue;
    }
    const dimensions = productionDimensions(part);
    if (dimensions.thicknessMm > 50) {
      warnings.push(`${part.name} is not panel-like (${dimensions.thicknessMm} mm minimum dimension) and was withheld from sheet nesting.`);
      continue;
    }
    const materialCode = part.materialId ?? 'material-unassigned';
    const edge = edgePolicy(semanticType, dimensions.lengthMm, dimensions.widthMm, rules);
    parts.push({
      id: part.id, partInstanceId: part.id, sourcePartId: part.id,
      moduleId: part.moduleId, roomId: part.roomId ?? '',
      family: moduleFamily.get(part.moduleId) ?? 'module-part', semanticType,
      partName: part.name, ...dimensions, ...edge,
      grainDirection: semanticType === 'shutter' || semanticType === 'back_panel' || semanticType === 'panel' ? 'vertical' : semanticType === 'glass' ? 'none' : 'horizontal',
      materialCode, quantity: 1, status: 'review_required', sourceSceneVersion: scene.metadata.designVersion,
    });
  }
  if (!parts.length) throw new Error('NO_SHEET_PARTS_AVAILABLE');
  return { schema: 'production.snapshot.v1', projectId: scene.projectId, sceneVersion: scene.metadata.designVersion, fabricationRules: rules, status: 'review_required', parts, hardware, warnings };
}

export type HardwareItem = {
  name: string;
  category: 'hinge' | 'slide' | 'fastener' | 'handle' | 'accessory';
  quantity: number;
  unit: string;
};

export type PlacedPanel = {
  partId: string;
  partInstanceId: string;
  partName: string;
  moduleId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  lengthMm: number;
  rotated: boolean;
};

export type NestingSheet = {
  sheetId: string;
  materialCode: string;
  thicknessMm: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  placedPanels: PlacedPanel[];
  usedAreaSqm: number;
  utilizationPercentage: number;
};

export type EdgeBandingSummary = {
  tapeType: string;
  thicknessMm: number;
  totalMeters: number;
};

export type NestingResult = {
  plywoodSheets18mm: number;
  mdfSheets8mm: number;
  wastageFactor: number;
  sheets: NestingSheet[];
  edgeBandingSummary: EdgeBandingSummary[];
  totalAreaSqm18mm: number;
  totalAreaSqm8mm: number;
};

// Deterministic 2D MaxRects Bin Packing Engine with 3mm Saw Kerf
export function nestPanels2D(
  parts: CutlistPart[],
  sheetWidthMm = 2440,
  sheetHeightMm = 1220,
  kerfMm = 3,
  trimMm = 10,
): { sheets: NestingSheet[]; updatedParts: CutlistPart[] } {
  const updatedParts = parts.map((p) => ({ ...p }));
  const sheets: NestingSheet[] = [];

  // Group parts by material code & thickness
  const groups = new Map<string, CutlistPart[]>();
  for (const part of updatedParts) {
    const key = `${part.materialCode || '18mm-plywood'}::${part.thicknessMm}`;
    if (!groups.has(key)) groups.set(key, []);
    const list = groups.get(key)!;
    for (let q = 0; q < part.quantity; q++) {
      list.push({ ...part, partInstanceId: part.quantity > 1 ? `${part.id}#${q + 1}` : (part.partInstanceId ?? part.id), quantity: 1 });
    }
  }

  for (const [key, groupParts] of groups.entries()) {
    const separator = key.lastIndexOf('::');
    const materialCode = key.slice(0, separator);
    const thickStr = key.slice(separator + 2);
    const thicknessMm = Number(thickStr) || 18;

    // Sort parts descending by area for efficient packing
    const unplaced = [...groupParts].sort((a, b) => b.lengthMm * b.widthMm - a.lengthMm * a.widthMm);

    let sheetCount = 0;
    while (unplaced.length > 0) {
      sheetCount++;
      const sheetId = `sheet-${materialCode}-${thicknessMm}mm-#${sheetCount}`;
      const freeRects = [{ x: trimMm, y: trimMm, w: sheetWidthMm - trimMm * 2, h: sheetHeightMm - trimMm * 2 }];
      const placedPanels: PlacedPanel[] = [];
      let usedAreaSqMm = 0;

      for (let i = unplaced.length - 1; i >= 0; i--) {
        const part = unplaced[i];
        let bestRectIdx = -1;
        let bestRotated = false;
        let bestShortSideFit = Infinity;

        const partW = part.widthMm + kerfMm;
        const partL = part.lengthMm + kerfMm;

        // Try normal and rotated (unless restricted by grain)
        const allowRotate = part.grainDirection !== 'vertical' && part.grainDirection !== 'horizontal';

        for (let r = 0; r < freeRects.length; r++) {
          const free = freeRects[r];

          // Normal orientation: length along X, width along Y
          if (free.w >= partL && free.h >= partW) {
            const leftoverShort = Math.min(free.w - partL, free.h - partW);
            if (leftoverShort < bestShortSideFit) {
              bestShortSideFit = leftoverShort;
              bestRectIdx = r;
              bestRotated = false;
            }
          }

          // Rotated orientation
          if (allowRotate && free.w >= partW && free.h >= partL) {
            const leftoverShort = Math.min(free.w - partW, free.h - partL);
            if (leftoverShort < bestShortSideFit) {
              bestShortSideFit = leftoverShort;
              bestRectIdx = r;
              bestRotated = true;
            }
          }
        }

        if (bestRectIdx !== -1) {
          const target = freeRects[bestRectIdx];
          const actualW = bestRotated ? part.widthMm : part.lengthMm;
          const actualH = bestRotated ? part.lengthMm : part.widthMm;
          const kerfW = actualW + kerfMm;
          const kerfH = actualH + kerfMm;

          const placement: PlacedPanel = {
            partId: part.id,
            partInstanceId: part.partInstanceId ?? part.id,
            partName: part.partName,
            moduleId: part.moduleId,
            xMm: target.x,
            yMm: target.y,
            widthMm: actualW,
            lengthMm: actualH,
            rotated: bestRotated,
          };
          placedPanels.push(placement);
          usedAreaSqMm += actualW * actualH;

          // Update part metadata
          part.sheetId = sheetId;
          part.placedPos = { xMm: target.x, yMm: target.y, rotated: bestRotated };

          // Split remaining free rectangle into right and top sub-rectangles (Guillotine cut style)
          freeRects.splice(bestRectIdx, 1);
          if (target.w - kerfW > 0) {
            freeRects.push({ x: target.x + kerfW, y: target.y, w: target.w - kerfW, h: target.h });
          }
          if (target.h - kerfH > 0) {
            freeRects.push({ x: target.x, y: target.y + kerfH, w: kerfW, h: target.h - kerfH });
          }

          unplaced.splice(i, 1);
        }
      }

      const totalSheetArea = sheetWidthMm * sheetHeightMm;
      const utilization = Math.min(100, Math.round((usedAreaSqMm / totalSheetArea) * 1000) / 10);

      sheets.push({
        sheetId,
        materialCode,
        thicknessMm,
        sheetWidthMm,
        sheetHeightMm,
        placedPanels,
        usedAreaSqm: Math.round((usedAreaSqMm / 1_000_000) * 100) / 100,
        utilizationPercentage: utilization,
      });
      if (!placedPanels.length) {
        const blocked = unplaced[0];
        throw new Error(`PANEL_EXCEEDS_USABLE_SHEET:${blocked.partInstanceId ?? blocked.id}:${blocked.lengthMm}x${blocked.widthMm}`);
      }
    }
  }

  return { sheets, updatedParts };
}

export function calculateEdgeBandingSummary(parts: CutlistPart[]): EdgeBandingSummary[] {
  const summaryMap = new Map<string, { thicknessMm: number; totalMm: number }>();

  for (const part of parts) {
    if (part.edging === 'none') continue;
    const count = part.quantity || 1;
    let l1 = 0, l2 = 0, w1 = 0, w2 = 0;

    if (part.edgeSchedule) {
      l1 = part.edgeSchedule.l1Mm || 0;
      l2 = part.edgeSchedule.l2Mm || 0;
      w1 = part.edgeSchedule.w1Mm || 0;
      w2 = part.edgeSchedule.w2Mm || 0;
    } else if (part.edging === 'all_sides') {
      l1 = part.lengthMm; l2 = part.lengthMm;
      w1 = part.widthMm; w2 = part.widthMm;
    } else if (part.edging === 'front_only') {
      l1 = part.lengthMm;
    }

    const totalMm = (l1 + l2 + w1 + w2) * count;
    const tapeType = part.edgeSchedule?.tapeType || (part.edging === 'all_sides' ? '2.0mm PVC' : '0.8mm PVC');
    const parsedThickness = Number.parseFloat(tapeType);
    const thick = Number.isFinite(parsedThickness) ? parsedThickness : 0.8;

    if (!summaryMap.has(tapeType)) {
      summaryMap.set(tapeType, { thicknessMm: thick, totalMm: 0 });
    }
    summaryMap.get(tapeType)!.totalMm += totalMm;
  }

  return Array.from(summaryMap.entries()).map(([tapeType, data]) => ({
    tapeType,
    thicknessMm: data.thicknessMm,
    totalMeters: Math.round((data.totalMm / 1000) * 10) / 10,
  }));
}

function escapeProductionXml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Printable, scene-linked panel labels. The instance ID is the stable QR/barcode payload. */
export function generateProductionLabelsSvg(snapshot: ProductionSnapshotV1) {
  const labelWidth = 360;
  const labelHeight = 190;
  const columns = 3;
  const rows = Math.max(1, Math.ceil(snapshot.parts.length / columns));
  const width = labelWidth * columns;
  const height = labelHeight * rows;
  const labels = snapshot.parts.map((part, index) => {
    const x = (index % columns) * labelWidth;
    const y = Math.floor(index / columns) * labelHeight;
    const edge = part.edgeSchedule?.tapeType ?? 'none';
    return `<g transform="translate(${x} ${y})"><rect x="8" y="8" width="344" height="174" rx="8" fill="#fff" stroke="#171717"/><text x="22" y="35" font-size="14" font-weight="700">${escapeProductionXml(part.partName)}</text><text x="22" y="58" font-size="11">${escapeProductionXml(part.partInstanceId)}</text><text x="22" y="82" font-size="13" font-weight="600">${part.lengthMm} x ${part.widthMm} x ${part.thicknessMm} mm</text><text x="22" y="105" font-size="11">Material: ${escapeProductionXml(part.materialCode)}</text><text x="22" y="126" font-size="11">Edge: ${escapeProductionXml(edge)} | Grain: ${escapeProductionXml(part.grainDirection)}</text><text x="22" y="147" font-size="11">Module: ${escapeProductionXml(part.moduleId)} | Room: ${escapeProductionXml(part.roomId ?? '-')}</text><text x="22" y="168" font-size="9">Scene ${escapeProductionXml(snapshot.sceneVersion)} | scan ID: ${escapeProductionXml(part.partInstanceId)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f4f1ea"/><g font-family="Arial, sans-serif" fill="#171717">${labels}</g></svg>`;
}

/** Reproducible cut diagrams using the same deterministic nesting result as the cutlist. */
export function generateProductionNestingSvg(snapshot: ProductionSnapshotV1) {
  const { sheets } = nestPanels2D(snapshot.parts, snapshot.fabricationRules.sheetWidthMm, snapshot.fabricationRules.sheetHeightMm, snapshot.fabricationRules.kerfMm, snapshot.fabricationRules.trimMm);
  const pageWidth = 1000;
  const sheetDrawWidth = 920;
  const scale = sheetDrawWidth / snapshot.fabricationRules.sheetWidthMm;
  const sheetDrawHeight = snapshot.fabricationRules.sheetHeightMm * scale;
  const sectionHeight = sheetDrawHeight + 100;
  const pageHeight = Math.max(180, sheets.length * sectionHeight + 40);
  const sections = sheets.map((sheet, index) => {
    const y = 30 + index * sectionHeight;
    const panels = sheet.placedPanels.map((panel) => `<g><rect x="${40 + panel.xMm * scale}" y="${y + 42 + panel.yMm * scale}" width="${panel.widthMm * scale}" height="${panel.lengthMm * scale}" fill="#d8c3a5" stroke="#34271f"/><text x="${44 + panel.xMm * scale}" y="${y + 58 + panel.yMm * scale}" font-size="9">${escapeProductionXml(panel.partInstanceId)}</text><text x="${44 + panel.xMm * scale}" y="${y + 70 + panel.yMm * scale}" font-size="8">${panel.widthMm}x${panel.lengthMm}${panel.rotated ? ' R' : ''}</text></g>`).join('');
    return `<g><text x="40" y="${y + 18}" font-size="15" font-weight="700">${escapeProductionXml(sheet.sheetId)}</text><text x="760" y="${y + 18}" font-size="12">${escapeProductionXml(sheet.materialCode)} ${sheet.thicknessMm} mm | ${sheet.utilizationPercentage}% used</text><rect x="40" y="${y + 42}" width="${sheetDrawWidth}" height="${sheetDrawHeight}" fill="#fff" stroke="#111" stroke-width="2"/>${panels}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}"><rect width="100%" height="100%" fill="#f4f1ea"/><g font-family="Arial, sans-serif" fill="#171717">${sections || '<text x="40" y="80">No nestable sheet parts were found.</text>'}</g></svg>`;
}

export function generateFullProductionCutlist(scene: SceneV1) {
  const snapshot = buildProductionSnapshot(scene);
  const { sheets, updatedParts } = nestPanels2D(
    snapshot.parts,
    snapshot.fabricationRules.sheetWidthMm,
    snapshot.fabricationRules.sheetHeightMm,
    snapshot.fabricationRules.kerfMm,
    snapshot.fabricationRules.trimMm,
  );
  const byThickness = (thicknessMm: number) => sheets.filter((sheet) => sheet.thicknessMm === thicknessMm).length;
  const totalArea = (parts: CutlistPart[]) => parts.reduce((sum, part) => sum + (part.lengthMm * part.widthMm * part.quantity) / 1_000_000, 0);
  return {
    parts: updatedParts,
    hardware: snapshot.hardware,
    fillers: [],
    nesting: {
      plywoodSheets18mm: byThickness(18),
      mdfSheets8mm: byThickness(8),
      wastageFactor: 0,
      sheets,
      edgeBandingSummary: calculateEdgeBandingSummary(updatedParts),
      totalAreaSqm18mm: totalArea(updatedParts.filter((part) => part.thicknessMm >= 16)),
      totalAreaSqm8mm: totalArea(updatedParts.filter((part) => part.thicknessMm < 16)),
    },
  };
}
export type BOQLineItem = {
  category: 'board' | 'laminate' | 'edging' | 'hardware' | 'finish' | 'labor';
  description: string;
  quantity: number;
  unit: 'sheet' | 'meter' | 'sqm' | 'pcs' | 'set' | 'lumpsum';
  rateInr: number;
  totalInr: number;
};

export type ProjectBOQResult = {
  currency: 'INR' | 'USD';
  items: BOQLineItem[];
  subtotalInr: number;
  taxInr: number;
  totalInr: number;
  summary: {
    plywoodSheets18mm: number;
    mdfSheets8mm: number;
    laminateSheets: number;
    edgeBandingMeters: number;
    hardwarePieces: number;
  };
};

export function generateProjectBOQ(scene: SceneV1, customRates?: Record<string, number>): ProjectBOQResult {
  const cutlist = generateFullProductionCutlist(scene);
  // Quantities are compiler-derived; commercial rates need explicit project
  // approval. A zero rate is intentionally visible rather than guessed.
  const rates: Record<string, number> = { ...(customRates || {}) };
  const rate = (key: string) => Number.isFinite(rates[key]) && rates[key] >= 0 ? rates[key] : 0;

  const items: BOQLineItem[] = [];

  const sheets18 = cutlist.nesting.plywoodSheets18mm;
  items.push({
    category: 'board',
    description: '18mm HDMR / BWP Commercial Plywood Sheet (8ft x 4ft / 2440x1220mm)',
    quantity: sheets18,
    unit: 'sheet',
    rateInr: rate('plywood_18mm'),
    totalInr: sheets18 * rate('plywood_18mm')
  });

  const sheets8 = cutlist.nesting.mdfSheets8mm;
  items.push({
    category: 'board',
    description: '8mm Backing MDF Board Sheet (8ft x 4ft / 2440x1220mm)',
    quantity: sheets8,
    unit: 'sheet',
    rateInr: rate('mdf_8mm'),
    totalInr: sheets8 * rate('mdf_8mm')
  });

  const laminateCount = 0;
  items.push({
    category: 'laminate',
    description: '1.0mm Decorative High-Pressure Laminate Sheet',
    quantity: laminateCount,
    unit: 'sheet',
    rateInr: rate('laminate_sheet'),
    totalInr: laminateCount * rate('laminate_sheet')
  });

  const totalEdgeMeters = cutlist.nesting.edgeBandingSummary.reduce((sum, item) => sum + item.totalMeters, 0);
  items.push({
    category: 'edging',
    description: 'PVC Edge Banding Tape (0.8mm & 2.0mm mixed)',
    quantity: Math.ceil(totalEdgeMeters),
    unit: 'meter',
    rateInr: rate('edge_tape_meter'),
    totalInr: Math.ceil(totalEdgeMeters) * rate('edge_tape_meter')
  });

  let totalHardwarePcs = 0;
  for (const hw of cutlist.hardware) {
    totalHardwarePcs += hw.quantity;
    const rateKey = hw.name.toLowerCase().includes('hinge')
      ? 'hinge_pc'
      : hw.name.toLowerCase().includes('handle')
      ? 'handle_pc'
      : hw.name.toLowerCase().includes('minifix')
      ? 'minifix_set'
      : hw.name.toLowerCase().includes('dowel')
      ? 'dowel_pc'
      : 'hardware_default';
    const hardwareRate = rate(rateKey);
    items.push({
      category: 'hardware',
      description: `${hw.name} (${hw.unit})`,
      quantity: hw.quantity,
      unit: hw.unit === 'pcs' ? 'pcs' : hw.unit === 'sets' ? 'set' : 'pcs',
      rateInr: hardwareRate,
      totalInr: hw.quantity * hardwareRate
    });
  }

  const paintAreaSqm = 0;

  const subtotalInr = items.reduce((sum, item) => sum + item.totalInr, 0);
  const taxInr = Math.round(subtotalInr * 0.18);
  const totalInr = subtotalInr + taxInr;

  return {
    currency: 'INR',
    items,
    subtotalInr,
    taxInr,
    totalInr,
    summary: {
      plywoodSheets18mm: sheets18,
      mdfSheets8mm: sheets8,
      laminateSheets: laminateCount,
      edgeBandingMeters: Math.ceil(totalEdgeMeters),
      hardwarePieces: totalHardwarePcs
    }
  };
}

export function generateWallElevationSvg(scene: SceneV1, wallId: string, options?: import('./shop-drawing-renderer.js').ShopDrawingOptions): string {
  if (options?.viewMode === 'shop-sheet' || options?.viewMode === 'internal' || options?.unitTitle) {
    return generateArchitecturalShopSheetSvg(scene, wallId, options);
  }
  const wall = (scene.walls ?? []).find((w: SceneV1['walls'][number]) => w.id === wallId) || scene.walls?.[0];
  const wallLengthMm = wall ? Math.hypot(wall.end.xMm - wall.start.xMm, wall.end.yMm - wall.start.yMm) : 5200;
  const wallHeightMm = wall?.heightMm || 2700;

  // ── Canvas layout ──────────────────────────────────────────────────────────
  const leftCalloutW = 180; // space for leader annotations
  const rightDimW = 80;     // right-side vertical dimension chain
  const dimLineH = 80;      // bottom horizontal dimension chain
  const topMargin = 60;     // title block
  const drawW = 780;
  const drawH = 480;

  const svgW = leftCalloutW + drawW + rightDimW + 20;
  const svgH = topMargin + drawH + dimLineH;

  const originX = leftCalloutW;                  // wall left edge in SVG
  const originY = topMargin + drawH;            // floor level in SVG (y increases downward)

  // Scale to fit drawW x drawH
  const scaleX = drawW / Math.max(1000, wallLengthMm);
  const scaleY = drawH / Math.max(1000, wallHeightMm);
  const scale = Math.min(scaleX, scaleY);

  // px helpers (positive y = up in architecture, so inverted for SVG)
  const tx = (mmX: number) => originX + mmX * scale;
  const ty = (mmY: number) => originY - mmY * scale;  // floor = originY, ceiling = originY - wallHeightMm*scale

  const wallRectW = wallLengthMm * scale;
  const wallRectH = wallHeightMm * scale;

  // ── Modules projected onto this wall ───────────────────────────────────────
  const modulesOnWall = buildDrawingProjection(scene).modules.filter((m) => m.wallId === wall?.id);

  // ── System 32 datum heights (Indian modular standard) ─────────────────────
  const PLINTH_H = 100;      // Skirting / plinth
  const COUNTER_H = 850;     // Kitchen counter / base unit top
  const LINTEL_H = 2100;     // Tall unit / wardrobe top shutter
  const LOFT_H = wallHeightMm - 600; // Loft shelf bottom (~2100mm for 2700 ceiling)
  const CEILING_H = wallHeightMm;

  const DIM_RED = '#e63232';
  const LINE_DARK = '#1c1c2e';
  const WALL_FILL = '#f5f5f0';
  const MOD_FILL = '#dde8f7';
  const MOD_STROKE = '#153e75';
  const HATCH_COL = '#b0aaa0';
  const DATUM_COL = '#c0bab0';
  const CALLOUT_COL = '#e63232';

  // ── Helper: horizontal dim string ─────────────────────────────────────────
  function hDim(x1: number, x2: number, y: number, label: string, above = true, tickH = 10): string {
    const midX = (x1 + x2) / 2;
    const textY = above ? y - 6 : y + 14;
    return `<g class="dim">
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${DIM_RED}" stroke-width="1.2"/>
      <line x1="${x1}" y1="${y - tickH / 2}" x2="${x1}" y2="${y + tickH / 2}" stroke="${DIM_RED}" stroke-width="1.2"/>
      <line x1="${x2}" y1="${y - tickH / 2}" x2="${x2}" y2="${y + tickH / 2}" stroke="${DIM_RED}" stroke-width="1.2"/>
      <text x="${midX}" y="${textY}" text-anchor="middle" fill="${DIM_RED}" font-size="11" font-weight="bold" font-family="Arial,sans-serif">${label}</text>
    </g>`;
  }

  // ── Helper: vertical dim string (right side) ──────────────────────────────
  function vDim(x: number, y1: number, y2: number, label: string, rightOffset = 18): string {
    const midY = (y1 + y2) / 2;
    const lx = x + rightOffset;
    return `<g class="dim">
      <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${DIM_RED}" stroke-width="1.2"/>
      <line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}" stroke="${DIM_RED}" stroke-width="1.2"/>
      <line x1="${x - 5}" y1="${y2}" x2="${x + 5}" y2="${y2}" stroke="${DIM_RED}" stroke-width="1.2"/>
      <text x="${lx}" y="${midY + 4}" fill="${DIM_RED}" font-size="10" font-weight="bold" font-family="Arial,sans-serif">${label}</text>
    </g>`;
  }

  // ── Helper: left leader callout ────────────────────────────────────────────
  function leader(svgY: number, label: string): string {
    const endX = originX - 6;
    const textX = 4;
    const textY = svgY + 4;
    return `<g>
      <line x1="${textX + label.length * 6 + 2}" y1="${svgY}" x2="${endX}" y2="${svgY}" stroke="${CALLOUT_COL}" stroke-width="0.9" stroke-dasharray="3 2"/>
      <text x="${textX}" y="${textY}" fill="${CALLOUT_COL}" font-size="9.5" font-family="Arial,sans-serif" font-weight="bold">${label}</text>
    </g>`;
  }

  // ── Helper: hatch pattern for ceiling/rafter zone ─────────────────────────
  function hatchRect(x: number, y: number, w: number, h: number, spacing = 14): string {
    let lines = '';
    for (let d = 0; d < w + h; d += spacing) {
      const x1 = x + Math.max(0, d - h);
      const y1 = y + Math.min(h, d);
      const x2 = x + Math.min(w, d);
      const y2 = y + Math.max(0, d - w);
      if (x1 < x + w && y2 < y + h) {
        lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${HATCH_COL}" stroke-width="0.8"/>`;
      }
    }
    return `<g opacity="0.5">${lines}</g>`;
  }

  // ── Ceiling / rafter hatch zone (top 600mm = loft space) ──────────────────
  const ceilingZoneH = (CEILING_H - LOFT_H) * scale;  // ~600mm * scale
  const ceilingRectY = ty(CEILING_H);
  const ceilingHatch = hatchRect(originX, ceilingRectY, wallRectW, Math.max(2, ceilingZoneH));

  // ── Datum dash lines ───────────────────────────────────────────────────────
  function datumLine(heightMm: number, label: string): string {
    const y = ty(heightMm);
    return `<g>
      <line x1="${originX}" y1="${y}" x2="${originX + wallRectW}" y2="${y}" stroke="${DATUM_COL}" stroke-width="0.6" stroke-dasharray="4 3"/>
      <text x="${originX + wallRectW + 6}" y="${y + 4}" fill="${DATUM_COL}" font-size="8.5" font-family="Arial,sans-serif">${label}</text>
    </g>`;
  }

  // ── Module SVG elements ────────────────────────────────────────────────────
  let moduleSvgElements = '';
  const moduleAnnotations: string[] = [];
  const hDimLines: string[] = [];

  // Bottom dimension chain: collect segment starts
  const hSegments: Array<{ xMm: number; wMm: number; label: string }> = [];
  let prevEndMm = 0;

  for (const mod of modulesOnWall) {
    const offMm = mod.offsetAlongWallMm ?? 0;
    const mx = tx(offMm);
    const my = ty(mod.heightMm);
    const mw = Math.max(6, mod.widthMm * scale);
    const mh = Math.max(6, mod.heightMm * scale);

    // Gap before module (filler)
    if (offMm > prevEndMm + 5) {
      hSegments.push({ xMm: prevEndMm, wMm: offMm - prevEndMm, label: `${Math.round(offMm - prevEndMm)}` });
    }
    hSegments.push({ xMm: offMm, wMm: mod.widthMm, label: `${Math.round(mod.widthMm)}` });
    prevEndMm = offMm + mod.widthMm;

    const isTall = mod.heightMm > 1800;
    const isBase = mod.heightMm <= 900;
    const fillColor = isTall ? '#d6e4f7' : isBase ? '#fdf0d0' : '#ddeeff';
    const strokeColor = isTall ? MOD_STROKE : isBase ? '#7c5c12' : MOD_STROKE;

    // Outer module group for lineage-aware picking
    moduleSvgElements += `<g data-module-id="${mod.id}" class="elevation-module-group" style="cursor: pointer;">`;

    // Outer module rectangle
    moduleSvgElements += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}"
      fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8" fill-opacity="0.7"
      data-module-id="${mod.id}" class="elevation-module-rect"/>`;

    // Skirting band (100mm plinth)
    const plinthPx = PLINTH_H * scale;
    if (mh > plinthPx + 10) {
      moduleSvgElements += `<rect x="${mx}" y="${originY - plinthPx}" width="${mw}" height="${plinthPx}"
        fill="#d4c8a0" stroke="${strokeColor}" stroke-width="1" fill-opacity="0.6"/>`;
      if (mw > 60) {
        moduleSvgElements += `<text x="${mx + mw / 2}" y="${originY - plinthPx / 2 + 4}" text-anchor="middle"
          fill="#6b5a2e" font-size="8" font-family="Arial,sans-serif">SKIRTING</text>`;
      }
    }

    // Drawer zone (base units) — bottom 200mm above plinth
    if (isBase && mh > 80) {
      const drawerH = 220 * scale;
      const drawerY = originY - PLINTH_H * scale - drawerH;
      moduleSvgElements += `<rect x="${mx + 4}" y="${drawerY}" width="${mw - 8}" height="${drawerH}"
        fill="#c8dff5" stroke="${MOD_STROKE}" stroke-width="1" fill-opacity="0.8"/>`;
      if (mw > 80) {
        moduleSvgElements += `<text x="${mx + mw / 2}" y="${drawerY + drawerH / 2 + 4}" text-anchor="middle"
          fill="${MOD_STROKE}" font-size="9" font-family="Arial,sans-serif" font-weight="bold">DRAWER</text>`;
      }
    }

    // Loft shelf (tall units) — top 600mm
    if (isTall && mh > 120) {
      const loftH = 600 * scale;
      moduleSvgElements += `<rect x="${mx}" y="${my}" width="${mw}" height="${loftH}"
        fill="#c8d8ef" stroke="${MOD_STROKE}" stroke-width="1" fill-opacity="0.5"/>`;
      if (mw > 60) {
        moduleSvgElements += `<text x="${mx + mw / 2}" y="${my + loftH / 2 + 4}" text-anchor="middle"
          fill="${MOD_STROKE}" font-size="8.5" font-family="Arial,sans-serif">LOFT</text>`;
      }
    }

    // Module label and dimensions
    if (mw > 50 && mh > 50) {
      moduleSvgElements += `<text x="${mx + mw / 2}" y="${my + mh / 2}" text-anchor="middle"
        fill="${LINE_DARK}" font-size="10" font-weight="bold" font-family="Arial,sans-serif">${mod.family}</text>`;
      moduleSvgElements += `<text x="${mx + mw / 2}" y="${my + mh / 2 + 14}" text-anchor="middle"
        fill="#4b5563" font-size="8.5" font-family="Arial,sans-serif">${Math.round(mod.widthMm)} x ${Math.round(mod.heightMm)} mm</text>`;
    }

    moduleSvgElements += `</g>`;

    // Leader annotations on left side
    moduleAnnotations.push(leader(my + mh * 0.15, mod.family.toUpperCase().replace(/-/g, ' ')));
    if (isBase) moduleAnnotations.push(leader(ty(PLINTH_H + 220 / 2), 'DRAWER'));
    if (isTall) moduleAnnotations.push(leader(ty(LINTEL_H + (LOFT_H - LINTEL_H) / 2), 'LOFT'));
  }

  // Gap at end
  if (prevEndMm < wallLengthMm - 5) {
    hSegments.push({ xMm: prevEndMm, wMm: wallLengthMm - prevEndMm, label: `${Math.round(wallLengthMm - prevEndMm)}` });
  }

  // ── Horizontal dimension chain (below wall) ────────────────────────────────
  const hChainY = originY + 28;
  for (const seg of hSegments) {
    if (seg.wMm < 20) continue;
    hDimLines.push(hDim(tx(seg.xMm), tx(seg.xMm + seg.wMm), hChainY, seg.label));
  }
  // Overall dimension
  const overallDimY = originY + 54;
  hDimLines.push(hDim(tx(0), tx(wallLengthMm), overallDimY, `${Math.round(wallLengthMm)}`, true, 8));

  // ── Right-side vertical dimension chain ────────────────────────────────────
  const vDimX = originX + wallRectW + 16;
  const vDims: string[] = [];
  // Plinth zone
  vDims.push(vDim(vDimX, ty(0), ty(PLINTH_H), `${PLINTH_H}`));
  // Shutter zone (plinth to lintel)
  vDims.push(vDim(vDimX + 22, ty(PLINTH_H), ty(LINTEL_H), `${LINTEL_H - PLINTH_H}`));
  // Loft zone (lintel to loft top)
  vDims.push(vDim(vDimX + 44, ty(LINTEL_H), ty(LOFT_H), `${Math.round(LOFT_H - LINTEL_H)}`));
  // Overall height
  vDims.push(vDim(vDimX + 62, ty(0), ty(CEILING_H), `${CEILING_H}`));

  // ── Opening symbols ────────────────────────────────────────────────────────
  const openingsOnWall = (scene.openings ?? []).filter((o: SceneOpeningV1) => o.wallId === wall?.id);
  let openingsSvg = '';
  for (const op of openingsOnWall) {
    const ox = tx(op.offsetMm);
    const oy = ty(op.heightMm);
    const ow = op.widthMm * scale;
    const oh = op.heightMm * scale;
    openingsSvg += `<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}"
      fill="white" stroke="#9b2c2c" stroke-width="1.8" fill-opacity="0.9"/>`;
    // Door swing arc hint
    if (op.kind === 'door') {
      openingsSvg += `<path d="M${ox} ${originY} Q${ox + ow} ${originY} ${ox + ow} ${originY - oh}"
        fill="none" stroke="#9b2c2c" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.6"/>`;
    }
    openingsSvg += `<text x="${ox + ow / 2}" y="${oy - 8}" text-anchor="middle"
      fill="#9b2c2c" font-size="9.5" font-weight="bold" font-family="Arial,sans-serif">
      ${op.kind.toUpperCase()} ${Math.round(op.widthMm)}mm</text>`;
    // Dim line for opening
    hDimLines.push(hDim(ox, ox + ow, originY + 14, `${Math.round(op.widthMm)}`, false, 7));
  }

  // ── Fixed annotations ──────────────────────────────────────────────────────
  const fixedAnnotations = [
    leader(ty(CEILING_H) + 10, 'RAFTERS / RAFTER ZONE'),
    leader(ty(LOFT_H), 'LOFT SHELF 600mm'),
    leader(ty(LINTEL_H), 'LINTEL 2100mm'),
    leader(ty(COUNTER_H), 'COUNTER / DADO 850mm'),
    leader(ty(PLINTH_H), 'PLINTH 100mm'),
    leader(ty(0), 'FINISHED FLOOR LEVEL'),
  ];

  // ── Assemble SVG ───────────────────────────────────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="ceilHatch" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="12" stroke="${HATCH_COL}" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- White background -->
  <rect width="${svgW}" height="${svgH}" fill="white"/>

  <!-- Title block -->
  <text x="${originX}" y="22" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="${LINE_DARK}">WALL ELEVATION — ${(wallId || 'MAIN').toUpperCase()}</text>
  <text x="${originX}" y="38" font-family="Arial,sans-serif" font-size="9.5" fill="#64748b">
    ${Math.round(wallLengthMm)} mm × ${wallHeightMm} mm  |  Scale 1:${Math.round(1 / scale * 10) / 10}  |  ULTIDA Architectural Drawing Engine  |  IS 710 / System 32 Standard
  </text>

  <!-- Wall background -->
  <rect x="${originX}" y="${ty(wallHeightMm)}" width="${wallRectW}" height="${wallRectH}" fill="${WALL_FILL}" stroke="${LINE_DARK}" stroke-width="2.5"/>

  <!-- Ceiling hatch zone -->
  <rect x="${originX}" y="${ty(CEILING_H)}" width="${wallRectW}" height="${ceilingZoneH}" fill="url(#ceilHatch)" opacity="0.45"/>
  ${ceilingHatch}

  <!-- Floor line -->
  <line x1="${originX - 10}" y1="${ty(0)}" x2="${originX + wallRectW + 10}" y2="${ty(0)}" stroke="${LINE_DARK}" stroke-width="3"/>

  <!-- System 32 datum lines -->
  ${datumLine(PLINTH_H, `PLINTH ${PLINTH_H}mm`)}
  ${datumLine(COUNTER_H, `COUNTER ${COUNTER_H}mm`)}
  ${datumLine(LINTEL_H, `LINTEL ${LINTEL_H}mm`)}
  ${datumLine(LOFT_H, `LOFT ${Math.round(LOFT_H)}mm`)}

  <!-- Openings (doors/windows) -->
  ${openingsSvg}

  <!-- Modular units -->
  ${moduleSvgElements}

  <!-- Left-side leader annotations -->
  ${fixedAnnotations.join('\n  ')}
  ${moduleAnnotations.join('\n  ')}

  <!-- Horizontal dimension chain -->
  ${hDimLines.join('\n  ')}

  <!-- Right-side vertical dimensions -->
  ${vDims.join('\n  ')}

  <!-- Border frame -->
  <rect x="1" y="1" width="${svgW - 2}" height="${svgH - 2}" fill="none" stroke="#2c2c2c" stroke-width="1.2"/>
</svg>`;
}

export { generateSketchUpRubyScript } from './sketchup-exporter.js';
export { generateArchitecturalShopSheetSvg, type ShopDrawingOptions } from './shop-drawing-renderer.js';
