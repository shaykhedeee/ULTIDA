import test from 'node:test';
import assert from 'node:assert/strict';
import { roomFloorPreviews } from '../src/features/scene/scene-floor-surfaces';
const surface = { id: 's', roomId: 'r', materialVersionId: 'tile', regionPolygon: [{ xMm: 0, yMm: 0 }, { xMm: 2400, yMm: 0 }, { xMm: 2400, yMm: 2400 }], elevationMm: 30, buildUpThicknessMm: 20, substrate: 'screed', tile: { widthMm: 600, lengthMm: 1200, groutWidthMm: 3, groutColor: '#aaaaaa', originX: 100, originY: 200, angleDeg: 30, pattern: 'brick' as const } };
test('room floors use saved polygons, material, build-up and tile pattern', () => {
  const result = roomFloorPreviews({ id: 'r', name: 'Bedroom', boundary: [] }, [{ surfaces: [surface] }], [{ id: 'tile', colorHex: '#123456', roughness: .7 }]);
  assert.equal(result[0]?.color, '#123456');
  assert.equal(result[0]?.elevationMm, 50);
  assert.equal(result[0]?.surface?.tile?.pattern, 'brick');
  assert.deepEqual(result[0]?.polygon, surface.regionPolygon);
});
test('room names cannot invent flooring or affect source selection', () => {
  const room = { id: 'other', name: 'Kitchen', boundary: surface.regionPolygon };
  const [floor] = roomFloorPreviews(room, [{ surfaces: [surface] }], []);
  assert.equal(floor?.materialId, undefined);
  assert.equal(floor?.color, '#e2dbd0');
  assert.equal(floor?.source, 'unassigned-preview');
});
