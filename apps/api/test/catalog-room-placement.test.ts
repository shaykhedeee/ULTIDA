import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { listCatalog, validatePlacement, RoomTypeSchema } from '@ultida/catalog-core';
import { app } from '../src/index.js';

test('every room has templates and every listed template passes room compatibility', () => {
  for (const room of RoomTypeSchema.options) {
    const modules = listCatalog(room);
    assert.ok(modules.length > 0, `No catalog for ${room}`);
    for (const module of modules) {
      assert.equal(validatePlacement(module, room, module.minClearanceMm).valid, true, `${room}: ${module.id}`);
    }
  }
  const base = listCatalog('kitchen').find((item) => item.id === 'kit-base-600')!;
  assert.equal(validatePlacement(base, 'bedroom', 1200).valid, false);
  assert.equal(validatePlacement(base, 'kitchen', 0).valid, false);
});

test('placement API exposes the UI validation contract and rejects invalid room types', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const [roomType, clearanceMm, status, valid] of [
      ['kitchen', 1200, 200, true], ['kitchen', 0, 200, false],
      ['bedroom', 1200, 200, false], ['invalid-room', 1200, 400, false],
    ] as const) {
      const response = await fetch(`${baseUrl}/api/catalog/validate-placement`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ moduleId: 'kit-base-600', roomType, clearanceMm }),
      });
      assert.equal(response.status, status);
      const payload = await response.json();
      if (status === 200) {
        assert.equal(payload.valid, valid);
        assert.equal(payload.validation.valid, valid);
        assert.ok(Array.isArray(payload.issues));
        if (!valid) assert.ok(payload.issues.length > 0);
      }
    }
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('catalog API supplies compatible templates for every supported room', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const room of RoomTypeSchema.options) {
      const response = await fetch(`${baseUrl}/api/catalog/modules?room=${room}`);
      assert.equal(response.status, 200, room);
      const payload = await response.json();
      assert.ok(payload.modules.length > 0, `No API catalog for ${room}`);
      assert.ok(payload.modules.every((module: { roomTypes: string[] }) => module.roomTypes.includes(room) || ((room === 'master_bedroom' || room === 'kids_bedroom') && module.roomTypes.includes('bedroom'))), room);
    }
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
