import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactDisplayState } from "../model/types";
import type { ArtifactPose } from "../timeline/types";
import type { LoadedArtifact } from "./load-artifact";
import { ArtifactSceneController } from "./ArtifactSceneController";

const canvasContext = {
  clearRect: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(),
  textAlign: "center", textBaseline: "middle", fillStyle: "", strokeStyle: "", font: "", lineWidth: 1,
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
});

afterEach(() => vi.restoreAllMocks());

class TestControls {
  readonly target = new THREE.Vector3();
  readonly update = vi.fn();
  readonly dispose = vi.fn();
  private readonly listeners = new Set<() => void>();

  addEventListener(_type: "start", listener: () => void) { this.listeners.add(listener); }
  removeEventListener(_type: "start", listener: () => void) { this.listeners.delete(listener); }
  dispatchStart() { this.listeners.forEach((listener) => listener()); }
}

function node(id: string) {
  const object = new THREE.Group();
  object.userData.node_id = id;
  return object;
}

function fixture(dynamicIds: readonly string[] = ["dynamic/calendar"]) {
  const canvas = document.createElement("canvas");
  const root = new THREE.Group();
  const movingNode = node("calendar/slip");
  movingNode.position.set(1, 2, 3);
  movingNode.rotation.set(0.1, 0.2, 0.3);
  movingNode.scale.set(2, 3, 4);
  root.add(movingNode);
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  const labelSurfaces = new Map<string, THREE.Mesh>();
  for (const dynamicId of dynamicIds) {
    const labelSurface = new THREE.Mesh(geometry, material);
    labelSurface.userData.dynamic_label_id = dynamicId;
    movingNode.add(labelSurface);
    labelSurfaces.set(dynamicId, labelSurface);
  }
  const artifact: LoadedArtifact = {
    root,
    nodes: new Map([["calendar/slip", movingNode]]),
    animations: [],
    url: "/artifact.glb",
  };
  const renderer = {
    domElement: canvas,
    capabilities: { getMaxAnisotropy: vi.fn(() => 12) },
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.LinearSRGBColorSpace,
  } as unknown as THREE.WebGLRenderer;
  const controls = new TestControls();
  const callbacks = {
    onUserControlStart: vi.fn(),
    onContextLost: vi.fn(),
    onError: vi.fn(),
  };
  const controller = new ArtifactSceneController(renderer, artifact, callbacks, {
    createControls: () => controls,
  });
  return {
    artifact, callbacks, canvas, controller, controls, geometry,
    labelSurface: labelSurfaces.get("dynamic/calendar")!, labelSurfaces,
    material, movingNode, renderer,
  };
}

function pose(translationX: number, rotationZ: number): ArtifactPose {
  return {
    nodes: {
      "calendar/slip": {
        translationX,
        translationY: 0,
        translationZ: 0,
        rotationZ,
      },
    },
    copy: {
      lessons: { opacity: 0, sourceLineProgress: 0, sourceLineOpacity: 0 },
      transmissions: { opacity: 0, sourceLineProgress: 0, sourceLineOpacity: 0 },
      generals: { opacity: 0, sourceLineProgress: 0, sourceLineOpacity: 0 },
    },
    generalDirection: "forward",
    generalSequence: [],
    cameraOrbitRequested: false,
  };
}

const displayState = {
  calendar: {
    pillars: ["甲子", "乙丑", "丙寅", "丁卯"],
    monthBuild: "寅",
    monthGeneral: "登明",
    divinationHour: "卯",
    manualFields: ["monthGeneral"],
  },
  plate: { offset: 0, palaces: [] },
  lessons: [],
  transmissions: [],
  methodLabel: "涉害法",
  generals: [],
  noble: { dayNight: "day", nobleHeaven: "丑", nobleEarth: "子", direction: "reverse" },
} as unknown as ArtifactDisplayState;

const generals = [
  ["贵人", "noble"], ["螣蛇", "snake"], ["朱雀", "vermilion-bird"], ["六合", "harmony"],
  ["勾陈", "hook-array"], ["青龙", "azure-dragon"], ["天空", "void"], ["白虎", "white-tiger"],
  ["太常", "constant"], ["玄武", "black-tortoise"], ["太阴", "yin"], ["天后", "queen-of-heaven"],
] as const;
const allDynamicIds = [
  "dynamic/calendar",
  ...["first", "second", "third", "fourth"].map((id) => `dynamic/lesson/${id}`),
  ...["initial", "middle", "final"].map((id) => `dynamic/transmission/${id}`),
  "dynamic/transmission/method",
  ...generals.map(([, id]) => `dynamic/general/${id}`),
];
const completeDisplayState = {
  ...displayState,
  lessons: ["first", "second", "third", "fourth"].map((id, index) => ({
    id, label: `${index + 1}课`, upper: "寅", lower: { kind: "branch", value: "卯" }, general: "贵人",
  })),
  transmissions: ["initial", "middle", "final"].map((position, index) => ({
    position, label: ["初传", "中传", "末传"][index], branch: "辰", relation: "父母", general: "贵人",
  })),
  generals: generals.map(([general], order) => ({ general, order, earth: "子", heaven: "丑", evidenceId: `${order}` })),
} as unknown as ArtifactDisplayState;

describe("ArtifactSceneController", () => {
  it("configures an AgX sRGB museum-lighting scene and resizes without WebGL construction", () => {
    const { controller, renderer } = fixture();

    controller.resize(800, 400, 2);
    controller.render();

    expect(renderer.toneMapping).toBe(THREE.AgXToneMapping);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledWith(800, 400, false);
    const scene = vi.mocked(renderer.render).mock.calls[0][0] as THREE.Scene;
    const lights = scene.children.filter((child) => child instanceof THREE.Light) as THREE.Light[];
    expect(lights.map((light) => light.intensity)).toEqual([1, 0.3, 0.18]);
  });

  it("applies every pose against frozen loaded transforms", () => {
    const { controller, movingNode } = fixture();
    const baseQuaternion = movingNode.quaternion.clone();

    controller.applyPose(pose(0.5, 0.4));
    const firstPosition = movingNode.position.toArray();
    const firstQuaternion = movingNode.quaternion.toArray();
    controller.applyPose(pose(-4, -2));
    movingNode.scale.set(99, 99, 99);
    controller.applyPose(pose(0.5, 0.4));

    expect(movingNode.position.toArray()).toEqual(firstPosition);
    expect(movingNode.quaternion.toArray()).toEqual(firstQuaternion);
    expect(movingNode.scale.toArray()).toEqual([2, 3, 4]);
    expect(baseQuaternion.equals(movingNode.quaternion)).toBe(false);
  });

  it("binds state-derived canvas labels and releases replaced textures", () => {
    const { controller, labelSurface } = fixture();
    controller.setDisplayState(displayState);
    const firstMaterial = labelSurface.material as unknown as THREE.MeshBasicMaterial;
    const firstTexture = firstMaterial.map!;
    const dispose = vi.spyOn(firstTexture, "dispose");

    controller.setDisplayState({
      ...displayState,
      calendar: { ...displayState.calendar, pillars: ["戊辰", "己巳", "庚午", "辛未"] },
    });

    expect((labelSurface.material as unknown as THREE.MeshBasicMaterial).map).not.toBe(firstTexture);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("binds calendar, lesson, transmission, method, and general surfaces with state markers", () => {
    const { controller, labelSurfaces } = fixture(allDynamicIds);

    controller.setDisplayState(completeDisplayState);

    for (const surface of labelSurfaces.values()) {
      const texture = (surface.material as unknown as THREE.MeshBasicMaterial).map;
      expect(texture?.anisotropy).toBe(12);
    }
    expect(canvasContext.fillText).toHaveBeenCalledWith("✎", expect.any(Number), expect.any(Number));
    expect(canvasContext.fillText).toHaveBeenCalledWith("◆", expect.any(Number), expect.any(Number));
    expect(canvasContext.fillText).toHaveBeenCalledWith("↺", expect.any(Number), expect.any(Number));
  });

  it("focuses a runtime node and restores the initial camera target", () => {
    const { controller, controls } = fixture();

    controller.focusNode("calendar/slip");
    expect(controls.target.toArray()).toEqual([1, 2, 3]);
    controller.resetCamera();
    expect(controls.target.toArray()).toEqual([0, 0, 0]);
  });

  it("invokes user-control start synchronously", () => {
    const { callbacks, controls } = fixture();

    controls.dispatchStart();

    expect(callbacks.onUserControlStart).toHaveBeenCalledOnce();
  });

  it("prevents context loss defaults, stops rendering, and reports the loss", () => {
    const { callbacks, canvas, controller, renderer } = fixture();
    const event = new Event("webglcontextlost", { cancelable: true, bubbles: true });
    const stopPropagation = vi.spyOn(event, "stopPropagation");

    canvas.dispatchEvent(event);
    controller.render();

    expect(event.defaultPrevented).toBe(true);
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(callbacks.onContextLost).toHaveBeenCalledOnce();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("reports render errors once rendering fails", () => {
    const { callbacks, controller, renderer } = fixture();
    const cause = new Error("render failed");
    vi.mocked(renderer.render).mockImplementation(() => { throw cause; });

    controller.render();
    controller.render();

    expect(callbacks.onError).toHaveBeenCalledOnce();
    expect(callbacks.onError).toHaveBeenCalledWith(cause);
  });

  it("removes listeners and disposes every owned resource exactly once", () => {
    const { callbacks, canvas, controller, controls, geometry, material, renderer } = fixture();
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");

    controller.setDisplayState(displayState);
    controller.dispose();
    controller.dispose();
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));

    expect(controls.dispose).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(callbacks.onContextLost).not.toHaveBeenCalled();
  });
});
