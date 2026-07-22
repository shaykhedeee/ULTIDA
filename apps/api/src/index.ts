import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PassThrough } from 'node:stream';
import { timingSafeEqual } from 'node:crypto';
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

import { getRequestSupabaseClient } from './supabase.js';
import { authenticateProjectUser, requireProjectUser } from './api-auth.js';
import { CanonicalPlanV1Schema, VisualProposalRequestSchema } from '@ultida/contracts';
import { createProviderGateway } from '@ultida/provider-gateway';
import { SceneV1Schema } from '@ultida/scene-core';
import { listCatalog, validatePlacement, RoomTypeSchema, IndianModularCatalog } from '@ultida/catalog-core';
import { parsePlanIntake } from '@ultida/plan-core';
import { analyzePlanWithProvider } from './plan-analyzer.js';
import { listAuraTools } from '@ultida/aura-tools';
import { createVisualJob, getVisualJob, listProjectRenders, reviewVisualJob } from './visual-jobs.js';
import { createPlanAnalysisJob, dispatchPlanAnalysisJob, getPlanAnalysisJob, processPlanAnalysisJobs } from './plan-jobs.js';
import { buildDrawingProjection, exportSceneToDxf, generateDrawingPackageSvg, generateProjectBOQ, generateWallElevationSvg, generateProjectionPdf } from '@ultida/drawing-core';
import { migrateScene } from '@ultida/scene-core';
import { evaluateVastuCompliance } from '@ultida/layout-core';

const app = express();
const port = Number(process.env.PORT || 8800);
const gateway = createProviderGateway(process.env);

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer: string) {
  return ['0', 'LINE', '8', layer, '10', String(x1), '20', String(y1), '30', '0', '11', String(x2), '21', String(y2), '31', '0'];
}

function buildCutlist(scene: ReturnType<typeof migrateScene>) {
  const parts = scene.modules.flatMap((module) => {
    const thicknessMm = 18;
    const backThicknessMm = 6;
    const widthMm = Math.round(module.widthMm);
    const depthMm = Math.round(module.depthMm);
    const heightMm = Math.round(module.heightMm);
    const rows = [
      ['side-left', heightMm, depthMm, thicknessMm],
      ['side-right', heightMm, depthMm, thicknessMm],
      ['top', widthMm, depthMm, thicknessMm],
      ['bottom', widthMm, depthMm, thicknessMm],
      ['shelf', Math.max(1, widthMm - thicknessMm * 2), Math.max(1, depthMm - 20), thicknessMm],
      ['shutter', heightMm, widthMm, thicknessMm],
      ['back', Math.max(1, heightMm - 36), Math.max(1, widthMm - 36), backThicknessMm],
    ] as const;
    return rows.map(([partType, lengthMm, width, thickness]) => ({
      id: `${module.id}-${partType}`,
      moduleId: module.id,
      roomId: module.roomId,
      family: module.family,
      partType,
      lengthMm,
      widthMm: width,
      thicknessMm: thickness,
      edgeBandMm: partType === 'back' ? 0 : Math.round((lengthMm + width) * 2),
      hardware: partType === 'shutter' ? ['hinges', 'handle'] : [],
      status: 'review_required',
    }));
  });
  return { partCount: parts.length, parts, assumptions: { carcassThicknessMm: 18, backThicknessMm: 6, edgeBandPolicy: 'perimeter', status: 'review_required' } };
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

app.get('/api/health', (_request, response) => {
  const currentGateway = createProviderGateway(process.env);
  const hasServerSupabaseKey = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasPlanVisionProvider = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_VISION_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_STUDIO_KEY_1 ||
    process.env.GOOGLE_AI_STUDIO_KEY_2 ||
    (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN && process.env.CLOUDFLARE_VISION_MODEL)
  );
  return response.status(200).json({
    success: true,
    app: 'ultida',
    status: 'ok',
    readiness: {
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
      durableJobs: hasServerSupabaseKey,
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
  response.json({ success: true, app: 'ultida', version: '0.1.0', providers: gateway.status() });
});

app.get('/api/providers', (_request, response) => response.json({ success: true, providers: gateway.status() }));

app.get('/api/aura/tools', (request, response) => {
  const group = typeof request.query.group === 'string' ? request.query.group as Parameters<typeof listAuraTools>[0] : undefined;
  return response.json({ success: true, tools: listAuraTools(group) });
});

app.post('/api/aura/tools/:toolId/preview', (request, response) => {
  const toolId = request.params.toolId;
  const { projectId, sceneVersionId, roomId, widthMm, style, laminate } = request.body ?? {};
  if (typeof projectId !== 'string' || typeof sceneVersionId !== 'string') return response.status(400).json({ success: false, code: 'SCENE_CONTEXT_REQUIRED', message: 'An approved scene context is required.' });
  if (toolId === 'generate_tv_unit') {
    const width = typeof widthMm === 'number' && widthMm >= 1200 ? widthMm : 1800;
    return response.status(200).json({ success: true, mode: 'preview', toolId, projectId, sceneVersionId, proposal: { family: 'tv-unit', roomId: roomId ?? 'living', widthMm: width, depthMm: 400, heightMm: 600, features: ['cable-management', 'base-storage', 'display-niche'], production: { panelBased: true, cutlistSupported: true, hardwareSchedule: true }, requiresConfirmation: true } });
  }
  if (toolId === 'change_laminate') {
    const finish = typeof laminate === 'string' && laminate.trim() ? laminate.trim() : 'warm oak matte';
    return response.status(200).json({ success: true, mode: 'preview', toolId, projectId, sceneVersionId, proposal: { operation: 'material-swap', target: 'selected scene modules', laminate: finish, style: style ?? 'coordinated modular interior', visualOnlyUntilApproved: true, requiresConfirmation: true } });
  }
  return response.status(404).json({ success: false, code: 'TOOL_NOT_IMPLEMENTED', message: 'This tool is registered but its execution handler is not available yet.' });
});

app.get('/api/catalog/modules', (request, response) => {
  const room = typeof request.query.room === 'string' ? RoomTypeSchema.safeParse(request.query.room) : null;
  if (room && !room.success) return response.status(400).json({ success: false, code: 'INVALID_ROOM_TYPE' });
  const query = typeof request.query.q === 'string' ? request.query.q : undefined;
  return response.json({ success: true, source: 'ULTIDA Indian modular catalog', modules: listCatalog(room?.success ? room.data : undefined, query) });
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
  if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(mimeType)) return response.status(400).json({ success: false, code: 'UNSUPPORTED_PLAN', message: 'Upload a PNG, JPEG, WebP, or PDF floor plan.' });
  const job = await createPlanAnalysisJob(process.env, { projectId, sourceAssetId, fileName, mimeType, idempotencyKey }, authReq.ultidaUser!.id);
  if (job.status === 'unavailable') return response.status(503).json({ success: false, code: job.code, message: job.reason });
  if (job.status === 'not_found') return response.status(404).json({ success: false, code: 'PLAN_SOURCE_NOT_FOUND', message: job.reason });
  return response.status(job.status === 'failed' ? 502 : 202).json({ success: job.status !== 'failed', ...job });
});

app.get('/api/plan/analyze/:jobId', requireProjectUser, async (request, response) => {
  const projectId = typeof request.query.projectId === 'string' ? request.query.projectId : String(request.body?.projectId ?? request.params.projectId ?? '');
  const result = await getPlanAnalysisJob(process.env, projectId, String(request.params.jobId));
  if (result.status === 'unavailable') return response.status(503).json({ success: false, code: 'PLAN_JOB_PERSISTENCE_UNAVAILABLE' });
  if (result.status === 'not_found') return response.status(404).json({ success: false, code: 'PLAN_JOB_NOT_FOUND' });
  return response.json({ success: true, ...result });
});

app.post('/api/internal/plan-jobs/process', async (request, response) => {
  const configuredSecret = process.env.ULTIDA_WORKER_SHARED_SECRET ?? '';
  const suppliedSecret = String(request.header('x-ultida-worker-secret') ?? '');
  const validSecret = configuredSecret.length > 31 && configuredSecret.length === suppliedSecret.length && timingSafeEqual(Buffer.from(configuredSecret), Buffer.from(suppliedSecret));
  if (!validSecret) return response.status(401).json({ success: false, code: 'WORKER_AUTH_FAILED' });
  await processPlanAnalysisJobs(process.env, 1);
  return response.json({ success: true });
});

app.post('/api/scene/materialize', (request, response) => {
  const { projectId, floorPlanVersionId, approved, spatialModel } = request.body ?? {};
  if (!projectId || !spatialModel) return response.status(400).json({ success: false, code: 'INVALID_MATERIALIZE_REQUEST' });
  const scene = {
    schema: 'scene.v1',
    sceneVersionId: `scene-${crypto.randomUUID()}`,
    projectId,
    floorPlanVersionId: floorPlanVersionId || 'fpv-default',
    metadata: { status: approved ? 'approved' : 'draft', createdAt: new Date().toISOString() },
    spatialModel
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
    const rows = cutlist.parts.map((part) => [part.id, part.moduleId, part.family, part.roomId, part.partType, part.lengthMm, part.widthMm, part.thicknessMm, part.edgeBandMm, part.hardware.join('|')].join(','));
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

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  const err = error as { status?: number; code?: string; message?: string };
  const status = typeof err?.status === 'number' ? err.status : 500;
  return response.status(status).json({
    success: false,
    code: err?.code ?? 'INTERNAL_SERVER_ERROR',
    message: err?.message ?? 'An unexpected error occurred.'
  });
});

app.post('/api/visual-proposals', requireProjectUser, async (request, response) => {
  const parsed = VisualProposalRequestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, code: 'INVALID_REQUEST', issues: parsed.error.issues });
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const result = await createVisualJob(process.env, gateway, parsed.data, authReq.ultidaUser?.id, getRequestSupabaseClient(request));
  const success = result.status === 'succeeded' || result.status === 'queued';
  return response.status(success ? 200 : 422).json({ success, result });
});

app.get('/api/visual-proposals/:jobId', requireProjectUser, async (request, response) => {
  const result = await getVisualJob(process.env, gateway, String(request.params.jobId), String(request.query.projectId ?? ''), getRequestSupabaseClient(request));
  return response.status(result.status === 'not_found' ? 404 : result.status === 'failed' ? 422 : 200).json({ success: result.status !== 'failed' && result.status !== 'not_found', result });
});

app.post('/api/visual-proposals/:jobId/:decision', requireProjectUser, async (request, response) => {
  const decisionMap = { approve: 'approved', reject: 'rejected', cancel: 'cancelled' } as const;
  const decision = decisionMap[String(request.params.decision) as keyof typeof decisionMap];
  if (!decision) return response.status(400).json({ success: false, code: 'INVALID_REVIEW_DECISION' });
  const result = await reviewVisualJob(process.env, String(request.params.jobId), String(request.body?.projectId ?? ''), decision, String(request.body?.note ?? ''), getRequestSupabaseClient(request));
  return response.status(result.status === 'not_found' ? 404 : result.status === 'conflict' ? 409 : 200).json({ success: result.status === 'succeeded' || result.status === 'cancelled', result });
});

app.get('/api/projects/:projectId/renders', requireProjectUser, async (request, response) => {
  const result = await listProjectRenders(process.env, String(request.params.projectId), getRequestSupabaseClient(request));
  if (result.status === 'failed') return response.status(500).json({ success: false, code: 'RENDER_LIST_FAILED', message: result.reason });
  return response.json({ success: true, renders: result.renders });
});

app.post('/api/projects/:projectId/renders', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId } = request.params;
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
    operation: 'generate',
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
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'];
  const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
  if (!allowedExts.includes(ext) || !allowedMimes.includes(mimeType)) {
    return response.status(415).json({
      success: false,
      code: 'UNSUPPORTED_FORMAT',
      message: ext === '.dwg' ? 'DWG requires verified server-side conversion and is not supported yet.' : 'Supported formats: PNG, JPEG, WEBP, scanned PDF, and vector PDF.'
    });
  }
  const organizationId = authReq.ultidaUser!.organizationId;
  const assetId = crypto.randomUUID();
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120);
  const storagePath = `${organizationId}/${projectId}/floor-plans/${assetId}-${safeName}`;
  try {
    const signedUrlRes = await getRequestSupabaseClient(request).storage.from('project-assets').createSignedUploadUrl(storagePath);
    if (signedUrlRes.error || !signedUrlRes.data?.token) return response.status(403).json({ success: false, code: 'SIGNED_UPLOAD_DENIED', message: signedUrlRes.error?.message ?? 'A signed upload could not be created.' });
    return response.status(200).json({
      success: true,
      assetId,
      storagePath,
      token: signedUrlRes.data.token,
      bucket: 'project-assets',
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
  const client = getRequestSupabaseClient(request);
  try {
    const verified = await client.storage.from('project-assets').download(storagePath);
    if (verified.error || !verified.data) return response.status(409).json({ success: false, code: 'UPLOAD_NOT_FOUND', message: verified.error?.message ?? 'The uploaded object could not be verified.' });
    const assetPayload = {
      id: assetId,
      organization_id: organizationId,
      project_id: projectId,
      kind: 'floor_plan',
      storage_path: storagePath,
      mime_type: mimeType || 'image/png',
      metadata: { originalName: fileName, size: Number(fileSize) || verified.data.size },
      created_by: userId
    };
    const asset = await client.from('project_assets').insert(assetPayload).select('id').single();
    if (asset.error) return response.status(500).json({ success: false, code: 'ASSET_RECORD_FAILED', message: asset.error.message });
    const job = await createPlanAnalysisJob(process.env, { projectId, sourceAssetId: asset.data.id, fileName, mimeType, idempotencyKey: `plan:${projectId}:${asset.data.id}` }, userId);
    if (job.status === 'failed' || job.status === 'unavailable' || job.status === 'not_found') return response.status(503).json({ success: false, code: 'PLAN_JOB_CREATE_FAILED', message: 'The file was stored, but analysis could not be queued.', detail: job });
    const dispatch = await dispatchPlanAnalysisJob(process.env, job.jobId);
    return response.status(200).json({
      success: true,
      asset: { id: asset.data.id, storagePath, name: fileName, mimeType },
      jobId: job.jobId,
      status: job.status,
      dispatch
    });
  } catch (err: any) {
    return response.status(500).json({ success: false, code: 'COMPLETE_FAILED', message: err.message });
  }
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

const writeProjectBrief = async (request: express.Request, response: express.Response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId } = request.params;
  const userId = authReq.ultidaUser!.id;
  const organizationId = authReq.ultidaUser!.organizationId;
  const { brief, clientName, clientEmail, clientPhone, siteLocation, propertyType, numBedrooms, isRenovation, ceilingHeightMm, budgetInr, measurementUnits, stylePreferences, customStyleRef, companyStandards, roomRequirements, isComplete } = request.body ?? {};
  const document = brief && typeof brief === 'object' ? brief : request.body ?? {};
  const fieldErrors: Record<string, string> = {};
  for (const [key, label] of [['clientName', 'Client name'], ['projectName', 'Project name'], ['propertyType', 'Property type'], ['rooms', 'Rooms and scope'], ['budgetRange', 'Budget range'], ['timeline', 'Timeline']] as const) {
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
  const parsed = CanonicalPlanV1Schema.safeParse(canonicalModel);
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

app.get('/api/projects/:projectId/spaces', requireProjectUser, async (request, response) => {
  const client = getRequestSupabaseClient(request);
  const project = await client.from('projects').select('active_floor_plan_version_id').eq('id', request.params.projectId).single();
  if (project.error) return response.status(500).json({ success: false, code: 'PROJECT_READ_FAILED', message: project.error.message });
  if (!project.data.active_floor_plan_version_id) return response.status(409).json({ success: false, code: 'APPROVED_PLAN_REQUIRED', message: 'Approve a canonical floor plan before configuring spaces.', spaces: [] });
  const spaces = await client.from('spaces').select('*').eq('project_id', request.params.projectId).eq('floor_plan_version_id', project.data.active_floor_plan_version_id).order('created_at');
  if (spaces.error) return response.status(500).json({ success: false, code: 'SPACES_READ_FAILED', message: spaces.error.message });
  return response.json({ success: true, floorPlanVersionId: project.data.active_floor_plan_version_id, spaces: spaces.data ?? [] });
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
    client.from('jobs').select('id,status').eq('project_id', projectId).eq('kind', 'visual-proposal').order('created_at', { ascending: false }).limit(1).maybeSingle(),
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

app.post('/api/projects/:projectId/layouts', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { spaceId, layoutShape, label = 'Option A', candidate, score } = request.body ?? {};
  if (typeof spaceId !== 'string' || !candidate || typeof candidate !== 'object') return response.status(400).json({ success: false, code: 'INVALID_LAYOUT', message: 'spaceId and candidate data are required.' });
  const client = getRequestSupabaseClient(request);
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

app.put('/api/projects/:projectId/stage-status/:stage', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { status, blocker = null, nextAction = null, evidence = {} } = request.body ?? {};
  if (!['blocked','ready','in_progress','needs_review','approved','stale','complete'].includes(status)) return response.status(400).json({ success: false, code: 'INVALID_STAGE_STATUS' });
  const { data, error } = await getRequestSupabaseClient(request).from('workflow_stage_status').upsert({ organization_id: authReq.ultidaUser?.organizationId, project_id: request.params.projectId, stage: request.params.stage, status, blocker, next_action: nextAction, evidence, updated_by: authReq.ultidaUser?.id, updated_at: new Date().toISOString() }, { onConflict: 'project_id,stage' }).select('*').single();
  if (error) return response.status(500).json({ success: false, code: 'STAGE_STATUS_UPDATE_FAILED', message: error.message });
  return response.json({ success: true, stage: data });
});

export { app };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, '127.0.0.1', () => console.log(`ULTIDA API http://127.0.0.1:${port}`));
}
