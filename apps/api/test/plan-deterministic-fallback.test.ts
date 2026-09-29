import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePlanFile, terminateOcrWorker } from '../src/plan-analysis-service.js';
import { readFile } from 'node:fs/promises';

test('analyzePlanFile falls back to deterministic OpenCV + OCR engine when allowDeterministicFallback is true', async () => {
  const buffer = await readFile(new URL('../../../floorplan analyser/ultida-flow-kit/proof/test_floorplan_input.png', import.meta.url));

  // Ensure no AI provider keys are set
  const saved = { ...process.env };
  for (const k of ['OPENAI_API_KEY', 'GEMINI_VISION_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_AI_STUDIO_KEY_1', 'GOOGLE_AI_STUDIO_KEY_2', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_AI_TOKEN']) {
    delete process.env[k];
  }

  try {
    const result = await analyzePlanFile({
      projectId: 'proj-det-1',
      organizationId: 'org-det-1',
      fileName: 'test_floorplan.png',
      mimeType: 'image/png',
      buffer,
      allowDeterministicFallback: true,
    });

    assert.ok(result);
    assert.equal(result.provider, 'deterministic-contour-engine');
    assert.ok(result.elements.length > 0);
    // Real walls detected from the floorplan contrast
    assert.ok(result.deterministic.lineWallCount >= 4, `Expected at least 4 real walls, got ${result.deterministic.lineWallCount}`);
    const walls = result.elements.filter((e) => e.kind === 'wall');
    assert.ok(walls.length >= 4, `Expected at least 4 wall elements, got ${walls.length}`);
    // Openings detected from wall gaps
    assert.ok(result.deterministic.openingCount >= 1, `Expected opening candidates, got ${result.deterministic.openingCount}`);
    assert.ok(result.vastuReport !== undefined);
  } finally {
    Object.assign(process.env, saved);
    await terminateOcrWorker();
  }
});

