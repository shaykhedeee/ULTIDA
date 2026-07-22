import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
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

export async function dispatchPlanAnalysisJob(environment: Environment, jobId: string) {
  const workerUrl = environment.CLOUDFLARE_WORKER_URL;
  const sharedSecret = environment.ULTIDA_WORKER_SHARED_SECRET;
  if (!workerUrl || !sharedSecret) {
    return { dispatched: false as const, reason: 'Cloudflare Worker dispatch is not configured.' };
  }
  const response = await fetch(`${workerUrl.replace(/\/$/, '')}/dispatch`, {
    method: 'POST',
    headers: { 'x-ultida-worker-secret': sharedSecret, 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, kind: 'plan-analysis' })
  });
  if (!response.ok) return { dispatched: false as const, reason: `Cloudflare Worker returned HTTP ${response.status}.` };
  return { dispatched: true as const };
}

export async function processPlanAnalysisJobs(environment: Environment, limit = 2) {
  const client = serverClient(environment);
  if (!client) return;
  const workerId = environment.ULTIDA_WORKER_ID || 'api-plan-worker';
  const claimed = await client.rpc('claim_jobs', {
    requested_kind: 'plan-analysis',
    worker_id: workerId,
    claim_limit: Math.max(1, Math.min(limit, 10))
  });
  if (claimed.error) throw new Error(`Plan job claim failed: ${claimed.error.message}`);
  for (const job of claimed.data ?? []) {
    try {
      const input = job.input as { sourceAssetId?: string; storagePath?: string; mimeType?: string; fileName?: string };
      if (!input.storagePath || !input.mimeType || !input.fileName) throw new Error('Plan analysis job has incomplete source metadata.');
      const downloaded = await client.storage.from('project-assets').download(input.storagePath);
      if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message ?? 'The uploaded plan asset could not be downloaded.');
      const original = new Uint8Array(await downloaded.data.arrayBuffer());
      const raster = input.mimeType === 'application/pdf' ? await rasterizePdf(original) : original;
      const analysisMimeType = input.mimeType === 'application/pdf' ? 'image/png' : input.mimeType;
      const analysis = await analyzePlanWithProvider(environment, { dataUrl: dataUrl(analysisMimeType, raster), fileName: input.fileName, mimeType: analysisMimeType });
      if (!analysis) throw new Error('No configured floor-plan analysis provider is available.');
      const output = { ...analysis, sourceAssetId: input.sourceAssetId, sourceMimeType: input.mimeType };
      const outputHash = createHash('sha256').update(JSON.stringify(output)).digest('hex');
      const providerRuns = Array.isArray(analysis.providerRuns) ? analysis.providerRuns : [];
      if (providerRuns.length) {
        const auditRows = providerRuns.map((run) => ({
          organization_id: job.organization_id,
          project_id: job.project_id,
          job_id: job.id,
          asset_id: input.sourceAssetId,
          task_type: 'floor_plan_vision_analysis',
          provider: run.provider,
          model: run.model,
          prompt_version: analysis.analysisVersion,
          asset_hash: analysis.source?.checksumSha256 ?? null,
          output_hash: run.status === 'succeeded' ? outputHash : null,
          latency_ms: run.latencyMs,
          status: run.status,
          error: 'error' in run && run.error ? { code: 'PROVIDER_RUN_FAILED', message: run.error } : null
        }));
        const audit = await client.from('ai_runs').insert(auditRows);
        if (audit.error) throw new Error(`AI provenance could not be stored: ${audit.error.message}`);
      }
      await client.from('jobs').update({ status: 'succeeded', output, error: null, locked_at: null, locked_by: null, updated_at: new Date().toISOString() }).eq('id', job.id);
    } catch (error) {
      await client.from('jobs').update({ status: 'failed', error: { code: 'PLAN_ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Plan analysis failed.' }, locked_at: null, locked_by: null, updated_at: new Date().toISOString() }).eq('id', job.id);
    }
  }
}
