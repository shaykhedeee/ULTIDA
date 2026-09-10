import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PassThrough } from 'node:stream';
import sharp from 'sharp';
import { compileSceneV1, reconcileSceneBays } from '@ultida/scene-compiler';
import { renderScenePerspectiveArtifacts } from '@ultida/render-pipeline';
import { buildProductionSnapshot, exportSceneToDxf, generateDrawingPackageSvg, generateProductionWorkbookXlsx, generateProductionLabelsSvg, generateProjectionPdf, buildDrawingProjection } from '@ultida/drawing-core';
import { prepareModulePlacement } from '../src/module-edit.js';
import { compileStoredModuleForScene } from '../src/scene-module-parts.js';
import { evaluateRenderImageQA, measureRenderImage } from '../src/visual-jobs.js';

test('measured golden room preserves placement, door/window geometry and revision through deterministic render and exports', async () => {
  const plan = JSON.parse(readFileSync(new URL('../../../packages/plan-core/test/fixtures/approved-plan.json', import.meta.url), 'utf8'));
  const corners = [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }, { xMm: 0, yMm: 3000 }];
  const roomId = plan.spaces[0].id;
  plan.source = { ...plan.source, sourceWidth: 4000, sourceHeight: 3000, mmPerPixel: 1, verifiedDimensionMm: 4000, scaleObservedMm: 4000 };
  plan.scale = { id: '00000000-0000-4000-8000-000000000099', pointA: corners[0], pointB: corners[1], realMm: 4000, inferredMm: 4000, method: 'verified_dimension', verified: true };
  plan.walls = corners.map((start, i) => ({ ...plan.walls[0], id: `00000000-0000-4000-8000-00000000000${i + 3}`, worldStart: start, worldEnd: corners[(i + 1) % 4], sourceStart: { x: start.xMm, y: start.yMm }, sourceEnd: { x: corners[(i + 1) % 4].xMm, y: corners[(i + 1) % 4].yMm }, lengthMm: i % 2 ? 3000 : 4000, adjacentSpaces: [roomId] }));
  plan.spaces[0].worldPolygon = [...corners, corners[0]];
  plan.spaces[0].sourcePolygon = [...corners, corners[0]].map((p) => ({ x: p.xMm, y: p.yMm }));
  plan.spaces[0].wallRefs = plan.walls.map((wall: any) => wall.id);
  plan.openings = [
    { id: '00000000-0000-4000-8000-000000000010', wallId: plan.walls[1].id, offsetMm: 800, widthMm: 900, heightMm: 2100, verification: 'verified' },
    { id: '00000000-0000-4000-8000-000000000011', wallId: plan.walls[2].id, offsetMm: 900, widthMm: 1200, sillMm: 900, headMm: 2100, verification: 'verified' },
  ];
  const proposal = { id: '00000000-0000-4000-8000-000000000020', space_id: roomId, category: 'tv-unit', template_id: 'tv-1800', config_json: { widthMm: 1800, depthMm: 400, heightMm: 600 }, position_json: { wallId: plan.walls[0].id, offsetMm: 1000 } };
  const placement = prepareModulePlacement(proposal, plan, roomId, []);
  assert.ok(placement.ok, JSON.stringify(placement));
  if (!placement.ok) return;
  // Exercise the storage serialization boundary: compilation uses the reloaded record.
  const persisted = JSON.parse(JSON.stringify(placement.candidate));
  const compiled = compileStoredModuleForScene(persisted, plan.walls);
  assert.ok(compiled.ok);
  if (!compiled.ok) return;
  const scene = compileSceneV1({ projectId: 'golden-room-test', floorPlanVersionId: 'golden-plan-v1', designVersion: 'golden-design-v1', plan,
    modules: [compiled.module], moduleParts: compiled.parts,
    compositionSchedules: [{ wallId: plan.walls[0].id, approvedUsableWidthMm: 4000, leftClearanceMm: 0, rightClearanceMm: 0, confirmed: true, confirmedBy: 'fixture-reviewer', confirmedAt: '2026-09-10T00:00:00Z', bays: [
      { id: 'clear-left', offsetMm: 0, widthMm: 1000, keepOut: false }, { id: 'unit', offsetMm: 1000, widthMm: 1800, moduleId: persisted.id, keepOut: false }, { id: 'clear-right', offsetMm: 2800, widthMm: 1200, keepOut: false },
    ] }],
    floorSurfaces: [{ id: 'floor-finish', roomId, materialVersionId: 'tile-test-v1', regionPolygon: corners, elevationMm: 0, buildUpThicknessMm: 20, substrate: 'fixture-screed', skirting: { heightMm: 100, profile: 'flush', doorwayExclusions: [] } }],
  });
  assert.ok(reconcileSceneBays(scene).every((r) => r.valid));
  assert.equal(scene.openings.find((o) => o.kind === 'window')?.sillHeightMm, 900);
  assert.equal(scene.openings.find((o) => o.kind === 'door')?.widthMm, 900);
  scene.metadata.status = 'approved'; // Test-only explicit approval; no live project is altered.
  const reloadedScene = JSON.parse(JSON.stringify(scene));
  const image = renderScenePerspectiveArtifacts(reloadedScene, { width: 640, height: 480 });
  const rgb = Buffer.from(image.rgb.url.split(',')[1], 'base64');
  const pixel = await sharp(rgb).extract({ left: 320, top: 300, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.ok(pixel[0] < 180 && pixel[0] !== pixel[2], 'The cabinet must be visible, not overwritten by the wall/floor.');
  assert.equal((await measureRenderImage(reloadedScene, image, image.rgb.url)).focalModuleVisible, true);
  const qa = await evaluateRenderImageQA(reloadedScene, image, image.edgeMap.url);
  assert.equal(qa.issues.filter((issue) => issue.severity === 'blocking').length, 0, JSON.stringify(qa));
  const snapshot = buildProductionSnapshot(reloadedScene);
  assert.ok(snapshot.parts.length >= 5);
  const workbook = generateProductionWorkbookXlsx(snapshot);
  assert.equal(workbook.subarray(0, 2).toString(), 'PK');
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const ended = new Promise<void>((done, reject) => { stream.once('end', done); stream.once('error', reject); });
  generateProjectionPdf(buildDrawingProjection(reloadedScene), stream, snapshot);
  await ended;
  const pdf = Buffer.concat(chunks);
  assert.ok(pdf.length > 10000);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const out = fileURLToPath(new URL('../../../.tmp-golden-room/', import.meta.url));
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'scene.json'), JSON.stringify(reloadedScene, null, 2));
  writeFileSync(resolve(out, 'render.png'), Buffer.from(image.rgb.url.split(',')[1], 'base64'));
  writeFileSync(resolve(out, 'drawings.svg'), generateDrawingPackageSvg(reloadedScene));
  writeFileSync(resolve(out, 'drawings.dxf'), exportSceneToDxf(reloadedScene));
  writeFileSync(resolve(out, 'panels.xlsx'), workbook);
  writeFileSync(resolve(out, 'labels.svg'), generateProductionLabelsSvg(snapshot));
  writeFileSync(resolve(out, 'drawing-package.pdf'), pdf);
  console.log(`Golden room: ${scene.walls.length} walls, ${scene.openings.length} openings, ${snapshot.parts.length} panels; outputs: ${out}`);
});
