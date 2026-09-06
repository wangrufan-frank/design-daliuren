import * as THREE from "three";

export interface ArtifactViewport {
  readonly width: number;
  readonly height: number;
}

export interface ArtifactFrame {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function frameParityArtifact(
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3,
  viewport: ArtifactViewport,
): ArtifactFrame {
  if (bounds.isEmpty()) throw new Error("Cannot frame an empty artifact.");
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3()).setY(bounds.max.y);
  camera.aspect = width / height;
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const horizontalTangent = verticalTangent * camera.aspect;
  const elevation = THREE.MathUtils.degToRad(62);
  const direction = new THREE.Vector3(0.62, 0, 0.78).normalize().multiplyScalar(Math.cos(elevation));
  direction.y = Math.sin(elevation);
  camera.up.set(0, 1, 0);
  camera.position.copy(center).add(direction);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const orientation = camera.matrixWorld.clone().setPosition(0, 0, 0).invert();
  const corners: THREE.Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  const localCorners = corners.map((corner) => corner.clone().sub(center).applyMatrix4(orientation));
  let distance = 0;
  for (const corner of localCorners) {
    distance = Math.max(
      distance,
      corner.z + Math.abs(corner.x) / horizontalTangent,
      corner.z + Math.abs(corner.y) / verticalTangent,
    );
  }
  distance *= 1.04;
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);
  camera.far = Math.max(camera.far, distance + size.length() * 2);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (const corner of corners) {
    const projected = corner.project(camera);
    const x = (projected.x + 1) * width / 2;
    const y = (1 - projected.y) * height / 2;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
}
