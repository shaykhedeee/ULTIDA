import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  inspectGlbBuffer,
  glbAssetPipeline,
  DIGITAL_TWIN_REFERENCE_PROFILES,
  GLB_MAGIC_NUMBER,
  MAX_SAFE_POLYGONS,
  inferMaterialSlot,
} from '../src/features/scene/glb-asset-pipeline.ts';

function makeGlb(gltf: Record<string, unknown>) {
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const buffer = new ArrayBuffer(20 + jsonLength);
  const view = new DataView(buffer);
  view.setUint32(0, GLB_MAGIC_NUMBER, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, json.length).set(json);
  return buffer;
}

const minimalGltf = {
  asset: { version: '2.0' },
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  accessors: [
    { count: 24, type: 'VEC3', min: [-0.5, 0, -0.3], max: [0.5, 2.4, 0.3] },
    { count: 36, type: 'SCALAR' },
  ],
};

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

test('inspectGlbBuffer: rejects corrupt lengths, malformed chunks, and non-v2 headers', () => {
  const valid = makeGlb(minimalGltf);
  const badLength = valid.slice(0);
  new DataView(badLength).setUint32(8, badLength.byteLength - 4, true);
  assert.equal(inspectGlbBuffer(badLength).valid, false);
  assert.ok(inspectGlbBuffer(badLength).errors.some((error) => error.includes('byteLength')));

  const badChunk = valid.slice(0);
  new DataView(badChunk).setUint32(12, badChunk.byteLength, true);
  assert.equal(inspectGlbBuffer(badChunk).valid, false);
  assert.ok(inspectGlbBuffer(badChunk).errors.some((error) => error.includes('chunk length')));

  const badVersion = valid.slice(0);
  new DataView(badVersion).setUint32(4, 1, true);
  assert.equal(inspectGlbBuffer(badVersion).valid, false);
});

test('inspectGlbBuffer: enforces the strict 65,000 triangle ceiling', () => {
  const gltf = {
    asset: { version: '2.0' },
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] },
      { count: MAX_SAFE_POLYGONS * 3, type: 'SCALAR' },
    ],
  };
  const atLimit = inspectGlbBuffer(makeGlb({
    ...gltf,
    accessors: [gltf.accessors[0], { count: MAX_SAFE_POLYGONS * 3, type: 'SCALAR' }],
  }));
  assert.equal(atLimit.polyCount, MAX_SAFE_POLYGONS);
  assert.equal(atLimit.valid, true);
  const overLimit = inspectGlbBuffer(makeGlb({
    ...gltf,
    accessors: [gltf.accessors[0], { count: (MAX_SAFE_POLYGONS + 1) * 3, type: 'SCALAR' }],
  }));
  assert.equal(overLimit.polyCount, MAX_SAFE_POLYGONS + 1);
  assert.equal(overLimit.valid, false);
  assert.ok(overLimit.errors.some((error) => error.includes('65,000-triangle asset limit')));
});

test('material slot inference recognizes architectural semantic names', () => {
  assert.equal(inferMaterialSlot('Wardrobe_Carcass_Oak'), 'carcass');
  assert.equal(inferMaterialSlot('Front_Shutter_Matte'), 'shutter');
  assert.equal(inferMaterialSlot('Quartz_Countertop'), 'countertop');
  assert.equal(inferMaterialSlot('Back_Panel_9mm'), 'back-panel');
  assert.equal(inferMaterialSlot('35mm_Hinge_Hardware'), 'hardware');
});

test('instantiateModel scales exact bounds, grounds at Y=0, and replaces semantic slots independently', () => {
  const source = new THREE.Group();
  const carcassMaterial = new THREE.MeshStandardMaterial();
  carcassMaterial.name = 'Carcass_Oak';
  const shutterMaterial = new THREE.MeshStandardMaterial();
  shutterMaterial.name = 'Front_Shutter';
  const hardwareMaterial = new THREE.MeshStandardMaterial();
  hardwareMaterial.name = 'Hinge_Hardware';
  const carcassMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), carcassMaterial);
  carcassMesh.position.y = 4;
  source.add(carcassMesh);
  source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [shutterMaterial, hardwareMaterial]));
  const override = {
    carcass: new THREE.MeshStandardMaterial({ color: '#123456' }),
    shutter: new THREE.MeshStandardMaterial({ color: '#654321' }),
    hardware: new THREE.MeshStandardMaterial({ color: '#abcdef' }),
  };
  const twin = glbAssetPipeline.instantiateModel(
    { scene: source } as any,
    inspectGlbBuffer(makeGlb(minimalGltf)),
    { targetWidthMm: 1000, targetDepthMm: 600, targetHeightMm: 2400, materialSlotOverrides: override },
  );
  const bounds = new THREE.Box3().setFromObject(twin.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.equal(Math.round(size.x), 1000);
  assert.equal(Math.round(size.y), 2400);
  assert.equal(Math.round(size.z), 600);
  assert.equal(Math.round(bounds.min.y), 0);
  assert.equal((twin.root.children[0] as THREE.Mesh).material, override.carcass);
  const mapped = (twin.root.children[1] as THREE.Mesh).material as THREE.Material[];
  assert.equal(mapped[0], override.shutter);
  assert.equal(mapped[1], override.hardware);
  assert.deepEqual(new Set(twin.appliedSlots), new Set(['carcass', 'shutter', 'hardware']));
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

test('digital twin references cover intended families without claiming unattached GLB certification', () => {
  const families = Object.values(DIGITAL_TWIN_REFERENCE_PROFILES).map((e) => e.family);
  assert.ok(families.includes('wardrobe'));
  assert.ok(families.includes('kitchen-base'));
  assert.ok(families.includes('kitchen-wall'));
  assert.ok(families.includes('tv-unit'));
  assert.ok(families.includes('pooja'));
  assert.ok(families.includes('study'));

  for (const entry of Object.values(DIGITAL_TWIN_REFERENCE_PROFILES)) {
    assert.ok(entry.nominalDimensionsMm.width > 0);
    assert.ok(entry.nominalDimensionsMm.depth > 0);
    assert.ok(entry.nominalDimensionsMm.height > 0);
    assert.equal(entry.modelSource, entry.assetUrl ? 'verified-glb' : 'parametric-reference');
  }
});
