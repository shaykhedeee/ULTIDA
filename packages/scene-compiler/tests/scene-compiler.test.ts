import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { compileScene, checkRenderReadiness } from '../src/index';
import type { SceneV1 } from '@ultida/scene-core';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../fixtures/${name}.v1.json`, import.meta.url), 'utf8'));
}

function buildFixtureScene(): SceneV1 {
  return {
    schema: 'scene.v1',
    units: 'mm',
    coordinateSystem: 'right-handed-z-up',
    projectId: 'project-1',
    floorPlanVersionId: 'plan-1',
    floors: fixture('floors') as SceneV1['floors'],
    spaces: fixture('spaces') as SceneV1['spaces'],
    rooms: fixture('rooms') as SceneV1['rooms'],
    walls: fixture('walls') as SceneV1['walls'],
    openings: fixture('openings') as SceneV1['openings'],
    fixedFixtures: [],
    modules: fixture('modules') as SceneV1['modules'],
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

    expect(graph.units).toBe('mm');
    expect(graph.coordinateSystem).toBe('right-handed-z-up');
    expect(graph.nodes.length).toBeGreaterThanOrEqual(8);
    expect(graph.provenance.compiler).toBe('scene-compiler@0.1.0');

    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toContain('floor-floor-main');
    expect(ids).toContain('wall-wall-living-a');
    expect(ids).toContain('opening-door-01');
    expect(ids).toContain('module-living-01');
    expect(graph.readiness.blockingCount).toBe(0);
    expect(graph.readiness.warningCount).toBe(0);
  });

  it('reports blocking issues for unverified openings and invalid modules', () => {
    const scene = buildFixtureScene();
    scene.openings[0].sillHeightMm = -1;
    scene.modules[0].heightMm = -120;
    const readiness = checkRenderReadiness(scene);

    expect(readiness.ready).toBe(false);
    expect(readiness.blockingCount).toBeGreaterThanOrEqual(2);
    const codes = readiness.issues.map((issue) => issue.code);
    expect(codes).toContain('UNVERIFIED_WINDOW_HEIGHT');
    expect(codes).toContain('MODULE_INVALID');
  });

  it('produces stable output for the same canonical model', () => {
    const scene = buildFixtureScene();
    const first = compileScene(scene);
    const second = compileScene(scene);

    expect(first.nodes).toEqual(second.nodes);
    expect(first.provenance.generatedAt).not.toEqual(second.provenance.generatedAt);
  });
});
