import assert from 'node:assert/strict';
import test from 'node:test';
import { compileRenderBrief, PROMPT_VERSIONS } from '@ultida/agent-core';
import { createProviderGateway } from '@ultida/provider-gateway';
import { buildDrawingProjection, exportProjectionToDxf, generateDrawingPackageSvg } from '@ultida/drawing-core';
import type { SceneV1 } from '@ultida/scene-core';
import { analyzePlanWithProvider } from '../src/plan-analyzer.js';

const scene: SceneV1 = {
  schema: 'scene.v1', units: 'mm', projectId: 'project-qa', floorPlanVersionId: 'plan-qa',
  rooms: [{ id: 'room-kitchen', name: 'Kitchen', type: 'kitchen', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }] }],
  walls: [{ id: 'wall-a', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700 }],
  openings: [{ id: 'window-a', wallId: 'wall-a', kind: 'window', offsetMm: 2200, widthMm: 1200, heightMm: 1200 }],
  modules: [{ id: 'base-a', roomId: 'room-kitchen', family: 'kitchen-base', widthMm: 600, depthMm: 600, heightMm: 750, position: { xMm: 800, yMm: 100 }, rotationDeg: 0 }],
  materials: [{ id: 'laminate-a', name: 'Warm oak matte', code: 'LAM-OAK-01' }],
  metadata: { branch: 'main', status: 'approved', changeReason: 'QA fixture' }
};

test('render prompt compiler preserves approved geometry facts and explicit negative constraints', () => {
  const brief = compileRenderBrief({ scene, sceneVersionId: '00000000-0000-4000-8000-000000000001', roomId: 'kitchen', style: 'warm contemporary', quality: 'review' });
  assert.equal(brief.version, PROMPT_VERSIONS.renderDirector);
  assert.match(brief.positivePrompt, /600 x 600 x 750 mm/);
  assert.match(brief.positivePrompt, /window-a/);
  assert.match(brief.negativePrompt, /Do not move, add or remove walls/);
});

test('shared drawing projection drives matching DXF and SVG dimensions', () => {
  const projection = buildDrawingProjection(scene);
  assert.equal(projection.elevations[0].lengthMm, 4000);
  assert.equal(projection.elevations[0].openings[0].offsetMm, 2200);
  assert.equal(projection.modules[0].widthMm, 600);
  const dxf = exportProjectionToDxf(projection);
  const svg = generateDrawingPackageSvg(scene);
  assert.match(dxf, /A-WALL/);
  assert.match(dxf, /4000/);
  assert.match(svg, /data-opening-id="window-a"/);
  assert.match(svg, /width="600"/);
  assert.match(svg, /Wall wall-a \/ 4000 x 2700 mm/);
});

test('editable DXF has disciplined layers, extents and source-faithful openings', () => {
  const rotated: SceneV1 = { ...scene, modules: [{ ...scene.modules[0], rotationDeg: 90 }], openings: [{ ...scene.openings[0], offsetMm: 400, widthMm: 900 }] };
  const projection = buildDrawingProjection(rotated);
  const dxf = exportProjectionToDxf(projection);
  assert.match(dxf, /2\r\nTABLES\r\n/);
  assert.match(dxf, /2\r\nA-WALL\r\n/);
  assert.match(dxf, /2\r\nA-OPENING\r\n/);
  assert.match(dxf, /2\r\nA-MOD\r\n/);
  assert.match(dxf, /9\r\n\$EXTMIN\r\n/);
  assert.match(dxf, /10\r\n400\r\n20\r\n0\r\n30\r\n0\r\n11\r\n1300\r\n21\r\n0/);
  assert.match(dxf, /10\r\n800\r\n20\r\n100\r\n30\r\n0\r\n11\r\n800\r\n21\r\n700/);
});

test('visual gateway falls back from OpenAI failure to queued ComfyUI without fabricated success', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('api.openai.com')) return new Response('{}', { status: 500 });
    if (url.endsWith('/prompt')) return Response.json({ prompt_id: 'prompt-qa' });
    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;
  try {
    const gateway = createProviderGateway({ OPENAI_API_KEY: 'test-key', COMFYUI_BASE_URL: 'http://comfy.test', COMFYUI_WORKFLOW_JSON: '{"1":{"inputs":{"text":"{{prompt}}"}}}' });
    const result = await gateway.createVisualProposal({ projectId: 'project-qa', sceneVersionId: '00000000-0000-4000-8000-000000000001', roomId: 'room-kitchen', sourceAssets: ['scene:approved'], referenceAssets: [], masks: [], operation: 'generate', style: 'warm contemporary', structuredPrompt: 'approved facts', negativePrompt: 'no geometry changes', promptVersion: PROMPT_VERSIONS.renderDirector, quality: 'review', providerPreference: ['openai', 'comfyui'] });
    assert.equal(result.status, 'queued');
    assert.equal('provider' in result ? result.provider : null, 'comfyui');
    assert.deepEqual(result.attemptedProviders, ['openai-dall-e-3', 'comfyui']);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('Nano Banana 2 adapter persists the real Gemini image payload contract', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    assert.match(String(input), /generativelanguage\.googleapis\.com\/v1beta\/interactions/);
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ output_image: { data: 'aW1hZ2UtYnl0ZXM=', mime_type: 'image/png' } });
  }) as typeof fetch;
  try {
    const gateway = createProviderGateway({ GEMINI_IMAGE_API_KEY: 'test-key' });
    const result = await gateway.createVisualProposal({ projectId: 'project-qa', sceneVersionId: '00000000-0000-4000-8000-000000000001', roomId: 'room-kitchen', sourceAssets: ['scene:approved'], referenceAssets: [], masks: [], operation: 'generate', style: 'warm contemporary', structuredPrompt: 'approved geometry facts', negativePrompt: 'no geometry changes', quality: 'review', camera: { view: 'wide-corner', lensMm: 24, eyeHeightMm: 1500 }, providerPreference: ['gemini-nano-banana-2'] });
    assert.equal(result.status, 'succeeded');
    assert.equal('provider' in result ? result.provider : null, 'gemini-nano-banana-2');
    assert.equal('image' in result ? result.image?.mimeType : null, 'image/png');
    assert.equal(requestBody?.model, 'gemini-3.1-flash-image');
    assert.deepEqual(requestBody?.response_format, { type: 'image', aspect_ratio: '16:9', image_size: '1K' });
  } finally { globalThis.fetch = originalFetch; }
});

test('visual gateway reports provider_not_configured when no configured provider exists', async () => {
  const result = await createProviderGateway({}).createVisualProposal({ projectId: 'project-qa', sceneVersionId: '00000000-0000-4000-8000-000000000001', roomId: 'room-kitchen', sourceAssets: ['scene:approved'], referenceAssets: [], masks: [], operation: 'generate', style: 'warm contemporary', structuredPrompt: 'approved facts', quality: 'review', providerPreference: [] });
  assert.equal(result.status, 'provider_not_configured');
  assert.equal('code' in result ? result.code : null, 'IMAGE_PROVIDER_NOT_CONFIGURED');
});

test('plan analyzer sends a plan to one primary provider unless verification is explicitly enabled', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ proposals: [{ kind: 'wall', confidence: 0.9, geometry: { x1: 10, y1: 10, x2: 900, y2: 10 }, note: 'Visible exterior wall.' }] }) }] } }] });
  }) as typeof fetch;
  try {
    const result = await analyzePlanWithProvider({
      GEMINI_API_KEY: 'gemini-test-key',
      CLOUDFLARE_ACCOUNT_ID: 'cf-account',
      CLOUDFLARE_AI_TOKEN: 'cf-token',
      CLOUDFLARE_VISION_MODEL: '@cf/meta/llama-3.2-11b-vision-instruct',
      PLAN_ANALYZER_PRIMARY: 'gemini',
    }, { dataUrl: 'data:image/png;base64,aW1hZ2U=', fileName: 'plan.png', mimeType: 'image/png' });
    assert.equal(result.provider, 'gemini');
    assert.equal(result.providerRuns.length, 1);
    assert.match(calls[0], /generativelanguage\.googleapis\.com/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('plan analyzer falls back only after the primary provider fails', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('generativelanguage.googleapis.com')) return new Response('{}', { status: 500 });
    if (url.includes('api.cloudflare.com')) return Response.json({ success: true, result: { response: JSON.stringify({ proposals: [{ kind: 'room', confidence: 0.8, geometry: { x: 20, y: 20, width: 300, height: 200 }, note: 'Visible room zone.' }] }) } });
    throw new Error(`Unexpected URL ${url}`);
  }) as typeof fetch;
  try {
    const result = await analyzePlanWithProvider({
      GEMINI_API_KEY: 'gemini-test-key',
      CLOUDFLARE_ACCOUNT_ID: 'cf-account',
      CLOUDFLARE_AI_TOKEN: 'cf-token',
      CLOUDFLARE_VISION_MODEL: '@cf/meta/llama-3.2-11b-vision-instruct',
      PLAN_ANALYZER_PRIMARY: 'gemini',
    }, { dataUrl: 'data:image/png;base64,aW1hZ2U=', fileName: 'plan.png', mimeType: 'image/png' });
    assert.equal(result.provider, 'cloudflare');
    assert.deepEqual(result.providerRuns.map((run) => [run.provider, run.status]), [['gemini', 'failed'], ['cloudflare', 'succeeded']]);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
