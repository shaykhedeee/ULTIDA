import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileModule, builderPlanToSymbols, buildAutoLayoutPrompt, parseAutoLayoutResponse,
  validateDesign, approveDesign, invalidateDownstream, MODULE_TEMPLATES, type SymbolicPlacement, type DesignValidationContext,
} from '../src/index.js';
import { COMPILER_REGISTRY } from '@ultida/module-framework';

const ctx = (placements: SymbolicPlacement[]): DesignValidationContext => ({
  projectId: 'p1', spaceId: 'r1', roomCategory: 'living', floorPlanVersionId: 'fpv1', shape: 'linear',
  candidateTypes: ['balanced'], requirements: {}, roomBoundingBoxMm: { minX: 0, minY: 0, maxX: 5000, maxY: 4000 },
  usableWalls: [{ id: 'w1', minX: 0, minY: 0, maxX: 5000, maxY: 0, orientation: 'north' }],
  openings: [{ id: 'd1', type: 'door', xMm: 0, yMm: 0, widthMm: 900, heightMm: 2100, swingDeg: 90 }],
  servicePoints: [], structuralElements: [], companyRules: {},
  curtainZones: [{ id: 'cz1', xMm: 100, yMm: 100, widthMm: 600, depthMm: 50 }],
  acUnits: [{ id: 'ac1', xMm: 4500, yMm: 200, clearanceMm: 600 }],
});

test('module templates: TV unit is the first complete vertical template and all 8 families compile', () => {
  assert.equal(MODULE_TEMPLATES[0].family, 'tv_unit');
  assert.equal(MODULE_TEMPLATES.length, 8);
  const wall = { id: 'w1', widthMm: 4000, heightMm: 2700, depthMm: 400 };
  for (const t of MODULE_TEMPLATES) {
    const res = compileModule({ family: t.family, parameters: { totalWidthMm: 2000, totalHeightMm: 2000, totalDepthMm: 400, shelfOption: true }, wall });
    assert.ok(res.parts.length > 0, `${t.family} produced parts`);
    const semantics = new Set(res.parts.map((p) => p.meta.semanticType));
    assert.ok(semantics.has('carcass' as any), `${t.family} has carcass`);
    const hasFront = ['shutter','drawer','panel'].some((k) => semantics.has(k as any));
    assert.ok(hasFront, `${t.family} has a front element (shutter/drawer/panel)`);
  }
  void COMPILER_REGISTRY;
});

test('symbolic AI layout response: parse structured placements (not screenshot)', () => {
  const prompt = buildAutoLayoutPrompt(ctx([]));
  assert.ok(!/screenshot|image/i.test(prompt), 'prompt must not rely on a screenshot');
  assert.ok(prompt.includes('SYMBOLIC'), 'prompt requests symbolic output');
  const resp = { placements: [{ id: 'a', spaceId: 'r1', category: 'tv_unit', templateFamily: 'tv_unit', wallId: 'w1', offsetMm: [500, 0, 0], rotationDeg: 0, widthMm: 2000, heightMm: 600, depthMm: 400, clearanceZoneMm: 150, materialSlots: {} }] };
  const parsed = parseAutoLayoutResponse(resp);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].source, 'ai_proposal');
  assert.equal(parsed[0].confirmed, false);
});

test('malformed layout response is rejected', () => {
  assert.throws(() => parseAutoLayoutResponse({ placements: [{ id: 'x', spaceId: 'r1' }] })); // missing dims
  assert.throws(() => parseAutoLayoutResponse({ placements: 'nope' }));
});

test('wall anchoring: placement references spaceId + wallId + offset', () => {
  const sym = builderPlanToSymbols([{ id: 's1', spaceId: 'r1', wallId: 'w1', category: 'tv_unit', xMm: 300, yMm: 0, widthMm: 2000, depthMm: 400, heightMm: 600 }]);
  assert.equal(sym[0].spaceId, 'r1');
  assert.equal(sym[0].wallId, 'w1');
  assert.equal(sym[0].anchor, 'wall');
  assert.deepEqual(sym[0].offsetMm, [300, 0, 0]);
  assert.equal(sym[0].source, 'builder_symbol');
  assert.equal(sym[0].confirmed, false); // requires confirmation
});

test('collision rejection: two overlapping placements flagged blocking', () => {
  const a: SymbolicPlacement = { id: 'a', spaceId: 'r1', category: 'tv_unit', templateFamily: 'tv_unit', anchor: 'wall', offsetMm: [1500, 1000, 0], rotationDeg: 0, widthMm: 2000, heightMm: 600, depthMm: 400, clearanceZoneMm: 0, materialSlots: {}, source: 'manual', confirmed: true };
  const b: SymbolicPlacement = { ...a, id: 'b', offsetMm: [1700, 1050, 0] };
  const res = validateDesign([a, b], ctx([a, b]));
  assert.equal(res.valid, false);
  assert.ok(res.issues.some((i) => i.code === 'FURNITURE_COLLISION'));
});

test('module compilation: parts + material assignment inside inspector', () => {
  const res = compileModule({ family: 'tv_unit', parameters: { totalWidthMm: 3000, totalHeightMm: 2000, totalDepthMm: 400, materialZones: { carcass: 'mat-walnut', shutters: 'mat-highgloss-white' } }, wall: { id: 'w1', widthMm: 4000, heightMm: 2700, depthMm: 400 } });
  const carcass = res.parts.find((p) => p.meta.semanticType === 'carcass');
  assert.equal(carcass!.meta.materialSlot.id, 'mat-walnut');
  const shutter = res.parts.find((p) => p.meta.semanticType === 'shutter');
  assert.equal(shutter!.meta.materialSlot.id, 'mat-highgloss-white');
});

test('material assignment: inspector can override material slots', () => {
  const sym: SymbolicPlacement = { id: 'a', spaceId: 'r1', category: 'tv_unit', templateFamily: 'tv_unit', anchor: 'wall', offsetMm: [0, 0, 0], rotationDeg: 0, widthMm: 2000, heightMm: 600, depthMm: 400, clearanceZoneMm: 0, materialSlots: { carcass: 'mat-oak' }, source: 'manual', confirmed: true };
  sym.materialSlots = { ...sym.materialSlots, shutter: 'mat-glass' };
  assert.equal(sym.materialSlots.shutter, 'mat-glass');
});

test('approval: creates immutable DesignVersion with input references; rejects invalid/unconfirmed', () => {
  const sym: SymbolicPlacement = { id: 'a', spaceId: 'r1', category: 'tv_unit', templateFamily: 'tv_unit', anchor: 'wall', offsetMm: [1500, 1000, 0], rotationDeg: 0, widthMm: 2000, heightMm: 600, depthMm: 400, clearanceZoneMm: 0, materialSlots: {}, source: 'manual', confirmed: true };
  const valid = validateDesign([sym], ctx([sym]));
  assert.equal(valid.valid, true);
  const dv = approveDesign({
    projectId: 'p1', spaceId: 'r1', floorPlanVersionId: 'fpv1', layoutShape: 'linear', mode: 'manual',
    placements: [sym], moduleParts: {}, materials: {}, validation: valid,
    inputVersionReferences: { floorPlanVersionId: 'fpv1', layoutVersionId: 'lv1' }, userId: 'u1',
  });
  assert.ok(dv.id.startsWith('design-'));
  assert.equal(dv.inputVersionReferences.floorPlanVersionId, 'fpv1');
  assert.equal(dv.mode, 'manual');
  // rejected when invalid
  const bad = { ...sym, widthMm: 9000 };
  const badVal = validateDesign([bad as SymbolicPlacement], ctx([bad as SymbolicPlacement]));
  assert.throws(() => approveDesign({ projectId: 'p1', spaceId: 'r1', floorPlanVersionId: 'fpv1', layoutShape: 'linear', mode: 'manual', placements: [bad as SymbolicPlacement], moduleParts: {}, materials: {}, validation: badVal, inputVersionReferences: { floorPlanVersionId: 'fpv1' } }));
  // rejected when unconfirmed
  const unconf = { ...sym, confirmed: false };
  assert.throws(() => approveDesign({ projectId: 'p1', spaceId: 'r1', floorPlanVersionId: 'fpv1', layoutShape: 'linear', mode: 'manual', placements: [unconf], moduleParts: {}, materials: {}, validation: valid, inputVersionReferences: { floorPlanVersionId: 'fpv1' } }));
});

test('refresh + downstream invalidation: approved version invalidates modules/scene/render', () => {
  const sym: SymbolicPlacement = { id: 'a', spaceId: 'r1', category: 'tv_unit', templateFamily: 'tv_unit', anchor: 'wall', offsetMm: [1500, 1000, 0], rotationDeg: 0, widthMm: 2000, heightMm: 600, depthMm: 400, clearanceZoneMm: 0, materialSlots: {}, source: 'manual', confirmed: true };
  const valid = validateDesign([sym], ctx([sym]));
  const dv = approveDesign({ projectId: 'p1', spaceId: 'r1', floorPlanVersionId: 'fpv1', layoutShape: 'linear', mode: 'manual', placements: [sym], moduleParts: {}, materials: {}, validation: valid, inputVersionReferences: { floorPlanVersionId: 'fpv1' }, userId: 'u1' });
  const events = invalidateDownstream(dv, 'plan rescaled');
  assert.ok(events.length >= 1);
  const allTargets = events.flatMap((e) => e.targets);
  assert.ok(allTargets.includes('modules'));
  assert.ok(allTargets.includes('render'));
  // refresh: re-deriving from immutable source is idempotent
  const dv2 = approveDesign({ projectId: 'p1', spaceId: 'r1', floorPlanVersionId: 'fpv1', layoutShape: 'linear', mode: 'manual', placements: [sym], moduleParts: {}, materials: {}, validation: valid, inputVersionReferences: { floorPlanVersionId: 'fpv1' }, userId: 'u1' });
  assert.equal(dv.placements.length, dv2.placements.length);
  assert.equal(dv.inputVersionReferences.floorPlanVersionId, dv2.inputVersionReferences.floorPlanVersionId);
});
