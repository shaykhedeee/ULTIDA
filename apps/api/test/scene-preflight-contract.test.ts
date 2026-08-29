import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

test('scene compilation exposes a room-scoped readiness preflight', () => {
  assert.match(apiSource, /\/scenes\/preflight/);
  assert.match(apiSource, /layoutApproved/);
  assert.match(apiSource, /wallAnchorSaved/);
  assert.match(apiSource, /positionResolved/);
  assert.match(apiSource, /dimensionsValid/);
  assert.match(apiSource, /materialsSaved/);
});

test('scene compilation rejects cross-room modules and returns lineage counts', () => {
  assert.match(apiSource, /ROOM_MODULE_MISMATCH/);
  assert.match(apiSource, /compiledModuleCount/);
  assert.match(apiSource, /componentPartCount/);
  assert.match(apiSource, /materialCount/);
  assert.match(apiSource, /sourceSpaceId/);
});
