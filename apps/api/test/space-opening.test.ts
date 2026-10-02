import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSpaceOpening } from '../src/space-opening.js';

test('Spaces preserves classified openings, zero offsets and measured sill heights', () => {
  const result = projectSpaceOpening({ id: 'window-a', wallId: 'wall-a', kind: 'window', offsetMm: 0, widthMm: 900, sillMm: 750 });
  assert.equal(result.kind, 'window');
  assert.equal(result.offsetAlongWallMm, 0);
  assert.equal(result.sillHeightMm, 750);
  assert.equal(projectSpaceOpening({ type: 'door', offsetAlongWallMm: 250 }).kind, 'door');
});

test('mechanism-only and missing classifications cannot masquerade as windows', () => {
  assert.equal(projectSpaceOpening({ type: 'hinged', widthMm: 900 }).kind, 'unclassified');
  const unknown = projectSpaceOpening({});
  assert.equal(unknown.kind, 'unclassified');
  assert.equal(unknown.offsetAlongWallMm, undefined);
  assert.equal(unknown.sillHeightMm, undefined);
});
