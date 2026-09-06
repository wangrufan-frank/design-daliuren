import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  clampZoom,
  classifyArtifactGesture,
  mountArtifactInteraction,
  normalizeAngleDelta,
} from "./artifact-interaction";

function pointerEvent(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  pointerType = "touch",
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

function wheelEvent(deltaY: number): Event {
  const event = new Event("wheel", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "deltaY", { value: deltaY });
  return event;
}

function fixture() {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getBoundingClientRect", {
    value: () => ({ left: 0, top: 0, right: 240, bottom: 240, width: 240, height: 240 }),
  });
  Object.defineProperty(canvas, "setPointerCapture", { value: () => {} });
  Object.defineProperty(canvas, "releasePointerCapture", { value: () => {} });
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0, 5, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const root = new THREE.Group();
  const heaven = new THREE.Group();
  const earthBranch = new THREE.Group();
  const monthGeneral = new THREE.Group();
  root.add(heaven);
  heaven.add(earthBranch, monthGeneral);
  const mounted = mountArtifactInteraction({
    canvas,
    camera,
    root,
    heaven,
    target: new THREE.Vector3(),
    innerRadius: 0.45,
    outerRadius: 0.75,
    minDistance: 4,
    maxDistance: 12,
  });
  const screenPoint = (point: THREE.Vector3) => {
    const projected = point.clone().project(camera);
    return { x: (projected.x + 1) * 120, y: (1 - projected.y) * 120 };
  };
  return { canvas, camera, root, heaven, earthBranch, monthGeneral, mounted, screenPoint };
}

describe("artifact interaction", () => {
  it("reserves the heaven plate for independent rotation", () => {
    expect(classifyArtifactGesture(3.2, 2.7, 3.75)).toBe("heaven");
    expect(classifyArtifactGesture(4.4, 2.7, 3.75)).toBe("orbit");
  });

  it("keeps dial rotation continuous across the angle boundary", () => {
    expect(normalizeAngleDelta(-Math.PI + 0.1 - (Math.PI - 0.1))).toBeCloseTo(0.2);
    expect(normalizeAngleDelta(5 * Math.PI)).toBeCloseTo(Math.PI);
  });

  it("rotates only the heaven plate from mouse drag on its ring", () => {
    const { canvas, earthBranch, heaven, monthGeneral, mounted, root, screenPoint } = fixture();
    const beforeBranch = earthBranch.getWorldQuaternion(new THREE.Quaternion());
    const beforeGeneral = monthGeneral.getWorldQuaternion(new THREE.Quaternion());
    const start = screenPoint(new THREE.Vector3(0.6, 0, 0));
    const end = screenPoint(new THREE.Vector3(0, 0, 0.6));

    canvas.dispatchEvent(pointerEvent("pointerdown", 1, start.x, start.y, "mouse"));
    canvas.dispatchEvent(pointerEvent("pointermove", 1, end.x, end.y, "mouse"));
    canvas.dispatchEvent(pointerEvent("pointerup", 1, end.x, end.y, "mouse"));
    root.updateMatrixWorld(true);

    expect(heaven.rotation.y).not.toBeCloseTo(0);
    expect(root.rotation.x).toBeCloseTo(0);
    expect(root.rotation.y).toBeCloseTo(0);
    expect(earthBranch.getWorldQuaternion(new THREE.Quaternion()).equals(beforeBranch)).toBe(false);
    expect(monthGeneral.getWorldQuaternion(new THREE.Quaternion()).equals(beforeGeneral)).toBe(false);
    mounted.dispose();
  });

  it("accumulates free heaven rotation through 90 and 180 degrees", () => {
    const { canvas, heaven, mounted, screenPoint } = fixture();
    const points = [
      new THREE.Vector3(0.6, 0, 0),
      new THREE.Vector3(0, 0, 0.6),
      new THREE.Vector3(-0.6, 0, 0),
    ].map(screenPoint);

    canvas.dispatchEvent(pointerEvent("pointerdown", 1, points[0].x, points[0].y));
    canvas.dispatchEvent(pointerEvent("pointermove", 1, points[1].x, points[1].y));
    expect(Math.abs(heaven.rotation.y)).toBeCloseTo(Math.PI / 2, 5);
    canvas.dispatchEvent(pointerEvent("pointermove", 1, points[2].x, points[2].y));
    expect(Math.abs(heaven.rotation.y)).toBeCloseTo(Math.PI, 5);
    canvas.dispatchEvent(pointerEvent("pointerup", 1, points[2].x, points[2].y));
    mounted.dispose();
  });

  it("rotates the artifact root outside the heaven ring and bounds pitch", () => {
    const { canvas, heaven, mounted, root } = fixture();

    canvas.dispatchEvent(pointerEvent("pointerdown", 1, 12, 12));
    canvas.dispatchEvent(pointerEvent("pointermove", 1, 220, 5000));
    canvas.dispatchEvent(pointerEvent("pointerup", 1, 220, 5000));

    expect(root.rotation.y).not.toBeCloseTo(0);
    expect(root.rotation.x).toBeGreaterThanOrEqual(-Math.PI / 12);
    expect(root.rotation.x).toBeLessThanOrEqual(Math.PI / 3);
    expect(heaven.rotation.y).toBeCloseTo(0);
    mounted.dispose();
  });

  it("uses the same zoom bounds for pinch and wheel", () => {
    const { camera, canvas, mounted } = fixture();

    canvas.dispatchEvent(pointerEvent("pointerdown", 1, 80, 120));
    canvas.dispatchEvent(pointerEvent("pointerdown", 2, 160, 120));
    canvas.dispatchEvent(pointerEvent("pointermove", 1, 0, 120));
    canvas.dispatchEvent(pointerEvent("pointermove", 2, 240, 120));
    expect(camera.position.length()).toBeCloseTo(4);

    canvas.dispatchEvent(pointerEvent("pointerup", 1, 0, 120));
    canvas.dispatchEvent(pointerEvent("pointerup", 2, 240, 120));
    canvas.dispatchEvent(wheelEvent(100000));
    expect(camera.position.length()).toBeCloseTo(12);
    canvas.dispatchEvent(wheelEvent(-100000));
    expect(camera.position.length()).toBeCloseTo(4);
    mounted.dispose();
  });

  it("stops responding after every interaction listener is disposed", () => {
    const { camera, canvas, mounted, root } = fixture();
    mounted.dispose();

    canvas.dispatchEvent(wheelEvent(100));
    canvas.dispatchEvent(pointerEvent("pointerdown", 1, 10, 10));
    canvas.dispatchEvent(pointerEvent("pointermove", 1, 200, 200));

    expect(camera.position.length()).toBeCloseTo(Math.sqrt(50));
    expect(root.rotation.x).toBeCloseTo(0);
    expect(root.rotation.y).toBeCloseTo(0);
  });

  it("clamps zoom at both limits", () => {
    expect(clampZoom(2, 4, 12)).toBe(4);
    expect(clampZoom(8, 4, 12)).toBe(8);
    expect(clampZoom(20, 4, 12)).toBe(12);
  });
});
