import test from 'node:test';
import assert from 'node:assert/strict';
import { requireProjectUser } from '../src/api-auth.js';
test('body and query cannot select another project for a path-scoped operation', async () => {
  for (const input of [{ body: { projectId: 'other' }, query: {} }, { body: {}, query: { projectId: 'other' } }]) {
    let status = 0; let code = ''; let advanced = false;
    const request: any = { ...input, params: { projectId: 'room-owner' }, header: () => '' };
    const response: any = { status(value: number) { status = value; return this; }, json(value: any) { code = value.code; return this; } };
    await requireProjectUser(request, response, () => { advanced = true; });
    assert.equal(status, 400); assert.equal(code, 'PROJECT_CONTEXT_MISMATCH'); assert.equal(advanced, false);
  }
});
