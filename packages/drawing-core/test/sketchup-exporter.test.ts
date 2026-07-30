import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSketchUpRubyScript } from '../dist/index.js';
import type { SceneV1 } from '@ultida/scene-core';

test('generateSketchUpRubyScript builds clean SketchUp Ruby exporter script', () => {
  const dummyScene: SceneV1 = {
    schema: 'scene.v1',
    units: 'mm',
    coordinateSystem: 'right-handed-z-up',
    projectId: 'p1',
    floorPlanVersionId: 'fp1',
    floors: [{ id: 'f1', name: 'Ground Floor', elevationMm: 0, heightMm: 2700 }],
    spaces: [{ id: 's1', floorId: 'f1', name: 'Master Bedroom Space', type: 'bedroom' }],
    rooms: [
      {
        id: 'r1',
        spaceId: 's1',
        name: 'Master Bedroom',
        type: 'bedroom',
        boundary: [
          { xMm: 0, yMm: 0 },
          { xMm: 4000, yMm: 0 },
          { xMm: 4000, yMm: 3500 },
          { xMm: 0, yMm: 3500 },
          { xMm: 0, yMm: 0 }
        ],
        confidence: 1
      }
    ],
    walls: [
      {
        id: 'w1',
        floorId: 'f1',
        start: { xMm: 0, yMm: 0 },
        end: { xMm: 4000, yMm: 0 },
        thicknessMm: 254,
        heightMm: 2700,
        baseElevationMm: 0,
        spaceIds: ['s1'],
        confidence: 1
      }
    ],
    openings: [],
    fixedFixtures: [],
    modules: [
      {
        id: 'm1',
        roomId: 'r1',
        family: 'wardrobe',
        widthMm: 1800,
        depthMm: 600,
        heightMm: 2400,
        position: { xMm: 500, yMm: 50 },
        rotationDeg: 0,
        anchor: 'floor',
        confidence: 1
      }
    ],
    moduleParts: [],
    materials: [],
    lighting: [],
    cameras: [],
    constraints: [],
    unresolvedDetections: [],
    metadata: {
      branch: 'main',
      status: 'approved',
      changeReason: 'Initial scene compilation',
      schemaVersion: 'scene.v1',
      designVersion: '1.0.0'
    }
  };

  const script = generateSketchUpRubyScript(dummyScene);
  assert.ok(script.includes("Sketchup.active_model"));
  assert.ok(script.includes("layers.add('A-WALL-EXTR')"));
  assert.ok(script.includes("layers.add('A-FURN-BASE')"));
  assert.ok(script.includes("ULTIDA Walls"));
  assert.ok(script.includes("ULTIDA Floors"));
  assert.ok(script.includes("wardrobe"));
});
