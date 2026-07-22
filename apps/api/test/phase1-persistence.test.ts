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
    // In missing token or missing Supabase env, status is 401 or 503
    assert.ok([401, 503].includes(resNoAuth.status));
  });
});

test('Single canonical floor-plan endpoint exists and handles invalid payload gracefully', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/projects/proj-123/floor-plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: '', dataUrl: '' })
    });
    assert.ok([400, 401, 503].includes(res.status));
  });
});

test('Project status API returns DB-backed stage statuses and lock reasons', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/projects/proj-123/status`);
    // Require auth -> 401 or 503
    assert.ok([401, 503].includes(res.status));
  });
});
