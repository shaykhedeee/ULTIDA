import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleRevisionsMatch } from '../src/scene-module-revisions.js';

const saved = '2026-09-27T10:00:00.100Z';
const rows = [{ id: 'wardrobe', updated_at: saved }];
const snapshot = { wardrobe: saved };

test('immediate approval accepts the exact compiled revision despite clock ordering', () => {
  assert.equal(moduleRevisionsMatch(['wardrobe'], rows, snapshot, '2026-09-27T10:00:00.000Z'), true);
});
test('an actual edit one millisecond later blocks approval', () => {
  assert.equal(moduleRevisionsMatch(['wardrobe'], [{ id: 'wardrobe', updated_at: '2026-09-27T10:00:00.101Z' }], snapshot, saved), false);
});
test('missing and invalid revisions fail closed', () => {
  assert.equal(moduleRevisionsMatch(['wardrobe'], [], snapshot, saved), false);
  assert.equal(moduleRevisionsMatch(['wardrobe'], rows, {}, saved), false);
  assert.equal(moduleRevisionsMatch(['wardrobe'], [{ id: 'wardrobe', updated_at: 'invalid' }], snapshot, saved), false);
});
test('legacy scenes allow equality but reject newer module revisions', () => {
  assert.equal(moduleRevisionsMatch(['wardrobe'], rows, undefined, saved), true);
  assert.equal(moduleRevisionsMatch(['wardrobe'], rows, undefined, '2026-09-27T10:00:00.000Z'), false);
});
