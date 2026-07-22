import { z } from 'zod';
import { RenderOptionsSchema, RenderQAResultSchema, RenderStateSchema, PersistedRenderRecordSchema } from './schema.js';
import type { RenderOptions, RenderQAResult, PersistedRenderRecord } from './schema.js';

export const RenderReadinessSchema = z.object({
  ready: z.boolean(),
  blockingCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  issues: z.array(z.object({ code: z.string(), severity: z.enum(['blocking', 'warning']), message: z.string(), entityIds: z.array(z.string()) }))
});
export type RenderReadiness = z.infer<typeof RenderReadinessSchema>;

export interface RenderBaseArtifacts {
  rgb: { url: string; bytes?: number };
  depth?: { url: string; bytes?: number };
  edgeMap?: { url: string; bytes?: number };
  objectMasks?: Array<{ id: string; url: string }>;
  materialRegions?: Array<{ materialId: string; url: string }>;
}

export interface EnhancementInput {
  baseImage: { url: string };
  materialReferences: Array<{ id: string; code: string; name: string; category?: string }>;
  sceneFacts: string[];
  cameraFacts: string[];
  forbiddenChanges: string[];
  options: RenderOptions;
}

export const DEFAULT_FORBIDDEN = [
  'Do not move walls',
  'Do not move openings',
  'Do not change shutter count',
  'Do not resize modules',
  'Do not add new furniture',
  'Do not remove existing furniture',
  'Do not change ceiling geometry',
  'Do not move lights',
  'Do not change camera'
] as const;

export function validateRenderOptions(options: unknown): RenderOptions {
  return RenderOptionsSchema.parse(options);
}

export function assertRenderTypeNotPhotorealOnly(options: RenderOptions): void {
  if (!['photoreal_render', 'concept_render', 'material_preview'].includes(options.renderType)) {
    throw new Error(`${options.renderType} cannot be exposed as the completed production render.`);
  }
}

export function resolveRenderState({ scene, options, qa }: { scene: { status?: string; readiness?: RenderReadiness }; options: RenderOptions; qa?: RenderQAResult }): 'waiting_for_geometry' | 'waiting_for_layout' | 'waiting_for_materials' | 'queued' | 'compiling_scene' | 'rendering_base' | 'enhancing' | 'validating' | 'completed' | 'completed_with_warnings' | 'failed' {
  if (options.renderType === 'technical_preview') return 'completed';
  const readiness = scene.readiness;
  if (!readiness || readiness.ready === false) return 'compiling_scene';
  if (scene.status === 'draft') return 'queued';
  if (qa && qa.issues.some((issue) => issue.severity === 'blocking')) return 'failed';
  if (qa && qa.issues.length > 0) return 'completed_with_warnings';
  return 'completed';
}

export function buildEnhancementPrompt(options: RenderOptions, sceneFacts: string[], cameraFacts: string[]): EnhancementInput {
  const parsed = validateRenderOptions(options);
  return {
    baseImage: { url: `base-render://${parsed.sourceSceneId}` },
    materialReferences: parsed.selectedMaterials.map((m) => ({ id: m.id, code: m.code, name: m.name })),
    sceneFacts: Array.from(new Set<string>([...sceneFacts, 'Geometry is fixed', `Aspect ratio: ${parsed.aspectRatio}`])),
    cameraFacts,
    forbiddenChanges: [...DEFAULT_FORBIDDEN],
    options: parsed
  };
}

export function validateRenderQA(qa: unknown): RenderQAResult {
  return RenderQAResultSchema.parse(qa);
}

export function buildRenderRecord(input: { id?: string; projectId: string; sceneVersionId: string; options: RenderOptions; provenance: { planVersionId?: string; layoutVersionId?: string; moduleSnapshotId?: string; materialVersionId?: string; cameraId?: string; provider?: string; model?: string; promptVersion: string } }): PersistedRenderRecord {
  const options = validateRenderOptions(input.options);
  assertRenderTypeNotPhotorealOnly(options);
  const now = new Date().toISOString();
  return PersistedRenderRecordSchema.parse({
    id: input.id ?? `render-${Date.now().toString(36)}`,
    projectId: input.projectId,
    planVersionId: input.provenance.planVersionId ?? 'plan-1',
    moduleSnapshotId: input.provenance.moduleSnapshotId ?? input.sceneVersionId,
    sceneVersionId: input.sceneVersionId,
    options,
    state: 'queued',
    provider: input.provenance.provider ?? 'unknown',
    model: input.provenance.model ?? 'unknown',
    promptVersion: input.provenance.promptVersion,
    sourceSceneGraph: options.sourceSceneGraph,
    layoutVersionId: input.provenance.layoutVersionId,
    materialVersionId: input.provenance.materialVersionId,
    cameraId: input.provenance.cameraId,
    createdAt: now,
    updatedAt: now
  });
}

export function applyProviderFailure(record: PersistedRenderRecord, failure: { code: string; message: string; retryable: boolean; providerReason?: string }): PersistedRenderRecord {
  return { ...record, state: 'failed', failure: { code: failure.code, message: failure.message, retryable: failure.retryable, providerReason: failure.providerReason }, updatedAt: new Date().toISOString() };
}

export function applyQA(record: PersistedRenderRecord, qa: RenderQAResult): PersistedRenderRecord {
  const blocking = qa.issues.some((issue) => issue.severity === 'blocking');
  const hasWarnings = !blocking && qa.issues.length > 0;
  return resolveRenderState({ scene: { readiness: blockUntilReady(qa), status: record.state }, options: record.options, qa }) === 'completed' ? record : { ...record, state: blocking ? 'failed' : hasWarnings ? 'completed_with_warnings' : 'completed', qaResult: qa, updatedAt: new Date().toISOString() };
}

function blockUntilReady(qa: RenderQAResult) {
  if (qa.issues.some((i) => i.severity === 'blocking')) return { ready: false, blockingCount: qa.issues.filter((i) => i.severity === 'blocking').length, warningCount: qa.issues.filter((i) => i.severity === 'warning').length, issues: qa.issues } as any;
  return { ready: true, blockingCount: 0, warningCount: qa.issues.length, issues: qa.issues } as any;
}
