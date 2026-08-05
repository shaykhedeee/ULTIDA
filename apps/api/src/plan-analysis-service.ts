import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import { getVisionProvider, type PlanVisionOutput } from '@ultida/agent-core';

const execFileAsync = promisify(execFile);

export type FileCategory =
  | 'raster' // image source normalized to PNG before vision
  | 'pdf'
  | 'vector' // svg/dxf
  | 'unsupported';

export function classifyFile(fileName: string, mimeType: string): FileCategory {
  const lower = (fileName || '').toLowerCase();
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (
    mimeType.startsWith('image/png') ||
    mimeType.startsWith('image/jpeg') ||
    mimeType.startsWith('image/webp') ||
    mimeType.startsWith('image/gif') ||
    mimeType.startsWith('image/bmp') ||
    mimeType.startsWith('image/tiff') ||
    mimeType.startsWith('image/avif') ||
    mimeType.startsWith('image/heic') ||
    mimeType.startsWith('image/heif') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.bmp') ||
    lower.endsWith('.tif') ||
    lower.endsWith('.tiff') ||
    lower.endsWith('.avif') ||
    lower.endsWith('.heic') ||
    lower.endsWith('.heif')
  )
    return 'raster';
  if (lower.endsWith('.svg') || lower.endsWith('.dxf')) return 'vector';
  return 'unsupported';
}

export const UNSUPPORTED_FORMATS = ['dwg', 'iges', 'step', 'password-protected-pdf'];

export type PlanElementDraft = {
  id: string;
  kind: 'wall' | 'room' | 'door' | 'window' | 'column' | 'beam' | 'service' | 'annotation' | 'dimension';
  label: string;
  confidence: number;
  status: 'needs_review';
  geometry: Record<string, number | string | undefined>;
  source: 'ai' | 'ocr' | 'line' | 'mixed';
  note?: string;
};

export type PlanIssueDraft = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
};

export type AnalysisResult = {
  analysisUuid: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  inputSha256: string;
  previewSha256: string;
  sourceFileName: string;
  sourceMimeType: string;
  promptVersion: string;
  elements: PlanElementDraft[];
  issues: PlanIssueDraft[];
  deterministic: {
    lineWallCount: number;
    openingCount: number;
    ocrText: string;
  };
  responseValidated: PlanVisionOutput;
  previewDataUrl: string;
};

const PROMPT_VERSION = 'floor-plan-vision.v1';

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizeToGrid(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1000, Math.round((value / max) * 1000)));
}

/**
 * Run the deterministic OpenCV wall tracer on a raster PNG.
 * Returns walls/openings in PIXEL space + image dimensions, or null if the
 * Python environment / opencv is unavailable (caller treats that as a soft
 * failure, not a fake result).
 */
export async function runWallTracer(pngPath: string): Promise<{
  widthPx: number;
  heightPx: number;
  walls: Array<{ x1: number; y1: number; x2: number; y2: number; thicknessPx: number }>;
  openings: Array<{ x: number; y: number; widthPx: number }>;
} | null> {
  // Resolve the wall_tracer.py script relative to the repo root (it lives at
  // <repo>/floorplan analyser/ultida-flow-kit/cv/wall_tracer.py). Walk up from
  // this module's location to find the repo root regardless of src/dist layout.
  const { fileURLToPath } = await import('node:url');
  let dir = dirname(fileURLToPath(import.meta.url));
  let scriptPath = '';
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'floorplan analyser', 'ultida-flow-kit', 'cv', 'wall_tracer.py');
    if (existsSync(candidate)) {
      scriptPath = candidate;
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!scriptPath) return null;
  try {
    const outPath = `${pngPath}.cv.json`;
    let pythonError: unknown;
    for (const executable of process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python']) {
      try {
        await execFileAsync(executable, [scriptPath, pngPath, outPath], { timeout: 120_000 });
        pythonError = undefined;
        break;
      } catch (error) {
        pythonError = error;
      }
    }
    if (pythonError) throw pythonError;
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(outPath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      sourceImageSize?: { widthPx: number; heightPx: number };
      walls?: Array<{ x1: number; y1: number; x2: number; y2: number; thicknessPx?: number }>;
      openings?: Array<{ x: number; y: number; widthPx?: number }>;
    };
    return {
      widthPx: parsed.sourceImageSize?.widthPx ?? 1000,
      heightPx: parsed.sourceImageSize?.heightPx ?? 1000,
      walls: (parsed.walls ?? []).map((w) => ({
        x1: w.x1,
        y1: w.y1,
        x2: w.x2,
        y2: w.y2,
        thicknessPx: w.thicknessPx ?? 0,
      })),
      openings: (parsed.openings ?? []).map((o) => ({ x: o.x, y: o.y, widthPx: o.widthPx ?? 0 })),
    };
  } catch {
    return null;
  }
}

async function runOcr(pngPath: string): Promise<string> {
  let worker: Worker | null = null;
  try {
    worker = await createWorker('eng');
    const { data } = await worker.recognize(pngPath);
    return (data.text || '').trim();
  } catch {
    return '';
  } finally {
    if (worker) await worker.terminate();
  }
}

/** Build a normalized PNG raster buffer for CV/OCR from an image input. */
export async function rasterizeImage(buffer: Buffer, mimeType: string): Promise<{ png: Buffer; width: number; height: number }> {
  const image = sharp(buffer, { failOn: 'none' });
  const meta = await image.metadata();
  const width = meta.width ?? 1000;
  const height = meta.height ?? 1000;
  const longest = Math.max(width, height);
  const resize = longest > 1600 ? { width: Math.round((width / longest) * 1600), height: Math.round((height / longest) * 1600) } : undefined;
  const png = await image
    .resize(resize)
    .png()
    .toBuffer();
  const pngMeta = await sharp(png).metadata();
  return { png, width: pngMeta.width ?? width, height: pngMeta.height ?? height };
}

/**
 * Reconcile AI semantic candidates with deterministic CV/OCR evidence.
 * - Walls: if a deterministic CV wall is within tolerance of an AI wall in the
 *   0-1000 grid, mark it `mixed` and prefer the CV geometry.
 * - Dimensions: if an AI dimension lacks a value but OCR nearby contains a
 *   number, we surface the OCR text as a note (we do NOT invent mm values).
 */
export function reconcileToElements(
  ai: PlanVisionOutput,
  cv: { widthPx: number; heightPx: number; walls: Array<{ x1: number; y1: number; x2: number; y2: number }> } | null,
  ocrText: string
): { elements: PlanElementDraft[]; issues: PlanIssueDraft[] } {
  const elements: PlanElementDraft[] = [];
  const issues: PlanIssueDraft[] = [];
  const num = (v: number | string | undefined): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : 0);
  const str = (v: string | undefined, fallback: string): string => (typeof v === 'string' && v.length ? v : fallback);

  // Deterministic CV walls normalized to 0-1000
  const cvWalls = (cv?.walls ?? []).map((w) => ({
    x1: normalizeToGrid(w.x1, cv!.widthPx),
    y1: normalizeToGrid(w.y1, cv!.heightPx),
    x2: normalizeToGrid(w.x2, cv!.widthPx),
    y2: normalizeToGrid(w.y2, cv!.heightPx),
  }));

  const wallDist = (a: { x1?: number; y1?: number; x2?: number; y2?: number }, b: { x1: number; y1: number; x2: number; y2: number }) => {
    const d1 = Math.hypot((a.x1 ?? 0) - b.x1, (a.y1 ?? 0) - b.y1);
    const d2 = Math.hypot((a.x2 ?? 0) - b.x2, (a.y2 ?? 0) - b.y2);
    return Math.max(d1, d2);
  };

  for (const w of ai.wallCandidates) {
    const geo = { x1: num(w.x1), y1: num(w.y1), x2: num(w.x2), y2: num(w.y2) };
    const match = cvWalls.find((c) => wallDist(geo, c) < 40);
    elements.push({
      id: str(w.id, `w${elements.length}`),
      kind: 'wall',
      label: str(w.label, `Wall ${w.id ?? elements.length}`),
      confidence: num(w.confidence),
      status: 'needs_review',
      geometry: match ? { x1: match.x1, y1: match.y1, x2: match.x2, y2: match.y2 } : geo,
      source: match ? 'mixed' : 'ai',
      note: w.notes,
    });
  }

  for (const r of ai.roomCandidates) {
    const poly = r.polygon ?? [];
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    elements.push({
      id: str(r.id, `r${elements.length}`),
      kind: 'room',
      label: str(r.label, `Room ${r.id ?? elements.length}`),
      confidence: num(r.confidence),
      status: 'needs_review',
      geometry: {
        x: xs.length ? Math.min(...xs) : 0,
        y: ys.length ? Math.min(...ys) : 0,
        width: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
        height: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
      },
      source: r.source,
      note: r.notes,
    });
  }

  for (const d of ai.doorCandidates) {
    elements.push({ id: str(d.id, `d${elements.length}`), kind: 'door', label: `Door ${d.id ?? elements.length}`, confidence: num(d.confidence), status: 'needs_review', geometry: { x: num(d.x), y: num(d.y), width: num(d.width) }, source: d.source, note: d.notes });
  }

  for (const win of ai.windowCandidates) {
    elements.push({ id: str(win.id, `win${elements.length}`), kind: 'window', label: `Window ${win.id ?? elements.length}`, confidence: num(win.confidence), status: 'needs_review', geometry: { x: num(win.x), y: num(win.y), width: num(win.width), height: num(win.height) }, source: win.source, note: win.notes });
  }

  for (const dim of ai.dimensionCandidates) {
    const hasOcrNumber = /\d/.test(ocrText);
    elements.push({
      id: str(dim.id, `dim${elements.length}`),
      kind: 'dimension',
      label: `Dimension ${dim.id ?? elements.length}`,
      confidence: num(dim.confidence),
      status: 'needs_review',
      geometry: { x1: num(dim.x1), y1: num(dim.y1), x2: num(dim.x2), y2: num(dim.y2), ...(num(dim.valueMm) !== 0 ? { valueMm: num(dim.valueMm) } : {}) },
      source: dim.source,
      note: !dim.valueMm && hasOcrNumber ? `OCR nearby may contain this value: "${ocrText.slice(0, 40)}"` : dim.notes,
    });
  }

  for (const c of ai.columnCandidates) {
    elements.push({ id: str(c.id, `col${elements.length}`), kind: 'column', label: `Column ${c.id ?? elements.length}`, confidence: num(c.confidence), status: 'needs_review', geometry: { x: num(c.x), y: num(c.y) }, source: c.source, note: c.notes });
  }
  for (const b of ai.beamCandidates) {
    elements.push({ id: str(b.id, `beam${elements.length}`), kind: 'beam', label: `Beam ${b.id ?? elements.length}`, confidence: num(b.confidence), status: 'needs_review', geometry: { x1: num(b.x1), y1: num(b.y1), x2: num(b.x2), y2: num(b.y2) }, source: b.source, note: b.notes });
  }
  for (const s of ai.services) {
    elements.push({ id: str(s.id, `svc${elements.length}`), kind: 'service', label: `${s.type ?? 'service'} ${s.id ?? elements.length}`, confidence: num(s.confidence), status: 'needs_review', geometry: { x: num(s.x), y: num(s.y) }, source: s.source, note: s.notes });
  }
  for (const a of ai.annotations) {
    elements.push({ id: str(a.id, `ann${elements.length}`), kind: 'annotation', label: str(a.text, `Note ${a.id ?? elements.length}`), confidence: num(a.confidence), status: 'needs_review', geometry: { x: num(a.x), y: num(a.y) }, source: a.source });
  }

  // Issues from AI uncertainty / warnings
  for (const warn of ai.warnings) {
    issues.push({ id: `warn-${issues.length}`, question: String(warn), optionA: 'Accept as noted', optionB: 'Reject affected proposal' });
  }
  for (const u of ai.uncertainRegions) {
    issues.push({ id: `unc-${issues.length}`, question: `Uncertain region: ${u.reason ?? 'unknown'}`, optionA: 'Flag for manual review', optionB: 'Ignore' });
  }
  if (cv && cv.walls.length === 0 && ai.wallCandidates.length === 0) {
    issues.push({ id: 'no-walls', question: 'No walls detected by either CV or vision. Confirm the plan is not blank or rotated.', optionA: 'Review manually', optionB: 'Reject' });
  }

  return { elements, issues };
}

export async function analyzePlanFile(input: {
  projectId: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  accessToken?: string;
}): Promise<AnalysisResult> {
  const category = classifyFile(input.fileName, input.mimeType);
  if (category === 'unsupported') {
    const err = new Error(`Unsupported file format: ${input.fileName}. Supported: PNG, JPG, WebP, GIF, BMP, TIFF, AVIF, HEIC/HEIF, SVG, and PDF. Excluded: DWG, DXF, IGES, STEP.`);
    (err as any).code = 'UNSUPPORTED_FORMAT';
    (err as any).status = 415;
    throw err;
  }

  const provider = getVisionProvider(process.env);
  if (!provider) {
    const err = new Error('A real AI vision provider is required for floor-plan analysis but none is configured (set OPENAI_API_KEY, GEMINI_*, or CLOUDFLARE_*).');
    (err as any).code = 'AI_PROVIDER_NOT_CONFIGURED';
    (err as any).status = 503;
    throw err;
  }

  const inputSha256 = sha256(input.buffer);
  const analysisUuid = randomUUID();
  const prompt = buildVisionPrompt();

  // ---- Build a raster PNG for deterministic CV + OCR ----
  let rasterPng: Buffer;
  let rasterWidth = 1000;
  let rasterHeight = 1000;
  if (category === 'raster') {
    const r = await rasterizeImage(input.buffer, input.mimeType);
    rasterPng = r.png;
    rasterWidth = r.width;
    rasterHeight = r.height;
  } else {
    // PDF: Gemini rasterizes server-side; we still need a raster for CV/OCR.
    // Without a PDF rasterizer on this host we skip deterministic CV/OCR for PDF
    // and rely on the vision provider (honest: deterministic evidence absent).
    rasterPng = input.buffer;
  }

  const workDir = await mkdtemp(join(tmpdir(), 'ultida-plan-'));
  const pngPath = join(workDir, 'source.png');
  await writeFile(pngPath, rasterPng);

  const [cvResult, ocrText] = await Promise.all([
    category === 'raster' ? runWallTracer(pngPath) : Promise.resolve(null),
    category === 'raster' ? runOcr(pngPath) : Promise.resolve(''),
  ]);

  // ---- Vision provider call ----
  // Gemini accepts PDF directly; others need a raster PNG.
  let imageForVision: string;
  let mimeForVision: string;
  if (category === 'pdf' && provider.name === 'gemini') {
    imageForVision = input.buffer.toString('base64');
    mimeForVision = 'application/pdf';
  } else if (category === 'pdf') {
    // Non-Gemini providers cannot ingest PDF on this host (no rasterizer).
    const err = new Error('PDF analysis requires a configured PDF-capable vision provider. Upload a supported raster image if PDF processing is unavailable.');
    (err as any).code = 'PDF_REQUIRES_GEMINI';
    (err as any).status = 415;
    throw err;
  } else {
    imageForVision = rasterPng.toString('base64');
    mimeForVision = 'image/png';
  }

  const started = Date.now();
  const visionResult = await provider.analyze(imageForVision, mimeForVision, prompt, analysisUuid);
  const latencyMs = Date.now() - started;

  const previewSha256 = sha256(rasterPng);
  const { elements, issues } = reconcileToElements(
    visionResult.output,
    cvResult ? { widthPx: cvResult.widthPx, heightPx: cvResult.heightPx, walls: cvResult.walls } : null,
    ocrText
  );

  await rm(workDir, { recursive: true, force: true }).catch(() => {});

  return {
    analysisUuid,
    provider: visionResult.metadata.provider,
    model: visionResult.metadata.model,
    latencyMs: visionResult.metadata.latencyMs || latencyMs,
    usage: visionResult.metadata.usage,
    inputSha256,
    previewSha256,
    sourceFileName: input.fileName,
    sourceMimeType: input.mimeType,
    promptVersion: PROMPT_VERSION,
    elements,
    issues,
    deterministic: {
      lineWallCount: cvResult?.walls.length ?? 0,
      openingCount: cvResult?.openings.length ?? 0,
      ocrText,
    },
    responseValidated: visionResult.output,
    previewDataUrl: `data:image/png;base64,${rasterPng.toString('base64')}`,
  };
}

export function buildVisionPrompt(): string {
  return `You are the floor-plan vision stage of a professional interior-design platform. Read the supplied plan image without redesigning it.

Extract only visible evidence across these categories:
- documentType (plan/section/elevation/detail/other)
- orientation (e.g. north_up or unknown)
- unitSuggestion (mm/cm/m/ft/in)
- roomCandidates: polygon points on a 0..1000 grid (x right, y down), each a closed loop, with a short label
- wallCandidates: line segments x1,y1,x2,y2 on the 0..1000 grid
- doorCandidates: x,y,width(mm-equivalent on grid) and hingeSide if visible
- windowCandidates: x,y,width,height
- dimensionCandidates: x1,y1,x2,y2 and the legible valueMm when the text is clearly readable
- columnCandidates, beamCandidates, shaftCandidates, stairCandidates
- fixedFixtures (toilet/sink/bathtub/shower/stove/fridge) with x,y
- services (electrical/plumbing/hvac/gas) with x,y
- annotations: any visible text with x,y
- uncertainRegions: polygons where the drawing is ambiguous, with a reason
- assumptions: anything you inferred rather than read
- warnings: risks for the designer

COORDINATES
- Return every coordinate on a source-relative 0..1000 grid: x=0 left, x=1000 right, y=0 top, y=1000 bottom.
- Set confidence below 0.70 for faint, occluded, ambiguous or inferred entities.
- A dimension may include valueMm only when its text is legible; otherwise omit valueMm.
- Do not invent a wall, room or opening that is not visible.
- Never return mm values derived purely from image scale — only use printed dimension text.

SELF CHECK
1. All coordinates finite and within 0..1000.
2. Walls have non-zero length; rooms have positive width/height.
3. Preserve uncertainty; do not over-claim.
4. Output JSON only matching the required schema.`;
}
