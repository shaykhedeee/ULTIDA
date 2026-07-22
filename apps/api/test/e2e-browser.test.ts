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

test('Complete End-to-End Workflow: Health -> Plan Baseline -> Materialize -> Rules Evaluate -> Wall DXF -> Commercial Estimate', async () => {
  await withServer(async (baseUrl) => {
    // 1. Health & Provider Status
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.ok(healthData.success);
    assert.equal(healthData.app, 'ultida');

    // 2. Materialize Approved Spatial Model
    const spatialModel = {
      rooms: [{ id: 'room-1', name: 'Living Room', type: 'living', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 4000 }, { xMm: 0, yMm: 4000 }, { xMm: 0, yMm: 0 }] }],
      walls: [{ id: 'wall-1', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700 }],
      openings: []
    };
    const sceneRes = await fetch(`${baseUrl}/api/scene/materialize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-e2e', floorPlanVersionId: 'plan-v1', approved: true, spatialModel })
    });
    assert.equal(sceneRes.status, 201);
    const sceneData = await sceneRes.json();
    assert.ok(sceneData.success);
    assert.equal(sceneData.scene.schema, 'scene.v1');

    // 3. Modular Rule Engine Evaluation
    const layoutCandidate = {
      id: 'candidate-1',
      wallHeightMm: 2700,
      modules: [
        {
          id: 'tv-unit-1',
          templateId: 'tpl-tv-floating',
          category: 'tv-unit',
          mounting: 'floating',
          position: { xMm: 500, yMm: 0, elevationMm: 200 },
          dimensions: { widthMm: 1800, depthMm: 400, heightMm: 450 },
          shutterCount: 4,
          shutterType: 'hinged'
        }
      ]
    };
    const rulesRes = await fetch(`${baseUrl}/api/rules/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(layoutCandidate)
    });
    assert.equal(rulesRes.status, 200);
    const rulesData = await rulesRes.json();
    assert.ok(rulesData.success);
    assert.equal(rulesData.score.passed, true);
    assert.equal(rulesData.score.overallScore, 100);

    // 4. Export Wall Elevation DXF
    const approvedScene = {
      ...sceneData.scene,
      metadata: { ...sceneData.scene.metadata, status: 'approved' },
      modules: [{ id: 'tv-unit-1', roomId: 'room-1', family: 'tv-unit', widthMm: 1800, depthMm: 400, heightMm: 450, position: { xMm: 500, yMm: 0 }, rotationDeg: 0, anchor: 'wall', confidence: 1 }]
    };
    const dxfRes = await fetch(`${baseUrl}/api/drawings/wall-elevation.dxf`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-e2e', sceneVersionId: 'scene-v1', wallId: 'wall-1', scene: approvedScene })
    });
    assert.equal(dxfRes.status, 200);
    const dxfText = await dxfRes.text();
    assert.match(dxfText, /^0\r\nSECTION\r\n2\r\nHEADER\r\n/);
    assert.match(dxfText, /0\r\nEOF\r\n$/);

    // 5. Commercial INR Estimate Calculation
    const estRes = await fetch(`${baseUrl}/api/commercial/estimates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'proj-e2e',
        sceneVersionId: 'scene-v1',
        lines: [{ id: 'l1', description: 'Floating TV Unit', category: 'tv-unit', quantity: 1, unit: 'each', unitRateInr: 45000, labourInr: 5000 }]
      })
    });
    assert.equal(estRes.status, 201);
    const estData = await estRes.json();
    assert.ok(estData.success);
    assert.equal(estData.estimate.currency, 'INR');
    assert.equal(estData.estimate.totals.grandTotalInr, 50000);
  });
});
