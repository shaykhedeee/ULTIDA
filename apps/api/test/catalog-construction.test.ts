import test from 'node:test';
import assert from 'node:assert/strict';
import { listCatalog } from '@ultida/catalog-core';
import { compileStoredModuleForScene } from '../src/scene-module-parts.js';
import { app } from '../src/index.js';

test('all catalog entries compile or resolve cleanly, and all cutlist-supported entries produce bounded physical parts', () => {
  const catalog = listCatalog();
  assert.ok(catalog.length >= 65, `Expected at least 65 catalog templates, found ${catalog.length}`);

  const cutlistTemplates = catalog.filter((entry) => entry.production.cutlistSupported);
  assert.ok(cutlistTemplates.length >= 54, `Expected at least 54 cutlist-supported templates, found ${cutlistTemplates.length}`);

  for (const entry of catalog) {
    const wallLength = Math.max(4200, entry.widthMm + 600);
    const wallHeight = Math.max(3000, entry.heightMm + 1600);
    const result = compileStoredModuleForScene(
      {
        id: `test-${entry.id}`,
        space_id: 'room-1',
        category: entry.family,
        template_id: entry.id,
        config_json: {
          widthMm: entry.widthMm,
          depthMm: entry.depthMm,
          heightMm: entry.heightMm,
          family: entry.family,
        },
        position_json: {
          xMm: 0,
          yMm: 0,
          zMm: entry.family === 'kitchen-wall' ? 1450 : 0,
          rotationDeg: 0,
          wallId: 'wall-1',
        },
      },
      [
        {
          id: 'wall-1',
          worldStart: { xMm: 0, yMm: 0 },
          worldEnd: { xMm: wallLength, yMm: 0 },
          heightMm: wallHeight,
        },
      ],
    );

    assert.equal(result.ok, true, `Failed to compile ${entry.id} (${entry.family}): ${!result.ok ? result.message : ''}`);
    if (!result.ok) continue;

    if (entry.production.cutlistSupported) {
      assert.ok(
        result.parts.length > 0,
        `Cutlist-supported template ${entry.id} (${entry.family}) produced 0 parts`,
      );
      for (const part of result.parts) {
        assert.ok(Number.isFinite(part.widthMm) && part.widthMm > 0, `Invalid width on ${entry.id}/${part.id}`);
        assert.ok(Number.isFinite(part.depthMm) && part.depthMm > 0, `Invalid depth on ${entry.id}/${part.id}`);
        assert.ok(Number.isFinite(part.heightMm) && part.heightMm > 0, `Invalid height on ${entry.id}/${part.id}`);
      }
    }
  }
});

test('custom 725x560x745 mm 3-drawer kitchen base cabinet compiles into 23 components and 3 drawer fronts', async () => {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const res = await fetch(`${baseUrl}/api/catalog/modules/kit-base-cutlery-600/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widthMm: 725, depthMm: 560, heightMm: 745 }),
    });
    assert.equal(res.status, 200);
    const payload = (await res.json()) as any;
    assert.equal(payload.success, true);
    assert.equal(payload.componentCount, 23);
    assert.equal(payload.drawerFrontCount, 3);
    assert.equal(payload.components.length, 23);

    const invalidRes = await fetch(`${baseUrl}/api/catalog/modules/kit-base-cutlery-600/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widthMm: 95, depthMm: 90, heightMm: 120 }),
    });
    assert.equal(invalidRes.status, 422);
    const invalidPayload = (await invalidRes.json()) as any;
    assert.equal(invalidPayload.success, false);
    assert.equal(invalidPayload.code, 'INVALID_CONSTRUCTION_ENVELOPE');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
