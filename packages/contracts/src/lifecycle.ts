import { z } from 'zod';

export const ProjectLifecycleStageV1Schema = z.enum([
  'brief',
  'floor_plan',
  'spaces',
  'design',
  'scene',
  'visualize',
  'production',
  'commercial',
  'delivery',
]);
export type ProjectLifecycleStageV1 = z.infer<typeof ProjectLifecycleStageV1Schema>;

export const VersionLineageV1Schema = z.object({
  projectId: z.string().min(1),
  briefId: z.string().nullable().optional(),
  floorPlanVersionId: z.string().nullable().optional(),
  spacesSnapshotId: z.string().nullable().optional(),
  designVersionId: z.string().nullable().optional(),
  sceneVersionId: z.string().nullable().optional(),
  materialVersionId: z.string().nullable().optional(),
  cameraId: z.string().nullable().optional(),
});
export type VersionLineageV1 = z.infer<typeof VersionLineageV1Schema>;

export const DesignVersionV1Schema = z.object({
  schemaVersion: z.literal('design.v1'),
  id: z.string().min(1),
  projectId: z.string().min(1),
  lineage: VersionLineageV1Schema,
  status: z.enum(['draft', 'approved', 'superseded', 'stale']),
  roomIds: z.array(z.string().min(1)).min(1),
  placements: z.array(z.record(z.unknown())),
  moduleSnapshots: z.array(z.record(z.unknown())),
  materialAssignments: z.array(z.record(z.unknown())),
  validation: z.object({ blockingCount: z.number().int().nonnegative(), warningCount: z.number().int().nonnegative(), issues: z.array(z.record(z.unknown())) }),
  createdAt: z.string(),
  approvedAt: z.string().nullable().optional(),
});
export type DesignVersionV1 = z.infer<typeof DesignVersionV1Schema>;

export const SceneV1Schema = z.object({
  schemaVersion: z.literal('scene.v1'),
  id: z.string().min(1),
  projectId: z.string().min(1),
  lineage: VersionLineageV1Schema,
  status: z.enum(['draft', 'compiled', 'approved', 'stale', 'failed']),
  units: z.literal('mm'),
  sceneGraph: z.record(z.unknown()),
  validation: z.object({ blockingCount: z.number().int().nonnegative(), warningCount: z.number().int().nonnegative(), issues: z.array(z.record(z.unknown())) }),
  compilerVersion: z.string().min(1),
  createdAt: z.string(),
  approvedAt: z.string().nullable().optional(),
});
export type SceneV1 = z.infer<typeof SceneV1Schema>;

export const RenderJobV1Schema = z.object({
  schemaVersion: z.literal('render-job.v1'),
  id: z.string().min(1),
  projectId: z.string().min(1),
  lineage: VersionLineageV1Schema,
  status: z.enum(['queued', 'running', 'succeeded', 'completed_with_warnings', 'failed', 'cancelled']),
  renderType: z.enum(['technical_preview', 'material_preview', 'concept_render', 'photoreal_render']),
  provider: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  baseHash: z.string().nullable(),
  outputHash: z.string().nullable(),
  artifactId: z.string().nullable(),
  qaStatus: z.enum(['pending', 'passed', 'warning', 'failed']),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type RenderJobV1 = z.infer<typeof RenderJobV1Schema>;
