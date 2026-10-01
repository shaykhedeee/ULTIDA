import assert from 'node:assert/strict';
import test from 'node:test';
import { eligiblePlanVisionProviders, getVisionProvider } from '@ultida/agent-core';
import { analyzePlanWithProvider, isPlanVisionProviderConfigured } from '../src/plan-analyzer.js';

const keys = { OPENAI_API_KEY: 'test-key', GEMINI_API_KEY: 'test-key', CLOUDFLARE_ACCOUNT_ID: 'test-account', CLOUDFLARE_AI_TOKEN: 'test-token' };
test('keys alone never enable paid analysis or promote a requested paid provider', () => {
  assert.deepEqual(eligiblePlanVisionProviders({ ...keys, PLAN_ANALYZER_PRIMARY: 'gemini' }), ['cloudflare']);
  assert.equal(getVisionProvider(keys)?.name, 'cloudflare');
  assert.equal(getVisionProvider({ OPENAI_API_KEY: 'test' }), null);
  assert.equal(isPlanVisionProviderConfigured({ GEMINI_API_KEY: 'test' }), false);
});
test('explicit paid opt-in permits selection while keeping Cloudflare first by default', () => {
  const optedIn = { ...keys, GEMINI_VISION_OPT_IN: 'true', OPENAI_VISION_OPT_IN: 'true' };
  assert.deepEqual(eligiblePlanVisionProviders(optedIn), ['cloudflare', 'gemini', 'openai']);
  assert.equal(getVisionProvider(optedIn, 'gemini')?.name, 'gemini');
});
test('Cloudflare failure does not spend against configured paid keys', async () => {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async input => { urls.push(String(input)); return new Response('Unavailable', { status: 503 }); };
  try {
    await assert.rejects(analyzePlanWithProvider(keys, { dataUrl: 'data:image/png;base64,AA==', fileName: 'plan.png', mimeType: 'image/png' }));
    assert.ok(urls.length > 0);
    assert.ok(urls.every(url => new URL(url).hostname === 'api.cloudflare.com'));
  } finally { globalThis.fetch = original; }
});
