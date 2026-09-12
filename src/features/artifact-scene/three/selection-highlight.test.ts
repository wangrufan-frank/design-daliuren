import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { highlightSelection } from "./selection-highlight";

it("highlights only the selected geometry without altering or disposing its material", () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  const selected = new THREE.Mesh(geometry, material);
  const other = new THREE.Mesh(geometry, material);
  root.add(selected, other);
  const disposeGeometry = vi.spyOn(geometry, "dispose");
  const disposeMaterial = vi.spyOn(material, "dispose");
  const clear = highlightSelection(selected);
  expect(selected.children).toHaveLength(1);
  expect(other.children).toHaveLength(0);
  expect(selected.material).toBe(material);
  const overlay = selected.children[0] as THREE.Mesh;
  const disposeOverlay = vi.spyOn(overlay.material as THREE.Material, "dispose");
  const hits: THREE.Intersection[] = [];
  overlay.raycast(new THREE.Raycaster(), hits);
  expect(hits).toEqual([]);
  clear();
  expect(selected.children).toHaveLength(0);
  expect(disposeOverlay).toHaveBeenCalledOnce();
  expect(disposeGeometry).not.toHaveBeenCalled();
  expect(disposeMaterial).not.toHaveBeenCalled();
});
