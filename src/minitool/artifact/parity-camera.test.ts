import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { frameParityArtifact } from "./parity-camera";

const BOARD_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-5, -0.5, -5),
  new THREE.Vector3(5, 0.5, 5),
);

function framed(viewport: { width: number; height: number }) {
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
  const frame = frameParityArtifact(camera, BOARD_BOUNDS, viewport);
  return { camera, frame };
}

describe("parity artifact camera", () => {
  it("frames the full solid artifact from the website portrait elevation", () => {
    const { camera, frame } = framed({ width: 390, height: 844 });

    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.right).toBeLessThanOrEqual(390);
    expect(frame.top).toBeGreaterThanOrEqual(0);
    expect(frame.bottom).toBeLessThanOrEqual(844);
    const center = BOARD_BOUNDS.getCenter(new THREE.Vector3()).setY(BOARD_BOUNDS.max.y);
    const direction = camera.position.clone().sub(center).normalize();
    const elevation = THREE.MathUtils.radToDeg(Math.asin(direction.y));
    expect(elevation).toBeGreaterThanOrEqual(61);
    expect(elevation).toBeLessThanOrEqual(63);
    expect(camera.position.x).toBeGreaterThan(center.x);
    expect(camera.position.y).toBeGreaterThan(0);
    expect(camera.position.z).toBeGreaterThan(center.z);
    expect(camera.up).toEqual(new THREE.Vector3(0, 1, 0));
  });

  it("contains the reference plane in landscape without clipping", () => {
    const portrait = framed({ width: 390, height: 844 });
    const landscape = framed({ width: 1280, height: 800 });

    expect(landscape.frame.left).toBeGreaterThanOrEqual(0);
    expect(landscape.frame.top).toBeGreaterThanOrEqual(0);
    expect(landscape.frame.right).toBeLessThanOrEqual(1280);
    expect(landscape.frame.bottom).toBeLessThanOrEqual(800.000001);
    const center = BOARD_BOUNDS.getCenter(new THREE.Vector3()).setY(BOARD_BOUNDS.max.y);
    expect(portrait.camera.position.clone().sub(center).normalize().angleTo(
      landscape.camera.position.clone().sub(center).normalize(),
    )).toBeLessThan(0.000001);
    expect(portrait.camera.position.length()).toBeGreaterThan(landscape.camera.position.length());
  });

  it("fills the canonical 1286 by 1223 capture without changing aspect ratio", () => {
    const canonical = new THREE.Box3(
      new THREE.Vector3(-1286 / 1223 / 2, 0, -0.5),
      new THREE.Vector3(1286 / 1223 / 2, 0.02, 0.5),
    );
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    const frame = frameParityArtifact(camera, canonical, { width: 1286, height: 1223 });

    expect(frame.left).toBeGreaterThanOrEqual(0);
    expect(frame.top).toBeGreaterThanOrEqual(0);
    expect(frame.right).toBeLessThanOrEqual(1286);
    expect(frame.bottom).toBeLessThanOrEqual(1223.000001);
    expect(frame.right - frame.left).toBeGreaterThan(1000);
  });
});
