import assert from 'node:assert/strict';
import test from 'node:test';
import { compileRenderBrief, PROMPT_VERSIONS } from '@ultida/agent-core';
import { createProviderGateway } from '@ultida/provider-gateway';
import { buildDrawingProjection, exportProjectionToDxf, generateDrawingPackageSvg } from '@ultida/drawing-core';
import type { SceneV1 } from '@ultida/scene-core';

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
    assert.deepEqual(result.attemptedProviders, ['openai', 'comfyui']);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('visual gateway reports provider_not_configured when no configured provider exists', async () => {
  const result = await createProviderGateway({}).createVisualProposal({ projectId: 'project-qa', sceneVersionId: '00000000-0000-4000-8000-000000000001', roomId: 'room-kitchen', sourceAssets: ['scene:approved'], referenceAssets: [], masks: [], operation: 'generate', style: 'warm contemporary', structuredPrompt: 'approved facts', quality: 'review', providerPreference: [] });
  assert.equal(result.status, 'provider_not_configured');
  assert.equal('code' in result ? result.code : null, 'IMAGE_PROVIDER_NOT_CONFIGURED');
});
