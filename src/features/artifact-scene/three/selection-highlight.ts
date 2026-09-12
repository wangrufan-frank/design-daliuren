import * as THREE from "three";

export function highlightSelection(node: THREE.Object3D): () => void {
  const meshes: THREE.Mesh[] = [];
  node.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  const material = new THREE.MeshBasicMaterial({
    color: 0xe6b85c, transparent: true, opacity: 0.42,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const overlays = meshes.map((mesh) => {
    const overlay = new THREE.Mesh(mesh.geometry, material);
    overlay.raycast = () => {};
    mesh.add(overlay);
    return overlay;
  });
  return () => {
    overlays.forEach((overlay) => overlay.removeFromParent());
    material.dispose();
  };
}
