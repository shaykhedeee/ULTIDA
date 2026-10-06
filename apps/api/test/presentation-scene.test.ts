import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenePresentationSheets } from '../src/presentation-scene.js';

const scene: any = {
  projectId: 'fixture', floorPlanVersionId: 'plan', metadata: { status: 'approved', designVersion: 'rev-1' },
  walls: [{ id: 'north', start: { xMm: 0, yMm: 0 }, end: { xMm: 4000, yMm: 0 }, heightMm: 2700, spaceIds: ['room'] }],
  rooms: [{ id: 'room', name: 'Bedroom', boundary: [{ xMm: 0, yMm: 0 }, { xMm: 4000, yMm: 0 }, { xMm: 4000, yMm: 3000 }] }],
  modules: [{ id: 'unit', roomId: 'room', family: 'wardrobe', position: { xMm: 500, yMm: 0, zMm: 0 }, widthMm: 1200, depthMm: 600, heightMm: 2400, rotationDeg: 0, materialSlots: { carcass: 'oak', shutter: 'unknown' } }],
  materials: [{ id: 'oak', code: 'OAK-1', name: 'Oak', finish: 'matte', colorHex: '#a58863' }, { id: 'unused', code: 'OTHER', name: 'Unused material' }],
  moduleParts: Array.from({ length: 10 }, (_, index) => ({ id: `panel-${index}`, moduleId: 'unit', roomId: 'room', name: `Panel ${index}`, semanticType: index === 0 ? 'shutter' : 'shelf', position: { xMm: 500, yMm: 0, zMm: 200 + index*100 }, rotationDeg: 0, widthMm: 600, depthMm: 600, heightMm: 18, materialId: 'oak' })), openings: [],
};

test('presentation includes saved plan, selected finishes, internal/external elevations and paginated panel details', async () => {
  const sheets = await buildScenePresentationSheets(scene);
  assert.ok(sheets.find(sheet => sheet.title === 'Room floor plan')?.image);
  assert.equal(sheets.filter(sheet => sheet.title.includes('elevation')).length, 2);
  const panels = sheets.filter(sheet => sheet.title.includes('Component schedule'));
  assert.deepEqual(panels.map(sheet => sheet.rows?.length), [8, 2]);
  assert.match(panels[0].rows![0].detail, /600 × 600 × 18 mm · Z 200/);
  const board = sheets.find(sheet => sheet.layout === 'moodboard')!;
  assert.equal(board.rows?.length, 1);
  assert.equal(board.rows![0].colorHex, '#a58863');
  assert.match(sheets.find(sheet => sheet.title.startsWith('Furniture finish'))!.rows![1].detail, /Specification unresolved/);
});

test('empty geometry does not manufacture a plan or a colour moodboard', async () => {
  const sheets = await buildScenePresentationSheets({ ...scene, rooms: [], walls: [], modules: [], materials: [], moduleParts: [] });
  assert.equal(sheets.length, 0);
});
