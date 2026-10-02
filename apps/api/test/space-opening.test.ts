import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSpaceOpening, persistSpaceOpening } from '../src/space-opening.js';
import { OpeningSchema } from '../../../packages/plan-core/src/plan-schema.js';

test('canonical door/window records retain classification through schema parsing and Spaces', () => {
  const shared = { id: '8fb4d545-89cc-40c0-8fff-783a64e3daa5', wallId: 'bdcee9b4-6d35-4283-9315-86a0b5860ba7', offsetMm: 0, widthMm: 900 };
  const door = OpeningSchema.parse({ ...shared, kind: 'door', type: 'hinged', heightMm: 2100 });
  const window = OpeningSchema.parse({ ...shared, kind: 'window', type: 'sliding', sillMm: 750, headMm: 2100 });
  assert.equal(projectSpaceOpening(door).kind, 'door');
  assert.equal(projectSpaceOpening(window).kind, 'window');
  assert.equal(projectSpaceOpening(window).heightMm, 1350);
  const legacyDoor = OpeningSchema.parse({ ...shared, type: 'hinged', heightMm: 2100 });
  const legacyWindow = OpeningSchema.parse({ ...shared, type: 'sliding', sillMm: 750, headMm: 2100 });
  assert.equal(projectSpaceOpening(legacyDoor).kind, 'door');
  assert.equal(projectSpaceOpening(legacyWindow).kind, 'window');
});

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

test('saving openings rejects missing measurements and preserves measured window elevations', () => {
  assert.throws(() => persistSpaceOpening({ kind: 'door', widthMm: 900, offsetAlongWallMm: 0 }), /height/);
  assert.throws(() => persistSpaceOpening({ kind: 'window', widthMm: 900, offsetAlongWallMm: 0, heightMm: 1350 }), /sill/);
  assert.throws(() => persistSpaceOpening({ kind: 'door', widthMm: 900, offsetAlongWallMm: -1, heightMm: 2100 }), /offset/);
  const saved = persistSpaceOpening({ id: 'window-a', wallId: 'wall-a', kind: 'window', offsetAlongWallMm: 0, widthMm: 900, heightMm: 1350, sillHeightMm: 750 });
  assert.equal(saved.sillMm, 750);
  assert.equal(saved.headMm, 2100);
  assert.equal(saved.kind, 'window');
});
