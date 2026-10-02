import * as THREE from 'three';
import { DEFAULT_SCENE_GEOMETRY_CONVENTION, scenePlanYawRadians, type SceneGeometryConvention } from '@ultida/scene-core';

export type DisplayPart = {
  id: string; moduleId: string; roomId: string;
  widthMm: number; depthMm: number; heightMm: number;
  position: { xMm: number; yMm: number; zMm: number };
  rotationDeg: number; materialId?: string;
  semanticType: string; kind?: string;
};

/** Scene parts are world-space corner origins in mm, not centered module proxies. */
export function createCompiledModuleMeshes(
  moduleId: string,
  parts: DisplayPart[],
  materialFor: (materialId?: string) => THREE.Material,
  convention: SceneGeometryConvention = DEFAULT_SCENE_GEOMETRY_CONVENTION,
) {
  const group = new THREE.Group();
  group.name = `module:${moduleId}`;
  group.userData = { kind: 'module', id: moduleId, geometrySource: 'compiled-parts' };
  for (const part of parts) {
    if (part.moduleId !== moduleId) continue;
    // Light emitters are drawn by the existing dedicated lighting pass.
    if (part.kind === 'lighting_anchor' || part.semanticType === 'lighting_anchor') continue;
    const dimensions = [part.widthMm, part.depthMm, part.heightMm];
    if (!dimensions.every(value => Number.isFinite(value) && value > 0)
      || ![part.position.xMm, part.position.yMm, part.position.zMm, part.rotationDeg].every(Number.isFinite)) {
      throw new Error(`Compiled part ${part.id} has invalid measured geometry.`);
    }
    const anchor = new THREE.Group();
    anchor.position.set(part.position.xMm, part.position.zMm, part.position.yMm);
    // Three Y is opposite plan yaw after mapping the plan's Y axis onto world Z.
    anchor.rotation.y = -scenePlanYawRadians(part.rotationDeg, convention);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(part.widthMm, part.heightMm, part.depthMm), materialFor(part.materialId),
    );
    mesh.position.set(part.widthMm / 2, part.heightMm / 2, part.depthMm / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = part.id;
    mesh.userData = { kind: 'module', id: moduleId, partId: part.id, roomId: part.roomId, semanticType: part.semanticType };
    anchor.add(mesh);
    group.add(anchor);
  }
  return group;
}
