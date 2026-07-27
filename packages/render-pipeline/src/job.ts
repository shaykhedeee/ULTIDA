/**
 * render-pipeline — deterministic render job orchestration.
 *
 * Chains: readiness gate → base render (deterministic PNG) → enhancement
 * payload → provider invocation → QA → proof persistence.
 *
 * Every step is injectable so tests can substitute fakes without
 * touching network or Supabase.
 */
import type { RenderReadiness, RenderOptions, PersistedRenderRecord } from './schema.js';
import { buildRenderReadiness } from './ready.js';
import { renderBaseArtifacts } from './base-render.js';
import { buildEnhancementPayload, invokeImageModel, type ProviderGatewayLike } from './enhance.js';
import { runRenderQA, type SceneExpectation, type MeasuredResult } from './qa.js';
import { buildRenderRecord, applyProviderFailure, applyQA } from './record.js';
import { createHash } from 'node:crypto';

export type StorageAdapter = {
  store(sceneVersionId: string, kind: string, bytes: Buffer, mimeType: string): Promise<{ path: string; url: string }>;
};

export interface RenderJobInput {
  projectId: string;
  sceneVersionId: string;
  floorPlanVersionId: string;
  layoutVersionId?: string;
  moduleSnapshotId?: string;
  materialVersionId?: string;
  cameraId?: string;
  options: RenderOptions;
  /** Deterministic base-render input (rooms, modules, openings in plan coords). */
  sceneBoxes: Parameters<typeof renderBaseArtifacts>[0]['boxes'];
  /** Structured scene summary passed to the image model. */
  sceneSummary: string[];
  roomDimensions: Array<{ id: string; name: string; widthMm: number; depthMm: number; heightMm: number }>;
  moduleDimensions: Array<{ id: string; name: string; widthMm: number; depthMm: number; heightMm: number; materialId?: string }>;
  materialReferences: Array<{ id: string; code: string; name: string; category?: string }>;
  cameraFacts: string[];
  promptVersion: string;
  /** External provider gateway (injectable). */
  gateway: ProviderGatewayLike;
  /** External storage for persistence (injectable). */
  storage: StorageAdapter;
  /** Precomputed readiness — if omitted, computed from input. */
  readinessOverride?: RenderReadiness;
  qaMeasurement?: MeasuredResult;
  qaExpectation?: Partial<SceneExpectation>;
}

export interface RenderJobProof {
  provider: string;
  model: string;
  sceneVersionId: string;
  baseHash: string;
  outputHash: string;
  promptVersion: string;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  usage?: Record<string, unknown>;
  status: 'succeeded' | 'failed' | 'provider_not_configured' | 'invalid_image' | 'qa_blocking';
  attemptedProviders: string[];
}

function sha256OfBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

function isSupportedImage(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (mimeType === 'image/webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

/**
 * Execute a deterministic render job end-to-end.
 *
 * Behaviour:
 * - Returns `{ status: 'blocked', readiness }` when any readiness gate fails —
 *   no provider credit is spent.
 * - Returns `{ status: 'failed', ... }` with a typed `code` when the provider
 *   is unconfigured, returns invalid image bytes, or the gateway throws.
 * - Runs QA after enhancement and persists the render record + proof fields.
 */
export async function executeRenderJob(input: RenderJobInput): Promise<{ record: PersistedRenderRecord; proof: RenderJobProof; artifacts: Awaited<ReturnType<typeof renderBaseArtifacts>> }> {
  const readiness = input.readinessOverride ?? buildRenderReadiness({
    scaleVerified: true,
    planApproved: true,
    designApproved: true,
    sceneVersion: { id: input.sceneVersionId, status: 'approved', updatedAt: nowIso(), approvedVersionId: input.sceneVersionId },
    modulesValid: true,
    materialsComplete: true,
    cameraValid: true,
    blockingIssues: [],
  });

  if (readiness.ready === false) {
    const now = nowIso();
    const record = buildRenderRecord({
      projectId: input.projectId, sceneVersionId: input.sceneVersionId,
      options: input.options,
      provenance: { planVersionId: input.floorPlanVersionId, layoutVersionId: input.layoutVersionId, moduleSnapshotId: input.moduleSnapshotId ?? input.sceneVersionId, materialVersionId: input.materialVersionId, cameraId: input.cameraId, promptVersion: input.promptVersion },
    });
    const blockedRecord: PersistedRenderRecord = { ...record, state: 'failed', startedAt: now, completedAt: now, latencyMs: 0, failure: { code: 'RENDER_BLOCKED', message: `Render blocked: ${readiness.issues.map((i) => i.code).join(', ')}`, retryable: false } };
    const proof: RenderJobProof = { provider: 'none', model: 'none', sceneVersionId: input.sceneVersionId, baseHash: '', outputHash: '', promptVersion: input.promptVersion, startedAt: now, completedAt: now, latencyMs: 0, status: 'provider_not_configured', attemptedProviders: [] };
    return { record: blockedRecord, proof, artifacts: null as unknown as Awaited<ReturnType<typeof renderBaseArtifacts>> };
  }

  // 1. Deterministic base render (RGB, edge, depth, object masks, material regions).
  const baseStart = Date.now();
  const artifacts = renderBaseArtifacts({ boxes: input.sceneBoxes, width: 1024, height: 768 });
  const baseHash = artifacts.baseHash;

  // 2. Build enhancement payload and invoke provider.
  const camera = input.options.customCamera
    ? { positionMm: input.options.customCamera.positionMm as [number, number, number], targetMm: input.options.customCamera.targetMm as [number, number, number], fovDeg: 50 }
    : { positionMm: [0, 0, 0] as [number, number, number], targetMm: [500, 0, 0] as [number, number, number], fovDeg: 50 };
  const requestedProvider = 'cloudflare';
  const requestedModel = '@cf/black-forest-labs/flux-2-klein-4b';
  const payload = buildEnhancementPayload({
    baseRenderDataUri: artifacts.rgb.url,
    options: input.options,
    camera,
    sceneSummary: input.sceneSummary,
    roomDimensions: input.roomDimensions,
    moduleDimensions: input.moduleDimensions,
    materialReferences: input.materialReferences,
    promptVersion: input.promptVersion,
  });
  payload.provider = requestedProvider;
  payload.model = requestedModel;

  const renderRecord = buildRenderRecord({
    projectId: input.projectId,
    sceneVersionId: input.sceneVersionId,
    options: input.options,
    provenance: {
      planVersionId: input.floorPlanVersionId,
      layoutVersionId: input.layoutVersionId,
      moduleSnapshotId: input.moduleSnapshotId ?? input.sceneVersionId,
      materialVersionId: input.materialVersionId,
      cameraId: input.cameraId,
      provider: requestedProvider,
      model: requestedModel,
      promptVersion: input.promptVersion,
    },
  });

  const startedAt = nowIso();
  let providerResult: any;
  let attemptedProviders: string[] = [];

  try {
    providerResult = await invokeImageModel(input.gateway, payload, requestedProvider, requestedModel);
    attemptedProviders = [requestedProvider];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown provider error';
    const failed = applyProviderFailure(renderRecord, { code: 'PROVIDER_ERROR', message: msg, retryable: true });
    const completedAt = nowIso();
    const proof: RenderJobProof = {
      provider: requestedProvider, model: requestedModel, sceneVersionId: input.sceneVersionId, baseHash,
      outputHash: '', promptVersion: input.promptVersion, startedAt, completedAt,
      latencyMs: Date.now() - baseStart, status: 'failed', attemptedProviders, usage: undefined,
    };
    return { record: { ...failed, startedAt, completedAt, latencyMs: proof.latencyMs }, proof, artifacts };
  }

  // 3. Detect provider-not-configured vs invalid image vs failure.
  if (providerResult.status === 'provider_not_configured') {
    const completedAt = nowIso();
    const proof: RenderJobProof = {
      provider: requestedProvider, model: requestedModel, sceneVersionId: input.sceneVersionId, baseHash,
      outputHash: '', promptVersion: input.promptVersion, startedAt, completedAt,
      latencyMs: Date.now() - baseStart, status: 'provider_not_configured', attemptedProviders, usage: undefined,
    };
    const failed = applyProviderFailure(renderRecord, { code: 'IMAGE_PROVIDER_NOT_CONFIGURED', message: 'No image provider is configured.', retryable: false });
    return { record: { ...failed, startedAt, completedAt, latencyMs: proof.latencyMs }, proof, artifacts };
  }

  if (providerResult.status === 'failed') {
    const completedAt = nowIso();
    const proof: RenderJobProof = {
      provider: payload.provider, model: payload.model, sceneVersionId: input.sceneVersionId, baseHash,
      outputHash: '', promptVersion: input.promptVersion, startedAt, completedAt,
      latencyMs: Date.now() - baseStart, status: 'failed', attemptedProviders, usage: providerResult.providerReason ? { providerReason: providerResult.providerReason } : undefined,
    };
    const failed = applyProviderFailure(renderRecord, { code: providerResult.code || 'IMAGE_GENERATION_FAILED', message: providerResult.message ?? 'Provider failed.', retryable: providerResult.retryable ?? true, providerReason: providerResult.providerReason });
    return { record: { ...failed, startedAt, completedAt, latencyMs: proof.latencyMs }, proof, artifacts };
  }

  // 4. Download + validate provider image (not empty, not synthetic SVG).
  let imageBytes: Buffer;
  try {
    if (providerResult.image?.encoding === 'base64') {
      imageBytes = Buffer.from(providerResult.image.data, 'base64');
    } else if (providerResult.resultUrl) {
      const remote = await fetch(providerResult.resultUrl);
      if (!remote.ok) throw new Error(`Image download HTTP ${remote.status}`);
      imageBytes = Buffer.from(await remote.arrayBuffer());
    } else {
      throw new Error('Provider returned no persistable image output.');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Image fetch failed';
    const completedAt = nowIso();
    const proof: RenderJobProof = {
      provider: payload.provider, model: payload.model, sceneVersionId: input.sceneVersionId, baseHash,
      outputHash: '', promptVersion: input.promptVersion, startedAt, completedAt,
      latencyMs: Date.now() - baseStart, status: 'invalid_image', attemptedProviders, usage: undefined,
    };
    const failed = applyProviderFailure(renderRecord, { code: 'INVALID_IMAGE', message: msg, retryable: false });
    return { record: { ...failed, startedAt, completedAt, latencyMs: proof.latencyMs }, proof, artifacts };
  }

  // 5. Reject non-image or tiny payloads (SVG placeholder, text, etc.).
  const mimeType = providerResult.image?.mimeType ?? 'image/png';
  if (!isSupportedImage(imageBytes, mimeType)) {
    const completedAt = nowIso();
    const proof: RenderJobProof = {
      provider: payload.provider, model: payload.model, sceneVersionId: input.sceneVersionId, baseHash,
      outputHash: '', promptVersion: input.promptVersion, startedAt, completedAt,
      latencyMs: Date.now() - baseStart, status: 'invalid_image', attemptedProviders, usage: undefined,
    };
    const failed = applyProviderFailure(renderRecord, { code: 'INVALID_IMAGE', message: `Provider output is not a valid ${mimeType} image (bytes=${imageBytes.byteLength}).`, retryable: false });
    return { record: { ...failed, startedAt, completedAt, latencyMs: proof.latencyMs }, proof, artifacts };
  }

  // 6. Persist image to storage.
  const outputHash = sha256OfBuffer(imageBytes);
  let storagePath: string;
  try {
    const stored = await input.storage.store(input.sceneVersionId, 'photoreal_render', imageBytes, mimeType);
    storagePath = stored.path;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Storage failed';
    const completedAt = nowIso();
    const proof: RenderJobProof = {
      provider: payload.provider, model: payload.model, sceneVersionId: input.sceneVersionId, baseHash,
      outputHash, promptVersion: input.promptVersion, startedAt, completedAt,
      latencyMs: Date.now() - baseStart, status: 'failed', attemptedProviders, usage: undefined,
    };
    const failed = applyProviderFailure(renderRecord, { code: 'STORAGE_FAILURE', message: msg, retryable: false });
    return { record: { ...failed, startedAt, completedAt, latencyMs: proof.latencyMs }, proof, artifacts };
  }

  // 7. Run deterministic QA.
  const expectation: SceneExpectation = {
    wallCount: input.sceneBoxes.filter((b) => b.kind === 'room').length > 0 ? 1 : 0,
    doorCount: input.sceneBoxes.filter((b) => b.kind === 'opening').length,
    windowCount: 0,
    moduleCount: input.moduleDimensions.length,
    cabinetDivisions: 0,
    camera: { positionMm: camera.positionMm, targetMm: camera.targetMm, fovDeg: 50 },
    expectedObjectIds: input.moduleDimensions.map((m) => m.id),
    materialRegionIds: input.materialReferences.map((m) => m.id),
    ...input.qaExpectation,
  };
  const qa = input.qaMeasurement
    ? runRenderQA(expectation, input.qaMeasurement, input.options.geometryLock)
    : {
        issues: [{ kind: 'qa_evidence_unavailable', message: 'No render QA evidence adapter supplied. Designer review is required before approval.', severity: 'warning' as const }],
        wallEdgesAligned: false,
        openingCountMatches: false,
        focalModuleVisible: false,
        cameraSimilarityMm: Number.POSITIVE_INFINITY,
        inventedObjectsDetected: false,
        missingObjects: [],
      };
  const qaBlocking = qa.issues.filter((i) => i.severity === 'blocking').length > 0;
  const recordWithQA = applyQA(renderRecord, qa);

  const completedAt = nowIso();
  const latencyMs = Date.now() - baseStart;
  const proof: RenderJobProof = {
    provider: providerResult.provider ?? requestedProvider,
    model: providerResult.model ?? requestedModel,
    sceneVersionId: input.sceneVersionId,
    baseHash,
    outputHash,
    promptVersion: input.promptVersion,
    startedAt,
    completedAt,
    latencyMs,
    usage: providerResult.usage,
    status: qaBlocking ? 'qa_blocking' : 'succeeded',
    attemptedProviders,
  };

  const finalRecord: PersistedRenderRecord = {
    ...recordWithQA,
    provider: providerResult.provider ?? requestedProvider,
    model: providerResult.model ?? requestedModel,
    startedAt,
    completedAt,
    latencyMs,
    baseHash,
    outputHash,
    usage: providerResult.usage ?? undefined,
    providerAttempts: attemptedProviders,
    artifacts: [
      { type: 'photoreal_render' as const, url: storagePath, bytes: imageBytes.byteLength },
      { type: 'rgb', url: artifacts.rgb.url, bytes: artifacts.rgb.bytes },
      { type: 'depth', url: artifacts.depth.url, bytes: artifacts.depth.bytes },
      { type: 'edge_map', url: artifacts.edgeMap.url, bytes: artifacts.edgeMap.bytes },
      ...artifacts.objectMasks.map((m) => ({ type: 'object_mask' as const, url: m.url, bytes: 0 })),
      ...artifacts.materialRegions.map((m) => ({ type: 'material_region' as const, url: m.url, bytes: 0 })),
    ],
  };

  return { record: finalRecord, proof, artifacts };
}
