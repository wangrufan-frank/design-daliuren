import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EARTHLY_BRANCHES } from "../../../domain/calendar/constants";
import type { EarthlyBranch } from "../../../domain/chart/types";
import type { ArtifactDisplayState } from "../model/types";
import type { ArtifactPose } from "../timeline/types";
import { reviewStageFor } from "../timeline/review-stages";
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

function fixture(
  dynamicIds: readonly string[] = ["dynamic/calendar"],
  options: { invalidBranchMaterialId?: string } = {},
) {
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
  const branchGeometry = new THREE.BoxGeometry(0.012, 0.012, 0.04);
  const earthBranchMaterial = new THREE.MeshStandardMaterial({ color: 0x80704c });
  const heavenBranchMaterial = new THREE.MeshStandardMaterial({ color: 0xc2c6bb });
  const branchNodes = new Map<string, THREE.Mesh>();
  for (const [surfaceIndex, surface] of (["earth", "heaven"] as const).entries()) {
    EARTHLY_BRANCHES.forEach((branch, index) => {
      const id = `branch/${surface}/${branch}`;
      const branchNode = new THREE.Mesh(
        branchGeometry,
        options.invalidBranchMaterialId === id
          ? new THREE.MeshBasicMaterial()
          : surface === "earth" ? earthBranchMaterial : heavenBranchMaterial,
      );
      branchNode.userData.node_id = id;
      branchNode.position.set((index - 5.5) * 0.018, (surfaceIndex - 0.5) * 0.08, 0);
      root.add(branchNode);
      branchNodes.set(id, branchNode);
    });
  }
  const traceGeometry = new THREE.BoxGeometry(0.16, 0.004, 0.002);
  const traceMaterial = new THREE.MeshStandardMaterial({ color: 0x879b92 });
  const trace = new THREE.Mesh(traceGeometry, traceMaterial);
  trace.userData.node_id = "trace/course";
  root.add(trace);
  const artifact: LoadedArtifact = {
    root,
    nodes: new Map<string, THREE.Object3D>([
      ["calendar/slip", movingNode],
      ...generalNodeIds.map((id, index) => [id, generalNodes[index]] as const),
      ...lessonNodes.map((lesson, index) => [`lesson/${["first", "second", "third", "fourth"][index]}`, lesson] as const),
      ...transmissionNodes.map((transmission, index) => [`transmission/${["initial", "middle", "final"][index]}`, transmission] as const),
      ...branchNodes,
      ["trace/course", trace] as const,
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
    onAnnotationError: vi.fn(),
  };
  const controller = new ArtifactSceneController(renderer, artifact, callbacks, {
    createControls: () => controls,
    createEnvironment: () => ({ texture: environmentTexture, dispose: environmentDispose }),
    now: () => nowMs,
  });
  return {
    artifact, callbacks, canvas, controller, controls, geometry,
    branchGeometry, branchNodes, earthBranchMaterial, heavenBranchMaterial,
    labelSurface: labelSurfaces.get("dynamic/calendar")!, labelSurfaces,
    environmentDispose, environmentTexture, generalNodes, material, movingNode, renderer,
    trace, traceGeometry, traceMaterial,
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
    labelOpacity: {},
    courseTraceOpacity: 0,
    generalDirection: "forward",
    generalSequence: [],
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
    voidBranches: ["寅", "卯"],
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
  generals: generals.map(([general], order) => ({
    general,
    order,
    earth: order === 0 ? "卯" : "子",
    heaven: order === 0 ? "寅" : "丑",
    evidenceId: `${order}`,
  })),
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
    expect(scene.background).toEqual(new THREE.Color(0xe4e6df));
    expect(scene.environment).toBe(environmentTexture);
    expect(scene.environmentIntensity).toBe(1.05);
    expect(controls.minPolarAngle).toBeCloseTo(Math.PI / 9);
    expect(controls.maxPolarAngle).toBeCloseTo(5 * Math.PI / 12);
    expect(controls.minAzimuthAngle).toBe(-Infinity);
    expect(controls.maxAzimuthAngle).toBe(Infinity);
    const lights = scene.children.filter((child) => child instanceof THREE.Light) as THREE.Light[];
    expect(lights).toHaveLength(4);
    expect(lights.map((light) => light.intensity)).toEqual([1.75, 1.28, 0.82, 0.42]);
    expect(lights[0].color).toEqual(new THREE.Color(0xf2eee4));
    expect(lights[1]).toBeInstanceOf(THREE.HemisphereLight);
    expect(lights[2]).toBeInstanceOf(THREE.DirectionalLight);
    const camera = vi.mocked(renderer.render).mock.calls[0][1] as THREE.PerspectiveCamera;
    expect(camera).toMatchObject({ fov: 34, near: 0.05, far: 4 });
    expect(controls.autoRotate).toBe(false);
  });

  it("owns one cloned standard material per branch and resets plate-aware void colors", () => {
    const {
      artifact, branchNodes, controller, earthBranchMaterial, heavenBranchMaterial,
    } = fixture();
    const ownedMaterials = [...branchNodes.values()].map((mesh) => mesh.material);

    expect(new Set(ownedMaterials).size).toBe(24);
    expect(ownedMaterials).not.toContain(earthBranchMaterial);
    expect(ownedMaterials).not.toContain(heavenBranchMaterial);
    controller.setDisplayState({
      ...completeDisplayState,
      calendar: { ...completeDisplayState.calendar, voidBranches: ["子", "丑"] },
    });

    expect(((artifact.nodes.get("branch/earth/子") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe("8a563b");
    expect(((artifact.nodes.get("branch/heaven/子") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe("477b9d");
    expect(((artifact.nodes.get("branch/earth/寅") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe("80704c");
    expect(earthBranchMaterial.color.getHexString()).toBe("80704c");
    expect(heavenBranchMaterial.color.getHexString()).toBe("c2c6bb");

    controller.setDisplayState({
      ...completeDisplayState,
      calendar: { ...completeDisplayState.calendar, voidBranches: ["辰", "巳"] },
    });
    expect((artifact.nodes.get("branch/earth/子") as THREE.Mesh).material).toBe(ownedMaterials[0]);
    expect(((artifact.nodes.get("branch/earth/子") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe("80704c");
  });

  it("rejects a branch inlay that is not backed by a standard material", () => {
    expect(() => fixture(["dynamic/calendar"], { invalidBranchMaterialId: "branch/heaven/亥" }))
      .toThrow("Invalid branch inlay branch/heaven/亥");
  });

  it("measures branch height along world Z deterministically after resize and an immediate preset", () => {
    const { controller } = fixture();
    controller.resize(800, 600, 1);
    controller.applyCameraPreset({ position: [0, -1, 0.2], target: [0, 0, 0] }, true);

    const first = controller.measureMinimumBranchProjectionPx();
    expect(first).toBeGreaterThan(18);
    expect(controller.measureMinimumBranchProjectionPx()).toBe(first);

    controller.resize(800, 300, 1);
    expect(controller.measureMinimumBranchProjectionPx()).toBeCloseTo(first / 2);
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
    const preset = reviewStageFor("four-lessons").camera;

    controller.applyCameraPreset(preset);
    setNow(350);
    controller.render();
    const camera = vi.mocked(renderer.render).mock.calls.at(-1)![1] as THREE.PerspectiveCamera;
    expect(camera.position.toArray()).not.toEqual([0.56, 0.44, 0.56]);
    expect(camera.position.toArray()).not.toEqual(preset.position);
    expect(camera.position.distanceTo(controls.target)).toBeGreaterThanOrEqual(1.04);
    expect(camera.position.distanceTo(controls.target)).toBeLessThanOrEqual(1.18);

    controls.dispatchStart();
    const interruptedPosition = camera.position.toArray();
    setNow(700);
    controller.render();
    expect(camera.position.toArray()).toEqual(interruptedPosition);
    expect(callbacks.onUserControlStart).toHaveBeenCalledOnce();

    controller.applyCameraPreset(preset, true);
    expect(camera.position.toArray()).toEqual(preset.position);
    expect(controls.target.toArray()).toEqual(preset.target);
    expect(camera.position.distanceTo(controls.target)).toBeGreaterThanOrEqual(1.04);
    expect(camera.position.distanceTo(controls.target)).toBeLessThanOrEqual(1.18);
  });

  it("captures current annotation coordinates after camera and node movement", () => {
    const { controller, movingNode } = fixture();
    movingNode.position.set(0, 0, 0);
    controller.resize(800, 600, 1);
    controller.applyCameraPreset({ position: [0, 0, 1], target: [0, 0, 0] }, true);

    const initial = controller.captureAnnotationFrame(["calendar/slip"]);
    controller.applyCameraPreset({ position: [0.2, 0, 1], target: [0, 0, 0] }, true);
    const afterCamera = controller.captureAnnotationFrame(["calendar/slip"]);
    controller.applyPose(pose(0.15, 0));
    const afterPose = controller.captureAnnotationFrame(["calendar/slip"]);

    expect(initial.viewport).toEqual({ width: 800, height: 600 });
    expect(initial.anchors[0]).toMatchObject({ id: "calendar/slip", x: 400, y: 300, behindCamera: false });
    expect(afterCamera.anchors[0].x).not.toBe(initial.anchors[0].x);
    expect(afterPose.anchors[0].x).not.toBe(afterCamera.anchors[0].x);
  });

  it("marks an annotation occluded only when a separate mesh is nearer than its anchor", () => {
    const { artifact, controller, movingNode } = fixture();
    movingNode.position.set(0, 0, 0);
    controller.resize(800, 600, 1);
    controller.applyCameraPreset({ position: [0, 0, 1], target: [0, 0, 0] }, true);
    expect(controller.captureAnnotationFrame(["calendar/slip"]).anchors[0].occluded).toBe(false);

    const occluder = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.08),
      new THREE.MeshBasicMaterial(),
    );
    occluder.position.set(0, 0, 0.5);
    artifact.root.add(occluder);

    expect(controller.captureAnnotationFrame(["calendar/slip"]).anchors[0].occluded).toBe(true);
  });

  it("ignores an intersection less than 0.002 world units nearer than the anchor", () => {
    const { artifact, controller, movingNode } = fixture();
    movingNode.position.set(0, 0, 0);
    controller.resize(800, 600, 1);
    controller.applyCameraPreset({ position: [0, 0, 1], target: [0, 0, 0] }, true);
    const nearCoplanar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    nearCoplanar.position.set(0, 0, 0.001);
    artifact.root.add(nearCoplanar);

    expect(controller.captureAnnotationFrame(["calendar/slip"]).anchors[0].occluded).toBe(false);

    nearCoplanar.position.z = 0.01;
    expect(controller.captureAnnotationFrame(["calendar/slip"]).anchors[0].occluded).toBe(true);
  });

  it("reports a missing annotation node without stopping the render loop", () => {
    const { callbacks, controller, renderer } = fixture();

    expect(() => controller.captureAnnotationFrame(["plate/heaven"])).not.toThrow();
    controller.render();

    expect(callbacks.onAnnotationError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Artifact annotation "plate/heaven" requires missing node "plate/heaven"',
    }));
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledOnce();
  });

  it("applies physical visibility, dynamic-label opacity, and the owned course trace", () => {
    const { controller, controls, labelSurface, movingNode, renderer, trace, traceMaterial } = fixture(allDynamicIds);
    const nextPose = pose(0, 0);
    nextPose.nodes = {
      "calendar/slip": {
        translationX: 0, translationY: 0, translationZ: 0,
        rotationX: 0, rotationY: 0, rotationZ: 0,
        visible: false,
      },
    };
    nextPose.labelOpacity = { "dynamic/calendar": 0.35 };
    nextPose.courseTraceOpacity = 0.6;

    const applied = controller.applyPose(nextPose);
    controller.render();

    const scene = vi.mocked(renderer.render).mock.calls.at(-1)![0] as THREE.Scene;
    expect(movingNode.visible).toBe(false);
    expect((labelSurface.material as THREE.MeshBasicMaterial).opacity).toBe(0.35);
    expect(trace.material).not.toBe(traceMaterial);
    expect(trace.material).toMatchObject({ transparent: true, depthWrite: true, opacity: 0.6 });
    expect(controls.autoRotate).toBe(false);
    expect(scene.getObjectByName("artifact-general-direction")).toBeUndefined();
    expect(scene.children.some((object) => object.name.startsWith("artifact-copy-"))).toBe(false);
    expect(scene.children.some((object) => object.name.startsWith("artifact-source-line-"))).toBe(false);
    expect(applied).toMatchObject({
      nodes: { "calendar/slip": { visible: false } },
      labelOpacity: { "dynamic/calendar": 0.35 },
      courseTraceOpacity: 0.6,
    });

    const resetPose = pose(0, 0);
    resetPose.nodes["calendar/slip"].visible = true;
    controller.applyPose(resetPose);
    expect(movingNode.visible).toBe(true);
    expect((labelSurface.material as THREE.MeshBasicMaterial).opacity).toBe(1);
    expect((trace.material as THREE.MeshStandardMaterial).opacity).toBe(0);
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
      expect(surface.children).toHaveLength(0);
    }
    expect(canvasContext.fillText).toHaveBeenCalledWith("✎", expect.any(Number), expect.any(Number));
    expect(canvasContext.fillText).toHaveBeenCalledWith("◆", expect.any(Number), expect.any(Number));
    expect(canvasContext.fillText).toHaveBeenCalledWith("↺", expect.any(Number), expect.any(Number));
    expect(canvasContext.fillText).toHaveBeenCalledWith(
      "月建寅　月将登明亥　占时卯　旬空寅卯　昼贵丑",
      expect.any(Number),
      expect.any(Number),
    );
    expect(canvasContext.fillText).toHaveBeenCalledWith(
      "贵人　寅（天盘空）/卯（地盘空）　查地盘子",
      expect.any(Number),
      expect.any(Number),
    );
    expect(canvasContext.fillText).toHaveBeenCalledWith(
      "寅（天盘空）/卯（地盘空）",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("focuses a runtime node and restores the three-quarter initial camera", () => {
    const { controller, controls, renderer } = fixture();

    controller.focusNode("calendar/slip");
    expect(controls.target.toArray()).toEqual([1, 2, 3]);
    controller.resetCamera();
    controller.render();
    const camera = vi.mocked(renderer.render).mock.calls.at(-1)![1] as THREE.PerspectiveCamera;
    expect(controls.target.toArray()).toEqual([0, 0.05, 0]);
    expect(camera.position.toArray()).toEqual([0.62, 0.58, 0.78]);
    expect(camera.position.distanceTo(controls.target)).toBeGreaterThanOrEqual(1.04);
    expect(camera.position.distanceTo(controls.target)).toBeLessThanOrEqual(1.18);
  });

  it("keeps a focused node after a later render interrupts a stage camera tween", () => {
    const { controller, controls, renderer, setNow } = fixture();
    controller.applyCameraPreset(reviewStageFor("four-lessons").camera);
    setNow(350);
    controller.render();
    const camera = vi.mocked(renderer.render).mock.calls.at(-1)![1] as THREE.PerspectiveCamera;

    controller.focusNode("calendar/slip");
    const focusedPosition = camera.position.toArray();
    expect(controls.target.toArray()).toEqual([1, 2, 3]);

    setNow(700);
    controller.render();

    expect(camera.position.toArray()).toEqual(focusedPosition);
    expect(controls.target.toArray()).toEqual([1, 2, 3]);
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
    const {
      branchNodes, callbacks, canvas, controller, controls, environmentDispose,
      geometry, material, renderer, trace, traceMaterial,
    } = fixture();
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const ownedBranchMaterial = (branchNodes.get("branch/earth/子")!.material as THREE.MeshStandardMaterial);
    const ownedBranchMaterialDispose = vi.spyOn(ownedBranchMaterial, "dispose");
    const ownedTraceMaterial = trace.material as THREE.MeshStandardMaterial;
    const ownedTraceMaterialDispose = vi.spyOn(ownedTraceMaterial, "dispose");
    const originalTraceMaterialDispose = vi.spyOn(traceMaterial, "dispose");

    controller.setDisplayState(displayState);
    controller.dispose();
    controller.dispose();
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));

    expect(controls.dispose).toHaveBeenCalledOnce();
    expect(environmentDispose).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(ownedBranchMaterialDispose).toHaveBeenCalledOnce();
    expect(ownedTraceMaterialDispose).toHaveBeenCalledOnce();
    expect(originalTraceMaterialDispose).toHaveBeenCalledOnce();
    expect(callbacks.onContextLost).not.toHaveBeenCalled();
  });
});
