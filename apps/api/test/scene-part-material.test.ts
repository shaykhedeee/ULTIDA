import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePartMaterial } from '../src/scene-part-material.js';
test('internal, external, backing and fixtures use independent saved finish slots', () => {
  const standard = new Map([['carcass', 'standard-ivory-liner'], ['shutter', 'oak-face'], ['backPanel', 'back-liner'], ['glass', 'bronze-glass'], ['lighting', 'led']]);
  const custom = new Map([['unit:shutter', 'sage-face']]);
  for (const semanticType of ['carcass', 'shelf', 'drawer']) assert.equal(resolvePartMaterial({ moduleId: 'unit', semanticType }, custom, standard), 'standard-ivory-liner');
  assert.equal(resolvePartMaterial({ moduleId: 'unit', semanticType: 'shutter' }, custom, standard), 'sage-face');
  assert.equal(resolvePartMaterial({ moduleId: 'unit', semanticType: 'back_panel' }, custom, standard), 'back-liner');
  assert.equal(resolvePartMaterial({ moduleId: 'unit', semanticType: 'profile_glass' }, custom, standard), 'bronze-glass');
  assert.equal(resolvePartMaterial({ moduleId: 'unit', semanticType: 'lighting_channel' }, custom, standard), 'led');
});
test('missing internal laminate is not silently substituted by external laminate', () => {
  assert.equal(resolvePartMaterial({ moduleId: 'unit', semanticType: 'shelf' }, new Map([['unit:shutter', 'oak']]), new Map()), undefined);
});
