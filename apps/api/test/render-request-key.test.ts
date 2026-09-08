import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderRequestKey } from '../../web/src/components/design/render-request';

const base = { sceneVersionId: 'scene-1', roomId: 'room-1', operation: 'generate' as const, style: 'Warm walnut with ivory shutters and concealed warm lighting', quality: 'draft' };

test('render retries are stable and retain the entire prompt', async () => {
  const key = await renderRequestKey(base);
  assert.equal(key, await renderRequestKey({ ...base }));
  for (const change of [{ style: base.style + ' and brass' }, { style: base.style + '!' }, { roomId: 'room-2' }, { sceneVersionId: 'scene-2' }, { quality: 'final' }]) {
    assert.notEqual(key, await renderRequestKey({ ...base, ...change }));
  }
});

test('room renders ignore inspector selection while swaps identify the exact target', async () => {
  assert.equal(await renderRequestKey(base), await renderRequestKey({ ...base, targetModuleId: 'selected' }));
  const swap = { ...base, operation: 'material-swap' as const, targetModuleId: 'module-1', targetMaterialId: 'oak', targetSemanticSlot: 'shutter' };
  for (const change of [{ targetModuleId: 'module-2' }, { targetMaterialId: 'ivory' }, { targetSemanticSlot: 'carcass' }]) {
    assert.notEqual(await renderRequestKey(swap), await renderRequestKey({ ...swap, ...change }));
  }
});
