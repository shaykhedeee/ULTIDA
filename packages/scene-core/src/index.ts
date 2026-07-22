import { z } from 'zod';

const PointMm = z.object({ xMm: z.number(), yMm: z.number() });
const Confidence = z.number().min(0).max(1);
const Id = z.string().min(1).regex(/^[A-Za-z][A-Za-z0-9_.:-]*$/);
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
  modules: z.array(z.object({ id: Id, roomId: Id, family: z.string(), widthMm: z.number().positive(), depthMm: z.number().positive(), heightMm: z.number().positive(), position: PointMm, rotationDeg: z.number().finite(), anchor: z.enum(['floor','wall','ceiling','free']), materialId: Id.optional(), confidence: Confidence })),
  materials: z.array(z.object({ id: Id, name: z.string(), code: z.string(), unitCost: z.number().nonnegative().optional(), finish: z.string().optional() })),
  lighting: z.array(z.object({ id: Id, spaceId: Id, kind: z.enum(['ambient','task','accent','natural']), position: PointMm, confidence: Confidence })),
  cameras: z.array(z.object({ id: Id, name: z.string(), position: z.object({ xMm: z.number(), yMm: z.number(), zMm: z.number() }), target: z.object({ xMm: z.number(), yMm: z.number(), zMm: z.number() }), lensMm: z.number().positive() })),
  constraints: z.array(z.object({ id: Id, kind: z.string(), severity: z.enum(['advisory','warning','critical']), description: z.string(), entityIds: z.array(Id) })),
  unresolvedDetections: z.array(z.object({ id: Id, kind: z.string(), description: z.string(), confidence: Confidence, source: z.string() })),
  metadata: z.object({ branch: z.string(), status: z.enum(['draft','review','approved','locked','superseded']), changeReason: z.string(), schemaVersion: z.literal('scene.v1'), designVersion: z.string() })
}).superRefine((scene, ctx) => {
  const ids = new Set<string>();
  const add = (id: string, path: (string|number)[]) => { if (ids.has(id)) ctx.addIssue({ code:'custom', path, message:`Duplicate entity id: ${id}` }); ids.add(id); };
  for (const collection of ['floors','spaces','rooms','walls','openings','fixedFixtures','modules','materials','lighting','cameras','constraints','unresolvedDetections'] as const) scene[collection].forEach((item, i) => add(item.id, [collection, i, 'id']));
  for (const [i, room] of scene.rooms.entries()) { const first = room.boundary[0]; const last = room.boundary[room.boundary.length - 1]; if (first.xMm !== last.xMm || first.yMm !== last.yMm) ctx.addIssue({ code:'custom', path:['rooms',i,'boundary'], message:'Room polygon must be closed.' }); }
  for (const [i, wall] of scene.walls.entries()) { if (wall.start.xMm === wall.end.xMm && wall.start.yMm === wall.end.yMm) ctx.addIssue({ code:'custom', path:['walls',i], message:'Wall length must be positive.' }); }
  for (const [i, opening] of scene.openings.entries()) { const wall = scene.walls.find(w => w.id === opening.wallId); if (wall && opening.offsetMm + opening.widthMm > Math.hypot(wall.end.xMm-wall.start.xMm, wall.end.yMm-wall.start.yMm)) ctx.addIssue({ code:'custom', path:['openings',i], message:'Opening is outside its wall.' }); }
});

export type SceneV1 = z.infer<typeof SceneV1Schema>;
export const SCENE_SCHEMA_VERSION = 'scene.v1';
export function migrateScene(input: unknown): SceneV1 {
  const candidate = (input && typeof input === 'object' ? { ...input } : {}) as Record<string, unknown>;
  if (!candidate.schema) candidate.schema = 'scene.v1';
  if (!candidate.units) candidate.units = 'mm';
  if (!candidate.coordinateSystem) candidate.coordinateSystem = 'right-handed-z-up';
  if (!Array.isArray(candidate.floors)) candidate.floors = [{ id: 'floor-1', name: 'Ground Floor', elevationMm: 0, heightMm: 2700 }];
  if (!Array.isArray(candidate.spaces)) candidate.spaces = [{ id: 'space-1', floorId: 'floor-1', name: 'Main Space', type: 'living' }];
  if (!Array.isArray(candidate.rooms) || candidate.rooms.length === 0) {
    candidate.rooms = [{ id: 'room-1', spaceId: 'space-1', name: 'Living Room', type: 'living', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 }, { xMm: 0, yMm: 0 }], confidence: 1 }];
  } else {
    candidate.rooms = (candidate.rooms as any[]).map((r, i) => {
      let boundary = Array.isArray(r.boundary) ? [...r.boundary] : [{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 }, { xMm: 0, yMm: 0 }];
      if (boundary.length >= 3) {
        const first = boundary[0];
        const last = boundary[boundary.length - 1];
        if (first.xMm !== last.xMm || first.yMm !== last.yMm) boundary.push({ xMm: first.xMm, yMm: first.yMm });
      }
      return { ...r, id: r.id ?? `room-${i + 1}`, spaceId: r.spaceId ?? 'space-1', name: r.name ?? `Room ${i + 1}`, type: r.type ?? 'living', boundary, confidence: r.confidence ?? 1 };
    });
  }

  if (!Array.isArray(candidate.walls)) candidate.walls = [];
  else candidate.walls = (candidate.walls as any[]).map((w) => ({ ...w, floorId: w.floorId ?? 'floor-1', baseElevationMm: w.baseElevationMm ?? 0, spaceIds: Array.isArray(w.spaceIds) ? w.spaceIds : ['space-1'], confidence: w.confidence ?? 1 }));

  if (!Array.isArray(candidate.openings)) candidate.openings = [];
  else candidate.openings = (candidate.openings as any[]).map((o) => ({ ...o, confidence: o.confidence ?? 1 }));

  if (!Array.isArray(candidate.fixedFixtures)) candidate.fixedFixtures = [];

  if (!Array.isArray(candidate.modules)) candidate.modules = [];
  else candidate.modules = (candidate.modules as any[]).map((m) => ({ ...m, roomId: m.roomId ?? 'room-1', position: m.position ?? { xMm: 0, yMm: 0 }, rotationDeg: m.rotationDeg ?? 0, anchor: m.anchor ?? 'floor', confidence: m.confidence ?? 1 }));

  if (!Array.isArray(candidate.materials)) candidate.materials = [];
  if (!Array.isArray(candidate.lighting)) candidate.lighting = [];
  if (!Array.isArray(candidate.cameras)) candidate.cameras = [];
  if (!Array.isArray(candidate.constraints)) candidate.constraints = [];
  if (!Array.isArray(candidate.unresolvedDetections)) candidate.unresolvedDetections = [];

  const meta = (candidate.metadata && typeof candidate.metadata === 'object' ? { ...candidate.metadata } : {}) as Record<string, unknown>;
  if (!meta.schemaVersion) meta.schemaVersion = 'scene.v1';
  if (!meta.designVersion) meta.designVersion = '1.0.0';
  if (!meta.branch) meta.branch = 'main';
  if (!meta.status) meta.status = 'draft';
  if (!meta.changeReason) meta.changeReason = 'Migration';
  candidate.metadata = meta;
  return SceneV1Schema.parse(candidate);
}
