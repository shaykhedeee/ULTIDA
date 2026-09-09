import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createProviderGateway } from '../dist/index.js';

const base = {
  projectId: 'project', sceneVersionId: '00000000-0000-4000-8000-000000000001',
  roomId: 'room', sourceAssets: ['https://assets.example/scene.png'],
  referenceAssets: [], masks: [], operation: 'generate', style: 'neutral',
  structuredPrompt: 'Preserve approved openings and furniture.', quality: 'review', providerPreference: [],
};

test('unsupported controls fail before network discovery or paid fallback', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Network must not be used'); };
  try {
    const gateway = createProviderGateway({ OPENAI_API_KEY: 'test', GEMINI_IMAGE_API_KEY: 'test', CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_AI_TOKEN: 'test' });
    for (const patch of [
      { conditioningMaps: { depthMapUrl: 'https://assets.example/depth.png' } },
      { masks: ['https://assets.example/mask.png'] },
      { operation: 'material-swap', conditioningIntent: 'reference' },
      { conditioningIntent: 'reference', conditioningMaps: { normalMapUrl: 'https://assets.example/normal.png' } },
    ]) {
      const result = await gateway.createVisualProposal({ ...base, ...patch });
      assert.equal(result.code, 'UNSUPPORTED_PROVIDER_CONDITIONING');
      assert.equal(result.retryable, false);
      assert.deepEqual(result.attemptedProviders, []);
      assert.equal(result.sourceSceneVersionId, base.sceneVersionId);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('explicit image-reference mode still submits base and guidance images', async () => {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#888888' } }).png().toBuffer();
  const asset = `data:image/png;base64,${bytes.toString('base64')}`;
  const original = globalThis.fetch;
  let fields = [];
  globalThis.fetch = async (_url, options) => {
    fields = [...options.body.keys()];
    return new Response(JSON.stringify({ success: true, result: { image: { data: bytes.toString('base64'), mimeType: 'image/png' } } }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await createProviderGateway({ CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_AI_TOKEN: 'test' }).createVisualProposal({
      ...base, sourceAssets: [asset], providerPreference: ['cloudflare'], conditioningIntent: 'reference',
      conditioningMaps: { depthMapUrl: asset, cannyEdgeMapUrl: asset, materialKeyMapUrl: asset },
    });
    assert.equal(result.status, 'succeeded', JSON.stringify(result));
    assert.deepEqual(fields.filter(name => name.startsWith('input_image_')), ['input_image_0', 'input_image_1', 'input_image_2', 'input_image_3']);
  } finally { globalThis.fetch = original; }
});

test('remote scene image cannot silently fall back to a text-only model', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No image-capable adapter'); };
  try {
    const result = await createProviderGateway({
      CLOUDFLARE_ACCOUNT_ID: 'test', CLOUDFLARE_AI_TOKEN: 'test',
      CLOUDFLARE_IMAGE_MODEL: '@cf/text-only-model', OPENAI_API_KEY: 'test',
    }).createVisualProposal({ ...base, providerPreference: ['cloudflare', 'openai-dall-e-3'] });
    assert.equal(result.status, 'provider_not_configured');
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
