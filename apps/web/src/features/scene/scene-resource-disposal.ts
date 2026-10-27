import * as THREE from 'three';
/** Clone GPU ownership; Object3D.clone otherwise shares cached asset resources. */
export function isolateSceneResources(root: THREE.Object3D) {
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materials = new Map<THREE.Material, THREE.Material>();
  const textures = new Map<THREE.Texture, THREE.Texture>();
  const copyMaterial = (source: THREE.Material) => {
    let material = materials.get(source);
    if (!material) {
      material = source.clone();
      for (const [key, value] of Object.entries(material)) {
        if (!(value instanceof THREE.Texture)) continue;
        let texture = textures.get(value);
        if (!texture) { texture = value.clone(); textures.set(value, texture); }
        (material as unknown as Record<string, unknown>)[key] = texture;
      }
      materials.set(source, material);
    }
    return material;
  };
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) {
      let geometry = geometries.get(mesh.geometry);
      if (!geometry) { geometry = mesh.geometry.clone(); geometries.set(mesh.geometry, geometry); }
      mesh.geometry = geometry;
    }
    if (mesh.material) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copyMaterial) : copyMaterial(mesh.material);
  });
}
/** Release shared GPU resources once, including late loaded asset groups. */
export function disposeSceneResources(root: THREE.Object3D) {
  const resources = new Set<{ dispose(): void }>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) resources.add(mesh.geometry);
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const material of materials) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
    }
    if (object instanceof THREE.Light && 'shadow' in object && object.shadow) resources.add(object.shadow as THREE.LightShadow);
  });
  for (const resource of resources) resource.dispose();
}
