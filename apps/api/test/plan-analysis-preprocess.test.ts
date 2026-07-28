import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { rasterizeImage, runWallTracer, classifyFile, buildVisionPrompt } from '../src/plan-analysis-service.js';
import { OpenAIVisionProvider } from '@ultida/agent-core';

const PROOF = new URL('../../../floorplan analyser/ultida-flow-kit/proof/test_floorplan_input.png', import.meta.url);

test('rasterizeImage produces a valid PNG buffer with metadata', async () => {
  const buffer = await readFile(PROOF);
  const result = await rasterizeImage(buffer, 'image/png');
  assert.ok(Buffer.isBuffer(result.png));
  // PNG magic bytes
  assert.equal(result.png[0], 0x89);
  assert.equal(result.png[1], 0x50);
  assert.ok(result.width > 0 && result.height > 0);
});

test('runWallTracer runs deterministic OpenCV extraction on a real raster', async () => {
  const buffer = await readFile(PROOF);
  const raster = await rasterizeImage(buffer, 'image/png');
  const workDir = await mkdtemp(join(tmpdir(), 'ultida-cv-'));
  const pngPath = join(workDir, 'source.png');
  await writeFile(pngPath, raster.png);
  try {
    const cv = await runWallTracer(pngPath);
    if (cv === null) {
      // CV is an evidence adapter; deployments without the optional Python
      // runtime must remain honest and continue with provider analysis.
      assert.ok(true, 'wall_tracer unavailable; optional evidence adapter skipped');
      return;
    }
    assert.ok(typeof cv!.widthPx === 'number');
    // The proof image contains walls; we do not assert a fixed count (tuning-dependent),
    // only that the deterministic extractor returns a structured result.
    assert.ok(Array.isArray(cv!.walls));
    assert.ok(Array.isArray(cv!.openings));
    console.log(`  [cv] walls=${cv!.walls.length} openings=${cv!.openings.length} size=${cv!.widthPx}x${cv!.heightPx}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test('buildVisionPrompt requires JSON-only structured output and lists required categories', () => {
  const prompt = buildVisionPrompt();
  assert.ok(prompt.includes('Output JSON only'));
  for (const cat of ['roomCandidates', 'wallCandidates', 'doorCandidates', 'windowCandidates', 'dimensionCandidates', 'uncertainRegions', 'assumptions', 'warnings']) {
    assert.ok(prompt.includes(cat), `prompt must mention ${cat}`);
  }
});

test('OpenAIVisionProvider constructs a real request to the OpenAI vision endpoint', async () => {
  const calls: any[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify({ documentType: 'plan', roomCandidates: [], wallCandidates: [] }) } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as any;
  try {
    const provider = new OpenAIVisionProvider({ OPENAI_API_KEY: 'test-key' });
    const result = await provider.analyze('BASE64DATA', 'image/png', 'SYSTEM_PROMPT', 'req-123');
    assert.equal(calls.length, 1);
    assert.ok(String(calls[0].url).includes('api.openai.com/v1/chat/completions'));
    assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, 'gpt-4o');
    assert.equal(body.messages[0].content, 'SYSTEM_PROMPT');
    assert.ok(body.messages[1].content[1].image_url.url.includes('BASE64DATA'));
    assert.equal(result.metadata.provider, 'openai');
    assert.equal(result.output.documentType, 'plan');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('OpenAIVisionProvider surfaces a provider failure instead of faking output', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('nope', { status: 401 })) as any;
  try {
    const provider = new OpenAIVisionProvider({ OPENAI_API_KEY: 'bad' });
    await assert.rejects(() => provider.analyze('x', 'image/png', 'p', 'r'), /OpenAI vision error 401/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('classifyFile assigns the right category for each extension', () => {
  assert.equal(classifyFile('a.png', 'image/png'), 'raster');
  assert.equal(classifyFile('a.pdf', 'application/pdf'), 'pdf');
  assert.equal(classifyFile('a.svg', 'image/svg+xml'), 'vector');
  assert.equal(classifyFile('a.dxf', 'application/dxf'), 'vector');
  assert.equal(classifyFile('a.dwg', 'application/octet-stream'), 'unsupported');
});
