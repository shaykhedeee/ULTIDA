import { z } from 'zod';

const PointSchema = z.object({ xMm: z.number(), yMm: z.number() });
const WallSchema = z.object({ id: z.string(), start: PointSchema, end: PointSchema, thicknessMm: z.number().positive(), heightMm: z.number().positive() });
const RoomSchema = z.object({ id: z.string(), name: z.string(), type: z.enum(['kitchen', 'living', 'bedroom', 'bathroom', 'dining', 'utility', 'other']), boundary: z.array(PointSchema).min(3) });
const ModuleSchema = z.object({ id: z.string(), roomId: z.string(), family: z.string(), widthMm: z.number().positive(), depthMm: z.number().positive(), heightMm: z.number().positive(), position: PointSchema, rotationDeg: z.number() });

export const SceneV1Schema = z.object({
  schema: z.literal('scene.v1'),
  units: z.literal('mm'),
  projectId: z.string(),
  floorPlanVersionId: z.string(),
  rooms: z.array(RoomSchema),
  walls: z.array(WallSchema),
  openings: z.array(z.object({ id: z.string(), wallId: z.string(), kind: z.enum(['door', 'window', 'passage']), offsetMm: z.number().nonnegative(), widthMm: z.number().positive(), heightMm: z.number().positive() })),
  modules: z.array(ModuleSchema),
  materials: z.array(z.object({ id: z.string(), name: z.string(), code: z.string(), unitCost: z.number().nonnegative().optional() })),
  metadata: z.object({ branch: z.string(), status: z.enum(['draft', 'review', 'approved', 'locked', 'superseded']), changeReason: z.string() })
});

export type SceneV1 = z.infer<typeof SceneV1Schema>;
