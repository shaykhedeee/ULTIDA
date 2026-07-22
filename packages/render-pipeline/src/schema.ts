import { z } from 'zod';

export const RenderTypeSchema = z.enum(['technical_preview', 'material_preview', 'concept_render', 'photoreal_render']);
export const RenderStateSchema = z.enum([
  'waiting_for_geometry',
  'waiting_for_layout',
  'waiting_for_materials',
  'queued',
  'compiling_scene',
  'rendering_base',
  'enhancing',
  'validating',
  'completed',
  'completed_with_warnings',
  'failed'
]);
export const ArtifactTypeSchema = z.enum(['rgb', 'depth', 'edge_map', 'object_mask', 'material_region', 'artifacts_archive']);

export const RoomSchema = z.object({ id: z.string().min(1), name: z.string().min(1), category: z.string().min(1) });
export type Room = z.infer<typeof RoomSchema>;

export const RenderOptionsSchema = z.object({
  room: z.string().min(1),
  focalModuleId: z.string().optional(),
  cameraPreset: z.enum(['perspective', 'top', 'front', 'side', 'custom']).default('perspective'),
  customCamera: z.object({ positionMm: z.tuple([z.number(), z.number(), z.number()]), targetMm: z.tuple([z.number(), z.number(), z.number()]) }).optional(),
  lighting: z.enum(['day', 'evening']).default('day'),
  renderType: RenderTypeSchema.default('photoreal_render'),
  quality: z.enum(['draft', 'review', 'final']).default('review'),
  aspectRatio: z.string().default('16:9'),
  geometryLock: z.enum(['strict', 'moderate', 'creative']).default('strict'),
  styleIntensity: z.number().min(0).max(1).default(0.4),
  sourceSceneId: z.string().min(1),
  sourceSceneGraph: z.unknown().optional(),
  materialVersion: z.string().min(1).optional(),
  selectedMaterials: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })).default([])
});
export type RenderOptions = z.infer<typeof RenderOptionsSchema>;

export const RenderArtifactSchema = z.object({ type: ArtifactTypeSchema, url: z.string().min(1), bytes: z.number().nonnegative().optional() });
export type RenderArtifact = z.infer<typeof RenderArtifactSchema>;

export const RenderQAResultSchema = z.object({
  issues: z.array(z.object({ kind: z.string(), message: z.string(), severity: z.enum(['blocking', 'warning']) })),
  wallEdgesAligned: z.boolean(),
  openingCountMatches: z.boolean(),
  focalModuleVisible: z.boolean(),
  cameraSimilarityMm: z.number(),
  inventedObjectsDetected: z.boolean(),
  missingObjects: z.array(z.string())
});
export type RenderQAResult = z.infer<typeof RenderQAResultSchema>;

export const PersistedRenderRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  planVersionId: z.string().min(1),
  layoutVersionId: z.string().optional(),
  moduleSnapshotId: z.string().min(1),
  materialVersionId: z.string().optional(),
  sceneVersionId: z.string().min(1),
  cameraId: z.string().optional(),
  provider: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  sourceSceneGraph: z.unknown().optional(),
  selectedMaterials: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })).default([]),
  options: RenderOptionsSchema,
  artifacts: z.array(RenderArtifactSchema).default([]),
  state: RenderStateSchema.default('waiting_for_geometry'),
  qaResult: RenderQAResultSchema.optional(),
  failure: z.object({ code: z.string(), message: z.string(), retryable: z.boolean(), providerReason: z.string().optional() }).optional(),
  approved: z.boolean().default(false),
  createdBy: z.string().optional(),
  createdAt: z.string().default(new Date().toISOString()),
  updatedAt: z.string().default(new Date().toISOString())
});
export type PersistedRenderRecord = z.infer<typeof PersistedRenderRecordSchema>;
