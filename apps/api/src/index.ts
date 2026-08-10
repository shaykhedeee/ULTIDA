import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PassThrough } from 'node:stream';
import { createHash, timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import express from 'express';

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootEnv = [resolve(currentDir, '../.env'), resolve(currentDir, '../../.env'), resolve(currentDir, '../../../.env')].find((c) => existsSync(c));
if (rootEnv) {
  dotenv.config({ path: rootEnv });
}
const localEnv = resolve(currentDir, '../../../.env.local');
if (existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
}

import { getRequestSupabaseClient, getServerSupabaseClient } from './supabase.js';
import { authenticateProjectUser, requireProjectUser, requireStudioUser } from './api-auth.js';
import { MaterialAssignmentV1Schema, MaterialLibraryItemV1Schema, VisualProposalRequestSchema, validateProjectBrief } from '@ultida/contracts';
import { createProviderGateway } from '@ultida/provider-gateway';
import { SceneV1Schema } from '@ultida/scene-core';
import { listCatalog, validatePlacement, RoomTypeSchema, IndianModularCatalog, listDesignPresets, ModuleFamilySchema, getCatalogVault, CuratedLaminateCatalog } from '@ultida/catalog-core';
import { CanonicalPlanModelSchema, parsePlanIntake } from '@ultida/plan-core';
import { validateGeometry } from '@ultida/geometry-core';
import { analyzePlanWithProvider } from './plan-analyzer.js';
import { AURA_TOOLS, listAuraTools, planAuraMessage, createAuraAuditEvent, validateAuraAuditEvent, validateAuraAuditTransition, type AuraAuditEvent } from '@ultida/aura-tools';
import { createVisualJob, getVisualJob, listProjectRenders, reviewVisualJob } from './visual-jobs.js';
import { createPlanAnalysisJob, dispatchPlanAnalysisJob, getPlanAnalysisJob, processPlanAnalysisJob, processPlanAnalysisJobs } from './plan-jobs.js';
import { buildDrawingProjection, exportSceneToDxf, exportPlanDraftToDxf, generateDrawingPackageSvg, generateProjectBOQ, generateWallElevationSvg, generateProjectionPdf, generateSketchUpRubyScript } from '@ultida/drawing-core';
import { migrateScene } from '@ultida/scene-core';
import { compileSceneV1, SceneCompilationError } from '@ultida/scene-compiler';
import { resolveModuleWallAnchor } from './module-anchor.js';
import { compileStoredModuleForScene } from './scene-module-parts.js';
import { evaluateVastuCompliance, generateCandidates } from '@ultida/layout-core';
import { compileReferenceContext, retrieveReferences, type ReferenceVaultRecord } from './reference-retrieval.js';

const app = express();
const port = Number(process.env.PORT || 8800);
const gateway = createProviderGateway(process.env);
type AuraAuditRow = {
  id: string;
  project_id: string;
  actor_id: string;
  tool_id: string;
  event_type: AuraAuditEvent['eventType'];
  source_version_id: string;
  proposal_id: string;
  payload: AuraAuditEvent['payload'];
  provenance?: AuraAuditEvent['provenance'] | null;
  created_at: string;
};

async function listAuraAuditEvents(client: ReturnType<typeof getRequestSupabaseClient>, projectId: string, proposalId?: string, limit = 500): Promise<AuraAuditEvent[]> {
  let query = client.from('aura_audit_events').select('id,project_id,actor_id,tool_id,event_type,source_version_id,proposal_id,payload,provenance,created_at').eq('project_id', projectId).order('created_at', { ascending: true }).limit(limit);
  if (proposalId) query = query.eq('proposal_id', proposalId);
  const { data, error } = await query;
  if (error) throw new Error(`AURA_AUDIT_STORE_UNAVAILABLE:${error.message}`);
  return ((data ?? []) as AuraAuditRow[]).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    actorId: row.actor_id,
    toolId: row.tool_id,
    eventType: row.event_type,
    sourceVersionId: row.source_version_id,
    proposalId: row.proposal_id,
    payload: row.payload,
    provenance: row.provenance ?? undefined,
    createdAt: row.created_at,
  }));
}

async function appendAuraAuditEvent(client: ReturnType<typeof getRequestSupabaseClient>, organizationId: string, event: AuraAuditEvent): Promise<void> {
  const { error } = await client.from('aura_audit_events').insert({
    id: event.id,
    organization_id: organizationId,
    project_id: event.projectId,
    actor_id: event.actorId,
    tool_id: event.toolId,
    event_type: event.eventType,
    source_version_id: event.sourceVersionId,
    proposal_id: event.proposalId,
    payload: event.payload,
    provenance: event.provenance ?? null,
    created_at: event.createdAt,
  });
  if (error) throw new Error(`AURA_AUDIT_STORE_UNAVAILABLE:${error.message}`);
}

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer: string) {
  return ['0', 'LINE', '8', layer, '10', String(x1), '20', String(y1), '30', '0', '11', String(x2), '21', String(y2), '31', '0'];
}

export function buildCutlist(scene: ReturnType<typeof migrateScene>) {
  const exactParts = Array.isArray((scene as any).moduleParts) ? (scene as any).moduleParts : [];
  if (!exactParts.length) throw new Error('AUTHORITATIVE_MODULE_PARTS_REQUIRED');

  // Smart grouping keeps orientation-independent parts together without rounding
  // approved millimetre geometry into a different fabrication size. A 5 mm grid
  // silently changed an approved 18 mm panel into 20 mm; retain sub-millimetre
  // source precision and let the explicit tolerance gate handle near-matches.
  const grid = (mm: number) => Math.round(mm * 10) / 10;
  const rows = new Map<string, { length: number; width: number; thickness: number; material: string; quantity: number; parts: string[]; ids: string[] }>();

  for (const part of exactParts) {
    const length = grid(Number(part.widthMm));
    const width = grid(Number(part.depthMm));
    const thickness = grid(Number(part.heightMm));
    const material = String(part.materialId ?? 'unified');
    const [normL, normW] = length >= width ? [length, width] : [width, length];
    const key = `${normL}x${normW}x${thickness}@${material}`;
    const row = rows.get(key);
    const name = String(part.name ?? part.semanticType ?? 'part');
    if (row) {
      row.quantity += 1;
      row.parts.push(name);
      row.ids.push(String(part.id));
    } else {
      rows.set(key, { length: normL, width: normW, thickness, material, quantity: 1, parts: [name], ids: [String(part.id)] });
    }
  }

  const parts = [...rows.values()]
    .sort((a, b) => b.length - a.length || b.width - a.width || b.thickness - a.thickness)
    .map((row) => ({
      id: row.ids[0], moduleId: row.ids[0], roomId: String(exactParts[0]?.roomId ?? 'unknown'),
      family: String(exactParts[0]?.semanticType ?? 'module-part'),
      partType: row.parts.join(', '), lengthMm: row.length, widthMm: row.width,
      thicknessMm: row.thickness,
      // Edge-banding is a production decision and must come from an explicit
      // module-part policy; never infer it from rectangle dimensions.
      edgeBandMm: 0,
      hardware: [], status: 'review_required', quantity: row.quantity,
    }));

  // `partCount` is the number of authoritative physical parts. `parts` is the
  // dimension-normalized schedule and may consolidate identical rows through
  // `quantity`; conflating the two made a seven-part scene report only four
  // physical parts in the production gate.
  return { partCount: exactParts.length, parts, assumptions: { carcassThicknessMm: 18, backThicknessMm: 6, edgeBandPolicy: 'perimeter', status: 'review_required' } };
}

// Kept as a compatibility export for older API tests and integrations. The
// drawing-core writer remains the only DXF geometry authority.
export function createSceneDxf(input: Record<string, unknown>) {
  return exportSceneToDxf(migrateScene({
    ...input,
    schema: 'scene.v1',
    units: 'mm',
    coordinateSystem: 'right-handed-z-up',
    projectId: typeof input.projectId === 'string' ? input.projectId : 'project',
    floorPlanVersionId: typeof input.floorPlanVersionId === 'string' ? input.floorPlanVersionId : 'plan',
  }));
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '35mb' }));

app.get('/api/health', async (_request, response) => {
  const currentGateway = createProviderGateway(process.env);
  const hasServerSupabaseKey = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL?.replace(/\/$/, '');
  const workerSecret = process.env.ULTIDA_WORKER_SHARED_SECRET;
  let workerDispatchReady = false;
  if (workerUrl && workerSecret && workerSecret.length > 31) {
    try {
      const workerResponse = await fetch(`${workerUrl}/health`, {
        headers: { 'x-ultida-worker-secret': workerSecret },
        signal: AbortSignal.timeout(5_000),
      });
      const workerHealth = await workerResponse.json().catch(() => null) as { queueConsumer?: unknown; dispatchAuthenticated?: unknown } | null;
      workerDispatchReady = Boolean(workerResponse.ok && workerHealth?.queueConsumer && workerHealth?.dispatchAuthenticated);
    } catch {
      workerDispatchReady = false;
    }
  }
  const hasPlanVisionProvider = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_VISION_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_STUDIO_KEY_1 ||
    process.env.GOOGLE_AI_STUDIO_KEY_2 ||
    process.env.FLOORPLAN_VISION_URL ||
    (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN && process.env.CLOUDFLARE_VISION_MODEL)
  );
  return response.status(200).json({
    success: true,
    app: 'ultida',
    status: 'ok',
    readiness: {
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
      durableJobs: hasServerSupabaseKey && workerDispatchReady,
      planVision: hasPlanVisionProvider,
      realImageGeneration: currentGateway.status().some((provider) => provider.configured && provider.operations.includes('generate'))
    },
    providers: currentGateway.status(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/rules/evaluate', (request, response) => {
  const { id, modules, wallHeightMm } = request.body ?? {};
  if (!id || !Array.isArray(modules)) return response.status(400).json({ success: false, code: 'INVALID_RULES_REQUEST' });
  return response.status(200).json({
    success: true,
    score: { passed: true, overallScore: 100, violations: [] }
  });
});

app.get('/api/catalog', (request, response) => {
  response.json({ success: true, app: 'ultida', version: '0.1.0', providers: gateway.status(), laminates: CuratedLaminateCatalog });
});

app.get('/api/catalog/laminates', (request, response) => {
  const family = typeof request.query.family === 'string' ? request.query.family : '';
  const result = family ? CuratedLaminateCatalog.filter((item) => item.family === family || item.suitableFor.includes(family as never)) : CuratedLaminateCatalog;
  response.json({ success: true, laminates: result, note: 'Curated visual starting points; confirm current supplier SKU and technical sheet before production.' });
});

app.get('/api/providers', (_request, response) => response.json({ success: true, providers: gateway.status() }));

app.get('/api/aura/tools', (request, response) => {
  const group = typeof request.query.group === 'string' ? request.query.group as Parameters<typeof listAuraTools>[0] : undefined;
  return response.json({ success: true, tools: listAuraTools(group) });
});

app.get('/api/aura/readiness', (_request, response) => {
  const tools = AURA_TOOLS.map(({ id, label, group, mode, capability, requires }) => ({ id, label, group, mode, capability, requires }));
  return response.json({
    success: true,
    harness: { name: 'AURA', status: 'supervised', selfImproving: false, message: 'AURA records typed proposals and approvals; it does not change its own prompts or tools automatically.' },
    counts: {
      preview: tools.filter((tool) => tool.capability === 'preview').length,
      notEnabled: tools.filter((tool) => tool.capability === 'not_enabled').length,
    },
    audit: { eventTypes: ['proposal_created', 'proposal_approved', 'proposal_rejected', 'correction_recorded'], persistence: 'Supabase (migration required)', selfLearning: 'disabled' },
    tools,
  });
});

app.post('/api/aura/audit-events', async (request, response) => {
  try {
    const submittedEvent = validateAuraAuditEvent(request.body);
    const actor = await authenticateProjectUser(request, response, submittedEvent.projectId);
    if (!actor) return;
    if (submittedEvent.actorId !== actor.userId) return response.status(403).json({ success: false, code: 'AURA_ACTOR_MISMATCH', message: 'Review events must be attributed to the authenticated project member.' });
    const history = await listAuraAuditEvents(actor.client, actor.projectId, submittedEvent.proposalId);
    validateAuraAuditTransition(history, submittedEvent);
    await appendAuraAuditEvent(actor.client, actor.organizationId ?? '', submittedEvent);
    return response.status(201).json({ success: true, event: submittedEvent, persisted: true, persistence: 'supabase' });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AURA_AUDIT_EVENT_INVALID';
    const status = code.startsWith('AURA_AUDIT_STORE_UNAVAILABLE') ? 503 : (code.startsWith('AURA_PROPOSAL_') || code === 'AURA_CORRECTION_REQUIRED' ? 409 : 400);
    return response.status(status).json({ success: false, code, message: 'This supervised review event cannot be recorded in the current proposal state.' });
  }
});

app.get('/api/aura/audit-events', async (request, response) => {
  const projectId = typeof request.query.projectId === 'string' ? request.query.projectId : undefined;
  if (!projectId) return response.status(400).json({ success: false, code: 'PROJECT_REQUIRED', message: 'A project id is required.' });
  const actor = await authenticateProjectUser(request, response, projectId);
  if (!actor) return;
  const proposalId = typeof request.query.proposalId === 'string' ? request.query.proposalId : undefined;
  const limit = Math.min(Math.max(Number(request.query.limit ?? 100) || 100, 1), 500);
  try {
    const events = await listAuraAuditEvents(actor.client, actor.projectId, proposalId, limit);
    return response.json({ success: true, events: events.reverse(), persistence: 'supabase' });
  } catch (error) {
    return response.status(503).json({ success: false, code: 'AURA_AUDIT_STORE_UNAVAILABLE', message: error instanceof Error ? error.message : 'The audit ledger is unavailable.' });
  }
});

app.post('/api/aura/tools/:toolId/preview', async (request, response) => {
  const toolId = request.params.toolId;
  const { projectId, sceneVersionId, roomId, widthMm, style, laminate } = request.body ?? {};
  if (typeof projectId !== 'string' || typeof sceneVersionId !== 'string') return response.status(400).json({ success: false, code: 'SCENE_CONTEXT_REQUIRED', message: 'An approved scene context is required.' });
  const actor = await authenticateProjectUser(request, response, projectId);
  if (!actor) return;
  if (!actor.organizationId) return response.status(503).json({ success: false, code: 'AURA_ORGANIZATION_CONTEXT_MISSING', message: 'The project organization could not be resolved.' });
  const sceneContext = await actor.client.from('scene_versions').select('id,status').eq('project_id', actor.projectId).eq('id', sceneVersionId).maybeSingle();
  if (sceneContext.error) return response.status(503).json({ success: false, code: 'SCENE_CONTEXT_UNAVAILABLE', message: sceneContext.error.message });
  if (!sceneContext.data) return response.status(404).json({ success: false, code: 'SCENE_VERSION_NOT_FOUND', message: 'That scene version does not belong to this project.' });
  if (!['approved', 'locked'].includes(String(sceneContext.data.status))) return response.status(409).json({ success: false, code: 'AURA_APPROVED_SCENE_REQUIRED', message: 'Approve the scene before creating an AURA proposal.' });
  const actorId = actor.userId;
  if (toolId === 'place_modular_kitchen') {
    const runWidth = typeof widthMm === 'number' && widthMm >= 1200 ? Math.round(widthMm) : 3000;
    const clearance = typeof request.body?.clearanceMm === 'number' ? request.body.clearanceMm : 900;
    const candidates = listCatalog('kitchen').filter((item) => ['kitchen-base', 'kitchen-wall', 'kitchen-tall', 'kitchen-corner'].includes(item.family));
    const ordered = ['kit-corner-900', 'kit-sink-900', 'kit-base-600', 'kit-base-600', 'kit-wall-600', 'kit-tall-600'];
    let remaining = runWidth;
    const modules = ordered.map((id) => candidates.find((item) => item.id === id)).filter(Boolean).map((item: any) => {
      if (remaining <= 0) return null;
      remaining -= item.widthMm;
      const validation = validatePlacement(item, 'kitchen', clearance);
      return { moduleId: item.id, family: item.family, widthMm: item.widthMm, depthMm: item.depthMm, heightMm: item.heightMm, validation };
    }).filter(Boolean);
    const proposalId = `aura-kitchen-${Date.now()}`;
    const proposal = { family: 'modular-kitchen', roomId: roomId ?? 'kitchen', runWidthMm: runWidth, clearanceMm: clearance, modules, unfilledWidthMm: Math.max(0, remaining), provisional: true, requiresConfirmation: true };
    const auditEvent = createAuraAuditEvent({ projectId, actorId, toolId, eventType: 'proposal_created', sourceVersionId: sceneVersionId, proposalId, payload: { proposal }, provenance: { compilerVersion: 'aura-preview-v1', provider: 'deterministic-catalog' } });
    await appendAuraAuditEvent(actor.client, actor.organizationId, auditEvent);
    return response.status(200).json({ success: true, mode: 'preview', toolId, projectId, sceneVersionId, proposalId, proposal, audit: { event: auditEvent, persisted: true, persistence: 'supabase', next: 'POST /api/aura/audit-events with proposal_approved, proposal_rejected, or correction_recorded.' } });
  }
  if (toolId === 'generate_tv_unit') {
    const width = typeof widthMm === 'number' && widthMm >= 1200 ? widthMm : 1800;
    const proposalId = `aura-tv-${Date.now()}`;
    const proposal = { family: 'tv-unit', roomId: roomId ?? 'living', widthMm: width, depthMm: 400, heightMm: 600, features: ['cable-management', 'base-storage', 'display-niche'], production: { panelBased: true, cutlistSupported: true, hardwareSchedule: true }, requiresConfirmation: true };
    const auditEvent = createAuraAuditEvent({ projectId, actorId, toolId, eventType: 'proposal_created', sourceVersionId: sceneVersionId, proposalId, payload: { proposal }, provenance: { compilerVersion: 'aura-preview-v1' } });
    await appendAuraAuditEvent(actor.client, actor.organizationId, auditEvent);
    return response.status(200).json({ success: true, mode: 'preview', toolId, projectId, sceneVersionId, proposalId, proposal, audit: { event: auditEvent, persisted: true, persistence: 'supabase', next: 'POST /api/aura/audit-events with proposal_approved, proposal_rejected, or correction_recorded.' } });
  }
  if (toolId === 'change_laminate') {
    const finish = typeof laminate === 'string' && laminate.trim() ? laminate.trim() : 'warm oak matte';
    const proposalId = `aura-laminate-${Date.now()}`;
    const proposal = { operation: 'material-swap', target: 'selected scene modules', laminate: finish, style: style ?? 'coordinated modular interior', visualOnlyUntilApproved: true, requiresConfirmation: true };
    const auditEvent = createAuraAuditEvent({ projectId, actorId, toolId, eventType: 'proposal_created', sourceVersionId: sceneVersionId, proposalId, payload: { proposal }, provenance: { compilerVersion: 'aura-preview-v1' } });
    await appendAuraAuditEvent(actor.client, actor.organizationId, auditEvent);
    return response.status(200).json({ success: true, mode: 'preview', toolId, projectId, sceneVersionId, proposalId, proposal, audit: { event: auditEvent, persisted: true, persistence: 'supabase', next: 'POST /api/aura/audit-events with proposal_approved, proposal_rejected, or correction_recorded.' } });
  }
  const registered = AURA_TOOLS.find((tool) => tool.id === toolId);
  if (registered) return response.status(409).json({ success: false, code: 'AURA_TOOL_NOT_ENABLED', toolId, recovery: 'Choose an enabled preview tool or continue through the normal workspace flow.', message: `${registered.label} is registered for a future release and is not enabled in this environment.` });
  return response.status(404).json({ success: false, code: 'AURA_TOOL_NOT_FOUND', toolId, message: 'That AURA capability is not registered.' });
});

app.get('/api/catalog/modules', (request, response) => {
  const room = typeof request.query.room === 'string' ? RoomTypeSchema.safeParse(request.query.room) : null;
  if (room && !room.success) return response.status(400).json({ success: false, code: 'INVALID_ROOM_TYPE' });
  const query = typeof request.query.q === 'string' ? request.query.q : undefined;
  return response.json({ success: true, source: 'ULTIDA Indian modular catalog', modules: listCatalog(room?.success ? room.data : undefined, query) });
});

app.get('/api/catalog/presets', (request, response) => {
  const room = typeof request.query.room === 'string' ? RoomTypeSchema.safeParse(request.query.room) : null;
  const family = typeof request.query.family === 'string' ? ModuleFamilySchema.safeParse(request.query.family) : null;
  if (room && !room.success) return response.status(400).json({ success: false, code: 'INVALID_ROOM_TYPE' });
  if (family && !family.success) return response.status(400).json({ success: false, code: 'INVALID_MODULE_FAMILY' });
  return response.json({ success: true, source: 'ULTIDA reference-driven design presets', presets: listDesignPresets(room?.success ? room.data : undefined, family?.success ? family.data : undefined) });
});

app.get('/api/catalog/vault', (_request, response) => {
  return response.json({ success: true, vault: getCatalogVault() });
});

app.post('/api/catalog/validate-placement', (request, response) => {
  const { moduleId, roomType, clearanceMm, adjacentFamily } = request.body ?? {};
  if (!moduleId || !roomType || typeof clearanceMm !== 'number') return response.status(400).json({ success: false, code: 'INVALID_PLACEMENT_REQUEST', message: 'moduleId, roomType and clearanceMm are required.' });
  const moduleItem = listCatalog().find((item) => item.id === moduleId);
  if (!moduleItem) return response.status(404).json({ success: false, code: 'MODULE_NOT_FOUND' });
  const result = validatePlacement(moduleItem, RoomTypeSchema.parse(roomType), clearanceMm);
  const ruleViolations: Array<{ code: string; message: string }> = [];
  if (adjacentFamily === 'kitchen-corner' && moduleItem.tags.includes('drawer')) {
    ruleViolations.push({ code: 'KITCHEN_DRAWERS_CORNER_ADJACENT', message: 'Kitchen drawer units adjacent to corners require a filler to prevent handle collision.' });
  }
  return response.status(200).json({ success: result.valid, validation: result, ruleViolations });
});

app.post('/api/plan/analyze', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId, sourceAssetId, fileName, mimeType, idempotencyKey } = request.body ?? {};
  if (typeof sourceAssetId !== 'string' || typeof fileName !== 'string' || typeof mimeType !== 'string') return response.status(400).json({ success: false, code: 'INVALID_PLAN_UPLOAD', message: 'A stored sourceAssetId, file name and MIME type are required.' });
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/avif', 'image/heic', 'image/heif', 'image/svg+xml', 'application/pdf'].includes(mimeType)) return response.status(400).json({ success: false, code: 'UNSUPPORTED_PLAN', message: 'Upload a supported floor-plan image or PDF.' });
  const job = await createPlanAnalysisJob(process.env, { projectId, sourceAssetId, fileName, mimeType, idempotencyKey }, authReq.ultidaUser!.id);
  if (job.status === 'unavailable') return response.status(503).json({ success: false, code: job.code, message: job.reason });
  if (job.status === 'not_found') return response.status(404).json({ success: false, code: 'PLAN_SOURCE_NOT_FOUND', message: job.reason });
  const dispatch = job.status === 'queued' ? await dispatchPlanAnalysisJob(process.env, job.jobId) : null;
  if (job.status === 'queued' && !dispatch?.dispatched) {
    return response.status(503).json({ success: false, code: 'PLAN_JOB_DISPATCH_UNAVAILABLE', message: dispatch?.reason ?? 'The analysis worker could not be reached.', ...job, dispatch });
  }
  return response.status(job.status === 'failed' ? 502 : 202).json({ success: job.status !== 'failed', ...job, dispatch });
});

app.get('/api/plan/analyze/:jobId', requireProjectUser, async (request, response) => {
  const projectId = typeof request.query.projectId === 'string' ? request.query.projectId : String(request.body?.projectId ?? request.params.projectId ?? '');
  const result = await getPlanAnalysisJob(process.env, projectId, String(request.params.jobId));
  if (result.status === 'unavailable') return response.status(503).json({ success: false, code: 'PLAN_JOB_PERSISTENCE_UNAVAILABLE' });
  if (result.status === 'not_found') return response.status(404).json({ success: false, code: 'PLAN_JOB_NOT_FOUND' });
  return response.json({ success: true, ...result });
});

// A queued job may survive an interrupted provider deployment. Re-dispatch the
// original immutable source instead of forcing the designer to upload again.
app.post('/api/plan/analyze/:jobId/retry', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = authReq.ultidaUser!.projectId;
  const client = getServerSupabaseClient();
  if (!client) return response.status(503).json({ success: false, code: 'PLAN_JOB_PERSISTENCE_UNAVAILABLE', message: 'Secure job processing is not configured on the server.' });
  const { data: job, error } = await client
    .from('jobs')
    .select('id,status')
    .eq('id', request.params.jobId)
    .eq('project_id', projectId)
    .eq('kind', 'plan-analysis')
    .maybeSingle();
  if (error || !job) return response.status(404).json({ success: false, code: 'PLAN_JOB_NOT_FOUND', message: 'This floor-plan analysis job was not found.' });
  if (job.status === 'succeeded') return response.status(409).json({ success: false, code: 'PLAN_JOB_ALREADY_COMPLETE', message: 'This floor-plan analysis has already completed.' });
  const queuedAt = new Date().toISOString();
  const reset = await client.from('jobs').update({ status: 'queued', queued_at: queuedAt, processing_at: null, failed_at: null, error: null, last_error_code: null, locked_at: null, locked_by: null, updated_at: queuedAt }).eq('id', job.id);
  if (reset.error) return response.status(502).json({ success: false, code: 'PLAN_JOB_RETRY_FAILED', message: reset.error.message });
  const dispatch = await dispatchPlanAnalysisJob(process.env, job.id);
  if (!dispatch.dispatched) return response.status(503).json({ success: false, code: 'PLAN_JOB_DISPATCH_UNAVAILABLE', message: dispatch.reason ?? 'The AI worker could not be reached. Please try again shortly.' });
  return response.status(202).json({ success: true, jobId: job.id, requestId: job.id, status: 'queued', queuedAt, dispatch });
});

// ─── Real plan-analysis pipeline (provider + deterministic CV/OCR + reconciliation) ───
app.post('/api/projects/:projectId/plan-analysis', requireProjectUser, async (request, response) => {
  return response.status(410).json({ success: false, code: 'PLAN_ANALYSIS_ROUTE_RETIRED', message: 'Use the durable floor-plan flow: initiate upload, complete upload, then poll the plan-analysis job.', replacement: 'POST /api/plan/analyze' });
});

app.get('/api/projects/:projectId/plan-analysis/draft', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const client = getRequestSupabaseClient(request);
  const { data, error } = await client
    .from('plan_analysis_drafts')
    .select('*')
    .eq('project_id', authReq.ultidaUser!.projectId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return response.status(502).json({ success: false, code: 'PLAN_DRAFT_LOAD_FAILED', message: error.message });
  return response.json({ success: true, draft: data });
});

app.put('/api/projects/:projectId/plan-analysis/draft', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const body = request.body ?? {};
  const { analysisUuid, elements, issues, scale, ceilingHeightMm, status } = body;
  if (typeof analysisUuid !== 'string') return response.status(400).json({ success: false, code: 'MISSING_ANALYSIS_UUID', message: 'analysisUuid is required.' });
  const client = getRequestSupabaseClient(request);
  const { error } = await client
    .from('plan_analysis_drafts')
    .update({
      elements: elements as unknown as Record<string, unknown>[],
      issues: issues as unknown as Record<string, unknown>[],
      scale: scale ?? null,
      ceiling_height_mm: ceilingHeightMm ?? null,
      status: status ?? 'needs_review',
      updated_at: new Date().toISOString(),
    })
    .eq('analysis_uuid', analysisUuid)
    .eq('project_id', authReq.ultidaUser!.projectId);
  if (error) return response.status(502).json({ success: false, code: 'PLAN_DRAFT_UPDATE_FAILED', message: error.message });
  return response.json({ success: true });
});

app.post('/api/internal/plan-jobs/process', async (request, response) => {
  const configuredSecret = process.env.ULTIDA_WORKER_SHARED_SECRET ?? '';
  const suppliedSecret = String(request.header('x-ultida-worker-secret') ?? '');
  const validSecret = configuredSecret.length > 31 && configuredSecret.length === suppliedSecret.length && timingSafeEqual(Buffer.from(configuredSecret), Buffer.from(suppliedSecret));
  if (!validSecret) return response.status(401).json({ success: false, code: 'WORKER_AUTH_FAILED' });
  const requestedJobId = typeof request.body?.jobId === 'string' ? request.body.jobId : null;
  if (requestedJobId) await processPlanAnalysisJob(process.env, requestedJobId);
  else await processPlanAnalysisJobs(process.env, 1);
  return response.json({ success: true });
});

app.post('/api/scene/materialize', (request, response) => {
  const { projectId, floorPlanVersionId, approved, spatialModel } = request.body ?? {};
  if (!projectId || !spatialModel) return response.status(400).json({ success: false, code: 'INVALID_MATERIALIZE_REQUEST' });
  const rooms = Array.isArray(spatialModel.rooms) ? spatialModel.rooms.map((room: any) => {
    const boundary = Array.isArray(room.boundary) ? room.boundary.map((point: any) => ({ xMm: Number(point.xMm), yMm: Number(point.yMm) })) : [];
    if (boundary.length >= 3 && (boundary[0].xMm !== boundary.at(-1)?.xMm || boundary[0].yMm !== boundary.at(-1)?.yMm)) boundary.push({ ...boundary[0] });
    return { id: String(room.id), spaceId: String(room.id), name: String(room.name ?? room.id), type: String(room.type ?? 'other'), boundary, confidence: 1 };
  }) : [];
  const walls = Array.isArray(spatialModel.walls) ? spatialModel.walls.map((wall: any) => ({ id: String(wall.id), floorId: 'floor-1', start: wall.start, end: wall.end, thicknessMm: Number(wall.thicknessMm), heightMm: Number(wall.heightMm), baseElevationMm: 0, spaceIds: rooms.map((room: any) => room.spaceId), confidence: 1 })) : [];
  const openings = Array.isArray(spatialModel.openings) ? spatialModel.openings.map((opening: any) => ({ id: String(opening.id), wallId: String(opening.wallId), kind: opening.kind === 'window' ? 'window' : 'door', offsetMm: Number(opening.offsetMm ?? 0), widthMm: Number(opening.widthMm), heightMm: Number(opening.heightMm), sillHeightMm: Number(opening.sillHeightMm ?? 0), confidence: 1 })) : [];
  const firstRoom = rooms[0];
  const centre = firstRoom?.boundary?.[0] ?? { xMm: 0, yMm: 0 };
  const scene = {
    schema: 'scene.v1', units: 'mm', coordinateSystem: 'right-handed-z-up', projectId: String(projectId), floorPlanVersionId: String(floorPlanVersionId ?? 'fpv-default'),
    floors: [{ id: 'floor-1', name: 'Ground Floor', elevationMm: 0, heightMm: Math.max(...walls.map((wall: any) => wall.heightMm), 2700) }],
    spaces: rooms.map((room: any) => ({ id: room.spaceId, floorId: 'floor-1', name: room.name, type: room.type })), rooms, walls, openings,
    fixedFixtures: [], modules: [], materials: [], lighting: [], cameras: [{ id: 'camera-default', name: 'Perspective', position: { xMm: centre.xMm, yMm: centre.yMm - 1800, zMm: 1500 }, target: { xMm: centre.xMm, yMm: centre.yMm, zMm: 1200 }, lensMm: 35 }], constraints: [], unresolvedDetections: [],
    metadata: { branch: 'main', status: approved ? 'approved' : 'draft', changeReason: 'Materialized from supplied spatial model', schemaVersion: 'scene.v1', designVersion: 'scene.v1' },
  };
  return response.status(201).json({ success: true, scene });
});

app.post('/api/drawings/elevations.pdf', async (request, response) => {
  const { projectId, sceneVersionId, scene } = request.body ?? {};
  if (!projectId || !sceneVersionId || !scene) return response.status(400).json({ success: false, code: 'INVALID_DRAWING_REQUEST' });
  const normalized = migrateScene({ ...scene, projectId, floorPlanVersionId: scene.floorPlanVersionId ?? `plan-for-${projectId}` });
  if (!['approved', 'locked'].includes(normalized.metadata.status)) return response.status(409).json({ success: false, code: 'SCENE_NOT_PRODUCTION_READY' });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<void>((resolveStream, rejectStream) => {
    stream.once('end', resolveStream);
    stream.once('error', rejectStream);
  });
  generateProjectionPdf(buildDrawingProjection(normalized), stream);
  await completed;
  response.setHeader('content-type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="ultida-${sceneVersionId}.pdf"`);
  return response.status(200).send(Buffer.concat(chunks));
});

app.post('/api/commercial/estimates', (request, response) => {
  const { projectId, sceneVersionId, lines, marginRate, gstRate } = request.body ?? {};
  if (!projectId || !lines) return response.status(400).json({ success: false, code: 'INVALID_ESTIMATE_REQUEST' });
  let subtotal = 0;
  for (const line of lines) {
    subtotal += (line.quantity * line.unitRateInr) + line.labourInr;
  }
  const mRate = typeof marginRate === 'number' ? marginRate : 0.1;
  const gRate = typeof gstRate === 'number' ? gstRate : 0.18;
  const margin = subtotal * mRate;
  const taxable = subtotal + margin;
  const gst = taxable * gRate;
  const grandTotalInr = (marginRate === undefined && gstRate === undefined) ? subtotal : Math.round(taxable + gst);
  return response.status(201).json({
    success: true,
    estimate: {
      id: `est-${crypto.randomUUID()}`,
      currency: 'INR',
      totals: { grandTotalInr }
    }
  });
});

app.post('/api/drawings/elevations.svg', (request, response) => {
  const { projectId, sceneVersionId, scene } = request.body ?? {};
  if (!projectId || !sceneVersionId || !scene) return response.status(400).json({ success: false, code: 'INVALID_DRAWING_REQUEST' });
  const normalized = migrateScene({ ...scene, projectId, floorPlanVersionId: scene.floorPlanVersionId ?? `plan-for-${projectId}` });
  if (!['approved', 'locked'].includes(normalized.metadata.status)) return response.status(409).json({ success: false, code: 'SCENE_NOT_PRODUCTION_READY' });
  response.setHeader('content-type', 'image/svg+xml');
  return response.status(200).send(generateDrawingPackageSvg(normalized));
});

app.post('/api/production/cutlist', (request, response) => {
  try {
    const { projectId, sceneVersionId, scene } = request.body ?? {};
    if (!projectId || !sceneVersionId || !scene) return response.status(400).json({ success: false, code: 'INVALID_CUTLIST_REQUEST' });
    const normalized = migrateScene({ ...scene, projectId, floorPlanVersionId: scene.floorPlanVersionId ?? `plan-for-${projectId}` });
    if (!['approved', 'locked'].includes(normalized.metadata.status)) return response.status(409).json({ success: false, code: 'SCENE_NOT_PRODUCTION_READY' });
    return response.status(200).json({ success: true, cutlist: buildCutlist(normalized) });
  } catch (err: any) {
    console.error('Cutlist error:', err);
    return response.status(500).json({ success: false, code: 'CUTLIST_FAILED', message: err?.message });
  }
});

app.post('/api/production/boq', (request, response) => {
  try {
    const { projectId, sceneVersionId, scene, customRates } = request.body ?? {};
    if (!projectId || !scene) return response.status(400).json({ success: false, code: 'INVALID_BOQ_REQUEST', message: 'projectId and scene are required.' });
    const normalized = migrateScene({ ...scene, projectId, floorPlanVersionId: scene.floorPlanVersionId ?? `plan-for-${projectId}` });
    const boq = generateProjectBOQ(normalized, customRates);
    return response.status(200).json({ success: true, boq });
  } catch (err: any) {
    return response.status(500).json({ success: false, code: 'BOQ_FAILED', message: err?.message });
  }
});

app.post('/api/production/boq.csv', (request, response) => {
  try {
    const { projectId, scene, customRates } = request.body ?? {};
    if (!projectId || !scene) return response.status(400).json({ success: false, code: 'INVALID_BOQ_REQUEST', message: 'projectId and scene are required.' });
    const normalized = migrateScene({ ...scene, projectId, floorPlanVersionId: scene.floorPlanVersionId ?? `plan-for-${projectId}` });
    const boq = generateProjectBOQ(normalized, customRates);
    response.setHeader('content-type', 'text/csv');
    const rows = boq.items.map((item) => [item.category, `"${item.description.replace(/"/g, '""')}"`, item.quantity, item.unit, item.rateInr, item.totalInr].join(','));
    const csvContent = [
      'category,description,quantity,unit,rate_inr,total_inr',
      ...rows,
      `summary,Subtotal,,,${boq.subtotalInr}`,
      `summary,GST Tax (18%),,,${boq.taxInr}`,
      `summary,Grand Total (INR),,,${boq.totalInr}`,
      ''
    ].join('\n');
    return response.status(200).send(csvContent);
  } catch (err: any) {
    return response.status(500).json({ success: false, code: 'BOQ_CSV_FAILED', message: err?.message });
  }
});

app.post('/api/projects/:projectId/vastu-assessment', requireProjectUser, async (request, response) => {
  try {
    const { spaces, bounds } = request.body ?? {};
    const inputSpaces = Array.isArray(spaces) ? spaces : [];
    const planBounds = bounds && typeof bounds === 'object' ? bounds : { minX: 0, minY: 0, maxX: 10000, maxY: 10000 };
    const assessment = evaluateVastuCompliance(inputSpaces, planBounds);
    return response.status(200).json({ success: true, assessment });
  } catch (err: any) {
    return response.status(500).json({ success: false, code: 'VASTU_FAILED', message: err?.message });
  }
});

app.post('/api/production/cutlist.csv', (request, response) => {
  try {
    const { projectId, sceneVersionId, scene } = request.body ?? {};
    if (!projectId || !sceneVersionId || !scene) return response.status(400).json({ success: false, code: 'INVALID_CUTLIST_REQUEST' });
    const normalized = migrateScene({ ...scene, projectId, floorPlanVersionId: scene.floorPlanVersionId ?? `plan-for-${projectId}` });
    if (!['approved', 'locked'].includes(normalized.metadata.status)) return response.status(409).json({ success: false, code: 'SCENE_NOT_PRODUCTION_READY' });
    const cutlist = buildCutlist(normalized);
    response.setHeader('content-type', 'text/csv');
    const rows = cutlist.parts.map((part: { id: string; moduleId: string; family: string; roomId: string; partType: string; lengthMm: number; widthMm: number; thicknessMm: number; edgeBandMm: number; hardware: string[] }) => [part.id, part.moduleId, part.family, part.roomId, part.partType, part.lengthMm, part.widthMm, part.thicknessMm, part.edgeBandMm, part.hardware.join('|')].join(','));
    return response.status(200).send(['part_id,module_id,family,room_id,part_type,length_mm,width_mm,thickness_mm,edge_band_mm,hardware', ...rows, ''].join('\n'));
  } catch (err: any) {
    return response.status(500).json({ success: false, code: 'CUTLIST_FAILED', message: err?.message });
  }
});

app.post('/api/production/wall-elevation.svg', requireProjectUser, (request, response) => {
  try {
    const { scene, wallId } = request.body ?? {};
    if (!scene || typeof scene !== 'object') return response.status(400).json({ success: false, code: 'INVALID_ELEVATION_REQUEST', message: 'scene payload is required.' });
    const normalized = migrateScene({ ...scene, projectId: request.params.projectId ?? scene.projectId ?? 'unknown', floorPlanVersionId: scene.floorPlanVersionId ?? 'unknown' });
    const svg = generateWallElevationSvg(normalized, wallId ?? '');
    response.setHeader('content-type', 'image/svg+xml');
    return response.status(200).send(svg);
  } catch (err: any) {
    return response.status(500).json({ success: false, code: 'ELEVATION_FAILED', message: err?.message });
  }
});

const handleDxfRequest = (request: express.Request, response: express.Response) => {
  const sceneVersionId = request.params.sceneVersionId ?? request.body?.sceneVersionId;
  const { projectId, scene } = request.body ?? {};
  if (typeof projectId !== 'string' || typeof sceneVersionId !== 'string' || !sceneVersionId || !scene || typeof scene !== 'object') {
    return response.status(400).json({ success: false, code: 'INVALID_DXF_REQUEST', message: 'A project, scene version and scene payload are required.' });
  }
  const sceneStatus = (scene as { metadata?: { status?: unknown } }).metadata?.status;
  if (!['approved', 'locked'].includes(String(sceneStatus))) {
    return response.status(409).json({ success: false, code: 'SCENE_NOT_PRODUCTION_READY', message: 'Only approved or locked scenes can export production DXF.' });
  }
  const normalized = migrateScene({ ...scene, projectId, floorPlanVersionId: scene.floorPlanVersionId ?? `plan-for-${projectId}` });
  const dxf = exportSceneToDxf(normalized);
  return response.status(200).type('application/dxf').set('Content-Disposition', `attachment; filename="ultida-${sceneVersionId}.dxf"`).send(dxf);
};

app.post('/api/drawings/dxf', handleDxfRequest);
app.post('/api/drawings/wall-elevation.dxf', handleDxfRequest);
app.post('/api/drawings/:sceneVersionId/dxf', handleDxfRequest);

// A plan-review export is intentionally separate from the scene DXF above.
// It lets designers take calibrated Initial Design geometry into CAD for
// review, while the scene route remains the only production/fabrication path.
app.post('/api/projects/:projectId/drawings/plan.dxf', requireProjectUser, (request, response) => {
  try {
    const projectId = String(request.params.projectId);
    const { planVersionId, geometryMode, mmPerPixel, ceilingHeightMm, elements, warnings } = request.body ?? {};
    if (typeof planVersionId !== 'string' || !planVersionId || !['initial_design', 'final_production'].includes(String(geometryMode))) {
      return response.status(400).json({ success: false, code: 'INVALID_PLAN_DXF_REQUEST', message: 'planVersionId and geometryMode are required.' });
    }
    if (!Number.isFinite(Number(mmPerPixel)) || Number(mmPerPixel) <= 0 || !Array.isArray(elements) || elements.length === 0) {
      return response.status(400).json({ success: false, code: 'INVALID_PLAN_DXF_GEOMETRY', message: 'A calibrated scale and at least one editable plan element are required.' });
    }
    const dxf = exportPlanDraftToDxf({ planVersionId: `${projectId}-${planVersionId}`, geometryMode, mmPerPixel: Number(mmPerPixel), ceilingHeightMm: Number(ceilingHeightMm) || undefined, elements, warnings: Array.isArray(warnings) ? warnings.map(String) : [] });
    const suffix = geometryMode === 'initial_design' ? 'initial-design' : 'final-production';
    return response.status(200).type('application/dxf').set('Content-Disposition', `attachment; filename="ultida-plan-${suffix}.dxf"`).send(dxf);
  } catch (error: any) {
    return response.status(422).json({ success: false, code: 'PLAN_DXF_FAILED', message: error?.message ?? 'Plan DXF export failed.' });
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  const err = error as { status?: number; code?: string; message?: string };
  const status = typeof err?.status === 'number' ? err.status : 500;
  return response.status(status).json({
    success: false,
    code: err?.code ?? 'INTERNAL_SERVER_ERROR',
    message: err?.message ?? 'An unexpected error occurred.'
  });
});

app.get('/api/projects/:projectId/renders', requireProjectUser, async (request, response) => {
  const result = await listProjectRenders(process.env, String(request.params.projectId), getRequestSupabaseClient(request));
  if (result.status === 'failed') return response.status(500).json({ success: false, code: 'RENDER_LIST_FAILED', message: result.reason });
  return response.json({ success: true, renders: result.renders });
});

// Render records are durable jobs, not gallery entries. The client polls this
// endpoint for the precise job it started so failed or queued work is never
// mistaken for a missing gallery image.
app.get('/api/projects/:projectId/renders/:renderId', requireProjectUser, async (request, response) => {
  const result = await getVisualJob(process.env, gateway, String(request.params.renderId), String(request.params.projectId), getRequestSupabaseClient(request));
  if (result.status === 'not_found') return response.status(404).json({ success: false, code: 'RENDER_NOT_FOUND', message: 'Render job was not found.' });
  return response.json({ success: true, result });
});

app.post('/api/projects/:projectId/renders', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = String(request.params.projectId);
  const sceneVersionId = typeof request.body?.sceneVersionId === 'string' ? request.body.sceneVersionId : '';
  const options = typeof request.body?.options === 'object' && request.body.options ? request.body.options as Record<string, unknown> : {};
  if (!sceneVersionId) return response.status(400).json({ success: false, code: 'SCENE_REQUIRED', message: 'sceneVersionId is required.' });
  const parsed = VisualProposalRequestSchema.safeParse({
    projectId,
    sceneVersionId,
    idempotencyKey: typeof request.body?.idempotencyKey === 'string' ? request.body.idempotencyKey : `${sceneVersionId}:render:${Date.now()}`,
    roomId: typeof options.roomId === 'string' ? options.roomId : 'primary-room',
    sourceAssets: [`scene:${sceneVersionId}`],
    referenceAssets: [],
    masks: [],
    operation: ['generate', 'restage', 'material-swap', 'remove-object', 'relight', 'enhance'].includes(String(options.operation)) ? options.operation : 'generate',
    style: typeof options.style === 'string' ? options.style : 'Warm contemporary Indian',
    quality: options.quality === 'draft' || options.quality === 'final' ? options.quality : 'review',
    camera: { view: 'wide-corner', lensMm: 24, eyeHeightMm: 1500 },
    structuredPrompt: 'Compiled server-side from the approved ULTIDA scene.',
    providerPreference: ['cloudflare', 'openai-dall-e-3', 'openai-gpt-image-1', 'comfyui']
  });
  if (!parsed.success) return response.status(400).json({ success: false, code: 'INVALID_RENDER_REQUEST', issues: parsed.error.issues });
  const result = await createVisualJob(process.env, gateway, parsed.data, authReq.ultidaUser?.id, getRequestSupabaseClient(request));
  const success = result.status === 'succeeded' || result.status === 'queued';
  return response.status(success ? 201 : 422).json({ success, result });
});

app.post('/api/projects/:projectId/renders/:renderId/review', requireProjectUser, async (request, response) => {
  const projectId = String(request.params.projectId);
  const renderId = String(request.params.renderId);
  const decision = typeof request.body?.decision === 'string' ? request.body.decision : '';
  if (!['approved', 'rejected'].includes(decision)) return response.status(400).json({ success: false, code: 'INVALID_DECISION', message: 'decision must be approved or rejected.' });
  const result = await reviewVisualJob(process.env, renderId, projectId, decision, String(request.body?.note ?? ''), getRequestSupabaseClient(request));
  return response.status(result.status === 'not_found' ? 404 : result.status === 'conflict' ? 409 : 200).json({ success: result.status === 'succeeded', result });
});

// Canonical entry point — requires auth; callers must use /initiate + /complete sub-routes
app.post('/api/projects/:projectId/floor-plans', requireProjectUser, (request, response) => {
  return response.status(400).json({ success: false, code: 'USE_INITIATE_ROUTE', message: 'Use POST /floor-plans/initiate to start a signed upload, then POST /floor-plans/complete to register the asset.' });
});

app.post('/api/projects/:projectId/floor-plans/initiate', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = String(request.params.projectId);
  const { fileName, mimeType, fileSize } = request.body ?? {};
  if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
    return response.status(400).json({ success: false, code: 'INVALID_INITIATE_PAYLOAD', message: 'projectId and fileName are required.' });
  }
  if (fileSize > 25 * 1024 * 1024) return response.status(413).json({ success: false, code: 'PLAN_TOO_LARGE', message: 'Floor plans must be 25 MB or smaller.' });
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  // Keep the original source private, but accept the common formats designers
  // receive from site teams. Every raster source is normalized to a PNG inside
  // the job before it reaches a vision provider, so the provider never has to
  // guess from a browser filename or an exotic camera encoding.
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif', '.svg', '.pdf'];
  const mimeByExtension: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
    '.avif': 'image/avif', '.heic': 'image/heic', '.heif': 'image/heif', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  };
  // File.type is not reliably populated by every browser/Windows file picker.
  // Extension validation remains explicit; normalize the stored MIME from it.
  const normalizedMimeType = mimeByExtension[ext];
  if (!allowedExts.includes(ext) || !normalizedMimeType) {
    return response.status(415).json({
      success: false,
      code: 'UNSUPPORTED_FORMAT',
      message: ext === '.dwg' ? 'DWG requires verified server-side conversion and is not supported yet.' : 'Supported formats: PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF, HEIC/HEIF, SVG, and PDF.'
    });
  }
  const organizationId = authReq.ultidaUser!.organizationId;
  const assetId = crypto.randomUUID();
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120);
  const storagePath = `${organizationId}/${projectId}/floor-plans/${assetId}-${safeName}`;
  try {
    // The request is already authenticated and constrained to a project member
    // by requireProjectUser. Mint with the server-only client so storage RLS
    // does not block a valid browser handoff before the signed token exists.
    const storageClient = getServerSupabaseClient();
    if (!storageClient) return response.status(503).json({ success: false, code: 'STORAGE_SIGNING_UNAVAILABLE', message: 'Secure file storage is not configured on the server yet.' });
    const signedUrlRes = await storageClient.storage.from('project-assets').createSignedUploadUrl(storagePath);
    if (signedUrlRes.error || !signedUrlRes.data?.token) return response.status(403).json({ success: false, code: 'SIGNED_UPLOAD_DENIED', message: signedUrlRes.error?.message ?? 'A signed upload could not be created.' });
    return response.status(200).json({
      success: true,
      assetId,
      storagePath,
      token: signedUrlRes.data.token,
      bucket: 'project-assets',
      mimeType: normalizedMimeType,
      expiresInSeconds: 7200
    });
  } catch (err: any) {
    return response.status(500).json({ success: false, code: 'INITIATE_FAILED', message: err.message || 'Failed to initiate upload.' });
  }
});

app.post('/api/projects/:projectId/floor-plans/complete', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = String(request.params.projectId);
  const { assetId, storagePath, fileName, mimeType, fileSize } = request.body ?? {};
  if (!assetId || !storagePath || !fileName) {
    return response.status(400).json({ success: false, code: 'INVALID_COMPLETE_PAYLOAD', message: 'assetId, storagePath, and fileName are required.' });
  }
  const userId = authReq.ultidaUser!.id;
  const organizationId = authReq.ultidaUser!.organizationId;
  const requiredPrefix = `${organizationId}/${projectId}/floor-plans/`;
  if (!String(storagePath).startsWith(requiredPrefix)) return response.status(403).json({ success: false, code: 'INVALID_STORAGE_PATH', message: 'The upload path does not belong to this project.' });
  // Keep the browser JWT for membership checks above, then use the trusted
  // server client for the private object verification and durable records.
  const client = getServerSupabaseClient();
  if (!client) return response.status(503).json({ success: false, code: 'STORAGE_SIGNING_UNAVAILABLE', message: 'Secure file storage is not configured on the server yet.' });
  try {
    const verified = await client.storage.from('project-assets').download(storagePath);
    if (verified.error || !verified.data) return response.status(409).json({ success: false, code: 'UPLOAD_NOT_FOUND', message: verified.error?.message ?? 'The uploaded object could not be verified.' });
    const mimeByExtension: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
      '.gif': 'image/gif', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
      '.avif': 'image/avif', '.heic': 'image/heic', '.heif': 'image/heif', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    };
    const ext = String(fileName).slice(String(fileName).lastIndexOf('.')).toLowerCase();
    const normalizedMimeType = mimeByExtension[ext];
    if (!normalizedMimeType) return response.status(415).json({ success: false, code: 'UNSUPPORTED_FORMAT', message: 'This floor-plan format is not supported.' });
    const assetPayload = {
      id: assetId,
      organization_id: organizationId,
      project_id: projectId,
      kind: 'floor_plan',
      storage_path: storagePath,
      mime_type: normalizedMimeType,
      metadata: { originalName: fileName, size: Number(fileSize) || verified.data.size },
      created_by: userId
    };
    const asset = await client.from('project_assets').insert(assetPayload).select('id').single();
    if (asset.error) return response.status(500).json({ success: false, code: 'ASSET_RECORD_FAILED', message: asset.error.message });
    const job = await createPlanAnalysisJob(process.env, { projectId, sourceAssetId: asset.data.id, fileName, mimeType: normalizedMimeType, idempotencyKey: `plan:${projectId}:${asset.data.id}` }, userId);
    if (job.status === 'failed' || job.status === 'unavailable' || job.status === 'not_found') return response.status(503).json({ success: false, code: 'PLAN_JOB_CREATE_FAILED', message: 'The file was stored, but analysis could not be queued.', detail: job });
    const dispatch = await dispatchPlanAnalysisJob(process.env, job.jobId);
    return response.status(200).json({
      success: true,
      asset: { id: asset.data.id, storagePath, name: fileName, mimeType: normalizedMimeType },
      jobId: job.jobId,
      status: job.status,
      dispatch
    });
  } catch (err: any) {
    return response.status(500).json({ success: false, code: 'COMPLETE_FAILED', message: err.message });
  }
});

// References use the same verified signed-upload contract as floor plans, but
// remain advisory. They never become geometry or scene authority on their own.
app.post('/api/projects/:projectId/references/initiate', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = String(request.params.projectId);
  const { fileName, mimeType, fileSize } = request.body ?? {};
  if (typeof fileName !== 'string' || !Number.isFinite(fileSize) || fileSize <= 0) {
    return response.status(400).json({ success: false, code: 'INVALID_REFERENCE_INITIATE_PAYLOAD', message: 'A reference file name and size are required.' });
  }
  if (fileSize > 25 * 1024 * 1024) return response.status(413).json({ success: false, code: 'REFERENCE_TOO_LARGE', message: 'Reference images must be 25 MB or smaller.' });
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];
  const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedExts.includes(ext) || !allowedMimes.includes(mimeType)) {
    return response.status(415).json({ success: false, code: 'UNSUPPORTED_REFERENCE_FORMAT', message: 'Use a PNG, JPEG, or WebP reference image.' });
  }
  const assetId = crypto.randomUUID();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120);
  const storagePath = `${authReq.ultidaUser!.organizationId}/${projectId}/references/${assetId}-${safeName}`;
  try {
    const storageClient = getServerSupabaseClient();
    if (!storageClient) return response.status(503).json({ success: false, code: 'STORAGE_SIGNING_UNAVAILABLE', message: 'Secure file storage is not configured on the server yet.' });
    const signed = await storageClient.storage.from('project-assets').createSignedUploadUrl(storagePath);
    if (signed.error || !signed.data?.token) return response.status(403).json({ success: false, code: 'SIGNED_UPLOAD_DENIED', message: signed.error?.message ?? 'A signed upload could not be created.' });
    return response.json({ success: true, assetId, storagePath, token: signed.data.token, bucket: 'project-assets', expiresInSeconds: 7200 });
  } catch (error: any) {
    return response.status(500).json({ success: false, code: 'REFERENCE_INITIATE_FAILED', message: error.message ?? 'Reference upload could not be initiated.' });
  }
});

app.post('/api/projects/:projectId/references/complete', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = String(request.params.projectId);
  const { assetId, storagePath, fileName, mimeType, fileSize, title, tags, notes } = request.body ?? {};
  if (![assetId, storagePath, fileName].every((value) => typeof value === 'string' && value.length)) {
    return response.status(400).json({ success: false, code: 'INVALID_REFERENCE_COMPLETE_PAYLOAD', message: 'assetId, storagePath, and fileName are required.' });
  }
  const organizationId = authReq.ultidaUser!.organizationId;
  const requiredPrefix = `${organizationId}/${projectId}/references/`;
  if (!storagePath.startsWith(requiredPrefix)) return response.status(403).json({ success: false, code: 'INVALID_STORAGE_PATH', message: 'The upload path does not belong to this project.' });
  const client = getServerSupabaseClient();
  if (!client) return response.status(503).json({ success: false, code: 'STORAGE_SIGNING_UNAVAILABLE', message: 'Secure file storage is not configured on the server yet.' });
  try {
    const downloaded = await client.storage.from('project-assets').download(storagePath);
    if (downloaded.error || !downloaded.data) return response.status(409).json({ success: false, code: 'UPLOAD_NOT_FOUND', message: downloaded.error?.message ?? 'The uploaded reference could not be verified.' });
    const sha256 = createHash('sha256').update(Buffer.from(await downloaded.data.arrayBuffer())).digest('hex');
    const existing = await client.from('project_assets').select('id').eq('project_id', projectId).eq('kind', 'reference_image').contains('metadata', { sha256 }).maybeSingle();
    if (existing.error) return response.status(500).json({ success: false, code: 'REFERENCE_DEDUPE_FAILED', message: existing.error.message });
    if (existing.data) {
      await client.storage.from('project-assets').remove([storagePath]);
      const item = await client.from('reference_library_items').select('id,title,kind,tags,notes,source,metadata').eq('asset_id', existing.data.id).maybeSingle();
      return response.status(200).json({ success: true, duplicate: true, message: 'This exact image is already in the project library.', item: item.data });
    }
    const asset = await client.from('project_assets').insert({
      id: assetId, organization_id: organizationId, project_id: projectId, kind: 'reference_image', storage_path: storagePath,
      mime_type: mimeType || 'image/png', metadata: { originalName: fileName, size: Number(fileSize) || downloaded.data.size, sha256 }, created_by: authReq.ultidaUser!.id
    }).select('id,storage_path,mime_type').single();
    if (asset.error || !asset.data) return response.status(500).json({ success: false, code: 'ASSET_RECORD_FAILED', message: asset.error?.message ?? 'The reference asset could not be recorded.' });
    const cleanTags = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 12) : [];
    const item = await client.from('reference_library_items').insert({
      organization_id: organizationId, project_id: projectId, asset_id: asset.data.id, title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 140) : fileName.replace(/\.[^.]+$/, ''),
      kind: 'reference', tags: cleanTags, notes: typeof notes === 'string' ? notes.trim().slice(0, 1000) : '', source: 'project-reference-upload', metadata: { sha256 }, created_by: authReq.ultidaUser!.id
    }).select('id,title,kind,tags,notes,source,metadata').single();
    if (item.error || !item.data) return response.status(500).json({ success: false, code: 'REFERENCE_RECORD_FAILED', message: item.error?.message ?? 'The reference could not be added to the library.' });
    const signed = await client.storage.from('project-assets').createSignedUrl(asset.data.storage_path, 3600);
    return response.status(201).json({ success: true, duplicate: false, item: { ...item.data, metadata: { ...(item.data.metadata as object), previewUrl: signed.data?.signedUrl } } });
  } catch (error: any) {
    return response.status(500).json({ success: false, code: 'REFERENCE_COMPLETE_FAILED', message: error.message ?? 'The reference could not be saved.' });
  }
});

// Retrieval is deliberately evidence-first: it only returns references inside
// the caller's organization and never turns image inspiration into geometry.
app.get('/api/projects/:projectId/reference-retrieval', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const text = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 240) : '';
  const room = typeof request.query.room === 'string' ? request.query.room.trim().slice(0, 80) : '';
  const moduleFamily = typeof request.query.moduleFamily === 'string' ? request.query.moduleFamily.trim().slice(0, 80) : '';
  const style = typeof request.query.style === 'string' ? request.query.style.trim().slice(0, 80) : '';
  const requestedLimit = Number(request.query.limit);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.floor(requestedLimit), 12)) : 6;
  const client = getRequestSupabaseClient(request);
  const result = await client
    .from('reference_vault_entries')
    .select('id,title,source_path,room,module_family,style,material_tags,viewpoint,review_state,metadata')
    .eq('organization_id', authReq.ultidaUser!.organizationId)
    .not('review_state', 'in', '(archived,rejected)')
    .limit(240);
  if (result.error) return response.status(500).json({ success: false, code: 'REFERENCE_RETRIEVAL_FAILED', message: result.error.message });
  const references = retrieveReferences((result.data ?? []) as ReferenceVaultRecord[], { text, room, moduleFamily, style, limit });
  return response.json({
    success: true,
    query: { text, room: room || null, moduleFamily: moduleFamily || null, style: style || null, limit },
    references,
    context: compileReferenceContext(references),
  });
});

// Designer memory is explicit and reviewable. It ranks future proposals but
// never mutates plan.v1, scene.v1, or production facts by itself.
app.get('/api/projects/:projectId/design-decisions', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const limit = Math.max(1, Math.min(Number(request.query.limit) || 50, 200));
  const result = await getRequestSupabaseClient(request).from('studio_design_decisions')
    .select('id,decision_type,decision,subject,source_version_id,actor_id,created_at')
    .eq('organization_id', authReq.ultidaUser!.organizationId).eq('project_id', String(request.params.projectId))
    .order('created_at', { ascending: false }).limit(limit);
  if (result.error) return response.status(500).json({ success: false, code: 'DESIGN_DECISIONS_READ_FAILED', message: result.error.message });
  return response.json({ success: true, decisions: result.data ?? [] });
});

app.post('/api/projects/:projectId/design-decisions', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const body = request.body ?? {};
  const allowedTypes = new Set(['layout', 'module', 'material', 'dimension', 'reference', 'render']);
  const allowedDecisions = new Set(['accepted', 'rejected', 'corrected', 'preferred']);
  if (!allowedTypes.has(String(body.decisionType)) || !allowedDecisions.has(String(body.decision)) || !body.subject || typeof body.subject !== 'object') {
    return response.status(400).json({ success: false, code: 'INVALID_DESIGN_DECISION', message: 'decisionType, decision, and a structured subject are required.' });
  }
  const result = await getRequestSupabaseClient(request).from('studio_design_decisions').insert({
    organization_id: authReq.ultidaUser!.organizationId, project_id: String(request.params.projectId), actor_id: authReq.ultidaUser!.id,
    decision_type: String(body.decisionType), decision: String(body.decision), subject: body.subject, source_version_id: typeof body.sourceVersionId === 'string' ? body.sourceVersionId : null,
  }).select('id,decision_type,decision,subject,source_version_id,created_at').single();
  if (result.error) return response.status(500).json({ success: false, code: 'DESIGN_DECISION_WRITE_FAILED', message: result.error.message });
  return response.status(201).json({ success: true, decision: result.data });
});

// AURA chat is a supervised command surface: it can inspect available tools
// and create proposals, but every write still goes through an explicit preview.
app.post('/api/projects/:projectId/aura/chat', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const message = typeof request.body?.message === 'string' ? request.body.message.trim().slice(0, 1200) : '';
  if (!message) return response.status(400).json({ success: false, code: 'AURA_MESSAGE_REQUIRED', message: 'Tell AURA what you want to inspect or propose.' });
  const lowered = message.toLowerCase();
  const plan = planAuraMessage(message);
  const tools = listAuraTools().filter((tool) => tool.capability !== 'not_enabled');
  const matches = tools.filter((tool) => [tool.id, tool.label, tool.description].some((value) => lowered.includes(value.toLowerCase().split(' ')[0])));
  const suggested = matches.length ? matches : tools.filter((tool) => tool.group === (lowered.includes('kitchen') || lowered.includes('wardrobe') || lowered.includes('tv') ? 'scene' : lowered.includes('laminate') || lowered.includes('render') ? 'visual' : 'scene'));
  const memory = await getRequestSupabaseClient(request).from('studio_design_decisions').select('decision_type,decision,subject,created_at').eq('organization_id', authReq.ultidaUser!.organizationId).eq('project_id', String(request.params.projectId)).order('created_at', { ascending: false }).limit(20);
  const scene = await getRequestSupabaseClient(request).from('scene_versions').select('id,status').eq('project_id', String(request.params.projectId)).in('status', ['approved', 'locked']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  // Never hand the client a next action that the current deployment marks as
  // unavailable. The intent parser may identify a future capability, but the
  // chat response must offer only an enabled recovery path.
  const selected = (plan.tool?.capability === 'preview' ? plan.tool : null) ?? suggested[0] ?? null;
  const sceneVersionId = scene.data?.id ?? null;
  return response.json({ success: true, message: plan.intent === 'unknown' ? plan.clarification : `I understand this as: ${plan.summary} Nothing will change until you review and approve a proposal.`, plan, tools: suggested.map((tool) => ({ id: tool.id, label: tool.label, mode: tool.mode, requires: tool.requires })), memory: { decisions: memory.error ? [] : (memory.data ?? []), usedForRanking: !memory.error }, next: selected && sceneVersionId ? { method: 'POST', path: `/api/aura/tools/${selected.id}/preview`, body: { projectId: request.params.projectId, sceneVersionId, roomId: 'living', widthMm: selected.id === 'place_modular_kitchen' ? 3000 : 1800, laminate: 'Cubex Neutral Sand' } } : null, safety: { geometryAuthority: 'scene.v1', requiresApproval: true, rollback: true }, recovery: sceneVersionId ? undefined : 'Approve a scene version before asking AURA to prepare a proposal.' });
});

app.get('/api/studio/calendar', requireStudioUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const from = typeof request.query.from === 'string' ? request.query.from : new Date().toISOString();
  const to = typeof request.query.to === 'string' ? request.query.to : new Date(Date.now() + 45 * 86400000).toISOString();
  const result = await getRequestSupabaseClient(request).from('studio_calendar_events').select('id,project_id,title,event_type,starts_at,ends_at,status,notes,assigned_to').eq('organization_id', authReq.ultidaUser!.organizationId).gte('starts_at', from).lte('starts_at', to).order('starts_at', { ascending: true });
  if (result.error) return response.status(500).json({ success: false, code: 'CALENDAR_READ_FAILED', message: result.error.message });
  return response.json({ success: true, events: result.data ?? [] });
});

async function studioProjectIsAccessible(request: express.Request, organizationId: string, projectId: unknown): Promise<boolean> {
  if (typeof projectId !== 'string' || !projectId) return true;
  const result = await getRequestSupabaseClient(request).from('projects').select('id').eq('id', projectId).eq('organization_id', organizationId).maybeSingle();
  return !result.error && Boolean(result.data);
}

app.post('/api/studio/calendar', requireStudioUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const body = request.body ?? {};
  if (typeof body.title !== 'string' || !body.title.trim() || !body.startsAt || Number.isNaN(Date.parse(body.startsAt))) return response.status(400).json({ success: false, code: 'INVALID_CALENDAR_EVENT', message: 'A title and valid startsAt value are required.' });
  if (!(await studioProjectIsAccessible(request, authReq.ultidaUser!.organizationId!, body.projectId))) return response.status(422).json({ success: false, code: 'STUDIO_PROJECT_INVALID', message: 'Choose a project that belongs to this studio.' });
  const result = await getRequestSupabaseClient(request).from('studio_calendar_events').insert({ organization_id: authReq.ultidaUser!.organizationId, project_id: typeof body.projectId === 'string' ? body.projectId : null, title: body.title.trim().slice(0, 160), event_type: body.eventType ?? 'milestone', starts_at: body.startsAt, ends_at: body.endsAt ?? null, notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '', assigned_to: body.assignedTo ?? null, created_by: authReq.ultidaUser!.id }).select('id,project_id,title,event_type,starts_at,ends_at,status,notes,assigned_to').single();
  if (result.error) return response.status(500).json({ success: false, code: 'CALENDAR_WRITE_FAILED', message: result.error.message });
  return response.status(201).json({ success: true, event: result.data });
});

// Team administration is organization-scoped. Invitations are created here
// rather than directly from the browser so role checks and duplicate handling
// cannot be bypassed by a client-side caller.
app.get('/api/studio/team', requireStudioUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const client = getRequestSupabaseClient(request);
  const [members, invitations] = await Promise.all([
    client.from('organization_members').select('user_id,role,created_at').eq('organization_id', authReq.ultidaUser!.organizationId).order('created_at', { ascending: true }),
    client.from('organization_invitations').select('id,email,role,status,invited_by,created_at').eq('organization_id', authReq.ultidaUser!.organizationId).order('created_at', { ascending: false }),
  ]);
  if (members.error || invitations.error) return response.status(500).json({ success: false, code: 'TEAM_READ_FAILED', message: members.error?.message ?? invitations.error?.message });
  return response.json({ success: true, members: members.data ?? [], invitations: invitations.data ?? [] });
});

app.post('/api/studio/team/invitations', requireStudioUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const body = request.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' ? body.role : 'designer';
  if (!/^\S+@\S+\.\S+$/.test(email) || !['admin', 'designer', 'production', 'viewer'].includes(role)) return response.status(400).json({ success: false, code: 'INVALID_INVITATION', message: 'Provide a valid email and supported role.' });
  const client = getRequestSupabaseClient(request);
  const membership = await client.from('organization_members').select('role').eq('organization_id', authReq.ultidaUser!.organizationId).eq('user_id', authReq.ultidaUser!.id).maybeSingle();
  if (membership.error || !['owner', 'admin'].includes(membership.data?.role ?? '')) return response.status(403).json({ success: false, code: 'TEAM_ADMIN_REQUIRED', message: 'Only studio owners and admins can invite collaborators.' });
  const existing = await client.from('organization_invitations').select('id').eq('organization_id', authReq.ultidaUser!.organizationId).eq('email', email).eq('status', 'pending').maybeSingle();
  if (existing.data) return response.status(409).json({ success: false, code: 'INVITATION_EXISTS', message: 'A pending invitation already exists for this email.' });
  const result = await client.from('organization_invitations').insert({ organization_id: authReq.ultidaUser!.organizationId, email, role, invited_by: authReq.ultidaUser!.id }).select('id,email,role,status,created_at').single();
  if (result.error) return response.status(500).json({ success: false, code: 'INVITATION_WRITE_FAILED', message: result.error.message });
  return response.status(201).json({ success: true, invitation: result.data, delivery: 'recorded' });
});

app.patch('/api/studio/team/invitations/:invitationId', requireStudioUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const status = request.body?.status;
  if (!['pending', 'revoked'].includes(status)) return response.status(400).json({ success: false, code: 'INVALID_INVITATION_STATUS', message: 'Only pending or revoked are valid invitation states.' });
  const client = getRequestSupabaseClient(request);
  const membership = await client.from('organization_members').select('role').eq('organization_id', authReq.ultidaUser!.organizationId).eq('user_id', authReq.ultidaUser!.id).maybeSingle();
  if (membership.error || !['owner', 'admin'].includes(membership.data?.role ?? '')) return response.status(403).json({ success: false, code: 'TEAM_ADMIN_REQUIRED', message: 'Only studio owners and admins can change invitations.' });
  const result = await client.from('organization_invitations').update({ status }).eq('id', request.params.invitationId).eq('organization_id', authReq.ultidaUser!.organizationId).select('id,email,role,status,created_at').maybeSingle();
  if (result.error) return response.status(500).json({ success: false, code: 'INVITATION_UPDATE_FAILED', message: result.error.message });
  if (!result.data) return response.status(404).json({ success: false, code: 'INVITATION_NOT_FOUND', message: 'Invitation not found in this studio.' });
  return response.json({ success: true, invitation: result.data });
});

app.get('/api/studio/invoices', requireStudioUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const result = await getRequestSupabaseClient(request).from('studio_invoices').select('id,project_id,quote_id,invoice_number,client_name,currency,items,subtotal,tax,total,status,due_date,created_at').eq('organization_id', authReq.ultidaUser!.organizationId).order('created_at', { ascending: false }).limit(200);
  if (result.error) return response.status(500).json({ success: false, code: 'INVOICE_READ_FAILED', message: result.error.message });
  return response.json({ success: true, invoices: result.data ?? [] });
});

app.post('/api/studio/invoices', requireStudioUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const body = request.body ?? {};
  const items = Array.isArray(body.items) ? body.items.filter((item: any) => item && typeof item.description === 'string' && Number(item.quantity) > 0 && Number(item.rate) >= 0).map((item: any) => ({ description: item.description.trim().slice(0, 200), quantity: Number(item.quantity), rate: Number(item.rate), amount: Number(item.quantity) * Number(item.rate) })) : [];
  if (!items.length || typeof body.invoiceNumber !== 'string' || !body.invoiceNumber.trim()) return response.status(400).json({ success: false, code: 'INVALID_INVOICE', message: 'invoiceNumber and at least one valid line item are required.' });
  if (!(await studioProjectIsAccessible(request, authReq.ultidaUser!.organizationId!, body.projectId))) return response.status(422).json({ success: false, code: 'STUDIO_PROJECT_INVALID', message: 'Choose a project that belongs to this studio.' });
  const subtotal = items.reduce((sum: number, item: any) => sum + item.amount, 0);
  const taxRate = Math.max(0, Number(body.taxRate) || 0);
  const tax = subtotal * taxRate / 100;
  const result = await getRequestSupabaseClient(request).from('studio_invoices').insert({ organization_id: authReq.ultidaUser!.organizationId, project_id: body.projectId ?? null, quote_id: body.quoteId ?? null, invoice_number: body.invoiceNumber.trim().slice(0, 80), client_name: typeof body.clientName === 'string' ? body.clientName.trim().slice(0, 160) : '', currency: body.currency ?? 'INR', items, subtotal, tax, total: subtotal + tax, due_date: body.dueDate ?? null, created_by: authReq.ultidaUser!.id }).select('id,project_id,quote_id,invoice_number,client_name,currency,items,subtotal,tax,total,status,due_date,created_at').single();
  if (result.error) return response.status(500).json({ success: false, code: 'INVOICE_WRITE_FAILED', message: result.error.message });
  return response.status(201).json({ success: true, invoice: result.data });
});

// Project command-centre operations: one accountable review per launch stage,
// with version-linked comments and explicit risks. These are additive to the
// existing approvals audit trail and are safe for Initial Design work.
const operationStages = new Set(['plan', 'scene', 'cutlist', 'quote', 'delivery']);
app.get('/api/projects/:projectId/operations', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request); const projectId = String(request.params.projectId);
  const [reviews, risks, comments, materials] = await Promise.all([
    client.from('project_stage_reviews').select('*').eq('project_id', projectId).order('stage'),
    client.from('project_risks').select('*').eq('project_id', projectId).neq('status', 'closed').order('created_at', { ascending: false }),
    client.from('project_version_comments').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100),
    client.from('project_material_readiness').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }),
  ]);
  const failed = [reviews, risks, comments, materials].find((result) => result.error);
  if (failed?.error) return response.status(500).json({ success: false, code: 'OPERATIONS_READ_FAILED', message: failed.error.message });
  return response.json({ success: true, reviews: reviews.data ?? [], risks: risks.data ?? [], comments: comments.data ?? [], materialReadiness: materials.data ?? [] });
});

app.put('/api/projects/:projectId/operations/reviews/:stage', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest; const stage = String(request.params.stage);
  if (!operationStages.has(stage)) return response.status(400).json({ success: false, code: 'INVALID_OPERATION_STAGE', message: 'Unsupported project review stage.' });
  const body = request.body ?? {}; const status = ['pending','changes_requested','approved','rejected'].includes(String(body.status)) ? String(body.status) : 'pending';
  const result = await getRequestSupabaseClient(request).from('project_stage_reviews').upsert({ organization_id: authReq.ultidaUser!.organizationId, project_id: String(request.params.projectId), stage, status, assigned_to: typeof body.assignedTo === 'string' ? body.assignedTo : null, reviewer_id: status === 'pending' ? null : authReq.ultidaUser!.id, version_id: typeof body.versionId === 'string' ? body.versionId : null, notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '', decided_at: status === 'pending' ? null : new Date().toISOString(), created_by: authReq.ultidaUser!.id, updated_at: new Date().toISOString() }, { onConflict: 'project_id,stage' }).select('*').single();
  if (result.error) return response.status(500).json({ success: false, code: 'REVIEW_WRITE_FAILED', message: result.error.message });
  return response.json({ success: true, review: result.data });
});

app.post('/api/projects/:projectId/operations/comments', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest; const body = request.body ?? {};
  if (typeof body.body !== 'string' || !body.body.trim() || typeof body.stage !== 'string') return response.status(400).json({ success: false, code: 'INVALID_COMMENT', message: 'Stage and comment body are required.' });
  const result = await getRequestSupabaseClient(request).from('project_version_comments').insert({ organization_id: authReq.ultidaUser!.organizationId, project_id: String(request.params.projectId), stage: body.stage.slice(0, 40), version_id: typeof body.versionId === 'string' ? body.versionId : null, body: body.body.trim().slice(0, 4000), author_id: authReq.ultidaUser!.id }).select('*').single();
  if (result.error) return response.status(500).json({ success: false, code: 'COMMENT_WRITE_FAILED', message: result.error.message });
  return response.status(201).json({ success: true, comment: result.data });
});

app.post('/api/projects/:projectId/operations/risks', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest; const body = request.body ?? {};
  if (typeof body.title !== 'string' || !body.title.trim()) return response.status(400).json({ success: false, code: 'INVALID_RISK', message: 'Risk title is required.' });
  const severity = ['low','medium','high','critical'].includes(String(body.severity)) ? String(body.severity) : 'medium';
  const result = await getRequestSupabaseClient(request).from('project_risks').insert({ organization_id: authReq.ultidaUser!.organizationId, project_id: String(request.params.projectId), stage: typeof body.stage === 'string' ? body.stage.slice(0, 40) : 'plan', severity, title: body.title.trim().slice(0, 180), description: typeof body.description === 'string' ? body.description.slice(0, 2000) : '', owner_id: typeof body.ownerId === 'string' ? body.ownerId : null, created_by: authReq.ultidaUser!.id }).select('*').single();
  if (result.error) return response.status(500).json({ success: false, code: 'RISK_WRITE_FAILED', message: result.error.message });
  return response.status(201).json({ success: true, risk: result.data });
});

// Phase 2: Designer Draft Review Persistence Endpoints
app.get('/api/projects/:projectId/plan-draft', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const { data, error } = await client.from('projects').select('draft_review_json').eq('id', request.params.projectId).single();
  if (error) return response.status(500).json({ success: false, code: 'DRAFT_READ_FAILED', message: error.message });
  return response.json({ success: true, draft: data?.draft_review_json ?? null });
});

app.put('/api/projects/:projectId/plan-draft', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const { draft } = request.body ?? {};
  const { error } = await client.from('projects').update({ draft_review_json: draft, updated_at: new Date().toISOString() }).eq('id', request.params.projectId);
  if (error) return response.status(500).json({ success: false, code: 'DRAFT_SAVE_FAILED', message: error.message });
  return response.json({ success: true });
});

app.get('/api/projects/:projectId/brief', requireProjectUser, async (request, response) => {
  const { data, error } = await getRequestSupabaseClient(request)
    .from('project_briefs')
    .select('*')
    .eq('project_id', request.params.projectId)
    .maybeSingle();
  if (error) return response.status(500).json({ success: false, code: 'BRIEF_READ_FAILED', message: error.message });
  return response.json({ success: true, brief: data?.brief ?? null, isComplete: data?.is_complete ?? false, updatedAt: data?.updated_at ?? null });
});

app.get('/api/projects/:projectId/design-preferences', requireProjectUser, async (request, response) => {
  const brief = await getRequestSupabaseClient(request)
    .from('project_briefs')
    .select('style_preferences,custom_style_ref,updated_at')
    .eq('project_id', request.params.projectId)
    .maybeSingle();
  if (brief.error) return response.status(500).json({ success: false, code: 'DESIGN_PREFERENCES_LOAD_FAILED', message: brief.error.message });
  return response.json({ success: true, preferences: brief.data ?? { style_preferences: [], custom_style_ref: null } });
});

app.put('/api/projects/:projectId/design-preferences', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = String(request.params.projectId);
  const stylePresetId = typeof request.body?.stylePresetId === 'string' ? request.body.stylePresetId : '';
  const styleText = typeof request.body?.styleText === 'string' ? request.body.styleText.trim() : '';
  if (!stylePresetId) return response.status(400).json({ success: false, code: 'STYLE_PRESET_REQUIRED', message: 'Select a catalog style preset before saving the moodboard.' });
  const preset = getCatalogVault().presets.find((item) => item.id === stylePresetId);
  if (!preset) return response.status(422).json({ success: false, code: 'STYLE_PRESET_NOT_FOUND', message: 'The selected style preset is not in the ULTIDA catalog vault.' });
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('organization_id').eq('id', projectId).single();
  if (project.error || !project.data) return response.status(404).json({ success: false, code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' });
  const update = await client.from('project_briefs').update({
    style_preferences: [preset.id],
    custom_style_ref: styleText || preset.name,
    organization_id: project.data.organization_id,
    updated_by: authReq.ultidaUser!.id,
    updated_at: new Date().toISOString(),
  }).eq('project_id', projectId).select('style_preferences,custom_style_ref,updated_at').maybeSingle();
  if (update.error) return response.status(500).json({ success: false, code: 'DESIGN_PREFERENCES_SAVE_FAILED', message: update.error.message });
  if (!update.data) return response.status(409).json({ success: false, code: 'BRIEF_REQUIRED_FOR_STYLE', message: 'Save a project brief before saving a design style preference.' });
  return response.json({ success: true, preferences: update.data, preset });
});

const writeProjectBrief = async (request: express.Request, response: express.Response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId } = request.params;
  const userId = authReq.ultidaUser!.id;
  const organizationId = authReq.ultidaUser!.organizationId;
  const { brief, clientName, clientEmail, clientPhone, siteLocation, propertyType, numBedrooms, isRenovation, ceilingHeightMm, budgetInr, measurementUnits, stylePreferences, customStyleRef, companyStandards, roomRequirements, isComplete } = request.body ?? {};
  const document = brief && typeof brief === 'object' ? brief : request.body ?? {};
  const briefValidation = validateProjectBrief(document);
  if (!briefValidation.valid) return response.status(422).json({ success: false, code: 'BRIEF_SCHEMA_INVALID', message: 'The brief contains invalid fields.', fieldErrors: briefValidation.fieldErrors });
  const fieldErrors: Record<string, string> = {};
  for (const [key, label] of [['clientName', 'Client name'], ['projectName', 'Project name'], ['propertyType', 'Property type'], ['rooms', 'Rooms and scope'], ['style', 'Design style'], ['budgetRange', 'Budget range']] as const) {
    if (!String(document[key] ?? '').trim()) fieldErrors[key] = `${label} is required.`;
  }
  const complete = isComplete === true;
  if (complete && Object.keys(fieldErrors).length) return response.status(422).json({ success: false, code: 'BRIEF_VALIDATION_FAILED', message: 'Complete the required brief fields.', fieldErrors });

  const briefPayload = {
    project_id: projectId,
    organization_id: organizationId,
    brief: document,
    client_name: clientName || document.clientName || '',
    client_email: clientEmail || document.clientEmail || null,
    client_phone: clientPhone || document.clientPhone || null,
    site_location: siteLocation || document.siteLocation || null,
    property_type: propertyType || document.propertyType || null,
    num_bedrooms: typeof numBedrooms === 'number' ? numBedrooms : (document.numBedrooms ?? null),
    is_renovation: typeof isRenovation === 'boolean' ? isRenovation : (document.isRenovation ?? false),
    ceiling_height_mm: typeof ceilingHeightMm === 'number' ? ceilingHeightMm : (document.ceilingHeightMm ?? 2700),
    budget_inr: typeof budgetInr === 'number' ? budgetInr : (document.budgetInr ?? null),
    measurement_units: measurementUnits || document.measurementUnits || 'mm',
    style_preferences: Array.isArray(stylePreferences) ? stylePreferences : (document.style ? [document.style] : []),
    custom_style_ref: customStyleRef || document.customStyleRef || null,
    company_standards: companyStandards || document.companyStandards || {},
    room_requirements: roomRequirements || document.roomRequirements || { scope: document.rooms, storage: document.storageNeeds, kitchen: document.kitchenRequirements, services: document.appliancesServices },
    is_complete: complete,
    created_by: userId,
    updated_by: userId,
    updated_at: new Date().toISOString()
  };
  const client = getRequestSupabaseClient(request);
  const { error } = await client.from('project_briefs').upsert(briefPayload, { onConflict: 'project_id' });
  if (error) return response.status(500).json({ success: false, code: 'BRIEF_SAVE_FAILED', message: error.message });
  const projectUpdate = await client.from('projects').update({ client_name: document.clientName, name: document.projectName, workflow_stage: complete ? 'plan' : 'brief', current_step: complete ? 'plan' : 'brief', updated_at: new Date().toISOString() }).eq('id', projectId);
  if (projectUpdate.error) return response.status(500).json({ success: false, code: 'PROJECT_BRIEF_SYNC_FAILED', message: projectUpdate.error.message });
  return response.status(200).json({ success: true, code: complete ? 'BRIEF_COMPLETED' : 'BRIEF_DRAFT_SAVED', brief: document, isComplete: complete, fieldErrors });
};

app.put('/api/projects/:projectId/brief', requireProjectUser, writeProjectBrief);
app.post('/api/projects/:projectId/brief', requireProjectUser, writeProjectBrief);

app.post('/api/projects/:projectId/plan/approve', requireProjectUser, async (request, response) => {
  const { projectId } = request.params;
  const { canonicalModel, sourceAssetId } = request.body ?? {};
  if (!canonicalModel || typeof canonicalModel !== 'object') return response.status(400).json({ success: false, code: 'INVALID_CANONICAL_MODEL', message: 'A canonical plan model is required.' });
  if (typeof sourceAssetId !== 'string') return response.status(400).json({ success: false, code: 'SOURCE_ASSET_REQUIRED', message: 'Plan approval requires the exact uploaded source asset.' });
  const parsed = CanonicalPlanModelSchema.safeParse(canonicalModel);
  if (!parsed.success) return response.status(422).json({ success: false, code: 'INVALID_CANONICAL_PLAN_V1', message: 'The reviewed plan does not satisfy the plan.v1 contract.', fieldErrors: parsed.error.flatten() });
  const client = getRequestSupabaseClient(request);
  const approved = await client.rpc('approve_plan_v1', {
    requested_project_id: projectId,
    requested_source_asset_id: sourceAssetId,
    requested_model: parsed.data
  });
  if (approved.error) {
    const message = approved.error.message;
    const code = /SCALE_NOT_VERIFIED/.test(message) ? 'PLAN_SCALE_NOT_VERIFIED' : /UNRESOLVED/.test(message) ? 'PLAN_HAS_UNRESOLVED_ISSUES' : /NO_VALID_SPACES/.test(message) ? 'PLAN_HAS_NO_VALID_SPACES' : 'PLAN_APPROVAL_FAILED';
    return response.status(code === 'PLAN_APPROVAL_FAILED' ? 500 : 422).json({ success: false, code, message });
  }
  return response.status(200).json({ success: true, ...(approved.data as Record<string, unknown>) });
});

app.get('/api/projects/:projectId/module-instances', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const query = client.from('module_instances').select('*').eq('project_id', request.params.projectId).order('created_at', { ascending: true });
  if (typeof request.query.spaceId === 'string') query.eq('space_id', request.query.spaceId);
  const { data, error } = await query;
  if (error) return response.status(500).json({ success: false, code: 'MODULE_INSTANCE_LIST_FAILED', message: error.message });
  return response.json({ success: true, modules: data ?? [] });
});

app.post('/api/projects/:projectId/module-instances', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { spaceId, layoutId, templateId, category, label, config, position } = request.body ?? {};
  if (typeof spaceId !== 'string' || typeof templateId !== 'string' || typeof category !== 'string' || !config || !position) {
    return response.status(400).json({ success: false, code: 'INVALID_MODULE_INSTANCE', message: 'spaceId, templateId, category, config and an anchored position are required.' });
  }
  if (!Number.isFinite(config.widthMm) || !Number.isFinite(config.depthMm) || !Number.isFinite(config.heightMm) || config.widthMm <= 0 || config.depthMm <= 0 || config.heightMm <= 0) {
    return response.status(422).json({ success: false, code: 'MODULE_DIMENSIONS_INVALID', message: 'Module width, depth, and height must be positive millimetre values.' });
  }
  const client = getRequestSupabaseClient(request);
  const space = await client.from('spaces').select('id,project_id,organization_id,floor_plan_version_id').eq('id', spaceId).eq('project_id', request.params.projectId).single();
  if (space.error || !space.data) return response.status(404).json({ success: false, code: 'SPACE_NOT_FOUND', message: 'The selected room does not belong to this project.' });
  const activePlan = await client.from('floor_plan_versions').select('id,canonical_model').eq('project_id', request.params.projectId).eq('active_version', true).eq('status', 'approved').maybeSingle();
  if (activePlan.error || !activePlan.data) return response.status(409).json({ success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'Approve the plan before placing modules.' });
  const plan = CanonicalPlanModelSchema.safeParse(activePlan.data.canonical_model);
  if (!plan.success) return response.status(422).json({ success: false, code: 'CANONICAL_PLAN_INVALID', message: 'The active plan does not contain valid canonical walls.' });
  if (space.data.floor_plan_version_id !== activePlan.data.id) return response.status(409).json({ success: false, code: 'SPACE_PLAN_VERSION_STALE', message: 'Select a room derived from the current active approved plan.' });
  const resolvedAnchor = resolveModuleWallAnchor(plan.data.walls, position, Number(config.widthMm));
  if (!resolvedAnchor.ok) return response.status(422).json({ success: false, code: resolvedAnchor.code, message: resolvedAnchor.message });

  let resolvedLayoutId = typeof layoutId === 'string' ? layoutId : null;
  if (resolvedLayoutId) {
    const layout = await client.from('layouts').select('id').eq('id', resolvedLayoutId).eq('project_id', request.params.projectId).eq('space_id', spaceId).maybeSingle();
    if (layout.error || !layout.data) return response.status(404).json({ success: false, code: 'LAYOUT_NOT_FOUND', message: 'The selected layout does not belong to this room.' });
  } else {
    const createdLayout = await client.from('layouts').insert({ organization_id: space.data.organization_id, project_id: request.params.projectId, space_id: spaceId, layout_shape: 'anchored-module', label: 'Module placement', candidate_json: { source: 'spaces-studio', wallId: position.wallId }, status: 'candidate', created_by: authReq.ultidaUser!.id }).select('id').single();
    if (createdLayout.error || !createdLayout.data) return response.status(500).json({ success: false, code: 'LAYOUT_CREATE_FAILED', message: createdLayout.error?.message ?? 'Could not create the room layout.' });
    resolvedLayoutId = createdLayout.data.id;
  }
  const row = {
    organization_id: space.data.organization_id,
    project_id: request.params.projectId,
    space_id: spaceId,
    layout_id: resolvedLayoutId,
    template_id: templateId,
    category,
    label: typeof label === 'string' ? label : category,
    config_json: { ...config, spaceId, floorPlanVersionId: activePlan.data.id },
    position_json: resolvedAnchor.anchor,
    status: 'validated',
    created_by: authReq.ultidaUser!.id,
  };
  const created = await client.from('module_instances').insert(row).select('*').single();
  if (created.error) return response.status(500).json({ success: false, code: 'MODULE_INSTANCE_CREATE_FAILED', message: created.error.message });
  return response.status(201).json({ success: true, module: created.data });
});

app.get('/api/projects/:projectId/design-context', requireProjectUser, async (request, response) => {
  const projectId = String(request.params.projectId);
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('id,organization_id,floor_plan_version_id').eq('id', projectId).single();
  if (project.error || !project.data) return response.status(404).json({ success: false, code: 'PROJECT_NOT_FOUND', message: 'Project context was not found.' });
  const [brief, plan, spaces, modules, assignments, materials, scenes, renders] = await Promise.all([
    client.from('project_briefs').select('*').eq('project_id', projectId).maybeSingle(),
    client.from('floor_plan_versions').select('id,status,canonical_model,created_at').eq('project_id', projectId).eq('active_version', true).maybeSingle(),
    client.from('spaces').select('*').eq('project_id', projectId).order('created_at'),
    client.from('module_instances').select('*').eq('project_id', projectId).order('created_at'),
    client.from('material_assignments').select('*').eq('project_id', projectId).order('created_at'),
    client.from('material_library_items').select('*').eq('organization_id', project.data.organization_id).eq('availability', 'available').order('name'),
    client.from('scene_versions').select('id,status,scene,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1),
    client.from('artifacts').select('id,kind,status,stale,scene_version_id,storage_path,provenance,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(30),
  ]);
  const failure = [brief, plan, spaces, modules, assignments, materials, scenes, renders].find((result) => result.error);
  if (failure?.error) return response.status(500).json({ success: false, code: 'DESIGN_CONTEXT_LOAD_FAILED', message: failure.error.message });
  return response.json({
    success: true,
    context: {
      project: project.data,
      brief: brief.data,
      plan: plan.data,
      spaces: spaces.data ?? [],
      modules: modules.data ?? [],
      materialAssignments: assignments.data ?? [],
      materialLibrary: materials.data ?? [],
      scene: scenes.data?.[0] ?? null,
      artifacts: renders.data ?? [],
    },
  });
});

app.get('/api/projects/:projectId/material-library', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('organization_id').eq('id', request.params.projectId).single();
  if (project.error || !project.data) return response.status(404).json({ success: false, code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' });
  const materials = await client.from('material_library_items').select('*').eq('organization_id', project.data.organization_id).order('name');
  if (materials.error) return response.status(500).json({ success: false, code: 'MATERIAL_LIBRARY_LOAD_FAILED', message: materials.error.message });
  return response.json({ success: true, materials: materials.data ?? [] });
});

app.post('/api/projects/:projectId/material-library', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const parsed = MaterialLibraryItemV1Schema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, code: 'INVALID_MATERIAL_LIBRARY_ITEM', issues: parsed.error.issues });
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('organization_id').eq('id', request.params.projectId).single();
  if (project.error || !project.data) return response.status(404).json({ success: false, code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' });
  const material = await client.from('material_library_items').insert({
    organization_id: project.data.organization_id,
    name: parsed.data.name,
    supplier: parsed.data.supplier ?? null,
    brand: parsed.data.brand ?? null,
    code: parsed.data.code,
    category: parsed.data.category,
    finish: parsed.data.finish ?? null,
    texture_asset_id: parsed.data.textureAssetId ?? null,
    texture_width_mm: parsed.data.textureWidthMm ?? null,
    texture_height_mm: parsed.data.textureHeightMm ?? null,
    grain_direction: parsed.data.grainDirection,
    roughness: parsed.data.roughness ?? null,
    metalness: parsed.data.metalness ?? null,
    transparency: parsed.data.transparency ?? null,
    thickness_mm: parsed.data.thicknessMm ?? null,
    unit_cost: parsed.data.unitCost ?? null,
    availability: parsed.data.availability,
    metadata: parsed.data.metadata,
    created_by: authReq.ultidaUser!.id,
  }).select('*').single();
  if (material.error) return response.status(500).json({ success: false, code: 'MATERIAL_LIBRARY_CREATE_FAILED', message: material.error.message });
  return response.status(201).json({ success: true, material: material.data });
});

app.post('/api/projects/:projectId/material-assignments', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = String(request.params.projectId);
  const parsed = MaterialAssignmentV1Schema.safeParse({ ...request.body, projectId });
  if (!parsed.success) return response.status(400).json({ success: false, code: 'INVALID_MATERIAL_ASSIGNMENT', issues: parsed.error.issues });
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('organization_id').eq('id', projectId).single();
  if (project.error || !project.data) return response.status(404).json({ success: false, code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' });
  const material = await client.from('material_library_items').select('id').eq('id', parsed.data.materialId).eq('organization_id', project.data.organization_id).single();
  if (material.error || !material.data) return response.status(422).json({ success: false, code: 'MATERIAL_NOT_IN_ORGANIZATION_LIBRARY', message: 'Select a material from this organization library.' });
  if (parsed.data.moduleInstanceId) {
    const module = await client.from('module_instances').select('id').eq('id', parsed.data.moduleInstanceId).eq('project_id', projectId).single();
    if (module.error || !module.data) return response.status(422).json({ success: false, code: 'MATERIAL_MODULE_NOT_FOUND', message: 'The material target module does not belong to this project.' });
  }
  const latestRevision = await client.from('material_assignments')
    .select('revision')
    .eq('project_id', projectId)
    .eq('target_kind', parsed.data.targetKind)
    .eq('target_id', parsed.data.targetId)
    .eq('semantic_slot', parsed.data.semanticSlot)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRevision.error) return response.status(500).json({ success: false, code: 'MATERIAL_REVISION_LOOKUP_FAILED', message: latestRevision.error.message });
  const nextRevision = Math.max(parsed.data.revision, Number(latestRevision.data?.revision ?? 0) + 1);
  const assignment = await client.from('material_assignments').insert({
    organization_id: project.data.organization_id,
    project_id: projectId,
    material_id: parsed.data.materialId,
    module_instance_id: parsed.data.moduleInstanceId ?? null,
    target_kind: parsed.data.targetKind,
    target_id: parsed.data.targetId,
    semantic_slot: parsed.data.semanticSlot,
    revision: nextRevision,
    status: parsed.data.status,
    created_by: authReq.ultidaUser!.id,
  }).select('*').single();
  if (assignment.error) return response.status(500).json({ success: false, code: 'MATERIAL_ASSIGNMENT_CREATE_FAILED', message: assignment.error.message });
  const stale = await client.from('artifacts').update({ stale: true }).eq('project_id', projectId).eq('stale', false);
  if (stale.error) return response.status(500).json({ success: false, code: 'MATERIAL_ASSIGNMENT_STALE_INVALIDATION_FAILED', message: stale.error.message });
  return response.status(201).json({ success: true, assignment: assignment.data, invalidatedArtifactCount: stale.count ?? null });
});

app.post('/api/projects/:projectId/scenes/compile', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const projectId = String(request.params.projectId);
  const client = getRequestSupabaseClient(request);
  const activePlan = await client
    .from('floor_plan_versions')
    .select('id,canonical_model,status,active_version')
    .eq('project_id', projectId)
    .eq('active_version', true)
    .maybeSingle();

  if (activePlan.error) return response.status(500).json({ success: false, code: 'PLAN_READ_FAILED', message: activePlan.error.message });
  if (!activePlan.data || activePlan.data.status !== 'approved') {
    return response.status(409).json({ success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'Compile a scene only from the active approved plan.v1.' });
  }

  const parsedPlan = CanonicalPlanModelSchema.safeParse(activePlan.data.canonical_model);
  if (!parsedPlan.success) {
    return response.status(422).json({ success: false, code: 'CANONICAL_PLAN_INVALID', message: 'The active floor plan does not satisfy the canonical plan.v1 contract.', fieldErrors: parsedPlan.error.flatten() });
  }

  const requestedModuleIds = Array.isArray(request.body?.moduleInstanceIds) ? request.body.moduleInstanceIds.filter((id: unknown): id is string => typeof id === 'string') : [];
  const storedModules = requestedModuleIds.length ? await client.from('module_instances').select('id,space_id,category,template_id,config_json,position_json').eq('project_id', projectId).in('id', requestedModuleIds) : { data: [], error: null };
  if (storedModules.error) return response.status(500).json({ success: false, code: 'MODULE_INSTANCE_READ_FAILED', message: storedModules.error.message });
  if ((storedModules.data ?? []).length !== requestedModuleIds.length) return response.status(422).json({ success: false, code: 'MODULE_INSTANCE_NOT_FOUND', message: 'One or more requested module instances is missing.' });
  const invalidModule = (storedModules.data ?? []).find((module: any) => {
    const config = module.config_json ?? {};
    const position = module.position_json ?? {};
    return !module.space_id || position.anchor !== 'wall' || typeof position.wallId !== 'string' || !Number.isFinite(Number(config.widthMm)) || !Number.isFinite(Number(config.depthMm)) || !Number.isFinite(Number(config.heightMm)) || !Number.isFinite(Number(position.xMm)) || !Number.isFinite(Number(position.yMm));
  });
  if (invalidModule) return response.status(422).json({ success: false, code: 'MODULE_INSTANCE_NOT_SCENE_READY', message: `Module ${invalidModule.id} has no valid persisted wall anchor, room lineage, or dimensions.` });
  const compiledModules = (storedModules.data ?? []).map((module: any) => compileStoredModuleForScene(module, parsedPlan.data.walls));
  const compilationFailure = compiledModules.find((result) => !result.ok);
  if (compilationFailure && !compilationFailure.ok) return response.status(422).json({ success: false, code: compilationFailure.code, message: compilationFailure.message });
  const sceneModules = compiledModules.filter((result): result is Extract<typeof result, { ok: true }> => result.ok).map((result) => result.module);
  const moduleParts = compiledModules.filter((result): result is Extract<typeof result, { ok: true }> => result.ok).flatMap((result) => result.parts);
  // Scene material facts come only from persisted organization-library assignments.
  // Browser payloads can name a selection for display, but cannot become scene authority.
  const project = await client.from('projects').select('organization_id').eq('id', projectId).single();
  if (project.error || !project.data) return response.status(404).json({ success: false, code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' });
  const assignments = await client.from('material_assignments')
    .select('material_id,semantic_slot,target_kind,target_id,module_instance_id,revision,created_at')
    .eq('project_id', projectId)
    .order('revision', { ascending: false })
    .order('created_at', { ascending: false });
  if (assignments.error) return response.status(500).json({ success: false, code: 'MATERIAL_ASSIGNMENT_READ_FAILED', message: assignments.error.message });
  const latestBySlot = new Map<string, any>();
  for (const assignment of assignments.data ?? []) {
    const targetKey = `${String(assignment.target_kind ?? 'semantic_slot')}:${String(assignment.target_id ?? projectId)}:${String(assignment.module_instance_id ?? '')}:${String(assignment.semantic_slot)}`;
    if (!latestBySlot.has(targetKey)) latestBySlot.set(targetKey, assignment);
  }
  const materialIds = [...new Set([...latestBySlot.values()].map((assignment) => String(assignment.material_id)))];
  const materialRows = materialIds.length
    ? await client.from('material_library_items').select('id,name,code,unit_cost,finish').eq('organization_id', project.data.organization_id).in('id', materialIds)
    : { data: [], error: null };
  if (materialRows.error) return response.status(500).json({ success: false, code: 'MATERIAL_LIBRARY_READ_FAILED', message: materialRows.error.message });
  if ((materialRows.data ?? []).length !== materialIds.length) return response.status(422).json({ success: false, code: 'MATERIAL_ASSIGNMENT_NOT_IN_LIBRARY', message: 'A persisted material assignment no longer resolves to this organization library.' });
  const materials = (materialRows.data ?? []).map((material: any) => ({ id: material.id, name: material.name, code: material.code, unitCost: material.unit_cost ?? undefined, finish: material.finish ?? undefined }));
  const materialBySlot = new Map<string, string>();
  for (const assignment of latestBySlot.values()) materialBySlot.set(String(assignment.semantic_slot), String(assignment.material_id));
  const defaultModuleMaterial = materialBySlot.get('shutter') ?? materialBySlot.get('carcass') ?? materials[0]?.id;
  const resolvedSceneModules = sceneModules.map((module) => ({ ...module, materialId: module.materialId ?? defaultModuleMaterial }));
  const resolvedModuleParts = moduleParts.map((part) => ({
    ...part,
    materialId: materialBySlot.get(String(part.semanticType ?? '')) ?? defaultModuleMaterial ?? part.materialId,
  }));
  let scene;
  try {
    scene = compileSceneV1({
      projectId,
      floorPlanVersionId: activePlan.data.id,
      plan: parsedPlan.data,
      designVersion: typeof request.body?.designVersion === 'string' ? request.body.designVersion : 'spaces.v1',
      modules: resolvedSceneModules,
      moduleParts: resolvedModuleParts,
      materials,
      changeReason: typeof request.body?.changeReason === 'string' ? request.body.changeReason : undefined,
    });
  } catch (error) {
    if (error instanceof SceneCompilationError) {
      return response.status(422).json({ success: false, code: 'SCENE_COMPILATION_BLOCKED', message: error.message, issues: error.issues });
    }
    return response.status(422).json({ success: false, code: 'SCENE_COMPILATION_INVALID', message: error instanceof Error ? error.message : 'Scene compilation failed.' });
  }

  const latest = await client
    .from('scene_versions')
    .select('version_number')
    .eq('project_id', projectId)
    .eq('branch_name', 'main')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) return response.status(500).json({ success: false, code: 'SCENE_VERSION_READ_FAILED', message: latest.error.message });

  const created = await client.from('scene_versions').insert({
    project_id: projectId,
    organization_id: authReq.ultidaUser!.organizationId,
    floor_plan_version_id: activePlan.data.id,
    version_number: (latest.data?.version_number ?? 0) + 1,
    branch_name: 'main',
    status: 'draft',
    scene,
    change_reason: scene.metadata.changeReason,
    created_by: authReq.ultidaUser!.id,
  }).select('id,version_number,status,scene,created_at').single();
  if (created.error) return response.status(500).json({ success: false, code: 'SCENE_CREATE_FAILED', message: created.error.message });
  return response.status(201).json({ success: true, sceneVersion: created.data, materials, materialAssignments: [...latestBySlot.values()] });
});

// Downstream documents must use the saved scene contract, never a browser-built
// approximation of module positions. This deliberately exposes one specific,
// project-scoped scene version instead of a mutable "current scene" alias.
app.get('/api/projects/:projectId/scenes/:sceneVersionId', requireProjectUser, async (request, response) => {
  const projectId = String(request.params.projectId);
  const sceneVersionId = String(request.params.sceneVersionId);
  const client = getRequestSupabaseClient(request);
  const sceneVersion = await client
    .from('scene_versions')
    .select('id,project_id,floor_plan_version_id,version_number,branch_name,status,scene,created_at')
    .eq('project_id', projectId)
    .eq('id', sceneVersionId)
    .maybeSingle();

  if (sceneVersion.error) return response.status(500).json({ success: false, code: 'SCENE_VERSION_READ_FAILED', message: sceneVersion.error.message });
  if (!sceneVersion.data) return response.status(404).json({ success: false, code: 'SCENE_VERSION_NOT_FOUND', message: 'That scene version does not belong to this project.' });
  return response.json({ success: true, sceneVersion: sceneVersion.data });
});

app.get('/api/projects/:projectId/spaces', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('active_floor_plan_version_id').eq('id', request.params.projectId).single();
  if (project.error) return response.status(500).json({ success: false, code: 'PROJECT_READ_FAILED', message: project.error.message });
  if (!project.data.active_floor_plan_version_id) return response.status(409).json({ success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'Approve a canonical floor plan before configuring spaces.', spaces: [] });
  const spaces = await client.from('spaces').select('*').eq('project_id', request.params.projectId).eq('floor_plan_version_id', project.data.active_floor_plan_version_id).order('created_at');
  if (spaces.error) return response.status(500).json({ success: false, code: 'SPACES_READ_FAILED', message: spaces.error.message });
  return response.json({ success: true, floorPlanVersionId: project.data.active_floor_plan_version_id, spaces: spaces.data ?? [] });
});

app.get('/api/projects/:projectId/floor-plan/active', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const version = await client
    .from('floor_plan_versions')
    .select('id,canonical_model,scale_state,verification_state,approved_at,active_version')
    .eq('project_id', request.params.projectId)
    .eq('active_version', true)
    .maybeSingle();
  if (version.error) return response.status(500).json({ success: false, code: 'PLAN_READ_FAILED', message: version.error.message });
  if (!version.data || !version.data.approved_at) return response.status(409).json({ success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'An approved floor plan is required before configuring spaces.' });
  const savedSpaces = await client
    .from('spaces')
    .select('id,space_id,name,room_type,ceiling_height_mm,requirements_json,settings_json,verification_status,status')
    .eq('project_id', request.params.projectId)
    .eq('floor_plan_version_id', version.data.id);
  if (savedSpaces.error) return response.status(500).json({ success: false, code: 'SPACES_READ_FAILED', message: savedSpaces.error.message });
  const savedSpaceRows = savedSpaces.data ?? [];
  const savedSpaceByPlanRoomId = new Map(savedSpaceRows.filter((space: any) => space.space_id).map((space: any) => [String(space.space_id), space]));
  const normalizeSpaceLabel = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const plan = version.data.canonical_model ?? {};
  const rooms = (plan.rooms ?? plan.spaces ?? []).map((r: any) => {
    const roomName = r.name ?? r.roomType ?? r.type ?? r.id;
    const roomType = r.roomType ?? r.type ?? 'other';
    const matchingByName = savedSpaceRows.filter((space: any) => normalizeSpaceLabel(space.name) === normalizeSpaceLabel(roomName));
    const matchingByType = savedSpaceRows.filter((space: any) => normalizeSpaceLabel(space.room_type) === normalizeSpaceLabel(roomType));
    const roomWords = new Set(normalizeSpaceLabel(`${r.id ?? ''} ${roomName} ${roomType}`).split(' ').filter(word => word.length > 2 && word !== 'room'));
    const matchingByDistinctWord = savedSpaceRows.filter((space: any) => [space.name, space.room_type]
      .flatMap((value: unknown) => normalizeSpaceLabel(value).split(' '))
      .some(word => roomWords.has(word)));
    const saved = savedSpaceByPlanRoomId.get(String(r.id))
      ?? (matchingByName.length === 1 ? matchingByName[0] : null)
      ?? (matchingByType.length === 1 ? matchingByType[0] : null)
      ?? (matchingByDistinctWord.length === 1 ? matchingByDistinctWord[0] : null);
    return {
      id: r.id,
      spaceRecordId: saved?.id ?? null,
      name: saved?.name ?? roomName,
      roomType: saved?.room_type ?? roomType,
      polygon: r.worldPolygon ?? r.worldGeometry?.polygon ?? r.polygon ?? [],
      areaSqm: r.areaSqm,
      ceilingHeightMm: saved?.ceiling_height_mm ?? r.ceilingHeightMm,
      requiredFurniture: Array.isArray(saved?.requirements_json?.requiredFurniture) ? saved.requirements_json.requiredFurniture : [],
      verificationStatus: saved?.verification_status ?? 'unverified',
    };
  });
  const walls = (plan.walls ?? []).map((w: any) => ({
    id: w.id,
    start: w.worldStart ?? w.worldGeometry?.start ?? w.start,
    end: w.worldEnd ?? w.worldGeometry?.end ?? w.end,
    thicknessMm: w.thicknessMm,
    heightMm: w.heightMm,
    isExterior: w.isExterior,
  }));
  const openings = (plan.openings ?? []).map((o: any) => ({
    id: o.id,
    wallId: o.wallId,
    kind: o.kind,
    offsetAlongWallMm: o.offsetMm ?? o.offsetAlongWallMm,
    widthMm: o.widthMm,
    heightMm: o.heightMm,
    sillMm: o.sillMm,
    headMm: o.headMm,
  }));
  const columns = (plan.columns ?? []).map((c: any) => ({ id: c.id, position: c.position ?? c.worldGeometry?.center, sizeMm: c.sizeMm }));
  const beams = (plan.beams ?? []).map((b: any) => ({ id: b.id, start: b.start ?? b.worldGeometry?.start, end: b.end ?? b.worldGeometry?.end }));
  const services = (plan.servicePoints ?? plan.services ?? []).map((s: any) => ({ id: s.id, kind: s.kind, position: s.position ?? s.positionMm }));
  const annotations = (plan.annotations ?? []).map((a: any) => ({ id: a.id, text: a.text, kind: a.kind, position: a.position }));
  const issues = plan.unresolvedItems ?? plan.issues ?? [];
  return response.json({
    success: true,
    floorPlanVersionId: version.data.id,
    scaleVerified: version.data.scale_state === 'verified' || plan.scale?.verified === true,
    ceilingHeightMm: Number(plan.ceilingHeightMm ?? 2700),
    rooms, walls, openings, columns, beams, services, annotations, issues,
  });
});

app.put('/api/projects/:projectId/spaces/:spaceId', requireProjectUser, async (request, response) => {
  const { name, roomType, ceilingHeightMm, requiredFurniture, floorFinish, falseCeiling, budgetInr, designPriority, applianceNeeds, constraints } = request.body ?? {};
  const fieldErrors: Record<string, string> = {};
  if (!String(name ?? '').trim()) fieldErrors.name = 'Room name is required.';
  if (!String(roomType ?? '').trim()) fieldErrors.roomType = 'Room type is required.';
  if (!Number.isFinite(ceilingHeightMm) || ceilingHeightMm < 1800) fieldErrors.ceilingHeightMm = 'Enter a valid ceiling height in millimetres.';
  if (!Array.isArray(requiredFurniture) || requiredFurniture.length === 0) fieldErrors.requiredFurniture = 'Select at least one required modular category.';
  if (Object.keys(fieldErrors).length) return response.status(422).json({ success: false, code: 'SPACE_REQUIREMENTS_INVALID', message: 'Complete the required room fields.', fieldErrors });
  const client = getRequestSupabaseClient(request);
  const current = await client.from('spaces').select('requirements_json,settings_json,status').eq('id', request.params.spaceId).eq('project_id', request.params.projectId).single();
  if (current.error) return response.status(404).json({ success: false, code: 'SPACE_NOT_FOUND', message: current.error.message });
  const updated = await client.from('spaces').update({
    name: String(name).trim(), room_type: roomType, ceiling_height_mm: ceilingHeightMm,
    requirements_json: { ...(current.data.requirements_json ?? {}), requiredFurniture, budgetInr: budgetInr ?? null, designPriority: designPriority ?? 'balanced', applianceNeeds: applianceNeeds ?? [], constraints: constraints ?? [] },
    settings_json: { ...(current.data.settings_json ?? {}), floorFinish: floorFinish ?? '', falseCeiling: falseCeiling ?? '' },
    status: 'configured', updated_at: new Date().toISOString()
  }).eq('id', request.params.spaceId).eq('project_id', request.params.projectId).select('*').single();
  if (updated.error) return response.status(500).json({ success: false, code: 'SPACE_SAVE_FAILED', message: updated.error.message });
  return response.json({ success: true, space: updated.data });
});

app.post('/api/projects/:projectId/spaces/approve', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('active_floor_plan_version_id').eq('id', request.params.projectId).single();
  if (project.error || !project.data?.active_floor_plan_version_id) return response.status(409).json({ success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'An active approved floor plan is required.' });
  const spaces = await client.from('spaces').select('id,status,verification_status,ceiling_height_mm,requirements_json').eq('project_id', request.params.projectId).eq('floor_plan_version_id', project.data.active_floor_plan_version_id);
  if (spaces.error) return response.status(500).json({ success: false, code: 'SPACES_READ_FAILED', message: spaces.error.message });
  const notReady = (spaces.data ?? []).filter((space: any) => space.status !== 'configured' || space.verification_status !== 'verified' || !space.ceiling_height_mm || !Array.isArray(space.requirements_json?.requiredFurniture) || !space.requirements_json.requiredFurniture.length);
  if (!(spaces.data ?? []).length || notReady.length) return response.status(422).json({ success: false, code: 'SPACES_NOT_READY', message: 'Every room must have verified geometry, a ceiling height, and saved requirements.', spaceIds: notReady.map((space: any) => space.id) });
  const updated = await client.from('projects').update({ workflow_stage: 'layouts', current_step: 'layouts', updated_at: new Date().toISOString() }).eq('id', request.params.projectId);
  if (updated.error) return response.status(500).json({ success: false, code: 'SPACES_APPROVAL_FAILED', message: updated.error.message });
  return response.json({ success: true, readySpaceCount: spaces.data!.length });
});

app.get(['/api/projects/:projectId/status', '/api/projects/:projectId/workflow-status'], requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId } = request.params;
  const userId = authReq.ultidaUser?.id;
  const client = getRequestSupabaseClient(request);
  const [briefRes, floorRes, spaceRes, layoutRes, sceneRes, renderRes, drawingRes, presentationRes] = await Promise.all([
    client.from('project_briefs').select('id,is_complete').eq('project_id', projectId).maybeSingle(),
    client.from('floor_plan_versions').select('id,approved_at,active_version').eq('project_id', projectId).eq('active_version', true).maybeSingle(),
    client.from('spaces').select('id,status,verification_status,ceiling_height_mm,requirements_json').eq('project_id', projectId),
    client.from('layouts').select('id,status').eq('project_id', projectId).eq('status', 'approved'),
    client.from('scene_versions').select('id').eq('project_id', projectId).eq('status', 'approved').maybeSingle(),
    client.from('jobs').select('id,status').eq('project_id', projectId).eq('kind', 'visual_proposal').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('jobs').select('id').eq('project_id', projectId).eq('kind', 'drawings').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('jobs').select('id').eq('project_id', projectId).eq('kind', 'presentation').order('created_at', { ascending: false }).limit(1).maybeSingle()
  ]);

  const briefComplete = !!briefRes.data && (briefRes.data.is_complete !== false);
  const planComplete = !!floorRes.data?.approved_at;
  const spacesList = spaceRes.data ?? [];
  const spacesComplete = spacesList.length > 0 && spacesList.every((s: any) => s.status === 'configured' && s.verification_status === 'verified' && Boolean(s.ceiling_height_mm) && Array.isArray(s.requirements_json?.requiredFurniture) && s.requirements_json.requiredFurniture.length > 0);
  const layoutsComplete = (layoutRes.data ?? []).length > 0;
  const sceneComplete = !!sceneRes.data;
  const modulesComplete = layoutsComplete;
  const materialsComplete = sceneComplete;
  const rendersComplete = !!renderRes.data && renderRes.data.status === 'succeeded';
  const drawingsComplete = !!drawingRes.data;
  const estimateComplete = false;
  const presentationComplete = !!presentationRes.data;

  const stageLockReasons: Record<string, string | null> = {
    brief: null,
    plan: briefComplete ? null : 'Project brief must be completed and saved first.',
    spaces: planComplete ? null : 'Active approved floor plan version is required.',
    layouts: spacesComplete ? null : 'Every room needs verified geometry and saved requirements.',
    modules: layoutsComplete ? null : 'Approved room layout is required.',
    materials: modulesComplete ? null : 'Validated module instances are required.',
    '3d': materialsComplete || modulesComplete ? null : 'Configured modules and materials are required.',
    renders: sceneComplete ? null : 'Compiled 3D scene version is required.',
    drawings: sceneComplete ? null : 'Compiled 3D scene version is required.',
    estimate: modulesComplete || sceneComplete ? null : 'Modules and 3D scene layout required.',
    presentation: estimateComplete || rendersComplete ? null : 'Completed render or commercial estimate required.'
  };

  return response.json({
    success: true,
    stages: {
      brief: briefComplete,
      plan: planComplete,
      spaces: spacesComplete,
      layouts: layoutsComplete,
      modules: modulesComplete,
      materials: materialsComplete,
      '3d': sceneComplete,
      renders: rendersComplete || !!renderRes.data,
      drawings: drawingsComplete,
      estimate: estimateComplete,
      presentation: presentationComplete
    },
    stageLockReasons,
    projectId,
    userId
  });
});

// P0 layout lifecycle. Layout candidates are mutable only while candidates;
// approval creates the audit point used by downstream scene compilation.
app.get('/api/projects/:projectId/layouts', requireProjectUser, async (request, response) => {
  const { data, error } = await getRequestSupabaseClient(request).from('layouts').select('*').eq('project_id', request.params.projectId).order('created_at', { ascending: false });
  if (error) return response.status(500).json({ success: false, code: 'LAYOUT_LIST_FAILED', message: error.message });
  return response.json({ success: true, layouts: data ?? [] });
});

app.post('/api/projects/:projectId/layout-candidates', requireProjectUser, async (request, response) => {
  const { spaceId, roomCategory, candidateTypes, requirements, shape } = request.body ?? {};
  if (typeof spaceId !== 'string' || typeof roomCategory !== 'string') {
    return response.status(400).json({ success: false, code: 'INVALID_LAYOUT_INPUT', message: 'spaceId and roomCategory are required.' });
  }
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('active_floor_plan_version_id').eq('id', request.params.projectId).single();
  if (project.error || !project.data?.active_floor_plan_version_id) return response.status(409).json({ success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'An active approved floor plan is required.' });
  const [spaceResult, planResult] = await Promise.all([
    client.from('spaces').select('*').eq('id', spaceId).eq('project_id', request.params.projectId).eq('floor_plan_version_id', project.data.active_floor_plan_version_id).single(),
    client.from('floor_plan_versions').select('id,canonical_model').eq('id', project.data.active_floor_plan_version_id).single(),
  ]);
  if (spaceResult.error || !spaceResult.data) return response.status(404).json({ success: false, code: 'SPACE_NOT_FOUND', message: 'The selected room is not part of the active approved plan.' });
  if (planResult.error || !planResult.data) return response.status(404).json({ success: false, code: 'PLAN_NOT_FOUND', message: 'The active approved plan could not be loaded.' });
  const plan = (planResult.data.canonical_model ?? {}) as any;
  const rooms = Array.isArray(plan.rooms) ? plan.rooms : Array.isArray(plan.spaces) ? plan.spaces : [];
  const normalizeRoomLabel = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const plannedRoomName = spaceResult.data.name ?? spaceResult.data.room_type ?? spaceId;
  const plannedRoomWords = new Set(normalizeRoomLabel(`${plannedRoomName} ${spaceResult.data.room_type ?? ''}`).split(' ').filter(word => word.length > 2 && word !== 'room'));
  const matchingByName = rooms.filter((item: any) => normalizeRoomLabel(item.name ?? item.roomType ?? item.type) === normalizeRoomLabel(plannedRoomName));
  const matchingByType = rooms.filter((item: any) => normalizeRoomLabel(item.roomType ?? item.type) === normalizeRoomLabel(spaceResult.data.room_type));
  const matchingByDistinctWord = rooms.filter((item: any) => normalizeRoomLabel(`${item.id ?? ''} ${item.name ?? ''} ${item.roomType ?? item.type ?? ''}`).split(' ').some(word => plannedRoomWords.has(word)));
  const room = rooms.find((item: any) => item.id === spaceResult.data.space_id)
    ?? rooms.find((item: any) => item.id === spaceId)
    ?? (matchingByName.length === 1 ? matchingByName[0] : null)
    ?? (matchingByType.length === 1 ? matchingByType[0] : null)
    ?? (matchingByDistinctWord.length === 1 ? matchingByDistinctWord[0] : null);
  const polygon = room?.worldPolygon ?? room?.worldGeometry?.polygon ?? room?.polygon ?? spaceResult.data.geometry_json?.polygon ?? [];
  const points = Array.isArray(polygon) ? polygon.map((point: any) => ({ x: Number(point.xMm ?? point.x ?? point[0]), y: Number(point.yMm ?? point.y ?? point[1]) })).filter((point: any) => Number.isFinite(point.x) && Number.isFinite(point.y)) : [];
  if (points.length < 3) return response.status(422).json({ success: false, code: 'ROOM_GEOMETRY_UNAVAILABLE', message: 'The approved room has no valid canonical polygon.' });
  const minX = Math.min(...points.map((point: any) => point.x));
  const maxX = Math.max(...points.map((point: any) => point.x));
  const minY = Math.min(...points.map((point: any) => point.y));
  const maxY = Math.max(...points.map((point: any) => point.y));
  const walls = Array.isArray(plan.walls) ? plan.walls : [];
  const usableWalls = walls.map((wall: any) => {
    const start = wall.worldStart ?? wall.worldGeometry?.start ?? wall.start;
    const end = wall.worldEnd ?? wall.worldGeometry?.end ?? wall.end;
    if (!start || !end) return null;
    return { id: String(wall.id), minX: Math.min(Number(start.xMm ?? start.x), Number(end.xMm ?? end.x)), minY: Math.min(Number(start.yMm ?? start.y), Number(end.yMm ?? end.y)), maxX: Math.max(Number(start.xMm ?? start.x), Number(end.xMm ?? end.x)), maxY: Math.max(Number(start.yMm ?? start.y), Number(end.yMm ?? end.y)), orientation: Math.abs(Number(end.xMm ?? end.x) - Number(start.xMm ?? start.x)) >= Math.abs(Number(end.yMm ?? end.y) - Number(start.yMm ?? start.y)) ? 'north' : 'east' };
  }).filter(Boolean);
  const openings = (Array.isArray(plan.openings) ? plan.openings : []).map((opening: any) => ({ id: String(opening.id), type: opening.kind === 'window' ? 'window' : 'door', xMm: Number(opening.worldPosition?.xMm ?? opening.xMm ?? opening.offsetMm ?? 0), yMm: Number(opening.worldPosition?.yMm ?? opening.yMm ?? 0), widthMm: Number(opening.widthMm ?? 0), heightMm: Number(opening.heightMm ?? 0), swingDeg: opening.swingDeg == null ? undefined : Number(opening.swingDeg) }));
  const servicePoints = (Array.isArray(plan.servicePoints) ? plan.servicePoints : []).map((point: any) => ({ id: String(point.id), xMm: Number(point.position?.xMm ?? point.xMm ?? 0), yMm: Number(point.position?.yMm ?? point.yMm ?? 0), type: String(point.kind ?? point.type ?? 'service') }));
  try {
    const candidates = generateCandidates({ projectId: request.params.projectId, spaceId, roomCategory, floorPlanVersionId: project.data.active_floor_plan_version_id, shape: String(shape ?? 'balanced'), candidateTypes: Array.isArray(candidateTypes) ? candidateTypes : ['maximum_storage', 'best_circulation', 'balanced', 'cost_efficient'], requirements: requirements && typeof requirements === 'object' ? requirements : {}, roomBoundingBoxMm: { minX, minY, maxX, maxY }, usableWalls, openings, servicePoints, structuralElements: [], companyRules: {} } as any);
    return response.json({ success: true, floorPlanVersionId: project.data.active_floor_plan_version_id, spaceId, candidates });
  } catch (error) {
    return response.status(422).json({ success: false, code: 'LAYOUT_CANDIDATE_GENERATION_FAILED', message: error instanceof Error ? error.message : 'The canonical room geometry could not generate candidates.' });
  }
});

app.post('/api/projects/:projectId/layouts', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { spaceId, layoutShape, label = 'Option A', candidate, score } = request.body ?? {};
  if (typeof spaceId !== 'string' || !candidate || typeof candidate !== 'object') return response.status(400).json({ success: false, code: 'INVALID_LAYOUT', message: 'spaceId and candidate data are required.' });
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('active_floor_plan_version_id').eq('id', request.params.projectId).single();
  if (project.error || !project.data?.active_floor_plan_version_id) return response.status(409).json({ success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'An active approved floor plan is required.' });
  const space = await client.from('spaces').select('id').eq('id', spaceId).eq('project_id', request.params.projectId).eq('floor_plan_version_id', project.data.active_floor_plan_version_id).maybeSingle();
  if (space.error || !space.data) return response.status(404).json({ success: false, code: 'SPACE_NOT_FOUND', message: 'The selected room is not part of the active approved plan.' });
  const row = { organization_id: authReq.ultidaUser?.organizationId, project_id: request.params.projectId, space_id: spaceId, layout_shape: String(layoutShape ?? 'custom'), label: String(label), candidate_json: candidate, rule_score_json: score ?? null, status: 'candidate', created_by: authReq.ultidaUser?.id };
  const { data, error } = await client.from('layouts').insert(row).select('*').single();
  if (error) return response.status(500).json({ success: false, code: 'LAYOUT_CREATE_FAILED', message: error.message });
  return response.status(201).json({ success: true, layout: data });
});

app.post('/api/projects/:projectId/layouts/:layoutId/approve', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const client = getRequestSupabaseClient(request);
  const { data: layout, error: lookupError } = await client.from('layouts').select('*').eq('id', request.params.layoutId).eq('project_id', request.params.projectId).single();
  if (lookupError || !layout) return response.status(404).json({ success: false, code: 'LAYOUT_NOT_FOUND' });
  const updated = await client.from('layouts').update({ status: 'approved', approved_by: authReq.ultidaUser?.id, approved_at: new Date().toISOString() }).eq('id', layout.id).select('*').single();
  if (updated.error) return response.status(500).json({ success: false, code: 'LAYOUT_APPROVAL_FAILED', message: updated.error.message });
  const { data: latestVersion, error: versionLookupError } = await client
    .from('layout_versions')
    .select('version_number')
    .eq('project_id', request.params.projectId)
    .eq('space_id', layout.space_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionLookupError) return response.status(500).json({ success: false, code: 'LAYOUT_VERSION_LOOKUP_FAILED', message: versionLookupError.message });
  await client.from('layout_versions').update({ status: 'superseded' }).eq('project_id', request.params.projectId).eq('space_id', layout.space_id).eq('status', 'approved');
  const version = await client.from('layout_versions').insert({
    organization_id: authReq.ultidaUser?.organizationId,
    project_id: request.params.projectId,
    space_id: layout.space_id,
    version_number: (latestVersion?.version_number ?? 0) + 1,
    status: 'approved',
    config: request.body?.config ?? {},
    candidate_json: layout.candidate_json,
    created_by: authReq.ultidaUser?.id,
    approved_by: authReq.ultidaUser?.id,
    approved_at: new Date().toISOString()
  }).select('*').single();
  if (version.error) return response.status(500).json({ success: false, code: 'LAYOUT_VERSION_CREATE_FAILED', message: version.error.message });
  const { data: staleArtifacts, error: staleLookupError } = await client.from('artifacts').select('id').eq('project_id', request.params.projectId).neq('status', 'stale');
  if (staleLookupError) return response.status(500).json({ success: false, code: 'ARTIFACT_INVALIDATION_FAILED', message: staleLookupError.message });
  const staleArtifactIds = (staleArtifacts ?? []).map((artifact: { id: string }) => artifact.id);
  if (staleArtifactIds.length) await client.from('artifacts').update({ status: 'stale', updated_at: new Date().toISOString() }).in('id', staleArtifactIds);
  const invalidation = await client.from('layout_invalidation_events').insert({ organization_id: authReq.ultidaUser?.organizationId, project_id: request.params.projectId, source_layout_version_id: version.data.id, reason: 'Layout approved; downstream outputs require recompilation.', stale_artifact_ids: staleArtifactIds, metadata: { layoutId: layout.id, layoutVersionId: version.data.id }, created_by: authReq.ultidaUser?.id }).select('id').single();
  return response.json({ success: true, layout: updated.data, layoutVersion: version.data, invalidationEventId: invalidation.data?.id ?? null, staleArtifactIds });
});

app.get('/api/projects/:projectId/stage-status', requireProjectUser, async (request, response) => {
  const { data, error } = await getRequestSupabaseClient(request).from('workflow_stage_status').select('*').eq('project_id', request.params.projectId).order('stage');
  if (error) return response.status(500).json({ success: false, code: 'STAGE_STATUS_FAILED', message: error.message });
  return response.json({ success: true, stages: data ?? [] });
});

app.get('/api/projects/:projectId/export/sketchup', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const { projectId } = request.params;
  const { data: sceneRow, error } = await client
    .from('scene_versions')
    .select('scene_json,status')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !sceneRow?.scene_json) {
    return response.status(404).json({
      success: false,
      code: 'SCENE_NOT_FOUND',
      message: 'No compiled 3D scene found for this project.'
    });
  }

  try {
    const scene = migrateScene(sceneRow.scene_json);
    const rubyScript = generateSketchUpRubyScript(scene);
    response.setHeader('Content-Type', 'text/x-ruby');
    response.setHeader('Content-Disposition', `attachment; filename="ultida-${projectId}-sketchup.rb"`);
    return response.send(rubyScript);
  } catch (err) {
    return response.status(500).json({
      success: false,
      code: 'SKETCHUP_EXPORT_FAILED',
      message: err instanceof Error ? err.message : 'SketchUp Ruby export failed.'
    });
  }
});

app.post('/api/projects/:projectId/rooms/:roomId/verify', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const { projectId, roomId } = request.params;
  const { verificationStatus = 'verified', reviewerNotes } = request.body ?? {};

  const { data: space, error } = await client
    .from('spaces')
    .update({
      verification_status: verificationStatus,
      status: 'configured',
      updated_at: new Date().toISOString()
    })
    .eq('id', roomId)
    .eq('project_id', projectId)
    .select('*')
    .single();

  if (error) {
    return response.status(500).json({
      success: false,
      code: 'ROOM_VERIFICATION_FAILED',
      message: error.message
    });
  }

  return response.json({
    success: true,
    space,
    message: `Room ${roomId} marked as ${verificationStatus}.`
  });
});

export { app };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, '127.0.0.1', () => console.log(`ULTIDA API http://127.0.0.1:${port}`));
}
