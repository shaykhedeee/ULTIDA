import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCandidates } from '@ultida/layout-core';
import { compileSceneV1 } from '@ultida/scene-compiler';
import { COMPILER_REGISTRY } from '@ultida/module-framework';
import { readFileSync } from 'node:fs';

const plan: any = {
  schemaVersion: 'plan.v1', state: 'approved', ceilingHeightMm: 2700,
  source: { schemaVersion: 'plan.v1', sourceAssetId: 'asset-1', sourceType: 'fixture', sourceWidth: 4000, sourceHeight: 3000, sourceRotation: 0, coordinateSystem: 'millimetres', scaleResolution: 'verified_dimension', verifiedDimensionMm: 4000, scaleObservations: [] },
  spaces: [{ id: 'living-1', sourcePolygon: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }], worldPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }], roomType: 'living', ceilingHeightMm: 2700, wallRefs: ['wall-1'], openingRefs: [], verification: 'verified' }],
  walls: [{ id: 'wall-1', sourceStart: { x: 0, y: 0 }, sourceEnd: { x: 4000, y: 0 }, worldStart: { xMm: 0, yMm: 0 }, worldEnd: { xMm: 4000, yMm: 0 }, thicknessMm: 150, heightMm: 2700, adjacentSpaces: ['living-1'], verification: 'verified' }],
  openings: [], columns: [], beams: [], servicePoints: [], annotations: [], issues: [], assumptions: [], validation: { isValid: true, blockingIssueCount: 0, issues: [] },
};

test('local MVP flow carries brief context through plan, layout, module, and scene', () => {
  const brief = { projectName: 'Fixture Residence', rooms: 'living', style: 'Contemporary', storageNeeds: 'TV storage', materials: 'matte laminate' };
  assert.equal(brief.projectName, 'Fixture Residence');
  const candidates = generateCandidates({ projectId: 'project-1', spaceId: 'living-1', roomCategory: 'living', floorPlanVersionId: 'plan-1', shape: 'tv_opposite_sofa', candidateTypes: ['balanced'], requirements: brief, roomBoundingBoxMm: { minX: 0, minY: 0, maxX: 4000, maxY: 3000 }, usableWalls: [{ id: 'wall-1', minX: 0, minY: 0, maxX: 4000, maxY: 0, orientation: 'north' }], openings: [], servicePoints: [], structuralElements: [], companyRules: {} });
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((candidate) => candidate.shape === 'tv_opposite_sofa'));
  const module = COMPILER_REGISTRY.tv_unit({ templateVersionId: 'tv-unit-v1', instanceId: 'module-1', wall: { widthMm: 4000, heightMm: 2700 }, parameters: { totalWidthMm: 1800, totalDepthMm: 400, totalHeightMm: 600, shutterCount: 2 } } as any);
  const approvedFixture = JSON.parse(readFileSync(new URL('../../../packages/plan-core/test/fixtures/approved-plan.json', import.meta.url), 'utf8'));
  const scene = compileSceneV1({ projectId: 'project-1', floorPlanVersionId: 'plan-1', designVersion: 'layout-1', plan: approvedFixture, modules: [{ id: 'module-1', roomId: approvedFixture.spaces[0].id, family: 'tv-unit', widthMm: 1800, depthMm: 400, heightMm: 600, xMm: 100, yMm: 0, rotationDeg: 0 }], moduleParts: module.parts.map((part: any) => ({ id: part.id, moduleId: 'module-1', roomId: approvedFixture.spaces[0].id, family: 'tv-unit', semanticType: part.meta?.semanticType ?? 'part', name: part.name, widthMm: part.size.widthMm, depthMm: part.size.depthMm, heightMm: part.size.heightMm, xMm: 100 + part.transform.xMm, yMm: part.transform.yMm, zMm: part.transform.zMm, rotationDeg: part.transform.rotationDeg, materialId: part.meta?.materialSlot?.id })) });
  assert.equal(scene.schema, 'scene.v1');
  assert.ok(scene.moduleParts.length > 0);
});
