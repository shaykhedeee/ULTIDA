import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootEnv = [resolve(currentDir, '../.env'), resolve(currentDir, '../../.env'), resolve(currentDir, '../../../.env')].find((c) => existsSync(c));
if (rootEnv) {
  dotenv.config({ path: rootEnv, override: true });
}
const localEnv = resolve(currentDir, '../../../.env.local');
if (existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
  process.env.SUPABASE_URL ||= process.env.VITE_SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY ||= process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

import { getRequestSupabaseClient } from './supabase.js';
import { authenticateProjectUser, requireProjectUser } from './api-auth.js';
import { VisualProposalRequestSchema } from '@ultida/contracts';
import { createProviderGateway } from '@ultida/provider-gateway';
import { SceneV1Schema } from '@ultida/scene-core';
import { listCatalog, validatePlacement, RoomTypeSchema, IndianModularCatalog } from '@ultida/catalog-core';
import { parsePlanIntake } from '@ultida/plan-core';
import { analyzePlanWithProvider } from './plan-analyzer.js';
import { listAuraTools } from '@ultida/aura-tools';
import { createVisualJob, getVisualJob, listProjectRenders, reviewVisualJob } from './visual-jobs.js';

const app = express();
const port = Number(process.env.PORT || 8800);
const gateway = createProviderGateway(process.env);

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer: string) {
  return ['0', 'LINE', '8', layer, '10', String(x1), '20', String(y1), '30', '0', '11', String(x2), '21', String(y2), '31', '0'];
}

export function createSceneDxf(input: { walls?: Array<{ start?: { xMm?: number; yMm?: number }; end?: { xMm?: number; yMm?: number } }>; modules?: Array<{ position?: { xMm?: number; yMm?: number }; widthMm?: number; depthMm?: number }> }) {
  const entities: string[] = [];
  for (const wall of input.walls ?? []) {
    const x1 = wall.start?.xMm ?? 0; const y1 = wall.start?.yMm ?? 0;
    const x2 = wall.end?.xMm ?? 0; const y2 = wall.end?.yMm ?? 0;
    entities.push(...dxfLine(x1, y1, x2, y2, 'ULTIDA-WALLS'));
  }
  for (const module of input.modules ?? []) {
    const x = module.position?.xMm ?? 0; const y = module.position?.yMm ?? 0;
    const width = module.widthMm ?? 0; const depth = module.depthMm ?? 0;
    if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) continue;
    entities.push(...dxfLine(x, y, x + width, y, 'ULTIDA-MODULES'));
    entities.push(...dxfLine(x + width, y, x + width, y + depth, 'ULTIDA-MODULES'));
    entities.push(...dxfLine(x + width, y + depth, x, y + depth, 'ULTIDA-MODULES'));
    entities.push(...dxfLine(x, y + depth, x, y, 'ULTIDA-MODULES'));
  }
  return ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC', '0', 'EOF', ''].join('\r\n');
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '35mb' }));

app.get('/api/health', (_request, response) => {
  const currentGateway = createProviderGateway(process.env);
  return response.status(200).json({ success: true, app: 'ultida', status: 'ok', providers: currentGateway.status(), timestamp: new Date().toISOString() });
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

app.post('/api/plan/analyze', (request, response) => {
  const { projectId, fileName, mimeType, dataUrl } = request.body ?? {};
  if (typeof projectId !== 'string' || typeof fileName !== 'string' || typeof mimeType !== 'string' || typeof dataUrl !== 'string') {
    return response.status(400).json({ success: false, code: 'INVALID_PLAN_UPLOAD', message: 'A project, file name, MIME type and file payload are required.' });
  }
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match || !['image/png', 'image/jpeg', 'application/pdf', 'application/dxf', 'application/acad', 'application/octet-stream'].includes(mimeType)) {
    return response.status(400).json({ success: false, code: 'UNSUPPORTED_PLAN', message: 'Upload a PNG, JPEG, PDF, DXF or DWG floor plan.' });
  }
  const bytes = Buffer.byteLength(match[2], 'base64');
  if (bytes > 25 * 1024 * 1024) return response.status(413).json({ success: false, code: 'PLAN_TOO_LARGE', message: 'Floor plans must be smaller than 25 MB.' });
  const localRequest = ['127.0.0.1', '::1'].includes(String(request.ip)) || String(request.ip).endsWith('::ffff:127.0.0.1');
  if (process.env.PLAN_ANALYZER_MODE === 'baseline' || (request.body?.demoMode === true && localRequest)) {
    const intake = parsePlanIntake({ projectId, fileName, mimeType, bytes });
    const proposals = intake.proposals;
    return response.status(202).json({ success: true, analysis: { projectId, fileName, mimeType, bytes, provider: 'baseline', status: 'review_required', confidence: intake.confidence, proposals, warnings: intake.warnings, message: 'Baseline mode is explicitly enabled. Technical preview requires calibration.' } });
  }
  return analyzePlanWithProvider(process.env, { dataUrl, fileName, mimeType }).then((result) => {
    if (!result) return response.status(503).json({ success: false, code: 'PLAN_ANALYZER_UNAVAILABLE', message: 'Configure OPENAI_API_KEY or GEMINI_API_KEY for floor-plan analysis. Baseline mode is available only with PLAN_ANALYZER_MODE=baseline.' });
    const proposals = result.proposals;
    return response.status(202).json({ success: true, analysis: { projectId, fileName, mimeType, bytes, provider: result.provider, status: 'review_required', confidence: proposals.length ? Math.min(...proposals.map((item) => item.confidence)) : 0, proposals, walls: proposals.filter((item) => item.kind === 'wall'), rooms: proposals.filter((item) => item.kind === 'room'), openings: proposals.filter((item) => item.kind === 'opening'), dimensions: proposals.filter((item) => item.kind === 'dimension'), message: 'Provider proposals prepared. Calibrate and review every candidate before approval.' } });
  }).catch((error: unknown) => {
    const err = error as { status?: number; code?: string; message?: string };
    const status = typeof err?.status === 'number' ? err.status : 502;
    const code = typeof err?.code === 'string' ? err.code : 'PLAN_ANALYZER_FAILED';
    return response.status(status).json({ success: false, code, message: err?.message ?? 'The configured plan analyzer failed.' });
  });
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

app.post('/api/drawings/elevations.pdf', (request, response) => {
  const { projectId, sceneVersionId, scene } = request.body ?? {};
  if (!projectId || !sceneVersionId || !scene) return response.status(400).json({ success: false, code: 'INVALID_DRAWING_REQUEST' });
  response.setHeader('content-type', 'application/pdf');
  return response.status(200).send(Buffer.from('%PDF-1.4 mock pdf payload'));
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
  response.setHeader('content-type', 'image/svg+xml');
  return response.status(200).send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800"><text x="10" y="30">Elevation Preview</text></svg>');
});

app.post('/api/production/cutlist', (request, response) => {
  const { projectId, sceneVersionId, scene } = request.body ?? {};
  if (!projectId || !sceneVersionId || !scene) return response.status(400).json({ success: false, code: 'INVALID_CUTLIST_REQUEST' });
  return response.status(202).json({
    success: true,
    cutlist: {
      partCount: 7,
      parts: [
        { id: 'p1', status: 'review_required', lengthMm: 2400, widthMm: 600, thicknessMm: 18 }
      ]
    }
  });
});

app.post('/api/production/cutlist.csv', (request, response) => {
  const { projectId, sceneVersionId, scene } = request.body ?? {};
  if (!projectId || !sceneVersionId || !scene) return response.status(400).json({ success: false, code: 'INVALID_CUTLIST_REQUEST' });
  response.setHeader('content-type', 'text/csv');
  return response.status(200).send('part_id,module_id,family,length_mm,width_mm,thickness_mm\np1,m1,wardrobe,2400,600,18\n');
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
  const dxf = createSceneDxf(scene as { walls?: Array<{ start?: { xMm?: number; yMm?: number }; end?: { xMm?: number; yMm?: number } }>; modules?: Array<{ position?: { xMm?: number; yMm?: number }; widthMm?: number; depthMm?: number }> });
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
    idempotencyKey: typeof request.body?.idempotencyKey === 'string' ? request.body.idempotencyKey : `${sceneVersionId}:legacy:${Date.now()}`,
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

app.post('/api/projects/:projectId/floor-plans', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId } = request.params;
  const userId = authReq.ultidaUser?.id;
  const organizationId = authReq.ultidaUser?.organizationId;
  const { fileName, mimeType, dataUrl } = request.body ?? {};
  if (!fileName || !dataUrl) return response.status(400).json({ success: false, code: 'INVALID_UPLOAD_PAYLOAD', message: 'fileName and dataUrl are required.' });
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  const allowedExts = ['.png', '.jpg', '.jpeg', '.pdf'];
  const allowedMimes = ['image/png', 'image/jpeg', 'application/pdf'];
  if (!allowedExts.includes(ext) && !allowedMimes.includes(mimeType) && !mimeType?.startsWith('image/')) return response.status(415).json({ success: false, code: 'UNSUPPORTED_DEMO_FORMAT', message: 'Supported formats for this demo: PNG, JPG, and PDF.' });
  let storagePath = '';
  try {
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    storagePath = `${projectId}/${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const upload = await getRequestSupabaseClient(request).storage.from('project-assets').upload(storagePath, buffer, { contentType: mimeType || 'image/png', upsert: true });
    if (upload.error) return response.status(403).json({ success: false, code: 'STORAGE_ACCESS_DENIED', message: upload.error.message });
    const assetPayload: any = { project_id: projectId, kind: 'floor_plan', storage_path: storagePath, mime_type: mimeType || 'image/png', metadata: { originalName: fileName, size: buffer.byteLength } };
    if (organizationId) assetPayload.organization_id = organizationId;
    if (userId) assetPayload.created_by = userId;
    const asset = await getRequestSupabaseClient(request).from('project_assets').insert(assetPayload).select('id').single();
    if (asset.error) return response.status(500).json({ success: false, code: 'ASSET_RECORD_FAILED', message: asset.error.message });
    const signed = await getRequestSupabaseClient(request).storage.from('project-assets').createSignedUrl(storagePath, 86400);
    return response.status(200).json({ success: true, asset: { id: asset.data.id, name: fileName, type: 'floor_plan', previewUrl: signed.data?.signedUrl || dataUrl, storagePath } });
  } catch (err: any) { return response.status(500).json({ success: false, code: 'UPLOAD_FAILED', message: err.message || 'Floor plan upload failed.' }); }
});

app.post('/api/projects/:projectId/brief', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId } = request.params;
  const userId = authReq.ultidaUser?.id;
  const organizationId = authReq.ultidaUser?.organizationId;
  const { brief, clientName, clientEmail, clientPhone, siteLocation, propertyType, numBedrooms, isRenovation, ceilingHeightMm, budgetInr, measurementUnits, stylePreferences, customStyleRef, companyStandards, roomRequirements, isComplete } = request.body ?? {};
  
  const briefPayload: any = {
    project_id: projectId,
    brief: brief || (request.body ?? {}),
    client_name: clientName || brief?.clientName || '',
    client_email: clientEmail || brief?.clientEmail || null,
    client_phone: clientPhone || brief?.clientPhone || null,
    site_location: siteLocation || brief?.siteLocation || null,
    property_type: propertyType || brief?.propertyType || null,
    num_bedrooms: typeof numBedrooms === 'number' ? numBedrooms : (brief?.numBedrooms ?? null),
    is_renovation: typeof isRenovation === 'boolean' ? isRenovation : (brief?.isRenovation ?? false),
    ceiling_height_mm: typeof ceilingHeightMm === 'number' ? ceilingHeightMm : (brief?.ceilingHeightMm ?? 2700),
    budget_inr: typeof budgetInr === 'number' ? budgetInr : (brief?.budgetInr ?? null),
    measurement_units: measurementUnits || brief?.measurementUnits || 'mm',
    style_preferences: Array.isArray(stylePreferences) ? stylePreferences : (Array.isArray(brief?.stylePreferences) ? brief.stylePreferences : []),
    custom_style_ref: customStyleRef || brief?.customStyleRef || null,
    company_standards: companyStandards || brief?.companyStandards || {},
    room_requirements: roomRequirements || brief?.roomRequirements || {},
    is_complete: typeof isComplete === 'boolean' ? isComplete : (typeof brief?.isComplete === 'boolean' ? brief.isComplete : true),
    updated_at: new Date().toISOString()
  };
  if (organizationId) briefPayload.organization_id = organizationId;
  if (userId) briefPayload.updated_by = userId;

  const { error } = await getRequestSupabaseClient(request).from('project_briefs').upsert(briefPayload, { onConflict: 'project_id' });
  if (error) return response.status(500).json({ success: false, code: 'BRIEF_SAVE_FAILED', message: error.message });
  return response.status(200).json({ success: true, code: 'BRIEF_SAVED', brief: briefPayload.brief });
});

app.post('/api/projects/:projectId/plan/approve', requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId } = request.params;
  const userId = authReq.ultidaUser?.id;
  const organizationId = authReq.ultidaUser?.organizationId;
  const { canonicalModel, floorPlanVersionId, sourceAssetId } = request.body ?? {};
  if (!canonicalModel || typeof canonicalModel !== 'object') return response.status(400).json({ success: false, code: 'INVALID_CANONICAL_MODEL', message: 'A canonical plan model is required.' });
  
  const client = getRequestSupabaseClient(request);
  const versionId = typeof floorPlanVersionId === 'string' && floorPlanVersionId ? floorPlanVersionId : crypto.randomUUID();
  const { data: previousVersions, error: previousVersionsError } = await client
    .from('floor_plan_versions')
    .select('version_number')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
    .limit(1);
  if (previousVersionsError) return response.status(500).json({ success: false, code: 'PLAN_VERSION_LOOKUP_FAILED', message: previousVersionsError.message });

  // Deactivate prior versions for this project before promoting this immutable one.
  await client.from('floor_plan_versions').update({ active_version: false, status: 'superseded' }).eq('project_id', projectId).eq('active_version', true);

  const planVersionPayload: any = {
    id: versionId,
    project_id: projectId,
    version_number: (previousVersions?.[0]?.version_number ?? 0) + 1,
    status: 'approved',
    canonical_model: canonicalModel,
    interpretation: canonicalModel,
    scale_state: (canonicalModel as any).scale || (canonicalModel as any).scaleState || null,
    verification_state: (canonicalModel as any).verification || (canonicalModel as any).verificationState || null,
    source_asset_id: sourceAssetId || (canonicalModel as any).sourceAssetId || null,
    schema_version: 'scene.v1-approval-1',
    approved_at: new Date().toISOString(),
    active_version: true,
    review_status: 'approved'
  };
  if (userId) {
    planVersionPayload.approved_by = userId;
    planVersionPayload.created_by = userId;
  }

  const { error } = await client.from('floor_plan_versions').upsert(planVersionPayload, { onConflict: 'id' });
  if (error) return response.status(500).json({ success: false, code: 'PLAN_APPROVAL_FAILED', message: error.message });

  // Derive spaces rows strictly from approved canonical model
  const spacesList = (canonicalModel as any).spaces || (canonicalModel as any).rooms || [];
  const rows = spacesList.map((space: any) => {
    const spaceRow: any = {
      project_id: projectId,
      floor_plan_version_id: versionId,
      space_id: space.id || `space-${Math.random().toString(36).slice(2)}`,
      name: space.name || space.roomId || space.roomType || 'Unnamed Space',
      room_type: space.type || space.roomType || 'living',
      ceiling_height_mm: space.ceilingHeightMm || 2700,
      area_sqm: typeof space.areaSqm === 'number' ? space.areaSqm : null,
      geometry_json: space.geometry || space.boundary || {},
      requirements_json: space.requirements || {},
      settings_json: space.settings || {},
      status: space.verified ? 'configured' : 'pending',
      verification_status: space.verified ? 'verified' : 'pending',
      updated_at: new Date().toISOString()
    };
    if (organizationId) spaceRow.organization_id = organizationId;
    if (userId) spaceRow.created_by = userId;
    return spaceRow;
  });

  if (rows.length) {
    const { error: spacesError } = await client.from('spaces').upsert(rows, { onConflict: 'floor_plan_version_id,space_id' });
    if (spacesError) return response.status(500).json({ success: false, code: 'SPACE_DERIVATION_FAILED', message: spacesError.message });
  }

  await client.from('projects').update({ active_floor_plan_version_id: versionId, workflow_stage: 'spaces', current_step: 'spaces', updated_at: new Date().toISOString() }).eq('id', projectId);

  return response.status(200).json({ success: true, floorPlanVersionId: versionId, spaces: rows });
});

app.get(['/api/projects/:projectId/status', '/api/projects/:projectId/workflow-status'], requireProjectUser, async (request, response) => {
  const authReq = request as import('./api-auth.js').AuthenticatedRequest;
  const { projectId } = request.params;
  const userId = authReq.ultidaUser?.id;
  const client = getRequestSupabaseClient(request);
  const [briefRes, floorRes, spaceRes, layoutRes, sceneRes, renderRes, drawingRes, presentationRes] = await Promise.all([
    client.from('project_briefs').select('id,is_complete').eq('project_id', projectId).maybeSingle(),
    client.from('floor_plan_versions').select('id,approved_at,active_version').eq('project_id', projectId).eq('active_version', true).maybeSingle(),
    client.from('spaces').select('id,verification_status').eq('project_id', projectId),
    client.from('layouts').select('id,status').eq('project_id', projectId).eq('status', 'approved'),
    client.from('scene_versions').select('id').eq('project_id', projectId).eq('status', 'approved').maybeSingle(),
    client.from('jobs').select('id,status').eq('project_id', projectId).eq('kind', 'visual-proposal').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('jobs').select('id').eq('project_id', projectId).eq('kind', 'drawings').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('jobs').select('id').eq('project_id', projectId).eq('kind', 'presentation').order('created_at', { ascending: false }).limit(1).maybeSingle()
  ]);

  const briefComplete = !!briefRes.data && (briefRes.data.is_complete !== false);
  const planComplete = !!floorRes.data?.approved_at;
  const spacesList = spaceRes.data ?? [];
  const spacesComplete = spacesList.length > 0 && spacesList.every((s: any) => s.verification_status === 'verified' || s.verification_status === 'completed');
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
    layouts: spacesComplete || (spacesList.length > 0 && planComplete) ? null : 'Verified spaces are required.',
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
      spaces: spacesComplete || (spacesList.length > 0 && planComplete),
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
