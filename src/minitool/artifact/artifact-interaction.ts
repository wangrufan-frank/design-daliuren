import * as THREE from "three";

export type ArtifactGesture = "heaven" | "orbit";

export interface ArtifactInteractionOptions {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly root: THREE.Object3D;
  readonly heaven: THREE.Object3D;
  readonly target: THREE.Vector3;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly minDistance: number;
  readonly maxDistance: number;
}

export interface MountedArtifactInteraction {
  dispose(): void;
}

const MIN_PITCH = -Math.PI / 12;
const MAX_PITCH = Math.PI / 3;
const POINTER_OPTIONS = { capture: true } as const;
const WHEEL_OPTIONS = { passive: false } as const;

export function classifyArtifactGesture(radius: number, innerRadius: number, outerRadius: number): ArtifactGesture {
  return radius >= innerRadius && radius <= outerRadius ? "heaven" : "orbit";
}

export function normalizeAngleDelta(delta: number): number {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

export function clampZoom(distance: number, minDistance: number, maxDistance: number): number {
  return Math.max(minDistance, Math.min(maxDistance, distance));
}

export function mountArtifactInteraction(options: ArtifactInteractionOptions): MountedArtifactInteraction {
  const { canvas, camera, root, heaven, target } = options;
  const pointers = new Map<number, THREE.Vector2>();
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const worldPoint = new THREE.Vector3();
  const plane = new THREE.Plane();
  const planeNormal = new THREE.Vector3();
  const planeCenter = new THREE.Vector3();
  const dialCenter = new THREE.Vector3();
  let single: { pointerId: number; gesture: ArtifactGesture; x: number; y: number; angle?: number } | undefined;
  let pinch: { distance: number; cameraDistance: number } | undefined;
  let disposed = false;

  function angleAt(clientX: number, clientY: number): { angle: number; radius: number } | undefined {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return undefined;
    pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    heaven.updateWorldMatrix(true, false);
    camera.updateMatrixWorld(true);
    planeNormal.set(0, 1, 0).transformDirection(heaven.matrixWorld);
    planeCenter.setFromMatrixPosition(heaven.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(planeNormal, planeCenter);
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(plane, worldPoint)) return undefined;
    const dialSpace = heaven.parent ?? heaven;
    const local = dialSpace.worldToLocal(worldPoint.clone());
    dialCenter.copy(planeCenter);
    dialSpace.worldToLocal(dialCenter);
    const x = local.x - dialCenter.x;
    const z = local.z - dialCenter.z;
    return { angle: Math.atan2(x, z), radius: Math.hypot(x, z) };
  }

  function cameraDistance(): number {
    return camera.position.distanceTo(target);
  }

  function setCameraDistance(distance: number): void {
    const direction = camera.position.clone().sub(target);
    if (direction.lengthSq() === 0) direction.set(0, 1, 1);
    camera.position.copy(target).addScaledVector(
      direction.normalize(),
      clampZoom(distance, options.minDistance, options.maxDistance),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  }

  function firstTwoPointers(): readonly [THREE.Vector2, THREE.Vector2] | undefined {
    const values = [...pointers.values()];
    return values.length >= 2 ? [values[0], values[1]] : undefined;
  }

  function beginSingle(pointerId: number, point: THREE.Vector2): void {
    const hit = angleAt(point.x, point.y);
    const gesture = hit
      ? classifyArtifactGesture(hit.radius, options.innerRadius, options.outerRadius)
      : "orbit";
    canvas.dataset.lastGesture = gesture;
    single = { pointerId, gesture, x: point.x, y: point.y, angle: hit?.angle };
  }

  function onPointerDown(event: PointerEvent): void {
    if (disposed) return;
    const point = new THREE.Vector2(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);
    canvas.setPointerCapture?.(event.pointerId);
    const pair = firstTwoPointers();
    if (pair) {
      single = undefined;
      pinch = { distance: pair[0].distanceTo(pair[1]), cameraDistance: cameraDistance() };
    } else {
      beginSingle(event.pointerId, point);
    }
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent): void {
    const point = pointers.get(event.pointerId);
    if (disposed || !point) return;
    point.set(event.clientX, event.clientY);
    const pair = firstTwoPointers();
    if (pair && pinch) {
      const nextDistance = pair[0].distanceTo(pair[1]);
      if (nextDistance > 0 && pinch.distance > 0) {
        setCameraDistance(pinch.cameraDistance * pinch.distance / nextDistance);
      }
      event.preventDefault();
      return;
    }
    if (!single || single.pointerId !== event.pointerId) return;
    if (single.gesture === "heaven") {
      const hit = angleAt(event.clientX, event.clientY);
      if (hit && single.angle !== undefined) {
        heaven.rotation.y += normalizeAngleDelta(hit.angle - single.angle);
        single.angle = hit.angle;
      }
    } else {
      root.rotation.y += (event.clientX - single.x) * 0.008;
      root.rotation.x = THREE.MathUtils.clamp(
        root.rotation.x + (event.clientY - single.y) * 0.006,
        MIN_PITCH,
        MAX_PITCH,
      );
    }
    single.x = event.clientX;
    single.y = event.clientY;
    event.preventDefault();
  }

  function onPointerEnd(event: PointerEvent): void {
    if (!pointers.delete(event.pointerId)) return;
    canvas.releasePointerCapture?.(event.pointerId);
    pinch = undefined;
    single = undefined;
    if (pointers.size === 1) {
      const remaining = pointers.entries().next().value as [number, THREE.Vector2];
      beginSingle(remaining[0], remaining[1]);
    }
    event.preventDefault();
  }

  function onWheel(event: WheelEvent): void {
    if (disposed) return;
    setCameraDistance(cameraDistance() * Math.exp(event.deltaY * 0.0015));
    event.preventDefault();
  }

  canvas.addEventListener("pointerdown", onPointerDown, POINTER_OPTIONS);
  canvas.addEventListener("pointermove", onPointerMove, POINTER_OPTIONS);
  canvas.addEventListener("pointerup", onPointerEnd, POINTER_OPTIONS);
  canvas.addEventListener("pointercancel", onPointerEnd, POINTER_OPTIONS);
  canvas.addEventListener("wheel", onWheel, WHEEL_OPTIONS);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("pointerdown", onPointerDown, POINTER_OPTIONS);
      canvas.removeEventListener("pointermove", onPointerMove, POINTER_OPTIONS);
      canvas.removeEventListener("pointerup", onPointerEnd, POINTER_OPTIONS);
      canvas.removeEventListener("pointercancel", onPointerEnd, POINTER_OPTIONS);
      canvas.removeEventListener("wheel", onWheel, false);
      for (const pointerId of pointers.keys()) canvas.releasePointerCapture?.(pointerId);
      pointers.clear();
      single = undefined;
      pinch = undefined;
    },
  };
}
