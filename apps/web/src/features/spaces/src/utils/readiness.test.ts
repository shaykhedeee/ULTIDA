import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReadiness, deriveSpaceFromPlanVersion, categoryRequirementsFor } from './readiness.js';

test('derives space from plan version using world polygon first', () => {
  const space = deriveSpaceFromPlanVersion({
    id: '00000000-0000-0000-0000-000000000001',
    roomType: 'living',
    roomName: 'Living Room',
    ceilingHeightMm: 2700,
    wallRefs: ['wall-1', 'wall-2', 'wall-3'],
    openingRefs: ['door-1'],
    verification: 'verified',
    requiredFurniture: ['tv_unit', 'sofa'],
    worldPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }],
  });
  assert.strictEqual(space.name, 'Living Room');
  assert.strictEqual(space.areaSqm, 12);
  assert.ok(space.dimensionsText.includes('m'));
  assert.strictEqual(space.usableWalls, 3);
});

test('readiness is complete only with verified geometry and non-empty requirements', () => {
  const ready = calculateReadiness(
    { id: 'space-1', roomType: 'living', ceilingHeightMm: 2700, wallRefs: [], openingRefs: [], verification: 'verified', requiredFurniture: ['tv_unit'] },
    { room_type: 'living', ceilingHeightMm: 2700, existingFixedItems: ['wall_slab'], requiredFurniture: ['tv_unit'] },
    []
  );
  assert.strictEqual(ready.readyForLayout, true);
  assert.strictEqual(ready.blockedByPlanIssue, false);
  assert.deepEqual(ready.incompleteRequirements, []);

  const incomplete = calculateReadiness(
    { id: 'space-1', roomType: 'living', ceilingHeightMm: 2700, wallRefs: [], openingRefs: [], verification: 'unverified', requiredFurniture: [] },
    { room_type: 'living', ceilingHeightMm: 2700, existingFixedItems: [], requiredFurniture: [] },
    []
  );
  assert.strictEqual(incomplete.readyForLayout, false);
  assert.ok(incomplete.incompleteRequirements.length > 0);
});

test('blocking plan issue prevents readiness', () => {
  const blocked = calculateReadiness(
    { id: 'space-1', roomType: 'living', ceilingHeightMm: 2700, wallRefs: [], openingRefs: [], verification: 'verified', requiredFurniture: ['tv_unit'] },
    { room_type: 'living', ceilingHeightMm: 2700, existingFixedItems: ['wall_slab'], requiredFurniture: ['tv_unit'] },
    [{ id: 'issue-1', severity: 'critical', resolved: false }]
  );
  assert.strictEqual(blocked.blockedByPlanIssue, true);
  assert.strictEqual(blocked.readyForLayout, false);
});

test('category requirements expose living, bedroom, kitchen fields', () => {
  const living = categoryRequirementsFor('living');
  assert.ok(living.living);
  assert.strictEqual((living.living as Record<string, unknown>).seating_count, undefined);

  const bedroom = categoryRequirementsFor('bedroom');
  assert.ok(bedroom.bedroom);
  assert.strictEqual((bedroom.bedroom as Record<string, unknown>).bed_size, undefined);

  const kitchen = categoryRequirementsFor('kitchen');
  assert.ok(kitchen.kitchen);
  assert.deepEqual((kitchen.kitchen as Record<string, unknown>).appliances, []);
});
