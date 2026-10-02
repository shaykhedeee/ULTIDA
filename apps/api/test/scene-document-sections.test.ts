import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sceneDocumentSections } from '../src/scene-document-sections.js';
import type { SceneV1 } from '@ultida/scene-core';

test('drawing elevation projection reverses the recorded plan-yaw convention for local component coordinates', () => {
  for (const geometryConvention of ['legacy-negative-plan-yaw', 'plan-positive-yaw-v2'] as const) {
    const rotationDeg = 90;
    const planAngle = geometryConvention === 'plan-positive-yaw-v2' ? Math.PI / 2 : -Math.PI / 2;
    const localX = 300, localY = 80;
    const scene = {
      walls: [], openings: [], materials: [], rooms: [{ id: 'room', name: 'Room' }],
      modules: [{ id: 'unit', roomId: 'room', family: 'wardrobe', position: { xMm: 1000, yMm: 500, zMm: 0 }, rotationDeg, widthMm: 1800, depthMm: 600, heightMm: 2400, materialSlots: {} }],
      moduleParts: [{ id: 'shelf', moduleId: 'unit', semanticType: 'shelf', name: 'Shelf', position: { xMm: 1000 + localX * Math.cos(planAngle) - localY * Math.sin(planAngle), yMm: 500 + localX * Math.sin(planAngle) + localY * Math.cos(planAngle), zMm: 300 }, widthMm: 564, depthMm: 18, heightMm: 18, rotationDeg, materialId: undefined }],
      metadata: { geometryConvention },
    } as unknown as SceneV1;
    const elevation = sceneDocumentSections(scene).elevations[0];
    assert.ok(elevation);
    assert.ok(Math.abs((elevation?.internalJoinery[0]?.xMm ?? NaN) - localX) < 1e-8);
    assert.equal(elevation?.internalJoinery[0]?.yMm, 300);
  }
});
