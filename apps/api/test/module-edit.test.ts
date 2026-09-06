import assert from 'node:assert/strict';
import test from 'node:test';
import { compileStoredModuleForScene } from '../src/scene-module-parts.js';
import type { CanonicalPlanModel } from '@ultida/plan-core';
import { ModuleEditSchema, prepareModuleEdit, type EditableModule } from '../src/module-edit.js';

const plan = {
  ceilingHeightMm: 2700,
  walls: [{ id: 'wall-a', worldStart: { xMm: 100, yMm: 200 }, worldEnd: { xMm: 4100, yMm: 200 }, heightMm: 2700 }],
  openings: [],
} as unknown as CanonicalPlanModel;
const module: EditableModule = { id: 'module-a', space_id: 'room-a', category: 'tv-unit', template_id: 'tv-1800', config_json: { family: 'tv-unit', widthMm: 1800, heightMm: 600, depthMm: 400 }, position_json: { wallId: 'wall-a', offsetMm: 0, xMm: 100, yMm: 200, zMm: 0, rotationDeg: 0 } };
const edit = (changes: object) => ModuleEditSchema.parse({ expectedUpdatedAt: '2026-09-06T00:00:00.000Z', reason: 'Adjust design', ...changes });

test('mounted modules retain their elevation in every compiled component', () => {
  const grounded = compileStoredModuleForScene(module, plan.walls);
  const mounted = compileStoredModuleForScene({ ...module, position_json: { ...module.position_json, zMm: 850 } }, plan.walls);
  assert.ok(grounded.ok && mounted.ok);
  if (!grounded.ok || !mounted.ok) return;
  assert.ok(grounded.parts.length > 0);
  assert.equal(mounted.parts.length, grounded.parts.length);
  mounted.parts.forEach((part, index) => {
    assert.equal(part.zMm, (grounded.parts[index].zMm ?? 0) + 850);
    assert.equal(part.xMm, grounded.parts[index].xMm);
    assert.equal(part.yMm, grounded.parts[index].yMm);
  });
});

test('dimension editing preserves the original and reanchors canonical geometry', () => {
  const original = structuredClone(module);
  const result = prepareModuleEdit(module, edit({ config: { widthMm: 1600 }, position: { offsetMm: 500 } }), plan, [module]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.candidate.position_json.xMm, 600);
  assert.equal(result.candidate.config_json.widthMm, 1600);
  assert.ok(result.partCount > 3);
  assert.deepEqual(module, original);
});

test('edit schema rejects unsafe dimensions, arbitrary fields and missing revision', () => {
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => edit({ config: { widthMm: value } }));
  assert.throws(() => edit({ config: { category: 'sofa' } }));
  assert.throws(() => edit({ position: { xMm: 42 } }));
  assert.equal(ModuleEditSchema.safeParse({ config: { widthMm: 1000 }, reason: 'Edit' }).success, false);
});

test('rejects wall overflow and ceiling overflow', () => {
  for (const changes of [{ position: { offsetMm: 3000 } }, { config: { heightMm: 2800 } }]) {
    assert.equal(prepareModuleEdit(module, edit(changes), plan, []).ok, false);
  }
});

test('canonical doors use offsetMm and do not require a nonexistent kind field', () => {
  const withDoor = { ...plan, openings: [{ id: 'door-a', wallId: 'wall-a', offsetMm: 500, widthMm: 900, heightMm: 2100, verification: 'verified' as const }] };
  const result = prepareModuleEdit(module, edit({ position: { offsetMm: 0 } }), withDoor, []);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'MODULE_BLOCKS_DOOR');
});

test('window clearance considers the actual sill and head', () => {
  const withWindow = { ...plan, openings: [{ id: 'window-a', wallId: 'wall-a', offsetMm: 500, widthMm: 900, sillMm: 900, headMm: 2000, verification: 'verified' as const }] };
  assert.equal(prepareModuleEdit(module, edit({ config: { heightMm: 600 } }), withWindow, []).ok, true);
  const result = prepareModuleEdit(module, edit({ config: { heightMm: 1000 } }), withWindow, []);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'MODULE_BLOCKS_WINDOW');
});

test('excludes the edited module, rejects neighbours and permits separate vertical bands', () => {
  const neighbour = { ...structuredClone(module), id: 'module-b', position_json: { ...module.position_json, offsetMm: 1700 } };
  assert.equal(prepareModuleEdit(module, edit({ config: { widthMm: 1800 } }), plan, [module, neighbour]).ok, false);
  neighbour.position_json.zMm = 1000;
  assert.equal(prepareModuleEdit(module, edit({ config: { widthMm: 1800 } }), plan, [module, neighbour]).ok, true);
});
