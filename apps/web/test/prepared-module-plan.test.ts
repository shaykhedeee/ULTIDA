import test from 'node:test';
import assert from 'node:assert/strict';
import { PREPARED_MODULE_KEY, readPreparedModule, bindPreparedModule, completePreparedModule } from '../src/lib/prepared-module-plan.ts';
import { readRoomProposals } from '../src/lib/room-proposals.ts';

const proposal = { schema: 'ultida.module-plan.v1', templateId: 'kit-island-waterfall-1800', name: 'Island', family: 'kitchen-base', dimensionsMm: { width: 1725, depth: 925, height: 875 }, wallWidthMm: 4000, clearanceMm: 900 };
test('room requests retain exact custom sizes and remain isolated by room and project', () => {
  const store = storage();
  const request = { id: 'request-a', roomId: 'kitchen', label: 'Island', family: 'kitchen-base', widthMm: 1725, depthMm: 925, heightMm: 875 };
  store.setItem('ultida.room-proposals.project-a', JSON.stringify([request, { ...request, id: 'request-b', roomId: 'bedroom' }, { ...request, id: 'invalid', widthMm: -1 }]));
  assert.deepEqual(readRoomProposals(store, 'project-a', 'kitchen'), [request]);
  assert.equal(readRoomProposals(store, 'project-b', 'kitchen').length, 0);
  assert.equal(readRoomProposals(store, 'project-a', 'living').length, 0);
});
function storage() {
  const data = new Map<string, string>([[PREPARED_MODULE_KEY, JSON.stringify(proposal)]]);
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
test('prepared custom dimensions survive room navigation and refresh until saved', () => {
  const store = storage();
  assert.equal(bindPreparedModule(store, 'project-a'), true);
  for (let visit = 0; visit < 3; visit++) assert.deepEqual(readPreparedModule(store, 'project-a')?.dimensionsMm, proposal.dimensionsMm);
  completePreparedModule(store, 'project-a', 'different-template');
  assert.ok(readPreparedModule(store, 'project-a'));
  completePreparedModule(store, 'project-a', proposal.templateId);
  assert.equal(readPreparedModule(store, 'project-a'), null);
});
test('another project cannot consume or clear a project-bound proposal', () => {
  const store = storage();
  bindPreparedModule(store, 'project-a');
  assert.equal(readPreparedModule(store, 'project-b'), null);
  completePreparedModule(store, 'project-b', proposal.templateId);
  assert.ok(readPreparedModule(store, 'project-a'));
});
test('malformed or incomplete dimensions never become a placement', () => {
  const store = storage();
  for (const raw of ['{', '{}', JSON.stringify({ ...proposal, dimensionsMm: { width: -5 } })]) {
    store.setItem(PREPARED_MODULE_KEY, raw);
    assert.equal(readPreparedModule(store), null);
  }
});
