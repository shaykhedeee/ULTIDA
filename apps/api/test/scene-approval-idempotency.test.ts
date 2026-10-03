import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { compileSceneV1 } from '@ultida/scene-compiler';
import { app } from '../src/index.js';

test('repeat approval verifies the current plan and module revisions', async (t) => {
  const plan = JSON.parse(readFileSync(new URL('../../../packages/plan-core/test/fixtures/approved-plan.json', import.meta.url), 'utf8'));
  const wall = plan.walls[0];
  const width = Math.hypot(wall.worldEnd.xMm - wall.worldStart.xMm, wall.worldEnd.yMm - wall.worldStart.yMm);
  const roomId = plan.spaces[0].id;
  const stamp = '2026-10-03T00:00:00.000Z';
  const scene = compileSceneV1({ projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'design-1', plan,
    modules: [{ id: 'module-1', roomId, family: 'tv-unit', widthMm: 600, depthMm: 400, heightMm: 600, xMm: wall.worldStart.xMm, yMm: wall.worldStart.yMm, rotationDeg: 0 }],
    compositionSchedules: [{ wallId: wall.id, approvedUsableWidthMm: width, leftClearanceMm: 0, rightClearanceMm: 0, confirmed: true, bays: [
      { id: 'unit', offsetMm: 0, widthMm: 600, moduleId: 'module-1', keepOut: false },
      { id: 'remainder', offsetMm: 600, widthMm: width - 600, keepOut: false },
    ] }],
  });
  (scene as any).sourceModuleRevisions = { 'module-1': stamp };
  let activePlan = 'plan-1';
  let moduleStamp = stamp;
  let sceneStatus = 'approved';
  let approvalWrites = 0;
  const originalFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'unit-test-key';
  delete process.env.SUPABASE_SECRET_KEY;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.hostname !== 'unit-test.supabase.co') return originalFetch(input, init);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'user-1', email: 'designer@example.test' });
    if (url.pathname === '/rest/v1/organization_members') return Response.json([{ organization_id: 'org-1' }]);
    if (url.pathname === '/rest/v1/projects') {
      const row = { id: 'project-1', organization_id: 'org-1', active_floor_plan_version_id: activePlan };
      return Response.json(req.headers.get('accept')?.includes('object+json') ? row : [row]);
    }
    if (url.pathname === '/rest/v1/scene_versions') {
      if (req.method !== 'GET') approvalWrites++;
      return Response.json([{ id: 'scene-1', floor_plan_version_id: 'plan-1', status: sceneStatus, scene, created_at: stamp }]);
    }
    if (url.pathname === '/rest/v1/module_instances') return Response.json([{ id: 'module-1', updated_at: moduleStamp }]);
    return Response.json({ message: `Unexpected fixture request ${url.pathname}` }, { status: 500 });
  }) as typeof fetch;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const approve = () => fetch(`${base}/api/projects/project-1/scenes/scene-1/approve`, { method: 'POST', headers: { authorization: 'Bearer test-session' } });
  try {
    await t.test('unchanged approval is idempotent without another write', async () => {
      const response = await approve();
      const payload = await response.json();
      assert.equal(response.status, 200, JSON.stringify(payload));
      assert.equal(payload.alreadyApproved, true);
      assert.equal(approvalWrites, 0);
    });
    await t.test('changed active plan blocks even an approved scene', async () => {
      activePlan = 'plan-2';
      const response = await approve();
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, 'SCENE_PLAN_VERSION_STALE');
      activePlan = 'plan-1';
    });
    await t.test('changed module blocks even an approved scene', async () => {
      moduleStamp = '2026-10-03T00:00:00.001Z';
      const response = await approve();
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, 'SCENE_MODULE_VERSION_STALE');
      moduleStamp = stamp;
    });
    await t.test('stale scene status is never revived', async () => {
      sceneStatus = 'stale';
      const response = await approve();
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, 'SCENE_NOT_DRAFT');
      assert.equal(approvalWrites, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']) {
      if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
    }
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

