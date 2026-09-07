import { z } from 'zod';

const PointMm = z.object({ xMm: z.number(), yMm: z.number() });
const Confidence = z.number().min(0).max(1);
// Canonical plan entities use UUIDs, so scene references must accept UUIDs too.
const Id = z.string().min(1);
const Polygon = z.array(PointMm).min(3);

export const SceneV1Schema = z.object({
  schema: z.literal('scene.v1'),
  units: z.literal('mm'),
  coordinateSystem: z.literal('right-handed-z-up'),
  projectId: Id,
  floorPlanVersionId: Id,
  floors: z.array(z.object({ id: Id, name: z.string(), elevationMm: z.number().finite(), heightMm: z.number().positive() })).min(1),
  spaces: z.array(z.object({ id: Id, floorId: Id, name: z.string(), type: z.string() })),
  rooms: z.array(z.object({ id: Id, spaceId: Id, name: z.string(), type: z.string(), boundary: Polygon, confidence: Confidence })),
  walls: z.array(z.object({ id: Id, floorId: Id, start: PointMm, end: PointMm, thicknessMm: z.number().positive(), heightMm: z.number().positive(), baseElevationMm: z.number().nonnegative().default(0), spaceIds: z.array(Id).default([]), confidence: Confidence })),
  openings: z.array(z.object({ id: Id, wallId: Id, kind: z.enum(['door','window','passage']), offsetMm: z.number().nonnegative(), widthMm: z.number().positive(), heightMm: z.number().positive(), sillHeightMm: z.number().nonnegative().default(0), confidence: Confidence })),
  fixedFixtures: z.array(z.object({ id: Id, spaceId: Id, kind: z.string(), anchor: PointMm, widthMm: z.number().positive(), depthMm: z.number().positive(), confidence: Confidence })),
  modules: z.array(z.object({ id: Id, roomId: Id, family: z.string(), widthMm: z.number().positive(), depthMm: z.number().positive(), heightMm: z.number().positive(), position: PointMm.extend({ zMm: z.number().nonnegative().default(0) }), rotationDeg: z.number().finite(), anchor: z.enum(['floor','wall','ceiling','free']), materialId: Id.optional(), confidence: Confidence })),
  // A module is the placement envelope. Module parts are the manufacturing
  // geometry used by the browser preview, deterministic base render, drawings,
  // and production pack. Keeping both avoids treating a visual bounding box as
  // a cabinet construction model.
  moduleParts: z.array(z.object({
    id: Id,
    moduleId: Id,
    roomId: Id,
    semanticType: z.string(),
    name: z.string(),
    widthMm: z.number().positive(),
    depthMm: z.number().positive(),
    heightMm: z.number().positive(),
    position: z.object({ xMm: z.number(), yMm: z.number(), zMm: z.number().nonnegative() }),
    rotationDeg: z.number().finite(),
    materialId: Id.optional(),
    confidence: Confidence,
  })).default([]),
  // Optional parametric composition schedule. When present, this is the
  // measured wall reconciliation used by elevations and production exports.
  compositions: z.array(z.object({
    id: Id,
    wallId: Id,
    usableWidthMm: z.number().positive(),
    leftClearanceMm: z.number().nonnegative().default(0),
    rightClearanceMm: z.number().nonnegative().default(0),
    bays: z.array(z.object({ id: Id, moduleId: Id, widthMm: z.number().positive(), offsetMm: z.number().nonnegative() })).min(1),
    fillers: z.array(z.object({ id: Id, widthMm: z.number().positive(), side: z.enum(['left','right','between']) })).default([]),
    confirmed: z.boolean().default(false),
  })).default([]),
  materials: z.array(z.object({ id: Id, name: z.string(), code: z.string(), unitCost: z.number().nonnegative().optional(), finish: z.string().optional() })),
  // Lighting is part of the authored scene contract, rather than a renderer-only
  // preset. Fixture detail is intentionally optional so older scene.v1 records
  // remain valid, while newly compiled scenes can render and brief fixtures
  // consistently across browser preview and downstream render jobs.
  lighting: z.array(z.object({
    id: Id,
    spaceId: Id,
    kind: z.enum(['ambient','task','accent','natural']),
    position: PointMm,
    fixture: z.enum(['ceiling-spot', 'floor-lamp', 'table-lamp', 'pendant', 'cove']).optional(),
    heightMm: z.number().positive().optional(),
    shadeDiameterMm: z.number().positive().optional(),
    colorTemperatureK: z.number().int().min(1800).max(6500).optional(),
    lumens: z.number().positive().optional(),
    materialId: Id.optional(),
    confidence: Confidence,
  })),
  cameras: z.array(z.object({ id: Id, name: z.string(), position: z.object({ xMm: z.number(), yMm: z.number(), zMm: z.number() }), target: z.object({ xMm: z.number(), yMm: z.number(), zMm: z.number() }), lensMm: z.number().positive() })),
  constraints: z.array(z.object({ id: Id, kind: z.string(), severity: z.enum(['advisory','warning','critical']), description: z.string(), entityIds: z.array(Id) })),
  unresolvedDetections: z.array(z.object({ id: Id, kind: z.string(), description: z.string(), confidence: Confidence, source: z.string() })),
  metadata: z.object({ branch: z.string(), status: z.enum(['draft','review','approved','locked','superseded']), changeReason: z.string(), schemaVersion: z.literal('scene.v1'), designVersion: z.string() })
}).superRefine((scene, ctx) => {
  // A room deliberately references its corresponding space by the same ID.
  // IDs must therefore be unique within each entity collection, not globally.
  for (const collection of ['floors','spaces','rooms','walls','openings','fixedFixtures','modules','materials','lighting','cameras','constraints','unresolvedDetections'] as const) {
    const ids = new Set<string>();
    scene[collection].forEach((item, i) => {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', path: [collection, i, 'id'], message: `Duplicate ${collection} id: ${item.id}` });
      ids.add(item.id);
    });
  }
  for (const [i, room] of scene.rooms.entries()) { const first = room.boundary[0]; const last = room.boundary[room.boundary.length - 1]; if (first.xMm !== last.xMm || first.yMm !== last.yMm) ctx.addIssue({ code:'custom', path:['rooms',i,'boundary'], message:'Room polygon must be closed.' }); }
  for (const [i, wall] of scene.walls.entries()) { if (wall.start.xMm === wall.end.xMm && wall.start.yMm === wall.end.yMm) ctx.addIssue({ code:'custom', path:['walls',i], message:'Wall length must be positive.' }); }
  for (const [i, opening] of scene.openings.entries()) { const wall = scene.walls.find(w => w.id === opening.wallId); if (wall && opening.offsetMm + opening.widthMm > Math.hypot(wall.end.xMm-wall.start.xMm, wall.end.yMm-wall.start.yMm)) ctx.addIssue({ code:'custom', path:['openings',i], message:'Opening is outside its wall.' }); }
});

export type SceneV1 = z.infer<typeof SceneV1Schema>;
export const SCENE_SCHEMA_VERSION = 'scene.v1';

export type WallKeepOutMm = {
  id?: string;
  offsetMm: number;
  widthMm: number;
  beforeMm?: number;
  afterMm?: number;
};

export type ModuleFitInput = {
  wallLengthMm: number;
  moduleWidthMm: number;
  moduleOffsetMm?: number;
  leftClearanceMm?: number;
  rightClearanceMm?: number;
  keepOuts?: WallKeepOutMm[];
};

export type ModuleFitResult = {
  fits: boolean;
  issues: string[];
  suggestedOffsetMm?: number;
  availableSegments: Array<{ startMm: number; endMm: number; widthMm: number }>;
};

/**
 * Reconcile a wall-mounted module against measured wall geometry and opening
 * keep-outs. This is deliberately dependency-free so the compiler, library,
 * and browser editor cannot drift into different fit rules.
 */
export function reconcileModuleFit(input: ModuleFitInput): ModuleFitResult {
  const issues: string[] = [];
  const wallLength = Number(input.wallLengthMm);
  const moduleWidth = Number(input.moduleWidthMm);
  const left = Number(input.leftClearanceMm ?? 0);
  const right = Number(input.rightClearanceMm ?? 0);
  if (![wallLength, moduleWidth, left, right].every(Number.isFinite) || wallLength <= 0 || moduleWidth <= 0 || left < 0 || right < 0) {
    return { fits: false, issues: ['Wall, module, and clearance dimensions must be finite positive millimetres.'], availableSegments: [] };
  }
  if (left + right >= wallLength) {
    return { fits: false, issues: ['Wall clearances consume the full measured wall.'], availableSegments: [] };
  }

  const wallStart = left;
  const wallEnd = wallLength - right;
  const ranges = (input.keepOuts ?? []).map((keepOut) => {
    const offset = Number(keepOut.offsetMm);
    const width = Number(keepOut.widthMm);
    const before = Number(keepOut.beforeMm ?? 0);
    const after = Number(keepOut.afterMm ?? 0);
    if (![offset, width, before, after].every(Number.isFinite) || width <= 0 || offset < 0 || before < 0 || after < 0) {
      issues.push(`Keep-out ${keepOut.id ?? 'opening'} has invalid measured geometry.`);
      return null;
    }
    return { startMm: Math.max(wallStart, offset - before), endMm: Math.min(wallEnd, offset + width + after) };
  }).filter((range): range is { startMm: number; endMm: number } => Boolean(range && range.endMm > range.startMm))
    .sort((a, b) => a.startMm - b.startMm);

  const merged: Array<{ startMm: number; endMm: number }> = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.startMm <= previous.endMm) previous.endMm = Math.max(previous.endMm, range.endMm);
    else merged.push({ ...range });
  }
  const availableSegments: ModuleFitResult['availableSegments'] = [];
  let cursor = wallStart;
  for (const range of merged) {
    if (range.startMm > cursor) availableSegments.push({ startMm: cursor, endMm: range.startMm, widthMm: range.startMm - cursor });
    cursor = Math.max(cursor, range.endMm);
  }
  if (cursor < wallEnd) availableSegments.push({ startMm: cursor, endMm: wallEnd, widthMm: wallEnd - cursor });

  const requestedOffset = input.moduleOffsetMm === undefined ? undefined : Number(input.moduleOffsetMm);
  if (requestedOffset !== undefined && !Number.isFinite(requestedOffset)) issues.push('Module offset must be a finite millimetre value.');
  if (requestedOffset !== undefined && Number.isFinite(requestedOffset)) {
    const moduleStart = requestedOffset;
    const moduleEnd = moduleStart + moduleWidth;
    if (moduleStart < wallStart || moduleEnd > wallEnd) issues.push('Module extends beyond the measured usable wall run.');
    if (merged.some((range) => moduleStart < range.endMm && moduleEnd > range.startMm)) issues.push('Module overlaps a measured door, window, or other keep-out zone.');
    return { fits: issues.length === 0, issues, suggestedOffsetMm: moduleStart, availableSegments };
  }

  const segment = availableSegments.find((candidate) => candidate.widthMm >= moduleWidth);
  if (!segment) issues.push('No measured wall segment can contain this module without crossing a keep-out zone.');
  return { fits: issues.length === 0, issues, suggestedOffsetMm: segment?.startMm, availableSegments };
}

export function migrateScene(input: unknown): SceneV1 {
  // Legacy callers use this name. It intentionally no longer migrates missing
  // geometry: a scene must be compiled from an approved plan, not repaired by
  // inventing rooms, walls, dimensions, or module positions at runtime.
  return SceneV1Schema.parse(input);
}
