import { createHash } from 'node:crypto';
import { PROMPT_VERSIONS } from '@ultida/agent-core';
import { PlanProposalSchema, parsePlanIntake, type PlanProposal, type PlanIntakeResult } from '@ultida/plan-core';

type Environment = Record<string, string | undefined>;
export type AnalysisGuideRegion = { id?: string; label?: string; x: number; y: number; width: number; height: number };
type Input = { dataUrl: string; fileName: string; mimeType: string; brief?: Record<string, unknown>; analysisGuides?: AnalysisGuideRegion[] };
type ProviderRun = { provider: 'openai' | 'gemini' | 'cloudflare' | 'intake-parser'; model: string; status: 'succeeded' | 'failed'; latencyMs: number; error?: string };

function providerTimeoutMs(environment: Environment) {
  // A failed provider must not hold the durable job for a full minute before
  // the next real provider can try. Dense plans normally complete in seconds;
  // callers may opt into a longer ceiling for unusual source files.
  const parsed = Number(environment.PLAN_ANALYZER_TIMEOUT_MS ?? 30_000);
  return Number.isFinite(parsed) ? Math.max(5_000, Math.min(parsed, 60_000)) : 30_000;
}

function providerOutputTokenBudget(environment: Environment) {
  // Floor-plan review needs concise structured evidence, not an essay. A
  // smaller default makes Llama's response materially faster while retaining
  // room, wall, opening and dimension proposals; a studio can raise it for
  // exceptionally dense sheets without a code change.
  const parsed = Number(environment.PLAN_ANALYZER_MAX_TOKENS ?? 3_200);
  return Number.isFinite(parsed) ? Math.max(1_024, Math.min(parsed, 8_192)) : 3_200;
}

function fetchWithProviderTimeout(environment: Environment, input: RequestInfo | URL, init: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(providerTimeoutMs(environment)) });
}

function geminiVisionKey(environment: Environment) {
  return environment.GEMINI_VISION_API_KEY || environment.GEMINI_API_KEY || environment.GOOGLE_AI_STUDIO_KEY_1 || environment.GOOGLE_AI_STUDIO_KEY_2;
}

export function compileBriefContext(brief?: Record<string, unknown>): string {
  if (!brief || Object.keys(brief).length === 0) {
    return '';
  }

  const style = typeof brief.style === 'string' ? brief.style.trim() : '';
  const propertyType = typeof brief.propertyType === 'string' ? brief.propertyType.trim() : '';
  const rooms = typeof brief.rooms === 'string' ? brief.rooms.trim() : '';
  const budgetRange = typeof brief.budgetRange === 'string' ? brief.budgetRange.trim() : '';
  const lifestyle = typeof brief.lifestyle === 'string' ? brief.lifestyle.trim() : '';
  const storageNeeds = typeof brief.storageNeeds === 'string' ? brief.storageNeeds.trim() : '';
  const kitchenRequirements = typeof brief.kitchenRequirements === 'string' ? brief.kitchenRequirements.trim() : '';
  const materials = typeof brief.materials === 'string' ? brief.materials.trim() : '';
  const appliancesServices = typeof brief.appliancesServices === 'string' ? brief.appliancesServices.trim() : '';
  const vastuPreference = typeof brief.vastuPreference === 'string' ? brief.vastuPreference.trim() : '';
  const approvalNotes = typeof brief.approvalNotes === 'string' ? brief.approvalNotes.trim() : '';

  const clauses = [
    style ? `The selected style is ${style}.` : '',
    propertyType ? `This is a ${propertyType}.` : '',
    rooms ? `The requested room scope includes: ${rooms}.` : '',
    budgetRange ? `Budget context: ${budgetRange}.` : '',
    lifestyle ? `Household use: ${lifestyle}.` : '',
    storageNeeds ? `Storage priorities: ${storageNeeds}.` : '',
    kitchenRequirements ? `Kitchen workflow guidance: ${kitchenRequirements}.` : '',
    materials ? `Preferred materials: ${materials}.` : '',
    appliancesServices ? `Appliances or services: ${appliancesServices}.` : '',
    vastuPreference ? `Vastu preference: ${vastuPreference}.` : '',
    approvalNotes ? `Client approvals and exclusions: ${approvalNotes}.` : '',
  ].filter(Boolean);

  if (!clauses.length) {
    return '';
  }

  return `\n\nPROJECT BRIEF\nOnly use the following as bias, not as source geometry:\n- ${clauses.join('\n- ')}`;
}

export function buildPlanPrompt(brief?: Record<string, unknown>, analysisGuides: AnalysisGuideRegion[] = []) {
  const base = `You are the extraction stage of a professional interior floor-plan review system. Read the supplied source without redesigning it.

Extract only visible evidence: walls, room zones, doors/windows/passages, room labels, written dimensions, and existing plan symbols. A fixture proposal may represent a fixed fixture (toilet, sink, bathtub, shower, stove, refrigerator) or a clearly drawn existing furniture symbol (bed, sofa, dining table, wardrobe, desk). Label it exactly as visible evidence, for example "Existing bed symbol". These are review-only context; never turn them into modular furniture, manufacturing geometry, or inferred dimensions. Never invent a dimension, wall, opening or fixture. Preserve uncertainty.

COORDINATES
- Return every coordinate on a source-relative 0..1000 grid: x=0 left, x=1000 right, y=0 top, y=1000 bottom.
- Walls use x1,y1,x2,y2. Rooms use x,y,width,height. Openings use x,y,width,kind where kind 0=door and 1=window. Dimensions use x1,y1,x2,y2,valueMm. Fixtures use x,y,width,depth only when their outline is visible.
- Set confidence below 0.70 for occluded, faint, ambiguous or inferred entities.
- A dimension may be returned only when its text is legible; otherwise omit it.
- Do not merge separate parallel wall faces into arbitrary geometry.

SELF CHECK
1. All coordinates are finite and within 0..1000.
2. Walls have non-zero length.
3. Rooms have positive width and height.
4. Notes state the visible evidence or uncertainty.
5. Return only entities supported by visible evidence. There is no minimum count. Omit an entity class when the drawing does not show it clearly.
6. Do not split a straight wall into redundant collinear fragments and never repeat the same wall candidate. Prefer fewer, well-evidenced candidates over guessed completeness.
7. Keep each note to 12 words or fewer and identify the visible evidence or uncertainty.
8. Start with every clearly enclosed room zone and its enclosing walls. Then add internal partitions, doors/windows, legible dimensions and only clearly drawn existing symbols. Do not sacrifice a whole room merely to describe a minor fixture or furniture symbol. For a multi-room plan, returning one wall or one room is incomplete evidence, not a valid result. Return at most 48 proposals.
9. A wall must contain exactly numeric x1,y1,x2,y2. A room must contain exactly numeric x,y,width,height. Do not use numbered keys, arrays, prose, units, or nested objects inside geometry.
10. Output one JSON object only, with no markdown and no explanatory text:
{"proposals":[{"kind":"wall","confidence":0.82,"geometry":{"x1":120,"y1":180,"x2":680,"y2":180},"note":"Visible external wall"}]}`;

  const briefContext = compileBriefContext(brief);
  const guideContext = analysisGuides.length
    ? `\n\nDESIGNER GUIDE REGIONS\nThese source-grid rectangles are a coverage checklist, not geometry authority. Inspect every guide for its enclosing walls, openings, visible dimensions and room label. Correct or reject a guide if the drawing disagrees; never copy a guide as a measured room.\n${analysisGuides.slice(0, 24).map((guide, index) => `- Guide ${index + 1}${guide.label ? ` (${guide.label})` : ''}: x=${Math.round(guide.x)}, y=${Math.round(guide.y)}, width=${Math.round(guide.width)}, height=${Math.round(guide.height)}.`).join('\n')}`
    : '';
  return `${base}${briefContext}${guideContext}`;
}

const prompt = buildPlanPrompt();

// Cloudflare JSON Mode is supported by Llama 3.2 Vision. The model can still
// decline an overly complex schema, so this stays deliberately small and our
// runtime quality gate remains the final authority.
const CLOUDFLARE_PLAN_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['proposals'],
    properties: {
      proposals: {
        type: 'array',
            maxItems: 48,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'confidence', 'geometry', 'note'],
          properties: {
            kind: { type: 'string', enum: ['wall', 'opening', 'room', 'dimension', 'fixture'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            geometry: { type: 'object', additionalProperties: { type: 'number' } },
            note: { type: 'string', maxLength: 160 },
          },
        },
      },
    },
  },
} as const;

function clampCoordinate(value: number) { return Math.max(0, Math.min(1000, value)); }

const GEOMETRY_KEYS: Record<PlanProposal['kind'], readonly string[]> = {
  wall: ['x1', 'y1', 'x2', 'y2'],
  room: ['x', 'y', 'width', 'height'],
  opening: ['x', 'y', 'width', 'height', 'kind'],
  dimension: ['x1', 'y1', 'x2', 'y2', 'valueMm'],
  fixture: ['x', 'y', 'width', 'depth'],
};

const PLAN_ENTITY_KINDS = new Set<PlanProposal['kind']>(['wall', 'room', 'opening', 'dimension', 'fixture']);

function normalizeGeometry(kind: PlanProposal['kind'], geometry: Record<string, unknown>) {
  const normalized: Record<string, number> = {};
  const allowedKeys = GEOMETRY_KEYS[kind] ?? [];
  for (const [key, raw] of Object.entries(geometry)) {
    if (!allowedKeys.includes(key)) continue;
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

function hasUsableGeometry(proposal: PlanProposal) {
  const geometry = proposal.geometry;
  if (proposal.kind === 'wall') return Math.hypot((geometry.x2 ?? 0) - (geometry.x1 ?? 0), (geometry.y2 ?? 0) - (geometry.y1 ?? 0)) >= 12;
  if (proposal.kind === 'room') return (geometry.width ?? 0) >= 20 && (geometry.height ?? 0) >= 20;
  if (proposal.kind === 'opening') return (geometry.width ?? 0) >= 8;
  if (proposal.kind === 'dimension') return Math.hypot((geometry.x2 ?? 0) - (geometry.x1 ?? 0), (geometry.y2 ?? 0) - (geometry.y1 ?? 0)) >= 8;
  return geometry.x !== undefined && geometry.y !== undefined;
}

function wallKey(proposal: PlanProposal) {
  const geometry = proposal.geometry;
  const first = `${Math.round(geometry.x1 ?? 0)}:${Math.round(geometry.y1 ?? 0)}`;
  const second = `${Math.round(geometry.x2 ?? 0)}:${Math.round(geometry.y2 ?? 0)}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function validatePlanEvidence(proposals: PlanProposal[]) {
  const usable = proposals.filter(hasUsableGeometry);
  const seenWalls = new Set<string>();
  const deduplicated = usable.filter((proposal) => {
    if (proposal.kind !== 'wall') return true;
    const key = wallKey(proposal);
    if (seenWalls.has(key)) return false;
    seenWalls.add(key);
    return true;
  });
  const structural = deduplicated.filter((proposal) => proposal.kind === 'wall' || proposal.kind === 'room');
  if (!structural.length) {
    throw new Error('Vision response contained no usable room or wall geometry. The provider was not accepted as a floor-plan result.');
  }
  return deduplicated;
}

/** A syntactically-valid one-wall response is not a usable floor-plan result.
 * Reject it and try the next configured real vision provider. Deterministic
 * CV reconciliation and designer review still govern final geometry. */
function assertFloorPlanCoverage(proposals: PlanProposal[]) {
  const rooms = proposals.filter((proposal) => proposal.kind === 'room').length;
  const walls = proposals.filter((proposal) => proposal.kind === 'wall').length;
  const openings = proposals.filter((proposal) => proposal.kind === 'opening').length;
  const dimensions = proposals.filter((proposal) => proposal.kind === 'dimension').length;
  if (rooms === 0 && walls < 4) {
    throw new Error(`Vision response is too sparse for a floor plan (${rooms} rooms, ${walls} walls).`);
  }
  // A small set of wall strokes without a room, opening, or measurement is
  // commonly a title block, furniture outline, or one exterior edge—not a
  // reviewable floor-plan model. Let the next configured provider inspect the
  // source instead of accepting it and later manufacturing a generic room.
  if (rooms === 0 && (openings + dimensions < 2 || walls < 8)) {
    throw new Error(`Vision response is missing room-level coverage (${rooms} rooms, ${walls} walls, ${openings} openings, ${dimensions} dimensions).`);
  }
  if (rooms + walls + openings + dimensions < 4) {
    throw new Error(`Vision response has insufficient structural coverage (${rooms} rooms, ${walls} walls, ${openings} openings, ${dimensions} dimensions).`);
  }
  return proposals;
}

function extractJsonObject(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch { /* Some vision providers add a short lead-in. */ }
  const first = cleaned.indexOf('{');
  if (first < 0) throw new Error('Plan analyzer did not return a JSON object.');
  let depth = 0; let quoted = false; let escaped = false;
  for (let index = first; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(first, index + 1)); }
        catch { throw new Error('Plan analyzer returned malformed JSON.'); }
      }
    }
  }
  throw new Error('Plan analyzer returned incomplete JSON.');
}

export function parseProposals(raw: string, source: 'ocr' | 'detector'): PlanProposal[] {
  const parsed = extractJsonObject(raw) as { proposals?: unknown[] };
  const proposals = (Array.isArray(parsed.proposals) ? parsed.proposals : []).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as { kind?: unknown; confidence?: unknown; geometry?: unknown; note?: unknown };
    // Providers occasionally emit a prose label or a new experimental entity
    // kind. Never index geometry rules with untrusted provider data.
    if (typeof value.kind !== 'string' || !PLAN_ENTITY_KINDS.has(value.kind as PlanProposal['kind'])) return [];
    const geometry = value.geometry && typeof value.geometry === 'object' && !Array.isArray(value.geometry)
      ? value.geometry as Record<string, unknown>
      : {};
    return [{ id: crypto.randomUUID(), kind: value.kind as PlanProposal['kind'], confidence: Math.max(0, Math.min(1, Number(value.confidence ?? 0))), source, status: 'needs_review' as const, geometry: normalizeGeometry(value.kind as PlanProposal['kind'], geometry), note: typeof value.note === 'string' ? value.note : `Provider proposal ${index + 1} requires review.` }];
  });
  const result = PlanProposalSchema.array().safeParse(proposals);
  if (!result.success) throw new Error('Plan analyzer returned an invalid proposal shape.');
  return validatePlanEvidence(result.data);
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
  const prompt = buildPlanPrompt(input.brief, input.analysisGuides);
  const response = await fetchWithProviderTimeout(environment, 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${environment.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_schema', json_schema: { name: 'floor_plan_analysis_v1', strict: true, schema: { type: 'object', additionalProperties: false, required: ['proposals'], properties: { proposals: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'object', additionalProperties: false, required: ['kind', 'confidence', 'geometry', 'note'], properties: { kind: { type: 'string', enum: ['wall', 'opening', 'room', 'dimension', 'fixture'] }, confidence: { type: 'number', minimum: 0, maximum: 1 }, geometry: { type: 'object', additionalProperties: { type: 'number' } }, note: { type: 'string', maxLength: 160 } } } } } } } }, messages: [{ role: 'system', content: prompt }, { role: 'user', content: [{ type: 'text', text: `Source file ${input.fileName}. Extract visible plan evidence and run the self-check.` }, { type: 'image_url', image_url: { url: input.dataUrl, detail: 'high' } }] }] }) });
  if (!response.ok) throw new Error(`OpenAI plan analyzer failed (${response.status}).`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI plan analyzer returned no proposal content.');
  return { model, proposals: assertFloorPlanCoverage(parseProposals(content, 'detector')) };
}

async function analyzeGemini(environment: Environment, input: Input) {
  const model = environment.GEMINI_VISION_MODEL || 'gemini-3.6-flash';
  const apiKey = geminiVisionKey(environment);
  const prompt = buildPlanPrompt(input.brief, input.analysisGuides);
  const base64 = input.dataUrl.split(',', 2)[1];
  if (!base64) throw new Error('The normalized plan image is missing its base64 payload.');
  // Dense measured drawings need enough output space for rooms, walls,
  // openings and dimensions. Keep the entity cap deliberate: a complete,
  // parseable review set is safer than a 72-item JSON document truncated in
  // the middle of an entity. OCR/CV add independent evidence afterwards.
  // A dense drawing can still hit a model's output limit. Retry once with a
  // deliberately smaller structural pass instead of forwarding incomplete
  // JSON to the next provider and leaving the designer with no review model.
  const attempts = [
    // `thinkingConfig` is not accepted by every Gemini vision model and was
    // causing valid uploads to fail before the model could inspect the plan.
    // Keep the first request structured, then retry with the portable Gemini
    // request shape when an account is pinned to an older compatible model.
    { entityCap: 48, generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' } },
    { entityCap: 24, generationConfig: { temperature: 0, maxOutputTokens: 4096 } },
  ];
  let lastError: Error | null = null;
  for (const { entityCap, generationConfig } of attempts) {
    try {
      const response = await fetchWithProviderTimeout(environment, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey ?? '')}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ generationConfig, contents: [{ parts: [{ text: `${prompt}\nReturn no more than ${entityCap} highest-confidence structural entities. Prioritize enclosed rooms, their enclosing walls, doors/windows, and legible dimensions. Source file: ${input.fileName}` }, { inlineData: { mimeType: input.mimeType, data: base64 } }] }] }) });
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || `Gemini plan analyzer failed (${response.status}).`);
      const content = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
      if (!content) throw new Error('Gemini plan analyzer returned no proposal content.');
      return { model, proposals: assertFloorPlanCoverage(parseProposals(content, 'ocr')) };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Gemini plan analyzer failed.');
    }
  }
  throw lastError ?? new Error('Gemini plan analyzer failed.');
}

async function analyzeCloudflare(environment: Environment, input: Input) {
  const accountId = environment.CLOUDFLARE_ACCOUNT_ID;
  const token = environment.CLOUDFLARE_AI_TOKEN;
  if (!accountId || !token) throw new Error('Cloudflare Workers AI credentials are not configured.');
  const prompt = buildPlanPrompt(input.brief, input.analysisGuides);
  const maxTokens = providerOutputTokenBudget(environment);
  const candidateModels = Array.from(new Set([
    // Llama Vision follows the compact JSON evidence contract more reliably
    // than Moondream for dense technical drawings. An explicitly configured
    // plan model still takes priority; Moondream remains a genuine fallback.
    environment.CLOUDFLARE_PLAN_MODEL,
    '@cf/meta/llama-4-scout-17b-16e-instruct',
    '@cf/meta/llama-3.2-11b-vision-instruct',
    environment.CLOUDFLARE_VISION_MODEL,
    '@cf/moondream/moondream3.1-9B-A2B',
  ].filter(Boolean) as string[]));
  let lastError: Error | null = null;
  for (const model of candidateModels) {
    if (model.includes('8b-instruct') && !model.includes('vision')) continue;
    try {
      const isMoondream = model.includes('moondream');
      const isLlama4 = model.includes('llama-4-');
      const requestBody = isMoondream
        ? { task: 'query', image: input.dataUrl, question: `${prompt}\nSource file: ${input.fileName}. Return the required JSON only.`, reasoning: false, stream: false, temperature: 0, max_tokens: maxTokens }
        : isLlama4
          ? {
              model,
              messages: [{
                role: 'user',
                // Llama 4 receives vision input only through OpenAI-compatible
                // content parts. The legacy /ai/run `image` field is silently
                // treated as text-only by this model.
                content: [
                  { type: 'text', text: `${prompt}\nSource file: ${input.fileName}. Return the required JSON only.` },
                  { type: 'image_url', image_url: { url: input.dataUrl } },
                ],
              }],
              response_format: { type: 'json_object' },
              temperature: 0,
              max_tokens: maxTokens,
            }
        : {
            messages: [{ role: 'system', content: prompt }, { role: 'user', content: `Extract the visible floor-plan evidence from ${input.fileName}. Return the required JSON only.` }],
            image: input.dataUrl,
            response_format: CLOUDFLARE_PLAN_RESPONSE_FORMAT,
            temperature: 0,
            max_tokens: maxTokens,
          };
      const endpoint = isLlama4
        ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`
        : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const response = await fetchWithProviderTimeout(environment, endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
      const payload = await response.json() as {
        success?: boolean;
        result?: {
          response?: string;
          text?: string;
          answer?: string;
          choices?: Array<{ message?: { content?: string } }>;
          result?: { answer?: string; response?: string; text?: string };
        };
        choices?: Array<{ message?: { content?: string } }>;
        errors?: Array<{ message?: string }>;
      };
      const content = payload.result?.response || payload.result?.text || payload.result?.answer || payload.result?.choices?.[0]?.message?.content || payload.result?.result?.answer || payload.result?.result?.response || payload.result?.result?.text || payload.choices?.[0]?.message?.content;
      // The OpenAI-compatible Cloudflare endpoint returns `choices` without
      // the legacy `{ success: true }` envelope. Treat an explicitly false
      // value as failure, but never discard a valid vision response solely
      // because that legacy field is absent.
      if (response.ok && payload.success !== false && content) {
        return { model, proposals: assertFloorPlanCoverage(parseProposals(content, 'detector')) };
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

  // Credentials are sufficient to enable the Cloudflare route: the adapter
  // has a tested vision-model default and can fall through its model list.
  // Requiring a model variable here incorrectly disabled the provider and
  // prevented Gemini/OpenAI fallback from being selected predictably.
  const configured = [environment.OPENAI_API_KEY ? 'openai' : null, geminiVisionKey(environment) ? 'gemini' : null, environment.CLOUDFLARE_ACCOUNT_ID && environment.CLOUDFLARE_AI_TOKEN ? 'cloudflare' : null].filter(Boolean) as Array<'openai' | 'gemini' | 'cloudflare'>;

  if (!configured.length) {
    const error = new Error('A real AI vision provider is required for floor-plan analysis.');
    (error as any).code = 'AI_PROVIDER_NOT_CONFIGURED';
    (error as any).stage = 'ai_analysis';
    (error as any).status = 503;
    (error as any).retryable = false;
    throw error;
  }
  const runs: ProviderRun[] = [];
  const execute = async (provider: 'openai' | 'gemini' | 'cloudflare') => {
    const started = Date.now();
    try {
      const result = provider === 'openai' ? await analyzeOpenAi(environment, input) : provider === 'gemini' ? await analyzeGemini(environment, input) : await analyzeCloudflare(environment, input);
      runs.push({ provider, model: result.model, status: 'succeeded', latencyMs: Date.now() - started });
      return { provider, ...result };
    } catch (error) {
      runs.push({ provider, model: provider === 'openai' ? environment.OPENAI_VISION_MODEL || 'gpt-4o-mini' : provider === 'gemini' ? environment.GEMINI_VISION_MODEL || 'gemini-3.6-flash' : environment.CLOUDFLARE_VISION_MODEL || environment.CLOUDFLARE_PLAN_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct', status: 'failed', latencyMs: Date.now() - started, error: error instanceof Error ? error.message : 'Provider failed.' });
      return null;
    }
  };
  const requestedPrimary = environment.PLAN_ANALYZER_PRIMARY;
  // Cloudflare is the single billed primary path for ULTIDA. Gemini remains a
  // configured optional fallback for accounts that choose it, while OpenAI is
  // deliberately last because a 429 must never delay a working Cloudflare run.
  const defaultOrder: Array<'openai' | 'gemini' | 'cloudflare'> = ['cloudflare', 'gemini', 'openai'];
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

export const __test__ = { normalizeGeometry, validatePlanEvidence };
