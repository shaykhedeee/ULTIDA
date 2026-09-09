import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createProviderGateway } from '../src/index.ts';

test('Cloudflare FLUX receives deterministic base, depth, edge, and material references', async () => {
  const pngBytes = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } }).png().toBuffer();
  const PNG = `data:image/png;base64,${pngBytes.toString('base64')}`;
  const originalFetch = globalThis.fetch;
  let fieldNames: string[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const form = init?.body as FormData;
    fieldNames = Array.from(form.keys());
    return new Response(JSON.stringify({
      success: true,
      result: { image: { data: PNG.split(',')[1], mimeType: 'image/png' } },
    }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const gateway = createProviderGateway({ CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_AI_TOKEN: 'token' });
    const result = await gateway.createVisualProposal({
      projectId: 'project-1', sceneVersionId: 'a0000000-0000-4000-8000-000000000001', roomId: 'room-1',
      sourceAssets: [PNG], referenceAssets: [], masks: [], operation: 'generate', style: 'Warm contemporary',
      structuredPrompt: 'Use image 0 as the approved scene and preserve it.', negativePrompt: 'Do not alter geometry.',
      quality: 'review', providerPreference: ['cloudflare'],
      conditioningIntent: 'reference',
      conditioningMaps: { depthMapUrl: PNG, cannyEdgeMapUrl: PNG, materialKeyMapUrl: PNG },
    });
    assert.equal(result.status, 'succeeded', JSON.stringify(result));
    assert.deepEqual(fieldNames.filter((name) => name.startsWith('input_image_')), [
      'input_image_0', 'input_image_1', 'input_image_2', 'input_image_3',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
