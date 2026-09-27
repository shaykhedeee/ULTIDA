import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSceneRevisionActive, renderInputFingerprint } from '../src/visual-jobs';

function sceneStatusClient(status: string | null) {
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: status ? { id: 'scene-1', status } : null, error: null }; },
  };
  return { from: () => query } as any;
}

test('in-flight renders are rejected after the source scene has been invalidated', async () => {
  await assert.rejects(
    assertSceneRevisionActive(sceneStatusClient('stale'), 'project-1', 'scene-1'),
    /scene changed while the render was running/i,
  );
});

test('active saved scene revisions remain eligible for render completion', async () => {
  const result = await assertSceneRevisionActive(sceneStatusClient('approved'), 'project-1', 'scene-1');
  assert.equal(result.status, 'approved');
});

test('render input fingerprints are stable across object key order', () => {
  const first = renderInputFingerprint({ sceneVersionId: 'scene-1', camera: { lensMm: 35, view: 'eye-level' }, style: 'warm minimal' });
  const second = renderInputFingerprint({ style: 'warm minimal', camera: { view: 'eye-level', lensMm: 35 }, sceneVersionId: 'scene-1' });
  assert.equal(first, second);
});

test('render input fingerprints change when a render contract changes', () => {
  const first = renderInputFingerprint({ sceneVersionId: 'scene-1', style: 'warm minimal', quality: 'review' });
  const second = renderInputFingerprint({ sceneVersionId: 'scene-1', style: 'warm minimal', quality: 'final' });
  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('a laminate revision fingerprint is unique to the selected module and component group', () => {
  const base = { sceneVersionId: 'scene-1', roomId: 'room-living', operation: 'material-swap', targetMaterialId: 'laminate-sage' };
  const shutters = renderInputFingerprint({ ...base, targetModuleId: 'module-tv-1', targetSemanticSlot: 'shutter' });
  const carcass = renderInputFingerprint({ ...base, targetModuleId: 'module-tv-1', targetSemanticSlot: 'carcass' });
  const otherModule = renderInputFingerprint({ ...base, targetModuleId: 'module-crockery-1', targetSemanticSlot: 'shutter' });
  assert.notEqual(shutters, carcass);
  assert.notEqual(shutters, otherModule);
  assert.notEqual(shutters, renderInputFingerprint({ ...base, targetMaterialId: 'laminate-oak', targetModuleId: 'module-tv-1', targetSemanticSlot: 'shutter' }));
});

test('render fingerprints retain long prompt suffixes and punctuation', () => {
  const style = 'Warm walnut with ivory shutters and concealed warm lighting';
  const first = renderInputFingerprint({ style });
  assert.notEqual(first, renderInputFingerprint({ style: `${style} and brass` }));
  assert.notEqual(first, renderInputFingerprint({ style: `${style}!` }));
});
