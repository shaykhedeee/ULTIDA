import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import { analyzePlanWithProvider, type AnalysisGuideRegion } from './plan-analyzer.js';
import { reconcilePlan, type CvTraceResult, type VisionSemanticResult } from './plan/reconcile_plan.js';
import { resolveWallTracerPath } from './wall-tracer.js';
import { extractOcrMeasurements } from './plan-analysis-service.js';

const execFileAsync = promisify(execFile);
type Environment = Record<string, string | undefined>;
type PlanJobRequest = { projectId: string; sourceAssetId: string; fileName: string; mimeType: string; analysisGuides?: AnalysisGuideRegion[]; idempotencyKey?: string };

/** A job used to be marked successful after a syntactically valid but sparse
 * vision response. Do not pin the designer to that legacy output: it contains
 * no usable room model and has never been approved. */
function hasReviewablePlanCoverage(output: unknown) {
  const value = output as { proposals?: Array<{ kind?: string }> } | null;
  const proposals = Array.isArray(value?.proposals) ? value.proposals : [];
  const count = (kind: string) => proposals.filter((proposal) => proposal?.kind === kind).length;
  const rooms = count('room');
  const walls = count('wall');
  const openings = count('opening');
  const dimensions = count('dimension');
  return rooms >= 1 && walls >= 4 && rooms + walls + openings + dimensions >= 6;
}

// Browser filenames and supplied MIME types are not trustworthy enough for a
// vision request. A WebP uploaded with a `.png` suffix made Workers AI decode
// the bytes as PNG and fail before it could analyse the plan. Use file magic as
// the source of truth for raster providers while retaining the original upload
// metadata separately for audit/history.
function detectRasterMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && (String.fromCharCode(...bytes.slice(0, 6)) === 'GIF87a' || String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a')) return 'image/gif';
  return null;
}

/**
 * Run the deterministic OpenCV wall-tracer as a separate Python process and
 * return its candidate geometry. Returns null when Python/OpenCV is not
 * available so the vision-only analysis can still proceed (never block the
 * whole job on a missing CV dependency — per ARCHITECTURE.md invariant #5).
 */
async function runRemoteCvTrace(environment: Environment, raster: Uint8Array): Promise<{ result: CvTraceResult; stderr: string } | null> {
  const configuredEndpoint = environment.PLAN_CV_SERVICE_URL?.trim();
  const vercelOrigin = environment.VERCEL_URL ? `https://${environment.VERCEL_URL.replace(/^https?:\/\//, '')}` : '';
  const endpoint = configuredEndpoint || (vercelOrigin ? `${vercelOrigin}/internal/cv/plan` : '');
  const secret = environment.ULTIDA_WORKER_SHARED_SECRET || environment.WORKER_DISPATCH_SECRET;
  if (!endpoint || !secret) return null;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ultida-worker-secret': secret,
      },
      body: JSON.stringify({ imageBase64: Buffer.from(raster).toString('base64') }),
      signal: AbortSignal.timeout(75_000),
    });
    const payload = await response.json() as { success?: boolean; result?: CvTraceResult; code?: string };
    if (response.ok && payload.success && payload.result?.schema === 'PlanAnalysisResultV1.wallCandidates') {
      return { result: payload.result, stderr: '' };
    }
    return { result: null as unknown as CvTraceResult, stderr: `Remote CV unavailable: ${payload.code || response.status}` };
  } catch (error) {
    return { result: null as unknown as CvTraceResult, stderr: `Remote CV unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function runCvTrace(environment: Environment, raster: Uint8Array, mimeType: string): Promise<{ result: CvTraceResult; stderr: string } | null> {
  // Production uses the authenticated Python function when configured. Local
  // development still runs the identical source file directly, so both paths
  // produce the same candidate contract.
  const remote = await runRemoteCvTrace(environment, raster);
  if (remote?.result) return remote;
  const scriptPath = resolveWallTracerPath();
  if (!scriptPath) return remote ?? { result: null as unknown as CvTraceResult, stderr: 'wall_tracer.py not found' };
  const dir = await mkdtemp(join(tmpdir(), 'ultida-cv-'));
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/gif' ? 'gif' : 'jpg';
  const inPath = join(dir, `plan.${extension}`);
  const outPath = join(dir, 'trace.json');
  try {
    await writeFile(inPath, raster);
    const candidates = Array.from(new Set([
      process.env.CV_PYTHON_PATH,
      process.platform === 'win32' ? 'python' : 'python3',
      process.platform === 'win32' ? 'python3' : 'python',
    ].filter(Boolean) as string[]));
    let lastError: unknown = null;
    for (const python of candidates) {
      try {
        await execFileAsync(python, [scriptPath, inPath, outPath], { timeout: 60_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    const raw = await readFile(outPath, 'utf8');
    return { result: JSON.parse(raw) as CvTraceResult, stderr: '' };
  } catch (error) {
    return { result: null as unknown as CvTraceResult, stderr: error instanceof Error ? error.message : String(error) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** OCR is retained as review evidence and runs concurrently with vision/CV. */
async function runPlanOcr(raster: Uint8Array): Promise<{ text: string; measurements: ReturnType<typeof extractOcrMeasurements>; status: 'completed' | 'unavailable' }> {
  let worker: Worker | null = null;
  try {
    worker = await createWorker('eng');
    const recognition = await Promise.race([
      worker.recognize(Buffer.from(raster)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), 35_000)),
    ]);
    const text = recognition.data.text.trim();
    return { text, measurements: extractOcrMeasurements(text), status: 'completed' };
  } catch {
    return { text: '', measurements: [], status: 'unavailable' };
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}

/** Adapt the existing vision-analyzer proposals into the reconciler's semantic shape. */
type SourceImageSize = { widthPx: number; heightPx: number };

// The vision contract deliberately uses a 0..1000 source-relative grid so it
// is stable across raster sizes. CV uses physical source pixels. Convert once
// at this boundary; comparing those spaces directly made nearly every
// AI/CV wall match look unrelated.
function sourceGridToPixels(value: number, axis: 'x' | 'y', image: SourceImageSize) {
  const scale = axis === 'x' ? image.widthPx : image.heightPx;
  return (value / 1000) * scale;
}

function visionProposalsToSemantic(
  proposals: Array<{ kind: string; geometry: Record<string, unknown>; confidence?: number; note?: string }>,
  image: SourceImageSize,
): VisionSemanticResult {
  const walls: VisionSemanticResult['walls'] = [];
  const rooms: VisionSemanticResult['rooms'] = [];
  const openings: VisionSemanticResult['openings'] = [];
  for (const p of proposals) {
    const g = p.geometry as Record<string, number>;
    if (p.kind === 'wall') {
      walls.push({
        approxStartPx: {
          x: sourceGridToPixels(Number(g.x1 ?? 0), 'x', image),
          y: sourceGridToPixels(Number(g.y1 ?? 0), 'y', image),
        },
        approxEndPx: {
          x: sourceGridToPixels(Number(g.x2 ?? 0), 'x', image),
          y: sourceGridToPixels(Number(g.y2 ?? 0), 'y', image),
        },
        confidence: Number(p.confidence ?? 0.5),
        evidence: p.note,
      });
    } else if (p.kind === 'room') {
      rooms.push({
        label: String(p.note ?? 'Room'),
        roomType: String(p.note ?? 'room'),
        approxPolygonPx: [
          { x: sourceGridToPixels(Number(g.x ?? 0), 'x', image), y: sourceGridToPixels(Number(g.y ?? 0), 'y', image) },
          { x: sourceGridToPixels(Number(g.x ?? 0) + Number(g.width ?? 0), 'x', image), y: sourceGridToPixels(Number(g.y ?? 0), 'y', image) },
          { x: sourceGridToPixels(Number(g.x ?? 0) + Number(g.width ?? 0), 'x', image), y: sourceGridToPixels(Number(g.y ?? 0) + Number(g.height ?? 0), 'y', image) },
          { x: sourceGridToPixels(Number(g.x ?? 0), 'x', image), y: sourceGridToPixels(Number(g.y ?? 0) + Number(g.height ?? 0), 'y', image) },
        ],
        confidence: Number(p.confidence ?? 0.5),
      });
    } else if (p.kind === 'opening') {
      openings.push({
        kind: Number(g.kind ?? 0) === 1 ? 'window' : 'door',
        approxCenterPx: { x: sourceGridToPixels(Number(g.x ?? 0), 'x', image), y: sourceGridToPixels(Number(g.y ?? 0), 'y', image) },
        approxWidthPx: sourceGridToPixels(Number(g.width ?? 0), 'x', image),
        confidence: Number(p.confidence ?? 0.5),
      });
    }
  }
  const dimensionTextFindings = proposals
    .filter((proposal) => proposal.kind === 'dimension')
    .map((proposal) => {
      const geometry = proposal.geometry as Record<string, number>;
      return {
        text: String(proposal.note ?? 'Dimension'),
        approxPositionPx: {
          x: sourceGridToPixels(Number(geometry.x1 ?? geometry.x ?? 0), 'x', image),
          y: sourceGridToPixels(Number(geometry.y1 ?? geometry.y ?? 0), 'y', image),
        },
        parsedMm: Number.isFinite(Number(geometry.valueMm)) && Number(geometry.valueMm) > 0 ? Number(geometry.valueMm) : null,
      };
    });
  return { walls, rooms, openings, dimensionTextFindings };
}

/**
 * Vision models are useful for labels but can omit geometry on dense plans.
 * Promote deterministic CV evidence into review-only proposals when that
 * happens, so a sparse model response cannot produce a misleading "0 rooms"
 * review. These are explicitly marked as derived assumptions and remain
 * editable/unapproved until the designer confirms the boundaries.
 */
function supplementSparseVisionProposals(
  proposals: Array<{ kind: string; geometry: Record<string, unknown>; confidence?: number; note?: string }>,
  cv: CvTraceResult,
) {
  const supplemented = [...proposals];
  const source = cv.sourceImageSize;
  const tolerancePx = Math.max(12, Math.round(Math.min(source.widthPx, source.heightPx) * 0.012));
  const matchesExistingWall = (candidate: { x1: number; y1: number; x2: number; y2: number }) => supplemented.some((proposal) => {
    if (proposal.kind !== 'wall') return false;
    const geometry = proposal.geometry as Record<string, unknown>;
    const x1 = (Number(geometry.x1) / 1000) * source.widthPx;
    const y1 = (Number(geometry.y1) / 1000) * source.heightPx;
    const x2 = (Number(geometry.x2) / 1000) * source.widthPx;
    const y2 = (Number(geometry.y2) / 1000) * source.heightPx;
    const direct = Math.max(Math.hypot(x1 - candidate.x1, y1 - candidate.y1), Math.hypot(x2 - candidate.x2, y2 - candidate.y2));
    const reversed = Math.max(Math.hypot(x1 - candidate.x2, y1 - candidate.y2), Math.hypot(x2 - candidate.x1, y2 - candidate.y1));
    return Math.min(direct, reversed) <= tolerancePx;
  });
  const hasRoom = supplemented.some((p) => p.kind === 'room');
  const walls = cv.walls.filter((w) => Number(w.lengthPx) >= 20);
  if (!hasRoom && walls.length >= 2) {
    const xs = walls.flatMap((w) => [w.x1, w.x2]);
    const ys = walls.flatMap((w) => [w.y1, w.y2]);
    const width = cv.sourceImageSize.widthPx;
    const height = cv.sourceImageSize.heightPx;
    const x = Math.max(0, Math.min(...xs));
    const y = Math.max(0, Math.min(...ys));
    const x2 = Math.min(width, Math.max(...xs));
    const y2 = Math.min(height, Math.max(...ys));
    if (x2 - x >= 40 && y2 - y >= 40) {
      supplemented.push({
        kind: 'room',
        confidence: 0.42,
        geometry: { x: Math.round((x / width) * 1000), y: Math.round((y / height) * 1000), width: Math.round(((x2 - x) / width) * 1000), height: Math.round(((y2 - y) / height) * 1000) },
        note: 'Derived plan envelope from traced walls; subdivide rooms during review.',
      });
    }
  }
  const hasOpening = supplemented.some((p) => p.kind === 'opening');
  if (!hasOpening) {
    for (const opening of (cv as CvTraceResult & { openings?: Array<{ approxCenterPx: { x: number; y: number }; approxWidthPx: number; confidence?: number }> }).openings ?? []) {
      supplemented.push({
        kind: 'opening',
        confidence: Number(opening.confidence ?? 0.45),
        geometry: { x: Math.round((opening.approxCenterPx.x / cv.sourceImageSize.widthPx) * 1000), y: Math.round((opening.approxCenterPx.y / cv.sourceImageSize.heightPx) * 1000), width: Math.round((opening.approxWidthPx / cv.sourceImageSize.widthPx) * 1000), kind: 0 },
        note: 'Derived from a collinear wall gap; classify as door or window during review.',
      });
    }
  }
  // One vision wall is not an adequate representation of a multi-room plan.
  // Keep semantic candidates, then add each traced wall that is not already
  // represented as a labelled, low-confidence review candidate.
  for (const wall of walls) {
    if (matchesExistingWall(wall)) continue;
    supplemented.push({ kind: 'wall', confidence: Number(wall.confidence ?? 0.55), geometry: { x1: Math.round((wall.x1 / source.widthPx) * 1000), y1: Math.round((wall.y1 / source.heightPx) * 1000), x2: Math.round((wall.x2 / source.widthPx) * 1000), y2: Math.round((wall.y2 / source.heightPx) * 1000) }, note: 'Deterministic wall trace; confirm against source.' });
  }
  return supplemented;
}

function serverClient(environment: Environment) {
  const url = environment.SUPABASE_URL;
  const secret = environment.SUPABASE_SECRET_KEY || environment.SUPABASE_SERVICE_ROLE_KEY;
  return url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function dataUrl(mimeType: string, bytes: Uint8Array) { return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`; }

async function normalizeRasterForVision(bytes: Uint8Array, mimeType: string) {
  try {
    // Workers AI receives one self-consistent, upright PNG irrespective of a
    // browser filename, EXIF rotation, transparency, or camera encoding. The
    // 2400px cap retains small dimension text while preventing one oversized
    // construction PDF/photo from consuming an unbounded vision request.
    const source = sharp(Buffer.from(bytes), { animated: false, failOn: 'none' }).rotate().flatten({ background: '#ffffff' });
    const png = await source
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const metadata = await sharp(png).metadata();
    if (!metadata.width || !metadata.height) throw new Error('the decoded source has no usable dimensions');
    return { bytes: new Uint8Array(png), mimeType: 'image/png' as const, widthPx: metadata.width, heightPx: metadata.height };
  } catch (error) {
    throw new Error(`The uploaded image could not be normalized for vision: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function rasterizePdf(bytes: Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), 'ultida-plan-'));
  const inputPath = join(directory, 'source.pdf'); const outputPrefix = join(directory, 'page');
  try {
    await writeFile(inputPath, bytes);
    try {
      await execFileAsync(process.env.PDFTOPPM_PATH || 'pdftoppm', ['-f', '1', '-singlefile', '-png', '-r', '180', inputPath, outputPrefix], { windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
      return await readFile(`${outputPrefix}.png`);
    } catch (popplerError) {
      // Vercel does not guarantee a Poppler binary. Sharp's bundled libvips can
      // render the first PDF page on supported builds, so use it before failing
      // the durable job. This keeps PDF and image sources on the exact same
      // normalisation/vision path and prevents a missing OS executable from
      // leaving the designer with an apparently queued analysis.
      try {
        return await sharp(Buffer.from(bytes), { density: 180, pages: 1, failOn: 'none' })
          .flatten({ background: '#ffffff' })
          .png({ compressionLevel: 9 })
          .toBuffer();
      } catch (sharpError) {
        const popplerDetail = popplerError instanceof Error ? popplerError.message : String(popplerError);
        const sharpDetail = sharpError instanceof Error ? sharpError.message : String(sharpError);
        const error = new Error(`PDF_RASTERIZATION_UNAVAILABLE: the first page could not be rendered by Poppler or the built-in image decoder. Install Poppler (pdftoppm) on the API host, set PDFTOPPM_PATH, or upload page one as PNG/JPG. Poppler: ${popplerDetail}. Decoder: ${sharpDetail}`);
        (error as Error & { code?: string }).code = 'PDF_RASTERIZATION_UNAVAILABLE';
        throw error;
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function createPlanAnalysisJob(environment: Environment, request: PlanJobRequest, actorId: string) {
  const client = serverClient(environment);
  if (!client) return { status: 'unavailable' as const, code: 'PLAN_JOB_PERSISTENCE_UNAVAILABLE', reason: 'A server-only Supabase secret key is required for durable plan analysis.' };
  const idempotencyKey = request.idempotencyKey || `plan:${request.projectId}:${request.sourceAssetId}`;
  const existing = await client.from('jobs').select('id,status,output,error,request_id,attempts,max_attempts,queued_at,processing_at,completed_at,failed_at,last_error_code').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing.data) {
    // A user may correct their brief, guides, or provider configuration after a
    // terminal analysis failure. Preserve the same durable job/source lineage,
    // but allow a deliberately requested retry up to its configured limit.
    // Successful and active jobs remain fully idempotent.
    const attempts = Number(existing.data.attempts ?? 0);
    const maxAttempts = Number(existing.data.max_attempts ?? 3);
    const needsQualityRetry = existing.data.status === 'succeeded' && !hasReviewablePlanCoverage(existing.data.output);
    if ((existing.data.status === 'failed' || needsQualityRetry) && attempts < maxAttempts) {
      const queuedAt = new Date().toISOString();
      const retryRequestId = crypto.randomUUID();
      const retried = await client.from('jobs')
        .update({
          status: 'queued',
          error: null,
          output: {},
          request_id: retryRequestId,
          attempts: attempts + 1,
          queued_at: queuedAt,
          processing_at: null,
          completed_at: null,
          failed_at: null,
          last_error_code: null,
          locked_at: null,
          locked_by: null,
          available_at: queuedAt,
          updated_at: queuedAt,
        })
        .eq('id', existing.data.id)
        .eq('status', existing.data.status)
        .select('id,request_id,attempts,max_attempts')
        .maybeSingle();
      if (retried.error) return { status: 'failed' as const, reason: `The previous analysis could not be retried: ${retried.error.message}` };
      if (retried.data) return { status: 'queued' as const, jobId: retried.data.id, requestId: retried.data.request_id, attempts: retried.data.attempts, maxAttempts: retried.data.max_attempts, retry: true, qualityRetry: needsQualityRetry };
    }
    return { status: existing.data.status as 'queued' | 'running' | 'succeeded' | 'failed', jobId: existing.data.id, requestId: existing.data.request_id, attempts: existing.data.attempts, maxAttempts: existing.data.max_attempts, output: existing.data.output, error: existing.data.error };
  }
  const [project, asset] = await Promise.all([
    client.from('projects').select('organization_id').eq('id', request.projectId).single(),
    client.from('project_assets').select('id,storage_path,mime_type').eq('id', request.sourceAssetId).eq('project_id', request.projectId).single()
  ]);
  if (project.error || asset.error || !project.data || !asset.data) return { status: 'not_found' as const, reason: 'The project or its uploaded floor-plan asset was not found.' };
  const requestId = crypto.randomUUID();
  const queuedAt = new Date().toISOString();
  const inserted = await client.from('jobs').insert({
    organization_id: project.data.organization_id,
    project_id: request.projectId,
    kind: 'plan-analysis',
    status: 'queued',
    idempotency_key: idempotencyKey,
    input: { sourceAssetId: request.sourceAssetId, fileName: request.fileName, mimeType: request.mimeType, storagePath: asset.data.storage_path, analysisGuides: Array.isArray(request.analysisGuides) ? request.analysisGuides.slice(0, 24) : [] },
    output: {}, request_id: requestId, queued_at: queuedAt,
    created_by: actorId
  }).select('id').single();
  if (inserted.error || !inserted.data) return { status: 'failed' as const, reason: inserted.error?.message ?? 'The plan analysis job could not be created.' };
  return { status: 'queued' as const, jobId: inserted.data.id, requestId, attempts: 0, maxAttempts: 3 };
}

export async function getPlanAnalysisJob(environment: Environment, projectId: string, jobId: string) {
  const client = serverClient(environment);
  if (!client) return { status: 'unavailable' as const };
  const job = await client.from('jobs').select('id,status,output,error,request_id,attempts,max_attempts,created_at,updated_at,queued_at,processing_at,completed_at,failed_at,last_error_code').eq('id', jobId).eq('project_id', projectId).eq('kind', 'plan-analysis').maybeSingle();
  if (job.error || !job.data) return { status: 'not_found' as const };
  let redispatched = false;
  const lastActivityMs = new Date(job.data.updated_at ?? job.data.created_at).getTime();
  // A serverless request can be interrupted after it claims the job but before
  // it writes a terminal result. Recover only a genuinely idle claim and
  // re-dispatch the exact same idempotent source job.
  // Provider + OCR + deterministic CV can legitimately take several minutes
  // on a cold serverless invocation. Recover only after a lease has been idle
  // beyond the complete bounded analysis window; otherwise polling could
  // launch a duplicate provider request while the original is still working.
  if (job.data.status === 'running' && Number.isFinite(lastActivityMs) && Date.now() - lastActivityMs > 300_000) {
    const reset = await client.from('jobs')
      .update({ status: 'queued', locked_at: null, locked_by: null, queued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', job.data.id)
      .eq('status', 'running');
    if (!reset.error) {
      const dispatch = await dispatchPlanAnalysisJob(environment, job.data.id).catch(() => ({ dispatched: false as const }));
      if (!dispatch.dispatched) await processPlanAnalysisJob(environment, job.data.id);
      return {
        status: 'queued' as const, jobId: job.data.id, requestId: job.data.request_id, attempts: job.data.attempts, maxAttempts: job.data.max_attempts, analysis: job.data.output, error: job.data.error,
        createdAt: job.data.created_at, updatedAt: new Date().toISOString(), queuedAt: new Date().toISOString(), redispatched: dispatch.dispatched,
        recovery: dispatch.dispatched ? 'Recovered a stalled worker claim and re-dispatched the analysis.' : 'Analysis worker recovery could not be dispatched.'
      };
    }
  }
  if (job.data.status === 'queued') {
    // The browser keeps polling while the review is open. Use that authenticated
    // request as a safe self-healing trigger rather than leaving a missed queue
    // handoff stuck forever. Updating updated_at limits this to one dispatch per
    // ten seconds while a worker is unavailable; targeted claiming is idempotent.
    if (Number.isFinite(lastActivityMs) && Date.now() - lastActivityMs > 10_000) {
      const dispatch = await dispatchPlanAnalysisJob(environment, job.data.id).catch(() => ({ dispatched: false as const }));
      if (dispatch.dispatched) {
        redispatched = true;
        await client.from('jobs').update({ updated_at: new Date().toISOString() }).eq('id', job.data.id).eq('status', 'queued');
      }
      // A successful HTTP dispatch is not proof that the queue consumer is
      // alive. After a short grace period, process the exact job directly so
      // the review screen cannot remain queued forever when a consumer is
      // paused or misconfigured.
      if (Date.now() - lastActivityMs > 45_000) {
        await processPlanAnalysisJob(environment, job.data.id);
        const refreshed = await client.from('jobs').select('id,status,output,error,request_id,attempts,max_attempts,created_at,updated_at,queued_at,processing_at,completed_at,failed_at,last_error_code').eq('id', job.data.id).single();
        if (refreshed.data) {
          return { status: refreshed.data.status, jobId: refreshed.data.id, requestId: refreshed.data.request_id, attempts: refreshed.data.attempts, maxAttempts: refreshed.data.max_attempts, analysis: refreshed.data.output, error: refreshed.data.error, createdAt: refreshed.data.created_at, updatedAt: refreshed.data.updated_at, queuedAt: refreshed.data.queued_at, processingAt: refreshed.data.processing_at, completedAt: refreshed.data.completed_at, failedAt: refreshed.data.failed_at, redispatched };
        }
      }
    }
  }
  return { status: job.data.status, jobId: job.data.id, requestId: job.data.request_id, attempts: job.data.attempts, maxAttempts: job.data.max_attempts, analysis: job.data.output, error: job.data.error, createdAt: job.data.created_at, updatedAt: job.data.updated_at, queuedAt: job.data.queued_at, processingAt: job.data.processing_at, completedAt: job.data.completed_at, failedAt: job.data.failed_at, redispatched };
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

async function processClaimedPlanAnalysisJobs(environment: Environment, client: NonNullable<ReturnType<typeof serverClient>>, jobs: Array<Record<string, any>>) {
  for (const job of jobs) {
    // Keep a lightweight durable heartbeat while slow vision/OCR calls are in
    // flight. The polling route can now distinguish real work from an orphaned
    // serverless claim and will not launch a competing analysis job.
    const heartbeat = setInterval(() => {
      const timestamp = new Date().toISOString();
      void (async () => {
        try {
          await client.from('jobs')
            .update({ locked_at: timestamp, updated_at: timestamp })
            .eq('id', job.id)
            .eq('kind', 'plan-analysis')
            .eq('status', 'running')
            .eq('locked_by', job.locked_by ?? environment.ULTIDA_WORKER_ID ?? 'api-plan-worker');
        } catch {
          // A final state write still owns the visible error; a transient
          // heartbeat failure must not terminate the in-flight analysis.
        }
      })();
    }, 25_000);
    try {
      const input = job.input as { sourceAssetId?: string; storagePath?: string; mimeType?: string; fileName?: string; analysisGuides?: AnalysisGuideRegion[] };
      if (!input.storagePath || !input.mimeType || !input.fileName) throw new Error('Plan analysis job has incomplete source metadata.');
      const downloaded = await client.storage.from('project-assets').download(input.storagePath);
      if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message ?? 'The uploaded plan asset could not be downloaded.');
      const original = new Uint8Array(await downloaded.data.arrayBuffer());
      const detectedMimeType = input.mimeType === 'application/pdf' ? null : detectRasterMimeType(original);
      const sourceRasterMimeType = detectedMimeType ?? input.mimeType;
      const rawRaster = input.mimeType === 'application/pdf' ? await rasterizePdf(original) : original;
      const normalized = await normalizeRasterForVision(rawRaster, input.mimeType === 'application/pdf' ? 'image/png' : sourceRasterMimeType);
      const raster = normalized.bytes;
      const analysisMimeType = normalized.mimeType;
      const briefRes = await client.from('project_briefs').select('brief').eq('project_id', job.project_id).maybeSingle();
      const [analysisAttempt, cvTrace, ocr] = await Promise.all([
        analyzePlanWithProvider(environment, { dataUrl: dataUrl(analysisMimeType, raster), fileName: input.fileName, mimeType: analysisMimeType, brief: briefRes.data?.brief, analysisGuides: Array.isArray(input.analysisGuides) ? input.analysisGuides : [] })
          .then((analysis) => ({ analysis, error: null as Error | null }))
          .catch((error) => ({ analysis: null, error: error instanceof Error ? error : new Error('Plan vision analysis failed.') })),
        runCvTrace(environment, raster, analysisMimeType).catch(() => null),
        runPlanOcr(raster),
      ]);
      let analysis: any = analysisAttempt.analysis;
      const tracedWalls = cvTrace?.result?.walls?.filter((wall) => Number(wall.lengthPx) >= 20) ?? [];
      // Vision providers are semantic readers, not the geometry authority. If
      // they both reject a dense drawing but the deterministic tracer found a
      // usable structural set, retain that real evidence as a *review-only*
      // draft. It deliberately requires calibration and room subdivision;
      // nothing is silently declared site-verified.
      if (!analysis && cvTrace?.result?.sourceImageSize && tracedWalls.length >= 4) {
        const proposals = supplementSparseVisionProposals([], cvTrace.result as CvTraceResult);
        const confidences = proposals.map((proposal) => Number(proposal.confidence ?? 0));
        analysis = {
          provider: 'intake-parser',
          proposals,
          intakeResult: { status: 'review_required', reason: 'Vision providers did not return reviewable structured geometry; deterministic wall trace was retained for designer review.' },
          analysisVersion: 'floor-plan-cv-review-fallback.v1',
          source: { fileName: input.fileName, mimeType: analysisMimeType, checksumSha256: createHash('sha256').update(raster).digest('hex'), coordinateSpace: { width: 1000, height: 1000, units: 'source_relative' } },
          ocrEvidence: [],
          calibration: { status: 'required', trustedDimensionMm: null },
          topologyIssues: [{ code: 'VISION_REVIEW_REQUIRED', severity: 'warning', message: 'AI vision did not return a complete semantic model. Review the traced walls, subdivide rooms, and calibrate one visible dimension.' }, { code: 'CALIBRATION_REQUIRED', severity: 'critical', message: 'Set one trusted visible dimension before approving measured geometry.' }],
          providerRuns: [{ provider: 'intake-parser', model: 'wall_tracer.py', status: 'succeeded', latencyMs: 0, error: analysisAttempt.error?.message }],
          reviewStatus: 'needs_review',
          confidenceSummary: { minimum: confidences.length ? Math.min(...confidences) : 0, average: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0, lowConfidenceCount: confidences.filter((value) => value < 0.7).length },
          verifier: null,
        };
      }
      if (!analysis) throw analysisAttempt.error ?? new Error('No configured floor-plan analysis provider is available.');

      // Deterministic CV geometry pass — runs alongside the vision pass and is
      // reconciled into a single candidate per ARCHITECTURE.md invariant #4.
      let reconciled = null;
      let cvStatus = analysis.provider === 'intake-parser' ? 'cv_review_fallback' : 'skipped';
      if (cvTrace && cvTrace.result && (cvTrace.result as unknown as CvTraceResult).walls) {
        try {
          const enrichedProposals = supplementSparseVisionProposals(
            analysis.proposals as Array<{ kind: string; geometry: Record<string, unknown>; confidence?: number; note?: string }>,
            cvTrace.result as unknown as CvTraceResult,
          );
          // Keep the enriched proposals as the editable review source. The
          // original provider response remains available in provenance/output.
          analysis.proposals = enrichedProposals as typeof analysis.proposals;
          const vision = visionProposalsToSemantic(
            enrichedProposals,
            cvTrace.result.sourceImageSize,
          );
          reconciled = reconcilePlan(cvTrace.result as unknown as CvTraceResult, vision);
          cvStatus = 'reconciled';
        } catch (reconcileError) {
          cvStatus = `reconcile_failed: ${reconcileError instanceof Error ? reconcileError.message : String(reconcileError)}`;
        }
      } else if (cvTrace && cvTrace.stderr) {
        cvStatus = `cv_unavailable: ${cvTrace.stderr.slice(0, 160)}`;
      }

      const output = {
        ...analysis,
        sourceAssetId: input.sourceAssetId,
        sourceMimeType: input.mimeType,
        analysisMimeType,
        normalizedSource: { widthPx: normalized.widthPx, heightPx: normalized.heightPx, maxDimensionPx: 2400 },
        ocrEvidence: { status: ocr.status, text: ocr.text, measurements: ocr.measurements },
        cvCandidate: cvTrace?.result ?? null,
        reconciled,
        cvStatus,
      };
      const outputHash = createHash('sha256').update(JSON.stringify(output)).digest('hex');
      const analysisUuid = crypto.randomUUID();
      const primaryRun = (Array.isArray(analysis.providerRuns) ? analysis.providerRuns : []).find((run: { status?: string }) => run.status === 'succeeded') ?? analysis.providerRuns?.[0];
      const persistedAnalysis = await client.from('plan_analyses').insert({
        organization_id: job.organization_id,
        project_id: job.project_id,
        analysis_uuid: analysisUuid,
        provider: primaryRun?.provider ?? 'unknown',
        model: primaryRun?.model ?? 'unknown',
        prompt_version: analysis.analysisVersion,
        source_file_name: input.fileName,
        source_mime_type: input.mimeType,
        input_sha256: analysis.source?.checksumSha256 ?? createHash('sha256').update(original).digest('hex'),
        preview_sha256: createHash('sha256').update(raster).digest('hex'),
        request_payload: { brief: briefRes.data?.brief ?? null, analysisGuides: input.analysisGuides ?? [] },
        deterministic: { cvStatus, cvCandidate: cvTrace?.result ?? null, reconciled, ocrEvidence: { status: ocr.status, text: ocr.text, measurements: ocr.measurements } },
        response_validated: analysis,
        latency_ms: Math.max(0, Number(primaryRun?.latencyMs ?? 0)),
        usage: null,
        status: 'succeeded',
        error: null,
      }).select('analysis_uuid').single();
      if (persistedAnalysis.error) throw new Error(`Plan analysis could not be persisted: ${persistedAnalysis.error.message}`);
      const draft = await client.from('plan_analysis_drafts').insert({
        organization_id: job.organization_id,
        project_id: job.project_id,
        analysis_uuid: analysisUuid,
        elements: analysis.proposals,
        issues: analysis.topologyIssues ?? [],
        scale: null,
        ceiling_height_mm: null,
        status: 'needs_review',
      }).select('analysis_uuid').single();
      if (draft.error) throw new Error(`Plan review draft could not be persisted: ${draft.error.message}`);
      const persistedOutput = { ...output, analysisUuid };
      const providerRuns = Array.isArray(analysis.providerRuns) ? analysis.providerRuns : [];
      if (providerRuns.length) {
        const auditRows = providerRuns.map((run: { provider?: string; model?: string; status?: string; latencyMs?: number }) => ({
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
      const completedAt = new Date().toISOString();
      await client.from('jobs').update({ status: 'succeeded', output: persistedOutput, error: null, completed_at: completedAt, last_error_code: null, locked_at: null, locked_by: null, updated_at: completedAt }).eq('id', job.id);
    } catch (error) {
      const typedError = error as Error & { code?: string };
      const failedAt = new Date().toISOString();
      await client.from('jobs').update({ status: 'failed', failed_at: failedAt, last_error_code: typedError.code ?? 'PLAN_ANALYSIS_FAILED', error: { code: typedError.code ?? 'PLAN_ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Plan analysis failed.' }, locked_at: null, locked_by: null, updated_at: failedAt }).eq('id', job.id);
    } finally {
      clearInterval(heartbeat);
    }
  }
}

export async function processPlanAnalysisJobs(environment: Environment, limit = 2) {
  const client = serverClient(environment);
  if (!client) return;
  // This runs only as a recovery sweep; queue-delivered jobs retain their
  // exact message priority. For a missed handoff, newest first prevents an
  // active designer's plan being stuck behind abandoned historical jobs.
  const candidates = await client
    .from('jobs')
    .select('id')
    .eq('kind', 'plan-analysis')
    .eq('status', 'queued')
    .lte('available_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 10)));
  if (candidates.error) throw new Error(`Plan job recovery lookup failed: ${candidates.error.message}`);
  for (const candidate of candidates.data ?? []) {
    await processPlanAnalysisJob(environment, String(candidate.id));
  }
}

/** Process the exact queue message that Cloudflare delivered, so older jobs
 * cannot delay the designer's current floor-plan analysis. */
export async function processPlanAnalysisJob(environment: Environment, jobId: string) {
  const client = serverClient(environment);
  if (!client) return;
  const workerId = environment.ULTIDA_WORKER_ID || 'api-plan-worker';
  const now = new Date().toISOString();
  const claimed = await client
    .from('jobs')
    .update({ status: 'running', processing_at: now, locked_at: now, locked_by: workerId, updated_at: now })
    .eq('id', jobId)
    .eq('kind', 'plan-analysis')
    .eq('status', 'queued')
    .lte('available_at', now)
    .select('*')
    .maybeSingle();
  if (claimed.error) throw new Error(`Targeted plan job claim failed: ${claimed.error.message}`);
  if (!claimed.data) return;
  await processClaimedPlanAnalysisJobs(environment, client, [claimed.data as Record<string, any>]);
}

// Narrow test seam for coordinate reconciliation. Runtime callers use only
// the durable job functions above.
export const __test__ = { visionProposalsToSemantic, hasReviewablePlanCoverage };
