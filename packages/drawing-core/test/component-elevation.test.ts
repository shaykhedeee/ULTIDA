import assert from 'node:assert/strict';
import test from 'node:test';
import { Writable } from 'node:stream';
import { projectComponentElevation, generateWallElevationsSvg, exportWallElevationToDxf, buildDrawingProjection, generateProjectionPdf } from '../src/index.js';

const scene: any = {
  projectId: 'measured-room', floorPlanVersionId: 'plan', metadata: { status: 'approved', designVersion: 'rev-7' },
  walls: [{ id: 'east', start: { xMm: 4000, yMm: 0 }, end: { xMm: 4000, yMm: 3000 }, heightMm: 2700 }, { id: 'north', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, heightMm: 2700 }],
  modules: [{ id: 'cabinet', wallId: 'east', roomId: 'room', family: 'wardrobe', position: { xMm: 4000, yMm: 500, zMm: 0 }, widthMm: 1200, depthMm: 600, heightMm: 2400, rotationDeg: 90 }],
  materials: [{ id: 'finish', name: 'Oak & Ivory', code: 'OAK-01', finish: 'matte' }],
  moduleParts: ['shelf', 'drawer', 'shutter', 'filler', 'carcass'].map((semanticType, index) => ({ id: `part-${semanticType}`, name: semanticType, moduleId: 'cabinet', semanticType, position: { xMm: 4000, yMm: 500, zMm: 400 + index * 200 }, rotationDeg: 90, widthMm: 600, depthMm: 18, heightMm: 18, materialId: 'finish' })), openings: [],
};
test('components project world coordinates onto the owning rotated wall', () => {
  const projection = projectComponentElevation(scene, 'east');
  assert.equal(projection.parts.length, 5);
  assert.equal(projection.parts[0].xMm, 500);
  assert.equal(projection.parts[0].projectedWidthMm, 600);
  assert.equal(projection.parts[0].zMm, 400);
  assert.equal(projectComponentElevation(scene, 'north').parts.length, 0);
  assert.equal(buildDrawingProjection(scene).elevations[0].components?.parts.length, 5);
});
test('internal elevation removes saved front shutters without inventing interiors', () => {
  const internal = projectComponentElevation(scene, 'east', true);
  assert.equal(internal.parts.length, 4);
  assert.ok(internal.parts.some((part) => part.semanticType === 'drawer'));
  assert.ok(internal.parts.every((part) => part.semanticType !== 'shutter'));
});
test('SVG and DXF include saved component IDs and resolved material legends', () => {
  const svg = generateWallElevationsSvg(scene, 'east');
  const dxf = exportWallElevationToDxf(scene, 'east');
  for (const part of scene.moduleParts) {
    assert.ok(svg.includes(`data-part-id="${part.id}"`));
    assert.ok(dxf.includes(`${part.id}:`));
  }
  assert.match(svg, /Oak &amp; Ivory/);
  assert.match(svg, /rev-7/);
  assert.match(dxf, /OAK-01/);
  assert.doesNotMatch(dxf, /PLINTH 100mm|COUNTER 850mm|LOFT 2100mm/);
});
test('unresolved material and orphan components cannot masquerade as selected cabinet detail', () => {
  const altered = { ...scene, materials: [], moduleParts: [...scene.moduleParts, { ...scene.moduleParts[0], id: 'orphan', moduleId: 'missing' }] };
  const svg = generateWallElevationsSvg(altered, 'east');
  assert.match(svg, /material specification unresolved/);
  assert.doesNotMatch(svg, /data-part-id="orphan"/);
});

test('PDF includes a paginated component schedule, dimensions, materials and revision', async () => {
  const chunks: Buffer[] = [];
  const stream = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  const finished = new Promise<void>((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });
  generateProjectionPdf(buildDrawingProjection(scene), stream);
  await finished;
  const text = Buffer.concat(chunks).toString('latin1');
  assert.match(text, /^%PDF/);
  assert.match(text, /COMPONENTS AND MATERIAL LEGEND/);
  assert.match(text, /part-shelf/);
  assert.match(text, /600 x 18 x 18 mm/);
  assert.match(text, /OAK-01/);
  assert.match(text, /REV: rev-7/);
  assert.match(text, /SHEET 3 \/ 3/);
});

test('non-geometric lighting records do not break elevations and title settings survive', () => {
  const altered = { ...scene, moduleParts: [...scene.moduleParts, { ...scene.moduleParts[0], id: 'light-anchor', semanticType: 'lighting_anchor', widthMm: 0, depthMm: 0, heightMm: 0 }] };
  assert.equal(projectComponentElevation(altered, 'east').parts.length, 5);
  const svg = generateWallElevationsSvg(altered, 'east', { titleBlock: { companyName: 'Studio & Co', drawingTitle: 'Saved cabinet' } });
  assert.match(svg, /Studio &amp; Co/);
  assert.match(svg, /Saved cabinet/);
});
