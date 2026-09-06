import * as THREE from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import { referenceSession } from "../../test/reference-session";
import type { ParityModelParts } from "./model-data";

let renderedScene: THREE.Scene | undefined;
let renderedCamera: THREE.Camera | undefined;
let testRenderer: {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  outputColorSpace: string;
} | undefined;
let textureLoaded = new Map<string, () => void>();
let textureFailed = new Map<string, () => void>();
let textureObjects = new Map<string, THREE.Texture>();
let renderedDrawCalls = 0;
const rendererDispose = vi.fn();
const source = {
  calendar: referenceSession.snapshots.calendar!.value,
  plate: referenceSession.snapshots["heaven-earth"]!.value,
  lessons: referenceSession.snapshots["four-lessons"]!.value,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value,
  generals: referenceSession.snapshots["heavenly-generals"]!.value,
  course: referenceSession.snapshots.course!.value,
} as ArtifactSourceResults;

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class TestRenderer {
    capabilities = { getMaxAnisotropy: () => 8 };
    toneMapping = actual.NoToneMapping;
    toneMappingExposure = 1;
    outputColorSpace = "";
    info = { render: { calls: renderedDrawCalls } };
    domElement: HTMLCanvasElement;
    constructor(options: { canvas: HTMLCanvasElement }) {
      this.domElement = options.canvas;
      testRenderer = this;
    }
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    render(scene: THREE.Scene, camera: THREE.Camera) {
      renderedScene = scene;
      renderedCamera = camera;
    }
    dispose() { rendererDispose(); }
  }
  class TestTextureLoader {
    load(url: string, onLoad: (texture: THREE.Texture) => void, _progress: unknown, onError: () => void) {
      const texture = new actual.Texture();
      textureObjects.set(url, texture);
      textureLoaded.set(url, () => onLoad(texture));
      textureFailed.set(url, onError);
      return texture;
    }
  }
  return { ...actual, WebGLRenderer: TestRenderer, TextureLoader: TestTextureLoader };
});

import { mountParityArtifact } from "./create-parity-artifact";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const translate = (x: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1];
const encode = (view: ArrayBufferView) => btoa(String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset, view.byteLength)));
const generalNodeIds = [
  "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
  "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger",
  "general/constant", "general/black-tortoise", "general/yin", "general/queen-of-heaven",
];

function packedMesh(nodeId: string, materialId: string, height = 0) {
  return {
    nodeId,
    materialId,
    position: {
      componentType: "u16" as const, itemSize: 3, count: 3,
      min: [0, height, 0], scale: [1 / 65535, 0.02 / 65535, 1 / 65535],
      data: encode(new Uint16Array([0, 0, 0, 65535, 65535, 0, 0, 0, 65535])),
    },
    normal: {
      componentType: "i16" as const, itemSize: 3, count: 3,
      min: [0, 0, 0], scale: [1 / 32767, 1 / 32767, 1 / 32767],
      data: encode(new Int16Array([0, 32767, 0, 0, 32767, 0, 0, 32767, 0])),
    },
    texcoord: {
      componentType: "u16" as const, itemSize: 2, count: 3,
      min: [0, 0], scale: [1 / 65535, 1 / 65535],
      data: encode(new Uint16Array([0, 0, 65535, 0, 0, 65535])),
    },
    indices: {
      componentType: "u16" as const, itemSize: 3, count: 1,
      min: [0, 0, 0], scale: [1, 1, 1],
      data: encode(new Uint16Array([0, 1, 2])),
    },
  };
}

function parts(): ParityModelParts {
  return {
    earth: {
      nodes: [
        { id: "artifact/root", parentId: null, matrix: identity },
        { id: "plate/earth", parentId: "artifact/root", matrix: translate(2) },
      ],
      materials: [{
        id: "RT_M_JadeBody_outer_board_v10",
        baseColor: [1, 1, 1, 1], metalness: 0, roughness: 0.3, alphaMode: "OPAQUE",
      }],
      meshes: [packedMesh("plate/earth", "RT_M_JadeBody_outer_board_v10")],
    },
    heaven: {
      nodes: [{ id: "plate/heaven", parentId: "plate/earth", matrix: translate(5) }],
      materials: [
        { id: "RT_lod2_M_JadeBody_moving", baseColor: [1, 1, 1, 1], metalness: 0, roughness: 0.3, alphaMode: "OPAQUE" },
        { id: "M_InkText", baseColor: [0, 0, 0, 1], metalness: 0, roughness: 0.7, alphaMode: "OPAQUE" },
      ],
      meshes: [
        packedMesh("plate/heaven", "RT_lod2_M_JadeBody_moving"),
        packedMesh("plate/heaven", "M_InkText", 0.003),
      ],
    },
    generals: {
      nodes: [
        { id: "plate/generals", parentId: "artifact/root", matrix: identity },
        ...generalNodeIds.map((id) => ({ id, parentId: "plate/generals", matrix: identity })),
      ],
      materials: [
        { id: "M_TranslucentJade", baseColor: [1, 1, 1, 1], metalness: 0, roughness: 0.2, alphaMode: "OPAQUE" },
        { id: "M_InkText", baseColor: [0, 0, 0, 1], metalness: 0, roughness: 0.7, alphaMode: "OPAQUE" },
        { id: "RT_lod2_M_JadeBody_hero", baseColor: [1, 1, 1, 1], metalness: 0, roughness: 0.3, alphaMode: "OPAQUE" },
        { id: "RT_lod2_M_JadeRecess_hero", baseColor: [0.5, 0.5, 0.5, 1], metalness: 0, roughness: 0.6, alphaMode: "OPAQUE" },
        { id: "RT_lod2_M_OldGold_hero", baseColor: [0.7, 0.5, 0.2, 1], metalness: 0.6, roughness: 0.4, alphaMode: "OPAQUE" },
      ],
      meshes: [
        ...generalNodeIds.flatMap((id) => [
          packedMesh(id, "M_TranslucentJade"),
          packedMesh(id, "M_InkText", 0.002),
        ]),
        packedMesh("plate/generals", "RT_lod2_M_JadeBody_hero"),
        packedMesh("plate/generals", "RT_lod2_M_JadeRecess_hero"),
        packedMesh("plate/generals", "RT_lod2_M_OldGold_hero"),
      ],
    },
    core: { nodes: [{ id: "plate/core", parentId: "artifact/root", matrix: identity }], meshes: [], materials: [] },
  };
}

beforeEach(() => {
  renderedScene = undefined;
  renderedCamera = undefined;
  testRenderer = undefined;
  textureLoaded = new Map();
  textureFailed = new Map();
  textureObjects = new Map();
  renderedDrawCalls = 0;
  rendererDispose.mockClear();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 7));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  window.__DALIUREN_MODEL_PARTS__ = parts();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.__DALIUREN_MODEL_PARTS__;
});

describe("parity artifact", () => {
  it("renders the real heaven and general top meshes with depth", () => {
    const canvas = document.createElement("canvas");
    const mounted = mountParityArtifact(canvas, source, "./assets/earth-board.jpg", vi.fn());
    const heaven = renderedScene!.getObjectByName("plate/heaven")!;
    const noble = renderedScene!.getObjectByName("general/noble")!;
    const generalPlate = renderedScene!.getObjectByName("plate/generals")!;
    const heavenMeshes = heaven.children.filter((child) => child instanceof THREE.Mesh) as THREE.Mesh[];
    const nobleMeshes = noble.children.filter((child) => child instanceof THREE.Mesh) as THREE.Mesh[];

    expect(heavenMeshes).toHaveLength(2);
    expect(nobleMeshes).toHaveLength(2);
    expect(generalPlate.children.filter((child) => child instanceof THREE.Mesh).map(
      (mesh) => mesh.userData.material_id,
    )).toEqual(["RT_lod2_M_JadeBody_hero"]);
    expect([...heavenMeshes, ...nobleMeshes].every((mesh) => mesh.geometry.index!.count === 3)).toBe(true);
    expect([...heavenMeshes, ...nobleMeshes].every((mesh) => {
      const material = mesh.material as THREE.Material;
      return material.depthTest && material.depthWrite;
    })).toBe(true);
    expect(noble.children.some((child) => child.userData.referenceSurface)).toBe(false);
    expect(canvas.dataset.solidMeshCount).toBe("28");
    expect(canvas.dataset.generalMeshCount).toBe("24");
    expect(Number(canvas.dataset.heavenThickness)).toBeGreaterThan(0.01);
    expect(Number(canvas.dataset.generalThickness)).toBeGreaterThan(0.01);
    mounted.dispose();
  });

  it("rotates one fixed heaven geometry without projection morphing", () => {
    const canvas = document.createElement("canvas") as HTMLCanvasElement & {
      __setHeavenRotation?: (rotationDelta: number) => void;
    };
    const mounted = mountParityArtifact(canvas, source, "./assets/earth-board.jpg", vi.fn());
    const heaven = renderedScene!.getObjectByName("plate/heaven")!;
    const meshes = heaven.children.filter((child) => child instanceof THREE.Mesh) as THREE.Mesh[];
    const positions = meshes.map((mesh) => Array.from(mesh.geometry.getAttribute("position").array));

    canvas.__setHeavenRotation!(Math.PI / 2);

    expect(canvas.dataset.heavenSurfaceProjection).toBe("rigid");
    expect(meshes.map((mesh) => Array.from(mesh.geometry.getAttribute("position").array))).toEqual(positions);
    expect(meshes.every((mesh) => !mesh.morphTargetInfluences?.some((value) => value !== 0))).toBe(true);
    mounted.dispose();
  });

  it("uses the website lighting and oblique solid-model framing", () => {
    const mounted = mountParityArtifact(
      document.createElement("canvas"),
      source,
      "./assets/earth-board.jpg",
      vi.fn(),
    );

    expect(testRenderer).toMatchObject({
      toneMapping: THREE.AgXToneMapping,
      toneMappingExposure: 1.12,
      outputColorSpace: THREE.SRGBColorSpace,
    });
    expect(renderedScene!.background).toEqual(new THREE.Color(0xd8d2c8));
    const lights = renderedScene!.children.filter((child) => child instanceof THREE.Light) as THREE.Light[];
    expect(lights.map((light) => light.intensity)).toEqual([1.65, 1.05, 0.65, 0.7]);
    const camera = renderedCamera as THREE.PerspectiveCamera;
    const target = new THREE.Box3().setFromObject(renderedScene!.getObjectByName("artifact/root")!)
      .getCenter(new THREE.Vector3());
    const elevation = THREE.MathUtils.radToDeg(Math.asin(camera.position.clone().sub(target).normalize().y));
    expect(elevation).toBeGreaterThan(61);
    expect(elevation).toBeLessThan(63);
    expect(renderedCamera!.position.x).toBeGreaterThan(target.x);
    expect(renderedCamera!.position.y).toBeGreaterThan(0);
    expect(renderedCamera!.position.z).toBeGreaterThan(target.z);
    expect(renderedCamera!.up).toEqual(new THREE.Vector3(0, 1, 0));
    expect((renderedCamera as THREE.PerspectiveCamera).fov).toBeCloseTo(20.4268144654051);
    mounted.dispose();
  });

  it("keeps the whole artifact inside the far plane at maximum portrait zoom-out", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperties(canvas, {
      clientWidth: { value: 390 },
      clientHeight: { value: 844 },
    });
    const mounted = mountParityArtifact(canvas, source, "./assets/earth-board.jpg", vi.fn());
    const camera = renderedCamera as THREE.PerspectiveCamera;
    const root = renderedScene!.getObjectByName("artifact/root")!;
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3()).setY(bounds.max.y);
    const initialDistance = camera.position.distanceTo(center);
    const wheel = new Event("wheel", { bubbles: true, cancelable: true });
    Object.defineProperty(wheel, "deltaY", { value: 100000 });

    canvas.dispatchEvent(wheel);
    camera.updateMatrixWorld(true);

    try {
      expect(camera.position.distanceTo(center)).toBeGreaterThan(initialDistance * 2.4);
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            const corner = new THREE.Vector3(x, y, z);
            const depth = -corner.clone().applyMatrix4(camera.matrixWorldInverse).z;
            const projected = corner.clone().project(camera);
            expect(depth).toBeGreaterThan(camera.near);
            expect(depth).toBeLessThan(camera.far);
            expect(projected.z).toBeGreaterThanOrEqual(-1);
            expect(projected.z).toBeLessThanOrEqual(1);
          }
        }
      }
    } finally {
      mounted.dispose();
    }
  });

  it("rejects malformed state instead of silently skipping parity application", () => {
    expect(() => mountParityArtifact(
      document.createElement("canvas"),
      {} as ArtifactSourceResults,
      "./assets/earth-board.jpg",
      vi.fn(),
    )).toThrow();
  });

  it("loads every classic model part before the application bundle", () => {
    const html = readFileSync(resolve("src/minitool/index.html"), "utf8");
    const page = new DOMParser().parseFromString(html, "text/html");

    expect([...page.querySelectorAll("script")].map((script) => script.getAttribute("src"))).toEqual([
      "./assets/model-earth.js",
      "./assets/model-heaven.js",
      "./assets/model-generals.js",
      "./assets/model-core.js",
      "./assets/app.js",
    ]);
  });

  it("preserves solid meshes and publishes ready after the board texture loads", () => {
    const canvas = document.createElement("canvas");
    const onReady = vi.fn();
    const mounted = mountParityArtifact(canvas, source, "./assets/earth-board.jpg", vi.fn(), onReady);
    const heaven = renderedScene!.getObjectByName("plate/heaven")!;
    const earth = renderedScene!.getObjectByName("plate/earth")!;
    const board = earth.children.find((child) => child.userData.material_id === "RT_M_JadeBody_outer_board_v10") as THREE.Mesh;

    renderedScene!.updateMatrixWorld(true);
    expect(heaven.position.x).toBe(3);
    expect(heaven.getWorldPosition(new THREE.Vector3()).x).toBe(5);
    expect(board.visible).toBe(false);
    expect(board.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((board.material as THREE.MeshStandardMaterial).map?.flipY).toBe(false);
    expect((board.geometry as THREE.BufferGeometry).getAttribute("uv").count).toBe(3);
    expect(onReady).not.toHaveBeenCalled();

    textureLoaded.get("./assets/earth-board.jpg")!();
    expect(board.visible).toBe(true);
    expect(onReady).toHaveBeenCalledOnce();

    mounted.dispose();
    expect(rendererDispose).toHaveBeenCalledOnce();
  });

  it("reports texture and WebGL context failures without leaving listeners after disposal", () => {
    const canvas = document.createElement("canvas");
    const onUnavailable = vi.fn();
    const onReady = vi.fn();
    const mounted = mountParityArtifact(canvas, source, "./assets/earth-board.jpg", onUnavailable, onReady);

    textureFailed.get("./assets/earth-board.jpg")!();
    expect(onUnavailable).toHaveBeenCalledOnce();
    textureLoaded.get("./assets/earth-board.jpg")!();
    expect(onReady).not.toHaveBeenCalled();
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(onUnavailable).toHaveBeenCalledOnce();

    mounted.dispose();
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it("keeps context loss terminal when texture callbacks arrive later", () => {
    const canvas = document.createElement("canvas");
    const onUnavailable = vi.fn();
    const onReady = vi.fn();
    const mounted = mountParityArtifact(canvas, source, "./assets/earth-board.jpg", onUnavailable, onReady);
    const board = renderedScene!.getObjectByName("plate/earth")!.children.find(
      (child) => child.userData.material_id === "RT_M_JadeBody_outer_board_v10",
    ) as THREE.Mesh;

    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    textureLoaded.get("./assets/earth-board.jpg")!();
    document.dispatchEvent(new Event("visibilitychange"));

    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(onReady).not.toHaveBeenCalled();
    expect(board.visible).toBe(false);
    mounted.dispose();
  });

  it("falls back when a real rendered frame exceeds the draw-call budget", () => {
    const canvas = document.createElement("canvas");
    const onUnavailable = vi.fn();
    renderedDrawCalls = 61;
    const mounted = mountParityArtifact(canvas, source, "./assets/earth-board.jpg", onUnavailable);

    expect(canvas.dataset.renderDrawCalls).toBe("61");
    expect(onUnavailable).toHaveBeenCalledOnce();
    mounted.dispose();
  });

  it("does not report a late texture success after disposal", () => {
    const onReady = vi.fn();
    const mounted = mountParityArtifact(
      document.createElement("canvas"),
      source,
      "./assets/earth-board.jpg",
      vi.fn(),
      onReady,
    );
    const onLoad = textureLoaded.get("./assets/earth-board.jpg")!;
    mounted.dispose();

    onLoad();
    expect(onReady).not.toHaveBeenCalled();
  });
});
