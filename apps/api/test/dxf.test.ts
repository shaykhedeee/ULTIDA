import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { app, createSceneDxf } from '../src/index.js';

const approvedScene = {
  schema: 'scene.v1', units: 'mm', projectId: 'project-1', floorPlanVersionId: 'plan-1',
  rooms: [], openings: [], materials: [], metadata: { branch: 'main', status: 'approved', changeReason: 'Test approval' },
  walls: [{ id: 'wall-1', start: { xMm: 125, yMm: 240 }, end: { xMm: 3125, yMm: 240 }, thicknessMm: 150, heightMm: 2700 }],
  modules: [{ id: 'module-1', roomId: 'room-1', family: 'wardrobe', widthMm: 900, depthMm: 600, heightMm: 2400, position: { xMm: 400, yMm: 700 }, rotationDeg: 0 }]
};

async function withServer<T>(callback: (baseUrl: string) => Promise<T>) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try { return await callback(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test('canonical writer emits a valid CRLF ASCII DXF structure', () => {
  const dxf = createSceneDxf(approvedScene);
  assert.match(dxf, /^0\r\nSECTION\r\n2\r\nHEADER\r\n/);
  assert.match(dxf, /0\r\nSECTION\r\n2\r\nENTITIES\r\n/);
  assert.match(dxf, /0\r\nENDSEC\r\n0\r\nEOF\r\n$/);
  assert.equal(dxf.includes('\n') && dxf.replaceAll('\r\n', '').includes('\n'), false);
  assert.equal([...Buffer.from(dxf)].every((byte) => byte < 128), true);
});

test('canonical writer preserves wall endpoints and module rectangle dimensions', () => {
  const dxf = createSceneDxf(approvedScene);
  assert.match(dxf, /10\r\n125\r\n20\r\n240\r\n30\r\n0\r\n11\r\n3125\r\n21\r\n240/);
  assert.match(dxf, /10\r\n400\r\n20\r\n700\r\n30\r\n0\r\n11\r\n1300\r\n21\r\n700/);
  assert.match(dxf, /10\r\n1300\r\n20\r\n1300\r\n30\r\n0\r\n11\r\n400\r\n21\r\n1300/);
});

test('canonical writer skips invalid module dimensions explicitly', () => {
  const dxf = createSceneDxf({ modules: [{ position: { xMm: 0, yMm: 0 }, widthMm: 0, depthMm: 600 }, { position: { xMm: 0, yMm: 0 }, widthMm: Number.NaN, depthMm: 600 }] });
  assert.equal((dxf.match(/ULTIDA-MODULES/g) ?? []).length, 0);
});

test('DXF route rejects missing sceneVersionId and non-production scenes', async () => {
  await withServer(async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/drawings/dxf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'project-1', scene: approvedScene }) });
    assert.equal(missing.status, 400);
    const draft = await fetch(`${baseUrl}/api/drawings/dxf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'project-1', sceneVersionId: 'scene-1', scene: { ...approvedScene, metadata: { ...approvedScene.metadata, status: 'draft' } } }) });
    assert.equal(draft.status, 409);
    const stale = await fetch(`${baseUrl}/api/drawings/dxf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'project-1', sceneVersionId: 'scene-1', scene: { ...approvedScene, metadata: { ...approvedScene.metadata, status: 'stale' } } }) });
    assert.equal(stale.status, 409);
  });
});

test('DXF route returns application/dxf for an approved scene', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/drawings/dxf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'project-1', sceneVersionId: 'scene-1', scene: approvedScene }) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^application\/dxf/);
    assert.match(await response.text(), /ULTIDA-WALLS/);
  });
});

test('plan analyzer never claims success without an analyzer key or explicit baseline mode', async () => {
  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousMode = process.env.PLAN_ANALYZER_MODE;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.PLAN_ANALYZER_MODE;
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/plan/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'project-1', fileName: 'plan.png', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AA==' }) });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'PLAN_ANALYZER_UNAVAILABLE');
    });
  } finally {
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousOpenAi;
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousGemini;
    if (previousMode === undefined) delete process.env.PLAN_ANALYZER_MODE; else process.env.PLAN_ANALYZER_MODE = previousMode;
  }
});
