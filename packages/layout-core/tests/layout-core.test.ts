import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateCandidates, validatePlacements, approveLayout, invalidateDownstream, restoreApprovedVersion, shapeCatalogFor } from '../src/index.js';

describe('layout-core', () => {
  test('shape catalog exposes required kitchen/tv/wardrobe/living/bedroom shapes', () => {
    assert.deepEqual(shapeCatalogFor('kitchen').map(s => s.id), ['single_wall','parallel','l_shaped','u_shaped','peninsula','island','g_shaped']);
    assert.deepEqual(shapeCatalogFor('tv_unit').map(s => s.id), ['linear','floating','full_wall','asymmetrical','l_shaped','partition','tv_plus_study','tv_plus_crockery']);
    assert.deepEqual(shapeCatalogFor('wardrobe').map(s => s.id), ['linear','l_shaped','walk_in','wardrobe_plus_dresser','wardrobe_plus_study','wardrobe_plus_tv']);
    assert.deepEqual(shapeCatalogFor('living').map(s => s.id), ['tv_opposite_sofa','tv_adjacent_entrance','l_seating','parallel_seating','open_living_dining','partition_layout']);
    assert.deepEqual(shapeCatalogFor('bedroom').map(s => s.id), ['bed_centred','side_wall_bed','wardrobe_opposite_bed','wardrobe_near_entrance','study_near_window']);
  });

  test('generates kitchen candidates', () => {
    const candidates = generateCandidates({
      projectId: 'p1', spaceId: 's1', roomCategory: 'kitchen', floorPlanVersionId: 'fpv1', shape: 'l_shaped',
      candidateTypes: ['balanced'],
      requirements: {},
      roomBoundingBoxMm: { minX: 0, minY: 0, maxX: 4000, maxY: 3000 },
      usableWalls: [{ id: 'w1', minX: 0, minY: 0, maxX: 4000, maxY: 0 }, { id: 'w2', minX: 0, minY: 0, maxX: 0, maxY: 3000 }],
      openings: [], servicePoints: [{ id: 'sp1', xMm: 100, yMm: 100, type: 'plumbing' }], structuralElements: []
    });
    assert.ok(candidates.length > 0);
    assert.ok(candidates.some(c => c.shape === 'l_shaped'), 'expected l_shaped candidate');
  });

  test('placement validation blocks out-of-bounds furniture', () => {
    const placements = [{ id: 'p1', category: 'kitchen', templateFamily: 'kitchen-base', anchor: 'room', positionMm: [0,0,0], rotationYawDeg: 0, widthMm: 5000, depthMm: 500, heightMm: 750, clearanceMm: 900, requiredServicePoints: [] }];
    const result = validatePlacements({
      projectId: 'p1', spaceId: 's1', roomCategory: 'kitchen', floorPlanVersionId: 'fpv1', shape: 'single_wall',
      candidateTypes: ['balanced'], requirements: {}, roomBoundingBoxMm: { minX: 0, minY: 0, maxX: 4000, maxY: 3000 },
      usableWalls: [], openings: [], servicePoints: [], structuralElements: []
    }, placements);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.code === 'WALL_FIT'));
  });

  test('door swing collision is blocking', () => {
    const placements = [{ id: 'p1', category: 'living', templateFamily: 'sofa', anchor: 'room', positionMm: [0,0,0], rotationYawDeg: 0, widthMm: 900, depthMm: 900, heightMm: 850, clearanceMm: 900, requiredServicePoints: [] }];
    const result = validatePlacements({
      projectId: 'p1', spaceId: 's1', roomCategory: 'living', floorPlanVersionId: 'fpv1', shape: 'tv_opposite_sofa',
      candidateTypes: ['balanced'], requirements: {}, roomBoundingBoxMm: { minX: 0, minY: 0, maxX: 5000, maxY: 4000 },
      usableWalls: [], openings: [{ id: 'd1', type: 'door', xMm: 100, yMm: 100, widthMm: 900, heightMm: 2100, swingDeg: 90 }], servicePoints: [], structuralElements: []
    }, placements);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.code === 'DOOR_SWING'));
  });

  test('approval creates immutable layout version with downstream invalidation', () => {
    const candidate = {
      id: 'c1', category: 'kitchen', shape: 'l_shaped', candidateType: 'balanced',
      placements: [{ id: 'p1', category: 'kitchen', templateFamily: 'kitchen-base', anchor: 'room', positionMm: [0,0,0], rotationYawDeg: 0, widthMm: 2000, depthMm: 600, heightMm: 750, clearanceMm: 900, requiredServicePoints: [] }],
      validation: { valid: true, issues: [] },
      score: { validity: 1, storage: 1, circulation: 1, symmetry: 1, manufacturingSimplicity: 1, cost: 1, userPriority: 1, weighted: 1 }
    };
    const version = approveLayout({ projectId: 'p1', spaceId: 's1', candidateId: 'c1', floorPlanVersionId: 'fpv1' }, candidate, 'user1');
    assert.strictEqual(version.projectId, 'p1');
    assert.strictEqual(version.active, true);
    assert.ok(version.approvedAt);
    const events = invalidateDownstream(version, 'layout changed', ['modules', 'render']);
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].targets[0], 'modules');
  });

  test('restores approved version from history', () => {
    const versions = [
      { id: 'v1', active: false, approvedAt: undefined } as any,
      { id: 'v2', active: true, approvedAt: '2026-01-01T00:00:00Z' } as any,
      { id: 'v3', active: true, approvedAt: undefined } as any,
    ];
    const restored = restoreApprovedVersion(versions);
    assert.strictEqual(restored?.id, 'v2');
  });
});
