import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EarthlyBranch } from "../../../domain/chart/types";
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
  autoRotate = false;
  minPolarAngle = 0;
  maxPolarAngle = Math.PI;
  minAzimuthAngle = -Infinity;
  maxAzimuthAngle = Infinity;
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
  let nowMs = 0;
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
  const generalNodeIds = generals.map(([, id]) => `general/${id}`);
  const generalNodes = generalNodeIds.map((id, index) => {
    const general = node(id);
    general.position.set(index * 10, index * 20, index * 30);
    general.rotation.set(index * 0.01, index * 0.02, index * 0.03);
    general.scale.setScalar(index + 1);
    root.add(general);
    return general;
  });
  const lessonNodes = ["first", "second", "third", "fourth"].map((id, index) => {
    const lesson = node(`lesson/${id}`);
    lesson.position.set(-0.2 + index * 0.04, 0.04, 0.1);
    root.add(lesson);
    return lesson;
  });
  const transmissionNodes = ["initial", "middle", "final"].map((id, index) => {
    const transmission = node(`transmission/${id}`);
    transmission.position.set(-0.08 + index * 0.08, 0.03, -0.18);
    root.add(transmission);
    return transmission;
  });
  const copyAnchors = ["lessons", "transmissions", "generals"].map((id, index) => {
    const anchor = node(`anchor/course-copy/${id}`);
    anchor.position.set(-0.2 + index * 0.2, 0.2, -0.28);
    root.add(anchor);
    return anchor;
  });
  const artifact: LoadedArtifact = {
    root,
    nodes: new Map([
      ["calendar/slip", movingNode],
      ...generalNodeIds.map((id, index) => [id, generalNodes[index]] as const),
      ...lessonNodes.map((lesson, index) => [`lesson/${["first", "second", "third", "fourth"][index]}`, lesson] as const),
      ...transmissionNodes.map((transmission, index) => [`transmission/${["initial", "middle", "final"][index]}`, transmission] as const),
      ...copyAnchors.map((anchor, index) => [`anchor/course-copy/${["lessons", "transmissions", "generals"][index]}`, anchor] as const),
    ]),
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
  const environmentTexture = new THREE.Texture();
  const environmentDispose = vi.fn();
  const callbacks = {
    onUserControlStart: vi.fn(),
    onContextLost: vi.fn(),
    onError: vi.fn(),
  };
  const controller = new ArtifactSceneController(renderer, artifact, callbacks, {
    createControls: () => controls,
    createEnvironment: () => ({ texture: environmentTexture, dispose: environmentDispose }),
    now: () => nowMs,
  });
  return {
    artifact, callbacks, canvas, controller, controls, geometry,
    labelSurface: labelSurfaces.get("dynamic/calendar")!, labelSurfaces,
    environmentDispose, environmentTexture, generalNodes, material, movingNode, renderer,
    setNow: (value: number) => { nowMs = value; },
  };
}

function pose(translationX: number, rotationZ: number): ArtifactPose {
  return {
    nodes: {
      "calendar/slip": {
        translationX,
        translationY: 0,
        translationZ: 0,
        rotationX: 0,
        rotationY: 0,
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

function generalPose(targetEarth: EarthlyBranch): ArtifactPose {
  const value = pose(0, 0);
  return {
    ...value,
    nodes: {
      "general/noble": {
        translationX: 0,
        translationY: 0,
        translationZ: 0.007,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        targetEarth,
      },
    },
  };
}

const displayState = {
  calendar: {
    pillars: ["甲子", "乙丑", "丙寅", "丁卯"],
    monthBuild: "寅",
    monthGeneral: "登明",
    monthGeneralBranch: "亥",
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
    id, label: `${index + 1}课`, upper: "寅", lower: { kind: "branch", value: "卯" }, lookupEarth: "子", general: "贵人",
  })),
  transmissions: ["initial", "middle", "final"].map((position, index) => ({
    position, label: ["初传", "中传", "末传"][index], branch: "辰", relation: "父母", general: "贵人",
  })),
  generals: generals.map(([general], order) => ({ general, order, earth: "子", heaven: "丑", evidenceId: `${order}` })),
} as unknown as ArtifactDisplayState;

describe("ArtifactSceneController", () => {
  it("configures an AgX sRGB museum-lighting scene and resizes without WebGL construction", () => {
    const { controller, controls, environmentTexture, renderer } = fixture();

    controller.resize(800, 400, 2);
    controller.render();

    expect(renderer.toneMapping).toBe(THREE.AgXToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.18);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledWith(800, 400, false);
    const scene = vi.mocked(renderer.render).mock.calls[0][0] as THREE.Scene;
    expect(scene.background).toEqual(new THREE.Color(0xdce5df));
    expect(scene.environment).toBe(environmentTexture);
    expect(scene.environmentIntensity).toBe(1.25);
    expect(controls.minPolarAngle).toBeCloseTo(Math.PI / 9);
    expect(controls.maxPolarAngle).toBeCloseTo(5 * Math.PI / 12);
    expect(controls.minAzimuthAngle).toBe(-Infinity);
    expect(controls.maxAzimuthAngle).toBe(Infinity);
    const lights = scene.children.filter((child) => child instanceof THREE.Light) as THREE.Light[];
    expect(lights.map((light) => light.intensity)).toEqual([1.35, 0.65, 0.75]);
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

  it("applies stage camera presets and cancels only the active tween on drag", () => {
    const { callbacks, controller, controls, renderer, setNow } = fixture();
    const preset = { position: [2, 1.5, 3] as const, target: [0.1, 0.2, 0.3] as const };

    controller.applyCameraPreset(preset);
    setNow(350);
    controller.render();
    const camera = vi.mocked(renderer.render).mock.calls.at(-1)![1] as THREE.PerspectiveCamera;
    expect(camera.position.toArray()).not.toEqual([0.56, 0.44, 0.56]);
    expect(camera.position.toArray()).not.toEqual(preset.position);

    controls.dispatchStart();
    const interruptedPosition = camera.position.toArray();
    setNow(700);
    controller.render();
    expect(camera.position.toArray()).toEqual(interruptedPosition);
    expect(callbacks.onUserControlStart).toHaveBeenCalledOnce();

    controller.applyCameraPreset(preset, true);
    expect(camera.position.toArray()).toEqual(preset.position);
    expect(controls.target.toArray()).toEqual(preset.target);
  });

  it("applies copy opacity and source-line progress to owned scene objects", () => {
    const { controller, renderer } = fixture(allDynamicIds);
    controller.setDisplayState(completeDisplayState);
    const nextPose = pose(0, 0);
    nextPose.copy = {
      lessons: { opacity: 0.65, sourceLineProgress: 0.4, sourceLineOpacity: 0.25 },
      transmissions: { opacity: 0.5, sourceLineProgress: 0.3, sourceLineOpacity: 0.2 },
      generals: { opacity: 0.75, sourceLineProgress: 0.6, sourceLineOpacity: 0.35 },
    };

    const applied = controller.applyPose(nextPose);
    controller.render();

    const scene = vi.mocked(renderer.render).mock.calls.at(-1)![0] as THREE.Scene;
    const copy = scene.getObjectByName("artifact-copy-lessons") as THREE.Mesh;
    const sourceLine = scene.getObjectByName("artifact-source-line-lessons") as THREE.Line;
    expect((copy.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.65);
    expect((sourceLine.material as THREE.LineBasicMaterial).opacity).toBeCloseTo(0.25);
    expect(sourceLine.geometry.getAttribute("position").getX(1)).not.toBe(
      sourceLine.geometry.getAttribute("position").getX(0),
    );
    expect(applied.copy.lessons.opacity).toBeCloseTo(0.65);
    expect(applied.copy.lessons.sourceLineProgress).toBeCloseTo(0.4);
    expect(applied.copy.lessons.sourceLineOpacity).toBeCloseTo(0.25);
  });

  it("applies general ordering, direction, and automatic-camera intent to the scene", () => {
    const { controller, controls, renderer } = fixture();
    const nextPose = pose(0, 0);
    nextPose.generalSequence = ["general/noble", "general/snake", "general/vermilion-bird"];
    nextPose.generalDirection = "reverse";
    nextPose.cameraOrbitRequested = true;
    nextPose.nodes = {
      "general/noble": { translationX: 0, translationY: 0, translationZ: 0.007, rotationX: 0, rotationY: 0, rotationZ: 0 },
      "general/snake": { translationX: 0, translationY: 0, translationZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
      "general/vermilion-bird": { translationX: 0, translationY: 0, translationZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
    };

    const applied = controller.applyPose(nextPose);
    controller.render();

    const scene = vi.mocked(renderer.render).mock.calls.at(-1)![0] as THREE.Scene;
    const direction = scene.getObjectByName("artifact-general-direction") as THREE.Line;
    expect(direction.userData.sequence).toEqual(nextPose.generalSequence);
    expect(direction.userData.direction).toBe("reverse");
    expect(direction.visible).toBe(true);
    expect(controls.autoRotate).toBe(true);
    expect(applied).toMatchObject({
      generalDirection: "reverse",
      generalSequence: nextPose.generalSequence,
      cameraOrbitRequested: true,
    });
  });

  it("hides the general-direction path before deployment begins", () => {
    const { controller, renderer } = fixture();
    const nextPose = pose(0, 0);
    nextPose.generalSequence = ["general/noble", "general/snake"];
    nextPose.nodes = {
      "general/noble": { translationX: 0, translationY: 0, translationZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
      "general/snake": { translationX: 0, translationY: 0, translationZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
    };

    controller.applyPose(nextPose);
    controller.render();

    const scene = vi.mocked(renderer.render).mock.calls.at(-1)![0] as THREE.Scene;
    expect(scene.getObjectByName("artifact-general-direction")).toHaveProperty("visible", false);
  });

  it("selects general destination palaces from frozen slots without pose history", () => {
    const { controller, generalNodes } = fixture();
    const targetSlot = generalNodes[3];
    const targetQuaternion = targetSlot.quaternion.toArray();

    controller.applyPose(generalPose("卯"));
    const firstPosition = generalNodes[0].position.toArray();
    const firstQuaternion = generalNodes[0].quaternion.toArray();
    const firstScale = generalNodes[0].scale.toArray();
    controller.applyPose(generalPose("酉"));
    generalNodes[0].position.set(999, 999, 999);
    controller.applyPose(generalPose("卯"));

    expect(firstPosition).toEqual([30, 60, 0.007]);
    expect(firstQuaternion).toEqual(targetQuaternion);
    expect(firstScale).toEqual([1, 1, 1]);
    expect(generalNodes[0].position.toArray()).toEqual(firstPosition);
    expect(generalNodes[0].quaternion.toArray()).toEqual(firstQuaternion);
    expect(generalNodes[0].scale.toArray()).toEqual(firstScale);
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
    expect(canvasContext.fillText).toHaveBeenCalledWith(
      "月建寅　月将登明亥　占时卯　昼贵丑",
      expect.any(Number),
      expect.any(Number),
    );
    expect(canvasContext.fillText).toHaveBeenCalledWith(
      "贵人　寅/卯　查地盘子",
      expect.any(Number),
      expect.any(Number),
    );
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
    const { callbacks, canvas, controller, controls, environmentDispose, geometry, material, renderer } = fixture();
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");

    controller.setDisplayState(displayState);
    controller.render();
    const scene = vi.mocked(renderer.render).mock.calls.at(-1)![0] as THREE.Scene;
    const copy = scene.getObjectByName("artifact-copy-lessons") as THREE.Mesh;
    const copyGeometryDispose = vi.spyOn(copy.geometry, "dispose");
    const copyMaterialDispose = vi.spyOn(copy.material as THREE.Material, "dispose");
    controller.dispose();
    controller.dispose();
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));

    expect(controls.dispose).toHaveBeenCalledOnce();
    expect(environmentDispose).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(copyGeometryDispose).toHaveBeenCalledOnce();
    expect(copyMaterialDispose).toHaveBeenCalledOnce();
    expect(callbacks.onContextLost).not.toHaveBeenCalled();
  });
});
