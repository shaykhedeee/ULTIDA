import { createHash } from 'node:crypto';
import { PROMPT_VERSIONS } from '@ultida/agent-core';
import { PlanProposalSchema, parsePlanIntake, type PlanProposal, type PlanIntakeResult } from '@ultida/plan-core';

type Environment = Record<string, string | undefined>;
type Input = { dataUrl: string; fileName: string; mimeType: string };
type ProviderRun = { provider: 'openai' | 'gemini' | 'cloudflare' | 'intake-parser'; model: string; status: 'succeeded' | 'failed'; latencyMs: number; error?: string };

function providerTimeoutMs(environment: Environment) {
  const parsed = Number(environment.PLAN_ANALYZER_TIMEOUT_MS ?? 60_000);
  return Number.isFinite(parsed) ? Math.max(5_000, Math.min(parsed, 120_000)) : 60_000;
}

function fetchWithProviderTimeout(environment: Environment, input: RequestInfo | URL, init: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(providerTimeoutMs(environment)) });
}

function geminiVisionKey(environment: Environment) {
  return environment.GEMINI_VISION_API_KEY || environment.GEMINI_API_KEY || environment.GOOGLE_AI_STUDIO_KEY_1 || environment.GOOGLE_AI_STUDIO_KEY_2;
}

const prompt = `You are the extraction stage of a professional interior floor-plan review system. Read the supplied source without redesigning it.

Extract only visible evidence: walls, room zones, doors/windows/passages, room labels and written dimensions. Never invent a dimension, wall or opening. Preserve uncertainty.

COORDINATES
- Return every coordinate on a source-relative 0..1000 grid: x=0 left, x=1000 right, y=0 top, y=1000 bottom.
- Walls use x1,y1,x2,y2. Rooms use x,y,width,height. Openings use x,y,width,kind where kind 0=door and 1=window. Dimensions use x1,y1,x2,y2,valueMm.
- Set confidence below 0.70 for occluded, faint, ambiguous or inferred entities.
- A dimension may be returned only when its text is legible; otherwise omit it.
- Do not merge separate parallel wall faces into arbitrary geometry.

SELF CHECK
1. All coordinates are finite and within 0..1000.
2. Walls have non-zero length.
3. Rooms have positive width and height.
4. Notes state the visible evidence or uncertainty.
5. Return 12-24 proposals with this balanced target: 8-12 major walls, 3-5 room zones, 2-5 openings, and up to 3 legible dimensions.
6. Do not split a straight wall into redundant collinear fragments. Omit an entity class only when no visible evidence exists.
7. Keep each note to 12 words or fewer.
8. Output JSON only as {"proposals":[{"kind":"wall|opening|room|dimension","confidence":0.0,"geometry":{},"note":""}]}.`;

function clampCoordinate(value: number) { return Math.max(0, Math.min(1000, value)); }

function normalizeGeometry(kind: PlanProposal['kind'], geometry: Record<string, unknown>) {
  const normalized: Record<string, number> = {};
  for (const [key, raw] of Object.entries(geometry)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    normalized[key] = key === 'valueMm' ? Math.max(0, value) : key === 'kind' ? Math.max(0, Math.min(1, Math.round(value))) : clampCoordinate(value);
  }
  if (kind === 'room') {
    normalized.width = Math.max(0, Math.min(1000 - (normalized.x ?? 0), normalized.width ?? 0));
    normalized.height = Math.max(0, Math.min(1000 - (normalized.y ?? 0), normalized.height ?? 0));
  }
  return normalized;
}

function parseProposals(raw: string, source: 'ocr' | 'detector'): PlanProposal[] {
  const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()) as { proposals?: unknown[] };
  const proposals = (parsed.proposals ?? []).map((item, index) => {
    const value = item as { kind?: PlanProposal['kind']; confidence?: unknown; geometry?: Record<string, unknown>; note?: unknown };
    return { id: crypto.randomUUID(), kind: value.kind, confidence: Math.max(0, Math.min(1, Number(value.confidence ?? 0))), source, status: 'needs_review' as const, geometry: normalizeGeometry(value.kind ?? 'wall', value.geometry ?? {}), note: typeof value.note === 'string' ? value.note : `Provider proposal ${index + 1} requires review.` };
  });
  const result = PlanProposalSchema.array().safeParse(proposals);
  if (!result.success) throw new Error('Plan analyzer returned an invalid proposal shape.');
  return result.data;
}

function topologyIssues(proposals: PlanProposal[]) {
  const issues: Array<{ code: string; severity: 'warning' | 'critical'; entityId?: string; message: string }> = [];
  for (const proposal of proposals) {
    const g = proposal.geometry;
    if (proposal.kind === 'wall' && Math.hypot((g.x2 ?? 0) - (g.x1 ?? 0), (g.y2 ?? 0) - (g.y1 ?? 0)) < 2) issues.push({ code: 'ZERO_LENGTH_WALL', severity: 'critical', entityId: proposal.id, message: 'Wall has zero or negligible source length.' });
    if (proposal.kind === 'room' && ((g.width ?? 0) <= 0 || (g.height ?? 0) <= 0)) issues.push({ code: 'INVALID_ROOM_BOUNDS', severity: 'critical', entityId: proposal.id, message: 'Room bounds are not positive.' });
    if (proposal.kind === 'dimension' && (g.valueMm ?? 0) <= 0) issues.push({ code: 'UNREADABLE_DIMENSION', severity: 'warning', entityId: proposal.id, message: 'Dimension has no trusted positive millimetre value.' });
    if (proposal.confidence < 0.7) issues.push({ code: 'LOW_CONFIDENCE', severity: 'warning', entityId: proposal.id, message: 'Designer review is required for this low-confidence entity.' });
  }
  if (!proposals.some((proposal) => proposal.kind === 'dimension' && (proposal.geometry.valueMm ?? 0) > 0)) issues.push({ code: 'CALIBRATION_REQUIRED', severity: 'critical', message: 'Enter one trusted dimension before approving measured geometry.' });
  return issues;
}

async function analyzeOpenAi(environment: Environment, input: Input) {
  if (input.mimeType === 'application/pdf') throw new Error('OpenAI PDF rasterization is not configured; Gemini handles PDF analysis in this deployment.');
  const model = environment.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const response = await fetchWithProviderTimeout(environment, 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${environment.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_schema', json_schema: { name: 'floor_plan_analysis_v1', strict: true, schema: { type: 'object', additionalProperties: false, required: ['proposals'], properties: { proposals: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'object', additionalProperties: false, required: ['kind', 'confidence', 'geometry', 'note'], properties: { kind: { type: 'string', enum: ['wall', 'opening', 'room', 'dimension'] }, confidence: { type: 'number', minimum: 0, maximum: 1 }, geometry: { type: 'object', additionalProperties: { type: 'number' } }, note: { type: 'string', maxLength: 160 } } } } } } } }, messages: [{ role: 'system', content: prompt }, { role: 'user', content: [{ type: 'text', text: `Source file ${input.fileName}. Extract visible plan evidence and run the self-check.` }, { type: 'image_url', image_url: { url: input.dataUrl, detail: 'high' } }] }] }) });
  if (!response.ok) throw new Error(`OpenAI plan analyzer failed (${response.status}).`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI plan analyzer returned no proposal content.');
  return { model, proposals: parseProposals(content, 'detector') };
}

async function analyzeGemini(environment: Environment, input: Input) {
  const model = environment.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
  const apiKey = geminiVisionKey(environment);
  const response = await fetchWithProviderTimeout(environment, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey ?? '')}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }, contents: [{ parts: [{ text: `${prompt}\nSource file: ${input.fileName}` }, { inlineData: { mimeType: input.mimeType, data: input.dataUrl.split(',')[1] } }] }] }) });
  if (!response.ok) throw new Error(`Gemini plan analyzer failed (${response.status}).`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!content) throw new Error('Gemini plan analyzer returned no proposal content.');
  return { model, proposals: parseProposals(content, 'ocr') };
}

async function analyzeCloudflare(environment: Environment, input: Input) {
  const accountId = environment.CLOUDFLARE_ACCOUNT_ID;
  const token = environment.CLOUDFLARE_AI_TOKEN;
  if (!accountId || !token) throw new Error('Cloudflare Workers AI credentials are not configured.');

  const candidateModels = Array.from(new Set([
    environment.CLOUDFLARE_VISION_MODEL,
    environment.CLOUDFLARE_PLAN_MODEL,
    '@cf/meta/llama-3.2-11b-vision-instruct',
    '@cf/llava-hl/llava-1.5-7b-hf'
  ].filter(Boolean) as string[]));

  let lastError: Error | null = null;
  for (const model of candidateModels) {
    if (model.includes('8b-instruct') && !model.includes('vision')) continue;
    try {
      const response = await fetchWithProviderTimeout(environment, `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'system', content: prompt }, { role: 'user', content: `Extract the visible floor-plan evidence from ${input.fileName}. Return the required JSON only.` }], image: input.dataUrl }) });
      const payload = await response.json() as { success?: boolean; result?: { response?: string; text?: string }; errors?: Array<{ message?: string }> };
      if (response.ok && payload.success && (payload.result?.response || payload.result?.text)) {
        const content = payload.result.response || payload.result.text!;
        return { model, proposals: parseProposals(content, 'detector') };
      }
      lastError = new Error(payload.errors?.map((e) => e.message).join(', ') || `Cloudflare ${model} returned HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(`Cloudflare ${model} request failed.`);
    }
  }
  throw lastError || new Error('All Cloudflare vision models failed.');
}

export async function analyzePlanWithProvider(environment: Environment, input: Input) {
  const intakeResult: PlanIntakeResult = parsePlanIntake({
    projectId: 'active-project',
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.dataUrl.length,
    textContent: input.dataUrl.startsWith('data:text') ? Buffer.from(input.dataUrl.split(',')[1], 'base64').toString('utf-8') : undefined
  });

  const configured = [environment.OPENAI_API_KEY ? 'openai' : null, geminiVisionKey(environment) ? 'gemini' : null, environment.CLOUDFLARE_ACCOUNT_ID && environment.CLOUDFLARE_AI_TOKEN && (environment.CLOUDFLARE_VISION_MODEL || environment.CLOUDFLARE_PLAN_MODEL) ? 'cloudflare' : null].filter(Boolean) as Array<'openai' | 'gemini' | 'cloudflare'>;

  if (!configured.length && environment.PLAN_ANALYZER_MODE !== 'baseline') {
    const error = new Error('A real AI vision provider is required for floor-plan analysis.');
    (error as any).code = 'AI_PROVIDER_NOT_CONFIGURED';
    (error as any).stage = 'ai_analysis';
    (error as any).status = 503;
    (error as any).retryable = false;
    throw error;
  }
  if (!configured.length) {
    const issues = topologyIssues(intakeResult.proposals);
    const confidences = intakeResult.proposals.map((proposal) => proposal.confidence);
    return {
      provider: 'intake-parser',
      proposals: intakeResult.proposals,
      intakeResult,
      analysisVersion: PROMPT_VERSIONS.floorPlanAnalyzer,
      source: { fileName: input.fileName, mimeType: input.mimeType, checksumSha256: createHash('sha256').update(input.dataUrl).digest('hex'), coordinateSpace: { width: 1000, height: 1000, units: 'source_relative' } },
      ocrEvidence: intakeResult.proposals.filter((proposal) => proposal.kind === 'dimension' || proposal.kind === 'room'),
      calibration: { status: 'required', trustedDimensionMm: null },
      topologyIssues: issues,
      providerRuns: [{ provider: 'intake-parser' as const, model: intakeResult.sourceFormat, status: 'succeeded' as const, latencyMs: 2 }],
      reviewStatus: 'needs_review',
      confidenceSummary: { minimum: confidences.length ? Math.min(...confidences) : 0, average: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0, lowConfidenceCount: confidences.filter((value) => value < 0.7).length },
      verifier: null
    };
  }

  const runs: ProviderRun[] = [];
  const execute = async (provider: 'openai' | 'gemini' | 'cloudflare') => {
    const started = Date.now();
    try {
      const result = provider === 'openai' ? await analyzeOpenAi(environment, input) : provider === 'gemini' ? await analyzeGemini(environment, input) : await analyzeCloudflare(environment, input);
      runs.push({ provider, model: result.model, status: 'succeeded', latencyMs: Date.now() - started });
      return { provider, ...result };
    } catch (error) {
      runs.push({ provider, model: provider === 'openai' ? environment.OPENAI_VISION_MODEL || 'gpt-4o-mini' : provider === 'gemini' ? environment.GEMINI_VISION_MODEL || 'gemini-2.5-flash' : environment.CLOUDFLARE_VISION_MODEL || environment.CLOUDFLARE_PLAN_MODEL || '@cf/meta/llama-3.2-11b-vision-instruct', status: 'failed', latencyMs: Date.now() - started, error: error instanceof Error ? error.message : 'Provider failed.' });
      return null;
    }
  };
  const requestedPrimary = environment.PLAN_ANALYZER_PRIMARY;
  const defaultOrder: Array<'openai' | 'cloudflare' | 'gemini'> = ['openai', 'cloudflare', 'gemini'];
  const order = [
    ...(requestedPrimary && configured.includes(requestedPrimary as 'openai' | 'gemini' | 'cloudflare')
      ? [requestedPrimary as 'openai' | 'gemini' | 'cloudflare']
      : []),
    ...defaultOrder
  ].filter((provider, index, list) => configured.includes(provider) && list.indexOf(provider) === index);

  let primary: { provider: 'openai' | 'gemini' | 'cloudflare'; model: string; proposals: PlanProposal[] } | null = null;
  let verifier: { provider: 'openai' | 'gemini' | 'cloudflare'; model: string; proposals: PlanProposal[] } | null = null;
  for (const provider of order) {
    const result = await execute(provider);
    if (!result) continue;
    if (!primary) {
      primary = result;
      if (environment.PLAN_ANALYZER_VERIFY !== 'true') break;
    } else {
      verifier = result;
      break;
    }
  }
  if (!primary) throw new Error(runs.map((run) => `${run.provider}: ${run.error}`).join(' | '));
  const issues = topologyIssues(primary.proposals);
  const confidences = primary.proposals.map((proposal) => proposal.confidence);
  return {
    provider: primary.provider,
    proposals: primary.proposals,
    intakeResult,
    analysisVersion: PROMPT_VERSIONS.floorPlanAnalyzer,
    source: { fileName: input.fileName, mimeType: input.mimeType, checksumSha256: createHash('sha256').update(input.dataUrl).digest('hex'), coordinateSpace: { width: 1000, height: 1000, units: 'source_relative' } },
    ocrEvidence: primary.proposals.filter((proposal) => proposal.kind === 'dimension' || proposal.kind === 'room'),
    calibration: { status: issues.some((issue) => issue.code === 'CALIBRATION_REQUIRED') ? 'required' : 'proposed', trustedDimensionMm: null },
    topologyIssues: issues,
    providerRuns: runs,
    reviewStatus: 'needs_review',
    confidenceSummary: { minimum: confidences.length ? Math.min(...confidences) : 0, average: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0, lowConfidenceCount: confidences.filter((value) => value < 0.7).length },
    verifier: verifier ? { provider: verifier.provider, entityCount: verifier.proposals.length, disagreement: Math.abs(verifier.proposals.length - primary.proposals.length) > 2 } : null
  };
}
