import test from 'node:test';
import assert from 'node:assert/strict';
import { requireSavedResponse } from '../src/components/design/saved-response';

test('save requires transport success and explicit API acknowledgement', async () => {
  await requireSavedResponse(Response.json({ success: true }));
  for (const response of [Response.json({ success: false, message: 'Denied' }), Response.json({ success: true }, { status: 500 }), Response.json({}), new Response('not JSON')]) {
    await assert.rejects(requireSavedResponse(response));
  }
});
test('server validation messages remain actionable', async () => {
  await assert.rejects(requireSavedResponse(Response.json({ success: false, message: 'Invalid material slot' }, { status: 422 })), /Invalid material slot/);
});
