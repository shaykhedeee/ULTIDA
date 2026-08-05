import test from 'node:test';
import assert from 'node:assert/strict';
import { exportPlanDraftToDxf } from '../src/index.js';

test('exportPlanDraftToDxf emits calibrated provisional geometry and layers', () => {
  const dxf = exportPlanDraftToDxf({
    planVersionId: 'analysis-1',
    geometryMode: 'initial_design',
    mmPerPixel: 2,
    elements: [
      { id: 'wall-1', kind: 'wall', geometry: { x1: 10, y1: 20, x2: 210, y2: 20 } },
      { id: 'room-1', kind: 'room', geometry: { polygon: [{ x: 10, y: 20 }, { x: 210, y: 20 }, { x: 210, y: 120 }, { x: 10, y: 120 }] } },
      { id: 'door-1', kind: 'door', geometry: { x: 80, y: 15, width: 40, height: 5 } },
    ],
    warnings: ['Opening needs site verification.'],
  });
  assert.match(dxf, /PROVISIONAL INITIAL DESIGN/);
  assert.match(dxf, /A-WALL/);
  assert.match(dxf, /A-ROOM/);
  assert.match(dxf, /A-OPENING/);
  assert.match(dxf, /UNITS: MILLIMETRES/);
  assert.match(dxf, /WARNING: Opening needs site verification/);
  assert.match(dxf, /0\r\nEOF\r\n$/);
});

test('exportPlanDraftToDxf rejects an uncalibrated plan', () => {
  assert.throws(() => exportPlanDraftToDxf({
    planVersionId: 'analysis-1', geometryMode: 'initial_design', mmPerPixel: 0, elements: [],
  }), /positive calibration scale/);
});
