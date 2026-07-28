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
