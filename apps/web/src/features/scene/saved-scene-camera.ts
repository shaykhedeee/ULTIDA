import * as THREE from 'three';
type Point = { xMm: number; yMm: number; zMm: number };
export function applySavedSceneCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, saved: { position: Point; target: Point; lensMm: number }) {
  const values = [...Object.values(saved.position), ...Object.values(saved.target), saved.lensMm];
  if (values.some(value => !Number.isFinite(value)) || saved.lensMm <= 0) throw new Error('Saved camera measurements are invalid.');
  camera.position.set(saved.position.xMm, saved.position.zMm, saved.position.yMm);
  target.set(saved.target.xMm, saved.target.zMm, saved.target.yMm);
  camera.filmGauge = 36;
  camera.setFocalLength(saved.lensMm);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
