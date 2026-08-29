import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInputFingerprint } from '../src/visual-jobs';

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
});
