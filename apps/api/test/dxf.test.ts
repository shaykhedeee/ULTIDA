import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../src/index.js';
import { exportSceneToDxf, generateDrawingPackageSvg } from '@ultida/drawing-core';

const approvedScene = {
  schema: 'scene.v1', units: 'mm', projectId: 'project-1', floorPlanVersionId: 'plan-1',
  coordinateSystem: 'right-handed-z-up',
  floors: [{ id: 'floor-1', name: 'Ground Floor', elevationMm: 0, heightMm: 2700 }],
  spaces: [{ id: 'space-1', floorId: 'floor-1', name: 'Room 1', type: 'bedroom' }],
  rooms: [{ id: 'room-1', spaceId: 'space-1', name: 'Room 1', type: 'bedroom', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }, { xMm: 0, yMm: 0 }], confidence: 1 }],
  openings: [], fixedFixtures: [], materials: [], lighting: [], cameras: [{ id: 'camera-1', name: 'Test', position: { xMm: 2000, yMm: -1800, zMm: 1500 }, target: { xMm: 2000, yMm: 1000, zMm: 1200 }, lensMm: 35 }], constraints: [], unresolvedDetections: [],
  metadata: { branch: 'main', status: 'approved', changeReason: 'Test approval', schemaVersion: 'scene.v1', designVersion: 'test' },
  walls: [{ id: 'wall-1', floorId: 'floor-1', start: { xMm: 125, yMm: 240 }, end: { xMm: 3125, yMm: 240 }, thicknessMm: 150, heightMm: 2700, baseElevationMm: 0, spaceIds: ['space-1'], confidence: 1 }],
  modules: [{ id: 'module-1', templateId: 'wardrobe-2100-four-shutter', roomId: 'room-1', family: 'wardrobe', widthMm: 900, depthMm: 600, heightMm: 2400, position: { xMm: 400, yMm: 700 }, rotationDeg: 0, anchor: 'wall', confidence: 1 }],
  moduleParts: [
    ...[
      ['panel', 'Wardrobe side panel', 2400, 600, 18],
      ['panel', 'Wardrobe side panel', 2400, 600, 18],
      ['shelf', 'Wardrobe shelf', 864, 560, 18],
      ['shelf', 'Wardrobe shelf', 864, 560, 18],
      ['shutter', 'Wardrobe shutter', 450, 18, 1990],
      ['shutter', 'Wardrobe shutter', 450, 18, 1990],
      ['back', 'Wardrobe back', 864, 6, 1990],
    ].map(([semanticType, name, widthMm, depthMm, heightMm], index) => ({
      id: `module-1-part-${index + 1}`, moduleId: 'module-1', roomId: 'room-1',
      semanticType, name, widthMm, depthMm, heightMm,
      position: { xMm: 400, yMm: 700, zMm: 0 }, rotationDeg: 0, confidence: 1,
    })),
  ]
};

async function withServer<T>(callback: (baseUrl: string) => Promise<T>) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try { return await callback(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test('canonical writer emits a valid CRLF ASCII DXF structure', () => {
  const dxf = exportSceneToDxf(approvedScene as any);
  assert.match(dxf, /^0\r\nSECTION\r\n2\r\nHEADER\r\n/);
  assert.match(dxf, /0\r\nSECTION\r\n2\r\nENTITIES\r\n/);
  assert.match(dxf, /0\r\nENDSEC\r\n0\r\nEOF\r\n$/);
  assert.equal(dxf.includes('\n') && dxf.replaceAll('\r\n', '').includes('\n'), false);
  assert.equal([...Buffer.from(dxf)].every((byte) => byte < 128), true);
});

function isPythonAvailable(): boolean {
  try {
    // Windows can resolve `python --version` to the Microsoft Store alias
    // with a successful exit code even though no interpreter is installed.
    // Execute a tiny program so the independent DXF validator only runs when
    // a real Python runtime is available.
    const res = spawnSync('python', ['-c', 'import sys; print(sys.version_info.major)'], { encoding: 'utf8' });
    return !res.error && res.status === 0 && /^\s*3\s*$/.test(String(res.stdout));
  } catch {
    return false;
  }
}

test('DXF validation fails when the independent validator is unavailable', (t) => {
  if (!isPythonAvailable()) {
    t.skip('python runtime is not available on this host');
    return;
  }
  const validatorPath = join(fileURLToPath(new URL('../../../scripts', import.meta.url)), 'validate_dxf.py');
  const result = spawnSync('python', ['-I', '-S', validatorPath, 'unused.dxf'], { encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ezdxf/);
});

test('python ezdxf validator approves canonical dxf output', (t) => {
  if (!isPythonAvailable()) {
    t.skip('python runtime is not available on this host');
    return;
  }
  const dxf = exportSceneToDxf(approvedScene as any);
  const tempPath = join(fileURLToPath(new URL('.', import.meta.url)), 'temp_test.dxf');
  writeFileSync(tempPath, dxf);
  try {
    const validatorPath = join(fileURLToPath(new URL('../../../scripts', import.meta.url)), 'validate_dxf.py');
    execFileSync('python', [validatorPath, tempPath], { stdio: 'pipe' });
  } finally {
    try { unlinkSync(tempPath); } catch {}
  }
});

test('canonical writer preserves wall endpoints and module rectangle dimensions', () => {
  const dxf = exportSceneToDxf(approvedScene as any);
  assert.match(dxf, /10\r\n125\r\n20\r\n240\r\n30\r\n0\r\n11\r\n3125\r\n21\r\n240/);
  assert.match(dxf, /10\r\n400\r\n20\r\n700\r\n30\r\n0\r\n11\r\n1300\r\n21\r\n700/);
  assert.match(dxf, /10\r\n1300\r\n20\r\n1300\r\n30\r\n0\r\n11\r\n400\r\n21\r\n1300/);
});

test('canonical writer skips invalid module dimensions explicitly', () => {
  const dxf = exportSceneToDxf({ modules: [{ position: { xMm: 0, yMm: 0 }, widthMm: 0, depthMm: 600 }, { position: { xMm: 0, yMm: 0 }, widthMm: Number.NaN, depthMm: 600 }] } as any);
  assert.equal((dxf.match(/ULTIDA-MODULES/g) ?? []).length, 0);
});

test('legacy DXF route rejects caller-supplied approval without project authentication', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/drawings/dxf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'project-1', sceneVersionId: 'scene-1', scene: approvedScene }) });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  });
});

test('legacy PDF, SVG and cutlist routes cannot export forged client-approved scene payloads', async () => {
  await withServer(async (baseUrl) => {
    const body = JSON.stringify({ projectId: 'project-1', sceneVersionId: 'scene-1', scene: approvedScene });
    const requests = [
      '/api/drawings/elevations.pdf',
      '/api/drawings/elevations.svg',
      '/api/production/cutlist',
      '/api/production/cutlist.csv',
      '/api/production/wall-elevation.svg',
      '/api/production/boq',
      '/api/production/boq.csv',
      '/api/drawings/cnc-panel.dxf',
    ];
    for (const path of requests) {
      const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      assert.equal(response.status, 401, `${path} must require project membership`);
      assert.equal((await response.json()).code, 'AUTH_REQUIRED');
    }
  });
});

test('authenticated export ignores caller scene and renders the exact approved persisted revision', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    url: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    secretKey: process.env.SUPABASE_SECRET_KEY,
  };
  process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'unit-test-key';
  delete process.env.SUPABASE_SECRET_KEY;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(requestUrl);
    if (url.hostname !== 'unit-test.supabase.co') return originalFetch(input, init);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'user-1', email: 'designer@example.test' });
    if (url.pathname === '/rest/v1/projects') return Response.json([{ id: 'project-1', organization_id: 'org-1' }]);
    if (url.pathname === '/rest/v1/organization_members') return Response.json([{ organization_id: 'org-1' }]);
    if (url.pathname === '/rest/v1/scene_versions') return Response.json([{ id: 'scene-1', status: 'approved', scene: approvedScene }]);
    return Response.json({ message: `Unexpected test request: ${url.pathname}` }, { status: 404 });
  }) as typeof fetch;

  await withServer(async (baseUrl) => {
    try {
      const forgedScene = { ...approvedScene, walls: [], modules: [], moduleParts: [] };
      const response = await fetch(`${baseUrl}/api/drawings/elevations.svg`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test-session' },
        body: JSON.stringify({ projectId: 'project-1', sceneVersionId: 'scene-1', scene: forgedScene }),
      });
      const svg = await response.text();
      assert.equal(response.status, 200, svg);
      assert.equal(svg, generateDrawingPackageSvg(approvedScene as any));

      const sketchup = await fetch(`${baseUrl}/api/projects/project-1/export/sketchup?sceneVersionId=scene-1`, {
        headers: { authorization: 'Bearer test-session' },
      });
      const ruby = await sketchup.text();
      assert.equal(sketchup.status, 200, ruby);
      assert.match(ruby, /Sketchup\.active_model/);
      assert.match(ruby, /3125/);

      const productionPlan = await fetch(`${baseUrl}/api/projects/project-1/drawings/plan.dxf`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test-session' },
        body: JSON.stringify({ planVersionId: 'plan-1', geometryMode: 'final_production', mmPerPixel: 1, elements: [{ kind: 'wall' }] }),
      });
      assert.equal(productionPlan.status, 409);
      assert.equal((await productionPlan.json()).code, 'APPROVED_SCENE_REQUIRED');
    } finally {
      globalThis.fetch = originalFetch;
      if (originalEnv.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalEnv.url;
      if (originalEnv.publishableKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalEnv.publishableKey;
      if (originalEnv.secretKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = originalEnv.secretKey;
    }
  });
});

test('plan analyzer never claims success without an analyzer key or explicit baseline mode', async () => {
  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousMode = process.env.PLAN_ANALYZER_MODE;
  const previousCfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  const previousCfToken = process.env.CLOUDFLARE_AI_TOKEN;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.PLAN_ANALYZER_MODE;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_AI_TOKEN;
  try {
    await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/plan/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'p1', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', fileName: 'f1.png', mimeType: 'image/png' })
    });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, 'AUTH_REQUIRED');
    });
  } finally {
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousOpenAi;
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGemini;
    if (previousMode === undefined) delete process.env.PLAN_ANALYZER_MODE; else process.env.PLAN_ANALYZER_MODE = previousMode;
    if (previousCfAccount === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID; else process.env.CLOUDFLARE_ACCOUNT_ID = previousCfAccount;
    if (previousCfToken === undefined) delete process.env.CLOUDFLARE_AI_TOKEN; else process.env.CLOUDFLARE_AI_TOKEN = previousCfToken;
  }
});

test('legacy cutlist route blocks untrusted caller-approved geometry', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/production/cutlist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'project-1', sceneVersionId: 'scene-1', scene: approvedScene }) });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  });
});

test('legacy elevation and cutlist export routes reject unauthenticated requests', async () => {
  await withServer(async (baseUrl) => {
    const body = { projectId: 'project-1', sceneVersionId: 'scene-1', scene: approvedScene };
    const elevation = await fetch(`${baseUrl}/api/drawings/elevations.svg`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(elevation.status, 401);
    const pdf = await fetch(`${baseUrl}/api/drawings/elevations.pdf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(pdf.status, 401);
    const csv = await fetch(`${baseUrl}/api/production/cutlist.csv`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(csv.status, 401);
  });
});
