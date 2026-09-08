import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { compileScene, checkRenderReadiness } from '../src/index';
import type { SceneV1 } from '@ultida/scene-core';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.v1.json`, import.meta.url), 'utf8'));
}

function buildFixtureScene(): SceneV1 {
  const rawRooms = fixture('rooms') as SceneV1['rooms'];
  const rooms = rawRooms.map((r) => {
    const boundary = [...r.boundary];
    const first = boundary[0];
    const last = boundary[boundary.length - 1];
    if (first && last && (first.xMm !== last.xMm || first.yMm !== last.yMm)) {
      boundary.push({ ...first });
    }
    return { ...r, boundary };
  });

  return {
    schema: 'scene.v1',
    units: 'mm',
    coordinateSystem: 'right-handed-z-up',
    projectId: 'project-1',
    floorPlanVersionId: 'plan-1',
    floors: fixture('floors') as SceneV1['floors'],
    spaces: fixture('spaces') as SceneV1['spaces'],
    rooms,
    walls: fixture('walls') as SceneV1['walls'],
    openings: fixture('openings') as SceneV1['openings'],
    fixedFixtures: [],
    modules: fixture('modules') as SceneV1['modules'],
    moduleParts: [
      {
        id: 'p-tv-1',
        moduleId: 'module-living-01',
        roomId: 'living-01',
        semanticType: 'panel',
        name: 'Back panel',
        widthMm: 1200,
        depthMm: 18,
        heightMm: 600,
        position: { xMm: 0, yMm: 0, zMm: 0 },
        rotationDeg: 0,
        confidence: 1,
      },
    ],
    compositions: [],
    materials: [],
    lighting: [],
    cameras: [],
    constraints: [],
    unresolvedDetections: [],
    metadata: {
      branch: 'main',
      status: 'draft',
      changeReason: 'test',
      schemaVersion: 'scene.v1',
      designVersion: '1.0.0'
    }
  } as SceneV1;
}

describe('scene-compiler', () => {
  it('compiles a deterministic scene graph from canonical input', () => {
    const scene = buildFixtureScene();
    const graph = compileScene(scene, { provider: 'test', model: 'deterministic-fixture' });

    assert.equal(graph.units, 'mm');
    assert.equal(graph.coordinateSystem, 'right-handed-z-up');
    assert.ok(graph.nodes.length >= 6);
    assert.equal(graph.provenance.compiler, 'scene-compiler@0.1.0');

    const ids = graph.nodes.map((node) => node.id);
    assert.ok(ids.includes('floor-floor-main'));
    assert.ok(ids.includes('wall-wall-living-a'));
    assert.ok(ids.includes('opening-door-01'));
    assert.ok(ids.includes('module-module-living-01') || graph.nodes.some((n) => n.sourceId === 'module-living-01'));
    assert.equal(graph.readiness.blockingCount, 0);
    assert.equal(graph.readiness.warningCount, 0);
  });

  it('reports blocking issues for unverified openings and invalid modules', () => {
    const scene = buildFixtureScene();
    scene.openings[0].kind = 'window';
    scene.openings[0].sillHeightMm = -1;
    scene.modules[0].heightMm = -120;
    const readiness = checkRenderReadiness(scene);

    assert.equal(readiness.ready, false);
    assert.ok(readiness.blockingCount >= 2);
    const codes = readiness.issues.map((issue) => issue.code);
    assert.ok(codes.includes('UNVERIFIED_WINDOW_HEIGHT'));
    assert.ok(codes.includes('MODULE_INVALID'));
  });

  it('produces stable output for the same canonical model', async () => {
    const scene = buildFixtureScene();
    const first = compileScene(scene);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = compileScene(scene);

    assert.deepEqual(first.nodes, second.nodes);
    assert.notEqual(first.provenance.generatedAt, second.provenance.generatedAt);
  });
});
