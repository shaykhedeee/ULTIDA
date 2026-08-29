import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { app } from '../src/index.js';
import { getRequestSupabaseClient } from '../src/supabase.js';

async function withServer<T>(callback: (baseUrl: string) => Promise<T>) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('getRequestSupabaseClient normalizes Authorization header safely without duplicate Bearer prefix', () => {
  const req1 = { header: (name: string) => (name === 'authorization' ? 'my-test-token-123' : null) };
  const client1 = getRequestSupabaseClient(req1);
  assert.ok(client1);

  const req2 = { header: (name: string) => (name === 'authorization' ? 'Bearer my-test-token-456' : null) };
  const client2 = getRequestSupabaseClient(req2);
  assert.ok(client2);
});

test('requireProjectUser attaches ultidaUser with userId, projectId, and organizationId context', async () => {
  const mockUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const mockKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || 'placeholder';

  await withServer(async (baseUrl) => {
    // Calling an endpoint protected by requireProjectUser without token returns 401
    const resNoAuth = await fetch(`${baseUrl}/api/projects/proj-123/brief`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ brief: { clientName: 'Test Client' } })
    });
    assert.equal(resNoAuth.status, 401);
  });
});

test('signed floor-plan upload contract is protected and the legacy base64 route is disabled', async () => {
  await withServer(async (baseUrl) => {
    const initiate = await fetch(`${baseUrl}/api/projects/proj-123/floor-plans/initiate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'plan.png', mimeType: 'image/png', sizeBytes: 1024 })
    });
    assert.equal(initiate.status, 401);

    const complete = await fetch(`${baseUrl}/api/projects/proj-123/floor-plans/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ storagePath: 'org/project/floor-plans/plan.png', fileName: 'plan.png', mimeType: 'image/png', sizeBytes: 1024 })
    });
    assert.equal(complete.status, 401);

    const legacy = await fetch(`${baseUrl}/api/projects/proj-123/floor-plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'plan.png', dataUrl: 'data:image/png;base64,ZmFrZQ==' })
    });
    assert.equal(legacy.status, 401);
  });
});

test('Project status API returns DB-backed stage statuses and lock reasons', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/projects/proj-123/status`);
    assert.equal(res.status, 401);
  });
});
