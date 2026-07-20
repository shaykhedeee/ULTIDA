import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { VisualProposalRequestSchema } from '@ultida/contracts';
import { createProviderGateway } from '@ultida/provider-gateway';
import { SceneV1Schema } from '@ultida/scene-core';
import { listCatalog, validatePlacement, IndianModularCatalog, RoomTypeSchema } from '@ultida/catalog-core';
import { createBaselineProposals } from '@ultida/plan-core';
import { analyzePlanWithProvider } from './plan-analyzer.js';
import { listAuraTools } from '@ultida/aura-tools';

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
// Plan source uploads are intentionally capped at 25 MB; base64 transport adds
// roughly one third overhead, so the parser must permit the full request.
app.use(express.json({ limit: '35mb' }));

app.get('/api/health', (_request, response) => {
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
  const { moduleId, roomType, clearanceMm } = request.body ?? {};
  const module = IndianModularCatalog.find((item) => item.id === moduleId);
  const room = RoomTypeSchema.safeParse(roomType);
  if (!module || !room.success || typeof clearanceMm !== 'number') return response.status(400).json({ success: false, code: 'INVALID_PLACEMENT_REQUEST' });
  return response.json({ success: true, moduleId, ...validatePlacement(module, room.data, clearanceMm) });
});

app.get('/api/aura/project-readiness', (request, response) => {
  const projectId = typeof request.query.projectId === 'string' ? request.query.projectId : '';
  if (!projectId) return response.status(400).json({ success: false, code: 'PROJECT_REQUIRED', message: 'A project id is required.' });
  return response.json({ success: true, readOnly: true, projectId, checks: [
    { id: 'brief', label: 'Client brief', status: 'unknown', reason: 'Project persistence is read through the authenticated workspace.' },
    { id: 'plan', label: 'Approved plan', status: 'blocked', reason: 'A plan must be reviewed and approved before scene creation.' },
    { id: 'scene', label: 'Scene v1', status: 'blocked', reason: 'No approved plan is available.' },
    { id: 'providers', label: 'Visual providers', status: gateway.status().some((provider) => provider.configured) ? 'ready' : 'unavailable', reason: 'Provider credentials are checked server-side.' }
  ], nextAction: 'Review and approve the floor plan.' });
});

app.post('/api/scene/materialize', (request, response) => {
  const { projectId, floorPlanVersionId, approved, spatialModel, changeReason = 'Materialize approved plan' } = request.body ?? {};
  if (approved !== true) return response.status(409).json({ success: false, code: 'PLAN_NOT_APPROVED', message: 'Only an approved plan can materialize a scene.' });
  if (typeof projectId !== 'string' || typeof floorPlanVersionId !== 'string' || !spatialModel || typeof spatialModel !== 'object') return response.status(400).json({ success: false, code: 'INVALID_SPATIAL_MODEL', message: 'Project, plan version and spatial model are required.' });
  const model = spatialModel as { rooms?: unknown[]; walls?: unknown[]; openings?: unknown[] };
  const scene = SceneV1Schema.safeParse({ schema: 'scene.v1', units: 'mm', projectId, floorPlanVersionId, rooms: model.rooms ?? [], walls: model.walls ?? [], openings: model.openings ?? [], modules: [], materials: [], metadata: { branch: 'main', status: 'draft', changeReason } });
  if (!scene.success) return response.status(422).json({ success: false, code: 'SCENE_VALIDATION_FAILED', issues: scene.error.issues });
  return response.status(201).json({ success: true, scene: scene.data, persistence: 'pending_hosted_migration' });
});

app.post('/api/drawings/preview', (request, response) => {
  const { projectId, sceneVersionId, modules } = request.body ?? {};
  if (typeof projectId !== 'string' || typeof sceneVersionId !== 'string' || !Array.isArray(modules)) return response.status(400).json({ success: false, code: 'INVALID_DRAWING_REQUEST', message: 'A project, scene version and module list are required.' });
  const productionModules = modules.filter((module: { family?: unknown }) => module.family !== 'sofa');
  return response.status(202).json({
    success: true,
    package: {
      projectId,
      sceneVersionId,
      sheets: 2,
      kinds: ['floor-plan', 'wall-elevations', 'module-schedule', 'dxf-export'],
      moduleCount: modules.length,
      productionModuleCount: productionModules.length,
      elevationViews: ['north', 'east'],
      status: 'review_ready',
      source: 'scene.v1',
      qualityGate: modules.length ? 'scene-linked outputs ready for designer review' : 'empty scene; add modules before issuing drawings',
      persistence: 'pending_hosted_migration'
    }
  });
});

app.post('/api/drawings/dxf', (request, response) => {
  const { projectId, sceneVersionId, scene } = request.body ?? {};
  if (typeof projectId !== 'string' || typeof sceneVersionId !== 'string' || !scene || typeof scene !== 'object') return response.status(400).json({ success: false, code: 'INVALID_DXF_REQUEST', message: 'A project, scene version and scene payload are required.' });
  const sceneStatus = (scene as { metadata?: { status?: unknown } }).metadata?.status;
  if (!['approved', 'locked'].includes(String(sceneStatus))) return response.status(409).json({ success: false, code: 'SCENE_NOT_PRODUCTION_READY', message: 'Only approved or locked scenes can export production DXF.' });
  const dxf = createSceneDxf(scene as { walls?: Array<{ start?: { xMm?: number; yMm?: number }; end?: { xMm?: number; yMm?: number } }>; modules?: Array<{ position?: { xMm?: number; yMm?: number }; widthMm?: number; depthMm?: number }> });
  response.status(200).type('application/dxf').set('Content-Disposition', `attachment; filename="ultida-${sceneVersionId}.dxf"`).send(dxf);
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
  if (process.env.PLAN_ANALYZER_MODE === 'baseline') {
    const proposals = createBaselineProposals({ projectId, fileName, mimeType, bytes });
    return response.status(202).json({ success: true, analysis: { projectId, fileName, mimeType, bytes, provider: 'baseline', status: 'review_required', confidence: Math.min(...proposals.map((item) => item.confidence)), proposals, walls: proposals.filter((item) => item.kind === 'wall'), rooms: proposals.filter((item) => item.kind === 'room'), openings: proposals.filter((item) => item.kind === 'opening'), dimensions: proposals.filter((item) => item.kind === 'dimension'), message: 'Baseline mode is explicitly enabled. These are placeholders, not measured geometry.' } });
  }
  return analyzePlanWithProvider(process.env, { dataUrl, fileName, mimeType }).then((result) => {
    if (!result) return response.status(503).json({ success: false, code: 'PLAN_ANALYZER_UNAVAILABLE', message: 'Configure OPENAI_API_KEY or GEMINI_API_KEY for floor-plan analysis. Baseline mode is available only with PLAN_ANALYZER_MODE=baseline.' });
    const proposals = result.proposals;
    return response.status(202).json({ success: true, analysis: { projectId, fileName, mimeType, bytes, provider: result.provider, status: 'review_required', confidence: proposals.length ? Math.min(...proposals.map((item) => item.confidence)) : 0, proposals, walls: proposals.filter((item) => item.kind === 'wall'), rooms: proposals.filter((item) => item.kind === 'room'), openings: proposals.filter((item) => item.kind === 'opening'), dimensions: proposals.filter((item) => item.kind === 'dimension'), message: 'Provider proposals prepared. Calibrate and review every candidate before approval.' } });
  }).catch((error: unknown) => response.status(502).json({ success: false, code: 'PLAN_ANALYZER_FAILED', message: error instanceof Error ? error.message : 'The configured plan analyzer failed.' }));
});

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError || (typeof error === 'object' && error !== null && 'type' in error && (error as { type?: string }).type === 'entity.too.large')) {
    return response.status(413).json({ success: false, code: 'PLAN_TOO_LARGE', message: 'The floor plan is too large. Use a file smaller than 25 MB.' });
  }
  return next(error);
});

app.post('/api/visual-proposals', async (request, response) => {
  const parsed = VisualProposalRequestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, code: 'INVALID_REQUEST', issues: parsed.error.issues });
  const result = await gateway.createVisualProposal(parsed.data);
  return response.status(result.status === 'unavailable' ? 503 : 202).json({ success: result.status !== 'unavailable', result });
});

app.use((_request, response) => response.status(404).json({ success: false, code: 'NOT_FOUND' }));

export { app };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, '127.0.0.1', () => console.log(`ULTIDA API http://127.0.0.1:${port}`));
}
