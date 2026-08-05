import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVisionProvider } from '@ultida/agent-core';
import { PlanVisionOutputSchema } from '@ultida/agent-core';
import { analyzePlanFile, classifyFile } from '../src/plan-analysis-service.js';
import { readFile } from 'node:fs/promises';

test('getVisionProvider returns null when no keys configured (fail visibly)', () => {
  const provider = getVisionProvider({});
  assert.equal(provider, null);
});

test('structured floor-plan provider is server-only, validates output, and normalizes aliases', async () => {
  const provider = getVisionProvider({ FLOORPLAN_VISION_URL: 'https://floorplan.internal/analyze', FLOORPLAN_VISION_MODEL: 'polyroom' });
  assert.ok(provider);
  assert.equal(provider.name, 'structured-floorplan');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, 'polyroom');
    assert.equal(request.mimeType, 'image/png');
    return new Response(JSON.stringify({ output: {
      roomCandidates: [{ points: [[0, 0], [100, 0], [100, 100], [0, 100]], confidence: 0.9 }],
      wallCandidates: [{ p1: [0, 0], p2: [100, 0], confidence: 0.8 }],
      assumptions: ['model output is provisional'],
    } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await provider!.analyze('base64-image', 'image/png', 'extract plan', 'req-1');
    assert.equal(result.output.roomCandidates[0].polygon.length, 4);
    assert.equal(result.output.wallCandidates[0].x2, 100);
    assert.equal(result.metadata.model, 'polyroom');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('analyzePlanFile throws AI_PROVIDER_NOT_CONFIGURED when no provider available', async () => {
  const buffer = await readFile(new URL('../../../floorplan analyser/ultida-flow-kit/proof/test_floorplan_input.png', import.meta.url));
  // Clear all provider env for this process
  const saved = { ...process.env };
  for (const k of ['OPENAI_API_KEY', 'GEMINI_VISION_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_AI_STUDIO_KEY_1', 'GOOGLE_AI_STUDIO_KEY_2', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_TOKEN']) {
    delete process.env[k];
  }
  try {
    await analyzePlanFile({
      projectId: 'p1', organizationId: 'o1', fileName: 'x.png', mimeType: 'image/png', buffer,
    });
    assert.fail('expected throw');
  } catch (err: any) {
    assert.equal(err.code, 'AI_PROVIDER_NOT_CONFIGURED');
    assert.equal(err.status, 503);
  } finally {
    Object.assign(process.env, saved);
  }
});

test('invalid provider output is rejected by the schema (validation gate)', () => {
  const bad = {
    documentType: 'plan',
    roomCandidates: 'not-an-array',
    wallCandidates: [{ x1: 'left', y1: 0, x2: 10, y2: 0 }], // bad types
  };
  const result = PlanVisionOutputSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test('classifyFile rejects vector and unsupported with clear category', () => {
  assert.equal(classifyFile('a.svg', 'image/svg+xml'), 'vector');
  assert.equal(classifyFile('a.dxf', 'application/dxf'), 'vector');
  assert.equal(classifyFile('a.dwg', 'application/octet-stream'), 'unsupported');
});

test('analyzePlanFile rejects unsupported format before any provider call', async () => {
  const buffer = Buffer.from('dummy');
  try {
    await analyzePlanFile({
      projectId: 'p1', organizationId: 'o1', fileName: 'plan.dwg', mimeType: 'application/octet-stream', buffer,
    });
    assert.fail('expected throw');
  } catch (err: any) {
    assert.equal(err.code, 'UNSUPPORTED_FORMAT');
    assert.equal(err.status, 415);
  }
});
