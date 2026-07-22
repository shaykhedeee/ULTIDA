import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { analyzePlanWithProvider } from './plan-analyzer.js';

const execFileAsync = promisify(execFile);
type Environment = Record<string, string | undefined>;
type PlanJobRequest = { projectId: string; sourceAssetId: string; fileName: string; mimeType: string; idempotencyKey?: string };

function serverClient(environment: Environment) {
  const url = environment.SUPABASE_URL;
  const secret = environment.SUPABASE_SECRET_KEY || environment.SUPABASE_SERVICE_ROLE_KEY;
  return url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function dataUrl(mimeType: string, bytes: Uint8Array) { return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`; }

async function rasterizePdf(bytes: Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), 'ultida-plan-'));
  const inputPath = join(directory, 'source.pdf'); const outputPrefix = join(directory, 'page');
  try {
    await writeFile(inputPath, bytes);
    await execFileAsync(process.env.PDFTOPPM_PATH || 'pdftoppm', ['-f', '1', '-singlefile', '-png', '-r', '180', inputPath, outputPrefix], { windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    return await readFile(`${outputPrefix}.png`);
  } catch (error) {
    throw new Error(`PDF rasterization failed. Install Poppler pdftoppm on the API host or set PDFTOPPM_PATH. ${error instanceof Error ? error.message : ''}`.trim());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function createPlanAnalysisJob(environment: Environment, request: PlanJobRequest, actorId: string) {
  const client = serverClient(environment);
  if (!client) return { status: 'unavailable' as const, code: 'PLAN_JOB_PERSISTENCE_UNAVAILABLE', reason: 'A server-only Supabase secret key is required for durable plan analysis.' };
  const idempotencyKey = request.idempotencyKey || `plan:${request.projectId}:${request.sourceAssetId}`;
  const existing = await client.from('jobs').select('id,status,output,error').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing.data) return { status: existing.data.status as 'queued' | 'running' | 'succeeded' | 'failed', jobId: existing.data.id, output: existing.data.output, error: existing.data.error };
  const [project, asset] = await Promise.all([
    client.from('projects').select('organization_id').eq('id', request.projectId).single(),
    client.from('project_assets').select('id,storage_path,mime_type').eq('id', request.sourceAssetId).eq('project_id', request.projectId).single()
  ]);
  if (project.error || asset.error || !project.data || !asset.data) return { status: 'not_found' as const, reason: 'The project or its uploaded floor-plan asset was not found.' };
  const inserted = await client.from('jobs').insert({
    organization_id: project.data.organization_id,
    project_id: request.projectId,
    kind: 'plan-analysis',
    status: 'queued',
    idempotency_key: idempotencyKey,
    input: { sourceAssetId: request.sourceAssetId, fileName: request.fileName, mimeType: request.mimeType, storagePath: asset.data.storage_path },
    output: {},
    created_by: actorId
  }).select('id').single();
  if (inserted.error || !inserted.data) return { status: 'failed' as const, reason: inserted.error?.message ?? 'The plan analysis job could not be created.' };
  return { status: 'queued' as const, jobId: inserted.data.id };
}

export async function getPlanAnalysisJob(environment: Environment, projectId: string, jobId: string) {
  const client = serverClient(environment);
  if (!client) return { status: 'unavailable' as const };
  const job = await client.from('jobs').select('id,status,output,error,created_at,updated_at').eq('id', jobId).eq('project_id', projectId).eq('kind', 'plan-analysis').maybeSingle();
  if (job.error || !job.data) return { status: 'not_found' as const };
  return { status: job.data.status, jobId: job.data.id, analysis: job.data.output, error: job.data.error, createdAt: job.data.created_at, updatedAt: job.data.updated_at };
}

export async function processPlanAnalysisJobs(environment: Environment) {
  const client = serverClient(environment);
  if (!client) return;
  const queued = await client.from('jobs').select('*').eq('kind', 'plan-analysis').eq('status', 'queued').lte('available_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(2);
  for (const job of queued.data ?? []) {
    const claimed = await client.from('jobs').update({ status: 'running', attempts: (job.attempts ?? 0) + 1, locked_at: new Date().toISOString(), locked_by: 'api-plan-worker', updated_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'queued').select('*').maybeSingle();
    if (!claimed.data) continue;
    try {
      const input = claimed.data.input as { storagePath?: string; mimeType?: string; fileName?: string };
      if (!input.storagePath || !input.mimeType || !input.fileName) throw new Error('Plan analysis job has incomplete source metadata.');
      const downloaded = await client.storage.from('project-assets').download(input.storagePath);
      if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message ?? 'The uploaded plan asset could not be downloaded.');
      const original = new Uint8Array(await downloaded.data.arrayBuffer());
      const raster = input.mimeType === 'application/pdf' ? await rasterizePdf(original) : original;
      const analysisMimeType = input.mimeType === 'application/pdf' ? 'image/png' : input.mimeType;
      const analysis = await analyzePlanWithProvider(environment, { dataUrl: dataUrl(analysisMimeType, raster), fileName: input.fileName, mimeType: analysisMimeType });
      if (!analysis) throw new Error('No configured floor-plan analysis provider is available.');
      await client.from('jobs').update({ status: 'succeeded', output: { ...analysis, sourceAssetId: (claimed.data.input as { sourceAssetId?: string }).sourceAssetId, sourceMimeType: input.mimeType }, error: null, locked_at: null, updated_at: new Date().toISOString() }).eq('id', job.id);
    } catch (error) {
      await client.from('jobs').update({ status: 'failed', error: { code: 'PLAN_ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Plan analysis failed.' }, locked_at: null, updated_at: new Date().toISOString() }).eq('id', job.id);
    }
  }
}

export function schedulePlanAnalysisWorker(environment: Environment) {
  const run = () => void processPlanAnalysisJobs(environment).catch(() => undefined);
  run();
  const timer = setInterval(run, 2_000);
  // Do not keep CLI tests and one-shot API imports alive solely for polling.
  timer.unref();
  return timer;
}
