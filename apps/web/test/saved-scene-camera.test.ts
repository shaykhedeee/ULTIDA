import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applySavedSceneCamera } from '../src/features/scene/saved-scene-camera';
test('restore uses persisted z-up pose and lens without altering source', () => {
  const saved = { position: { xMm: 100, yMm: 2000, zMm: 1500 }, target: { xMm: 900, yMm: 10, zMm: 1100 }, lensMm: 35 };
  const before = JSON.stringify(saved); const camera = new THREE.PerspectiveCamera(45, 4 / 3); const target = new THREE.Vector3();
  applySavedSceneCamera(camera, target, saved);
  assert.deepEqual(camera.position.toArray(), [100, 1500, 2000]);
  assert.deepEqual(target.toArray(), [900, 1100, 10]);
  assert.ok(Math.abs(camera.getFocalLength() - 35) < .00001);
  assert.equal(JSON.stringify(saved), before);
  assert.throws(() => applySavedSceneCamera(camera, target, { ...saved, lensMm: NaN }));
});
