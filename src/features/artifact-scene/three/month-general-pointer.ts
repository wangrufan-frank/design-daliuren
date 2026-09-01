import * as THREE from "three";

export function angleOnPlatePlane(
  ray: THREE.Ray,
  plane: THREE.Plane,
  center: THREE.Vector3,
): number | undefined {
  const hit = ray.intersectPlane(plane, new THREE.Vector3());
  if (!hit) return undefined;
  const local = hit.sub(center);
  return Math.atan2(local.x, local.z);
}
