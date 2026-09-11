import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCompiledModuleMeshes, type DisplayPart } from '../src/features/scene/compiled-module-meshes.ts';

const part: DisplayPart = {
  id: 'left', moduleId: 'wardrobe', roomId: 'bedroom', semanticType: 'carcass',
  widthMm: 18, depthMm: 600, heightMm: 2000,
  position: { xMm: 1200, yMm: 300, zMm: 450 }, rotationDeg: 0, materialId: 'oak',
};
const material = () => new THREE.MeshStandardMaterial();

test('compiled panel keeps its corner origin, exact dimensions and mounting elevation', () => {
  const group = createCompiledModuleMeshes('wardrobe', [part], material);
  const bounds = new THREE.Box3().setFromObject(group);
  assert.deepEqual(bounds.min.toArray(), [1200, 450, 300]);
  assert.deepEqual(bounds.max.toArray(), [1218, 2450, 900]);
  const mesh = group.children[0].children[0];
  assert.equal(mesh.userData.partId, 'left');
  assert.equal(mesh.userData.id, 'wardrobe');
});

test('rotated parts match deterministic negative-plan-yaw geometry without double placement', () => {
  for (const angle of [0, 37, 90, 180, 270]) {
    const group = createCompiledModuleMeshes('wardrobe', [{ ...part, rotationDeg: angle }], material);
    group.updateMatrixWorld(true);
    const mesh = group.children[0].children[0] as THREE.Mesh;
    const corner = mesh.localToWorld(new THREE.Vector3(part.widthMm / 2, -part.heightMm / 2, part.depthMm / 2));
    const theta = -angle * Math.PI / 180;
    assert.ok(Math.abs(corner.x - (1200 + 18 * Math.cos(theta) - 600 * Math.sin(theta))) < 1e-8);
    assert.ok(Math.abs(corner.z - (300 + 18 * Math.sin(theta) + 600 * Math.cos(theta))) < 1e-8);
    assert.equal(corner.y, 450);
  }
});

test('independent components retain material bindings; unrelated modules and light anchors are not duplicated', () => {
  const assigned: Array<string | undefined> = [];
  const parts = [part, { ...part, id: 'shutter', semanticType: 'shutter', materialId: 'ivory' },
    { ...part, id: 'other', moduleId: 'other' }, { ...part, id: 'lamp', semanticType: 'lighting_anchor' }];
  const group = createCompiledModuleMeshes('wardrobe', parts, id => { assigned.push(id); return material(); });
  assert.equal(group.children.length, 2);
  assert.deepEqual(assigned, ['oak', 'ivory']);
  assert.equal(parts[0].position.zMm, 450);
});

test('invalid compiled measurements cannot become invented default panels', () => {
  assert.throws(() => createCompiledModuleMeshes('wardrobe', [{ ...part, widthMm: NaN }], material), /left.*invalid measured geometry/);
});
