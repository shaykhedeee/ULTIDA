import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from '../src/index.js';

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

test('AURA audit ledger rejects anonymous reads, writes, and proposal creation', async () => {
  await withServer(async (baseUrl) => {
    const missingProject = await fetch(`${baseUrl}/api/aura/audit-events`);
    assert.equal(missingProject.status, 400);

    const read = await fetch(`${baseUrl}/api/aura/audit-events?projectId=project-1`);
    assert.equal(read.status, 401);

    const create = await fetch(`${baseUrl}/api/aura/audit-events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'event-1', projectId: 'project-1', actorId: 'spoofed-user', toolId: 'generate_tv_unit', eventType: 'proposal_created', sourceVersionId: 'scene-1', proposalId: 'proposal-1', createdAt: new Date().toISOString(), payload: {} }),
    });
    assert.equal(create.status, 401);

    const preview = await fetch(`${baseUrl}/api/aura/tools/generate_tv_unit/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'project-1', sceneVersionId: 'scene-1' }),
    });
    assert.equal(preview.status, 401);
  });
});
