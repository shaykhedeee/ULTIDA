import { PersistedRenderRecordSchema, RenderOptionsSchema, RenderQAResultSchema, RenderReadinessSchema } from './schema.js';
import type { PersistedRenderRecord, RenderOptions, RenderQAResult, RenderReadiness } from './schema.js';

export function validateRenderOptions(options: unknown): RenderOptions {
  return RenderOptionsSchema.parse(options);
}

export function assertRenderTypeNotPhotorealOnly(options: RenderOptions): void {
  if (!['photoreal_render', 'concept_render', 'material_preview'].includes(options.renderType)) {
    throw new Error(`${options.renderType} cannot be exposed as the completed production render.`);
  }
}

export function resolveRenderState({ scene, options, qa }: { scene: { status?: string; readiness?: RenderReadiness }; options: RenderOptions; qa?: RenderQAResult }): PersistedRenderRecord['state'] {
  if (options.renderType === 'technical_preview') return 'completed';
  if (!scene.readiness || !scene.readiness.ready) return 'compiling_scene';
  if (scene.status === 'draft') return 'queued';
  if (qa?.issues.some((issue) => issue.severity === 'blocking')) return 'failed';
  if (qa?.issues.length) return 'completed_with_warnings';
  return 'completed';
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
    updatedAt: now,
  });
}

export function applyProviderFailure(record: PersistedRenderRecord, failure: { code: string; message: string; retryable: boolean; providerReason?: string }): PersistedRenderRecord {
  return { ...record, state: 'failed', failure: { code: failure.code, message: failure.message, retryable: failure.retryable, providerReason: failure.providerReason }, updatedAt: new Date().toISOString() };
}

export function applyQA(record: PersistedRenderRecord, qa: RenderQAResult): PersistedRenderRecord {
  const normalized = RenderQAResultSchema.parse(qa);
  const readiness = RenderReadinessSchema.parse({
    ready: !normalized.issues.some((issue) => issue.severity === 'blocking'),
    blockingCount: normalized.issues.filter((issue) => issue.severity === 'blocking').length,
    warningCount: normalized.issues.filter((issue) => issue.severity === 'warning').length,
    issues: normalized.issues.map((issue) => ({ code: issue.kind, severity: issue.severity, message: issue.message, entityIds: [] })),
  });
  return { ...record, state: resolveRenderState({ scene: { readiness, status: 'validating' }, options: record.options, qa: normalized }), qaResult: normalized, updatedAt: new Date().toISOString() };
}
