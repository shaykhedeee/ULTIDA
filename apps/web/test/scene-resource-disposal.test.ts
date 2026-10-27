import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { disposeSceneResources, isolateSceneResources } from '../src/features/scene/scene-resource-disposal';
test('shared geometry, material and textures are released once per scene teardown', () => {
  const root = new THREE.Group(); const geometry = new THREE.BoxGeometry(); const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const count = { geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener('dispose', () => count.geometry++);
  material.addEventListener('dispose', () => count.material++);
  texture.addEventListener('dispose', () => count.texture++);
  disposeSceneResources(root);
  assert.deepEqual(count, { geometry: 1, material: 1, texture: 1 });
});
test('disposing a cloned asset cannot release the cached source resources', () => {
  const source = new THREE.Group(); const geometry = new THREE.BoxGeometry(); const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture }); source.add(new THREE.Mesh(geometry, material));
  const instance = source.clone(true); isolateSceneResources(instance);
  const mesh = instance.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  assert.notEqual(mesh.geometry, geometry); assert.notEqual(mesh.material, material); assert.notEqual(mesh.material.map, texture);
  let disposed = 0;
  for (const resource of [geometry, material, texture]) resource.addEventListener('dispose', () => disposed++);
  disposeSceneResources(instance); assert.equal(disposed, 0);
});
