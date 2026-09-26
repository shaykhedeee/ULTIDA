import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  inspectGlbBuffer,
  glbAssetPipeline,
  CERTIFIED_DIGITAL_TWINS,
  GLB_MAGIC_NUMBER,
} from '../src/features/scene/glb-asset-pipeline.ts';

test('inspectGlbBuffer: rejects short or non-GLB buffers', () => {
  const shortBuffer = new ArrayBuffer(8);
  const result = inspectGlbBuffer(shortBuffer);
  assert.equal(result.valid, false);
  assert.equal(result.magicValid, false);
  assert.ok(result.errors.length > 0);

  // Invalid magic header
  const badMagic = new ArrayBuffer(20);
  const view = new DataView(badMagic);
  view.setUint32(0, 0x12345678, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, 20, true);

  const res2 = inspectGlbBuffer(badMagic);
  assert.equal(res2.valid, false);
  assert.equal(res2.magicValid, false);
  assert.ok(res2.errors.some((e) => e.includes('Invalid GLB magic header')));
});

test('inspectGlbBuffer: correctly parses valid GLB header and JSON chunk with material slots', () => {
  // Construct a minimal synthetic GLB buffer
  const gltfJson = JSON.stringify({
    asset: { version: '2.0' },
    materials: [
      { name: 'Carcass_Oak_Finish' },
      { name: 'Front_Shutter_Matte' },
      { name: 'Gola_Hardware_Profile' },
    ],
    meshes: [
      {
        name: 'Wardrobe_Mesh',
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
          },
        ],
      },
    ],
    accessors: [
      {
        count: 24,
        type: 'VEC3',
        min: [-0.5, 0, -0.3],
        max: [0.5, 2.4, 0.3],
      },
      {
        count: 36, // 12 triangles
        type: 'SCALAR',
      },
    ],
  });

  const jsonBytes = new TextEncoder().encode(gltfJson);
  // glTF chunk must be aligned to 4 bytes
  const paddedJsonLen = Math.ceil(jsonBytes.length / 4) * 4;
  const totalLength = 12 + 8 + paddedJsonLen;

  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // 12-byte header
  view.setUint32(0, GLB_MAGIC_NUMBER, true); // "glTF"
  view.setUint32(4, 2, true);                 // version 2
  view.setUint32(8, totalLength, true);        // byteLength

  // Chunk 0: JSON
  view.setUint32(12, paddedJsonLen, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  new Uint8Array(buffer, 20, jsonBytes.length).set(jsonBytes);

  const inspection = inspectGlbBuffer(buffer);
  assert.equal(inspection.valid, true);
  assert.equal(inspection.magicValid, true);
  assert.equal(inspection.version, 2);
  assert.equal(inspection.polyCount, 12);
  assert.equal(inspection.meshCount, 1);
  assert.equal(inspection.lodTier, 'lod1');

  // Should have converted meters (<25) to millimeters
  assert.equal(inspection.boundingBoxMm.width, 1000);
  assert.equal(inspection.boundingBoxMm.height, 2400);
  assert.equal(inspection.boundingBoxMm.depth, 600);

  // Should have discovered semantic material slots
  assert.ok(inspection.recognizedSlots.includes('carcass'));
  assert.ok(inspection.recognizedSlots.includes('shutter'));
  assert.ok(inspection.recognizedSlots.includes('hardware'));
});

test('glbAssetPipeline: creates high-precision parametric fallback with exact dimensions', () => {
  const fallback = glbAssetPipeline.createParametricProxy(
    {
      targetWidthMm: 1200,
      targetDepthMm: 600,
      targetHeightMm: 2100,
      castShadow: true,
      receiveShadow: true,
    },
    'wardrobe'
  );

  assert.equal(fallback.isFallback, true);
  assert.equal(fallback.appliedSlots[0], 'carcass');

  const bbox = new THREE.Box3().setFromObject(fallback.root);
  const size = bbox.getSize(new THREE.Vector3());

  assert.equal(Math.round(size.x), 1200);
  assert.equal(Math.round(size.y), 2100);
  assert.equal(Math.round(size.z), 600);
  assert.equal(Math.round(bbox.min.y), 0); // Origin at floor level
});

test('CERTIFIED_DIGITAL_TWINS: contains verified modular furniture families', () => {
  const families = Object.values(CERTIFIED_DIGITAL_TWINS).map((e) => e.family);
  assert.ok(families.includes('wardrobe'));
  assert.ok(families.includes('kitchen-base'));
  assert.ok(families.includes('kitchen-wall'));
  assert.ok(families.includes('tv-unit'));
  assert.ok(families.includes('pooja'));
  assert.ok(families.includes('study'));

  for (const entry of Object.values(CERTIFIED_DIGITAL_TWINS)) {
    assert.ok(entry.nominalDimensionsMm.width > 0);
    assert.ok(entry.nominalDimensionsMm.depth > 0);
    assert.ok(entry.nominalDimensionsMm.height > 0);
    assert.equal(entry.fabricationCertified, true);
  }
});
