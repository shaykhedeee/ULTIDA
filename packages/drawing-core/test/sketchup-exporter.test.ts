import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSketchUpRubyScript } from '../src/sketchup-exporter.ts';
import type { SceneV1 } from '@ultida/scene-core';

test('generateSketchUpRubyScript builds comprehensive, production-accurate SketchUp Ruby exporter script', () => {
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
    openings: [
      {
        id: 'd1',
        wallId: 'w1',
        kind: 'door',
        offsetMm: 500,
        widthMm: 1000,
        heightMm: 2100,
        sillHeightMm: 0,
        confidence: 1
      },
      {
        id: 'win1',
        wallId: 'w1',
        kind: 'window',
        offsetMm: 2000,
        widthMm: 1200,
        heightMm: 1400,
        sillHeightMm: 900,
        confidence: 1
      }
    ],
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
        rotationDeg: 90,
        anchor: 'floor',
        confidence: 1
      },
      {
        id: 'm2',
        roomId: 'r1',
        family: 'overhead_unit',
        widthMm: 900,
        depthMm: 350,
        heightMm: 600,
        position: { xMm: 2500, yMm: 50 },
        rotationDeg: 0,
        anchor: 'wall',
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

  // Core SketchUp setup
  assert.ok(script.includes("Sketchup.active_model"));
  assert.ok(script.includes("LengthUnit'] = 2")); // Millimetres
  assert.ok(script.includes("ULTIDA 3D Architecture & Modular Casework"));

  // CAD Layer / Tag Hierarchy
  assert.ok(script.includes("layers.add('A-WALL-EXTR')"));
  assert.ok(script.includes("layers.add('A-WALL-SKIR')"));
  assert.ok(script.includes("layers.add('A-DOOR')"));
  assert.ok(script.includes("layers.add('A-GLAZ')"));
  assert.ok(script.includes("layers.add('A-FLOR')"));
  assert.ok(script.includes("layers.add('A-CLNG')"));
  assert.ok(script.includes("layers.add('A-FURN-BASE')"));
  assert.ok(script.includes("layers.add('A-FURN-OVER')"));
  assert.ok(script.includes("layers.add('A-FURN-SHUT')"));
  assert.ok(script.includes("layers.add('A-FURN-HARD')"));

  // Wall Openings (Doors & Windows)
  assert.ok(script.includes("Door Opening: d1"));
  assert.ok(script.includes("ultida_create_door_assembly"));
  assert.ok(script.includes("Window Opening: win1"));
  assert.ok(script.includes("ultida_create_window_assembly"));
  assert.ok(script.includes("Sill wall"));
  assert.ok(script.includes("Lintel wall"));

  // Architecture: Floors, Skirting & False Ceiling
  assert.ok(script.includes("Floor: Master Bedroom"));
  assert.ok(script.includes("Room Perimeter Skirting"));
  assert.ok(script.includes("False Ceiling Slab (at 2700mm)"));
  assert.ok(script.includes("LED Cove Strip"));

  // System 32 Modular Casework Joinery
  assert.ok(script.includes("wardrobe [m1]"));
  assert.ok(script.includes("Recessed Plinth Kickboard"));
  assert.ok(script.includes("18mm Left Gable & Right Gable"));
  assert.ok(script.includes("Internal Adjustable Shelves (System 32)"));
  assert.ok(script.includes("Front Shutters"));
  assert.ok(script.includes("Brushed Brass Bar Handle"));

  // 3D Spatial Transformation (Rotation & Translation)
  assert.ok(script.includes("rot_rad = 90 * Math::PI / 180.0"));
  assert.ok(script.includes("Geom::Transformation.rotation"));
  assert.ok(script.includes("Geom::Transformation.translation"));

  // Scene Camera Pages (Tabs)
  assert.ok(script.includes("pages.add('01 - Overall 3D Orbit')"));
  assert.ok(script.includes("pages.add('02 - Floor Plan (Top View)')"));
  assert.ok(script.includes("pages.add('03 - Master Bedroom View')"));
});
