import * as THREE from "three";

type Disposable = { dispose(): void };

const disposedResources = new WeakSet<object>();

function disposeOnce(resource: Disposable) {
  if (disposedResources.has(resource)) return;
  disposedResources.add(resource);
  resource.dispose();
}

function disposeMaterial(material: THREE.Material) {
  for (const [key, value] of Object.entries(material)) {
    if (key !== "envMap" && value instanceof THREE.Texture) disposeOnce(value);
  }
  disposeOnce(material);
}

export function disposeArtifact(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    disposeOnce(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) disposeMaterial(material);
  });
}
