import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { mountAtlasPicking } from "./atlas-picking";

function fixture(nodeId = "branch/earth/子") {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 } as DOMRect);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
  camera.position.z = 3;
  const root = new THREE.Group();
  root.userData.node_id = "plate/heaven";
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
  mesh.userData.node_id = nodeId;
  root.add(mesh);
  const selected: string[] = [];
  const dispose = mountAtlasPicking(canvas, camera, root, (id) => selected.push(id));
  function pointer(type: string, x = 100, y = 100, pointerId = 1) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId, button: 0 });
    canvas.dispatchEvent(event);
  }
  return { pointer, selected, dispose, root, mesh, canvas };
}

describe("atlas model picking", () => {
  it.each([
    ["lesson/fourth", "core-第四课"], ["transmission/initial", "core-初传"],
    ["branch/earth/丑", "branch-丑"], ["general/snake", "general-snake"], ["general/void", "general-void"],
    ["branch/earth/子", "zi"], ["branch/earth/亥", "hai"],
    ["general/noble", "noble"], ["plate/heaven", "plates"],
    ["plate/earth", "plates"], ["month-general/神后", "zi"], ["month-general/登明", "hai"],
  ])("opens the visible semantic element %s", (nodeId, expected) => {
    const test = fixture(nodeId);
    test.pointer("pointerdown");
    test.pointer("pointerup");
    expect(test.selected).toEqual([expected]);
    test.dispose();
  });

  it.each(["general/unknown", "branch/earth/unknown", "lesson/unknown"])("does not reinterpret unsupported %s as its parent plate", (nodeId) => {
    const test = fixture(nodeId);
    test.pointer("pointerdown"); test.pointer("pointerup");
    expect(test.selected).toEqual([]);
    test.dispose();
  });

  it("makes the picked canvas the focus return target", () => {
    const test = fixture();
    test.canvas.tabIndex = 0;
    document.body.append(test.canvas);
    test.pointer("pointerdown"); test.pointer("pointerup");
    expect(document.activeElement).toBe(test.canvas);
    test.dispose();
    test.canvas.remove();
  });

  it("does not open a card after wheel zoom during a pointer gesture", () => {
    const test = fixture();
    test.pointer("pointerdown");
    test.canvas.dispatchEvent(new Event("wheel"));
    test.pointer("pointerup");
    expect(test.selected).toEqual([]);
    test.dispose();
  });

  it("rejects a drag even when the pointer returns to its origin", () => {
    const test = fixture();
    test.pointer("pointerdown"); test.pointer("pointermove", 107); test.pointer("pointerup");
    expect(test.selected).toEqual([]);
    test.dispose();
  });

  it("rejects movement reported only by pointerup", () => {
    const test = fixture();
    test.pointer("pointerdown"); test.pointer("pointerup", 107);
    expect(test.selected).toEqual([]);
    test.dispose();
  });

  it("rejects the whole multiple-pointer gesture, then permits the next tap", () => {
    const test = fixture();
    test.pointer("pointerdown"); test.pointer("pointerdown", 100, 100, 2);
    test.pointer("pointerup", 100, 100, 2); test.pointer("pointerup");
    expect(test.selected).toEqual([]);
    test.pointer("pointerdown"); test.pointer("pointerup");
    expect(test.selected).toEqual(["zi"]);
    test.dispose();
  });

  it("ignores cancellation, invisible ancestors, and disposed listeners", () => {
    const test = fixture();
    test.pointer("pointerdown"); test.pointer("pointercancel"); test.pointer("pointerup");
    test.root.visible = false;
    test.pointer("pointerdown"); test.pointer("pointerup");
    test.root.visible = true;
    test.dispose();
    test.pointer("pointerdown"); test.pointer("pointerup");
    expect(test.selected).toEqual([]);
  });
});
