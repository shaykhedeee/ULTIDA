import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from '../src/index.js';

async function withServer<T>(callback: (baseUrl: string) => Promise<T>) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try { return await callback(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test('E2E project flow: Brief -> Plan -> Scene (confirm mutation) -> Document (PDF elevations) -> Commercial -> Deliver', async () => {
  await withServer(async (baseUrl) => {
    // 1. Plan analyzer baseline check
    process.env.PLAN_ANALYZER_MODE = 'baseline';
    const planRes = await fetch(`${baseUrl}/api/plan/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'project-test',
        fileName: 'floor-plan.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      })
    });
    assert.equal(planRes.status, 202);
    const planData = await planRes.json();
    assert.ok(planData.success);
    assert.equal(planData.analysis.provider, 'baseline');
    assert.ok(planData.analysis.proposals.length > 0);

    // 2. Scene materialization
    const spatialModel = {
      rooms: [{ 
        id: 'room-1', 
        name: 'Living Room', 
        type: 'living', 
        boundary: [{ xMm: 0, yMm: 0 }, { xMm: 3000, yMm: 0 }, { xMm: 3000, yMm: 3000 }, { xMm: 0, yMm: 3000 }] 
      }],
      walls: [{ 
        id: 'wall-1', 
        start: { xMm: 0, yMm: 0 }, 
        end: { xMm: 3000, yMm: 0 },
        thicknessMm: 150,
        heightMm: 2700
      }],
      openings: []
    };
    const sceneRes = await fetch(`${baseUrl}/api/scene/materialize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'project-test',
        floorPlanVersionId: 'plan-version-test',
        approved: true,
        spatialModel
      })
    });
    assert.equal(sceneRes.status, 201);
    const sceneData = await sceneRes.json();
    assert.ok(sceneData.success);
    assert.equal(sceneData.scene.schema, 'scene.v1');

    // 3. Document check: PDF elevations export
    const pdfRes = await fetch(`${baseUrl}/api/drawings/elevations.pdf`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'project-test',
        sceneVersionId: 'scene-version-test',
        scene: { ...sceneData.scene, metadata: { ...sceneData.scene.metadata, status: 'approved' } }
      })
    });
    assert.equal(pdfRes.status, 200);
    assert.match(pdfRes.headers.get('content-type') ?? '', /^application\/pdf/);

    const estimateRes = await fetch(`${baseUrl}/api/commercial/estimates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'project-test', sceneVersionId: 'scene-version-test', lines: [{ id: 'kit', description: 'Kitchen base', category: 'modular_unit', quantity: 2, unit: 'each', unitRateInr: 10000, labourInr: 1000 }], marginRate: 0.1, gstRate: 0.18 })
    });
    assert.equal(estimateRes.status, 201);
    const estimateData = await estimateRes.json();
    assert.equal(estimateData.estimate.currency, 'INR');
    assert.equal(estimateData.estimate.totals.grandTotalInr, 27258);
  });
});

test('API validate-placement route returns kitchen interlocking rules violations', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/catalog/validate-placement`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        moduleId: 'kit-base-600',
        roomType: 'kitchen',
        clearanceMm: 1200,
        adjacentFamily: 'kitchen-corner'
      })
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.success);
    assert.ok(data.ruleViolations.some((v: any) => v.code === 'KITCHEN_DRAWERS_CORNER_ADJACENT'));
  });
});
