import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { angleOnPlatePlane } from "./month-general-pointer";

describe("angleOnPlatePlane", () => {
  const platePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const center = new THREE.Vector3();

  it("maps a pointer ray to an angle on the fixed plate plane", () => {
    const ray = new THREE.Ray(new THREE.Vector3(1, 1, 0), new THREE.Vector3(0, -1, 0));

    expect(angleOnPlatePlane(ray, platePlane, center)).toBeCloseTo(Math.PI / 2);
  });

  it("returns undefined when the pointer ray misses the plate plane", () => {
    const ray = new THREE.Ray(new THREE.Vector3(1, 1, 0), new THREE.Vector3(1, 0, 0));

    expect(angleOnPlatePlane(ray, platePlane, center)).toBeUndefined();
  });
});
