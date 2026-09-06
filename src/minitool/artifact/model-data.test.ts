import { describe, expect, it } from "vitest";
import { decodeParityModel, type ParityModelParts } from "./model-data";

function base64(view: ArrayBufferView): string {
  return btoa(String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset, view.byteLength)));
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;

function fixtureParts(): ParityModelParts {
  return {
    earth: {
      nodes: [
        { id: "artifact/root", parentId: null, matrix: [...identity] },
        { id: "plate/heaven", parentId: "artifact/root", matrix: [...identity] },
        { id: "branch/earth/午", parentId: "plate/heaven", matrix: [...identity] },
      ],
      meshes: [{
        nodeId: "plate/heaven",
        materialId: "RT_M_JadeBody_outer_board_v10",
        position: {
          componentType: "u16", itemSize: 3, count: 2,
          min: [-1, 2, 4], scale: [0.5, 1, 2],
          data: base64(new Uint16Array([0, 1, 2, 4, 3, 1])),
        },
        normal: {
          componentType: "i16", itemSize: 3, count: 2,
          min: [0, 0, 0], scale: [99, 99, 99],
          data: base64(new Int16Array([0, 32767, -32767, 16384, 0, 32767])),
        },
        texcoord: {
          componentType: "u16", itemSize: 2, count: 2,
          min: [0.25, 0.5], scale: [0.25, 0.125],
          data: base64(new Uint16Array([0, 2, 3, 4])),
        },
        indices: {
          componentType: "u16", itemSize: 3, count: 1,
          min: [0, 0, 0], scale: [1, 1, 1],
          data: base64(new Uint16Array([0, 1, 0])),
        },
      }],
      materials: [{
        id: "RT_M_JadeBody_outer_board_v10",
        baseColor: [1, 1, 1, 1], metalness: 0, roughness: 0.3, alphaMode: "OPAQUE",
      }],
    },
    heaven: { nodes: [], meshes: [], materials: [] },
    generals: {
      nodes: [{ id: "general/noble", parentId: "artifact/root", matrix: [...identity] }],
      meshes: [],
      materials: [{
        id: "M_InkText", baseColor: [0, 0, 0, 1], metalness: 0, roughness: 1, alphaMode: "OPAQUE",
      }],
    },
    core: { nodes: [], meshes: [], materials: [] },
  };
}

describe("parity model data", () => {
  it("restores the packed website geometry without canvas labels", () => {
    const model = decodeParityModel(fixtureParts());

    expect(model.nodes.get("plate/heaven")?.parentId).toBe("artifact/root");
    expect(model.nodes.get("branch/earth/午")?.parentId).toBe("plate/heaven");
    expect(model.nodes.get("general/noble")).toBeDefined();
    expect(model.materials.some((item) => item.kind === "canvas-label")).toBe(false);
    expect([...model.meshes[0].position]).toEqual([-1, 3, 8, 1, 5, 6]);
    expect([...model.meshes[0].normal].slice(0, 3)).toEqual([0, 1, -1]);
    expect(model.meshes[0].normal[3]).toBeCloseTo(16384 / 32767);
    expect([...model.meshes[0].normal].slice(4)).toEqual([0, 1]);
    expect([...model.meshes[0].texcoord!]).toEqual([0.25, 0.75, 1, 1]);
    expect([...model.meshes[0].indices]).toEqual([0, 1, 0]);
  });
});
