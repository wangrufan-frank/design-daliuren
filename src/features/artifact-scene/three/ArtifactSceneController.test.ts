import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EARTHLY_BRANCHES } from "../../../domain/calendar/constants";
import type { EarthlyBranch } from "../../../domain/chart/types";
import type { ArtifactDisplayState } from "../model/types";
import type { ArtifactPose, JadePlateMotion } from "../timeline/types";
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
  enabled = true;
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
  options: { invalidBranchMaterialId?: string; includeLegacyOverlay?: boolean; observeListeners?: boolean } = {},
) {
  let nowMs = 0;
  const canvas = document.createElement("canvas");
  const root = new THREE.Group();
  const legacyOverlay = options.includeLegacyOverlay
    ? new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
    : undefined;
  if (legacyOverlay) {
    legacyOverlay.name = "lod0_divider_heaven_00";
    root.add(legacyOverlay);
  }
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
    general.position.set(index * 10 + 1, index * 20, index * 30);
    general.rotation.set(index * 0.01, index * 0.02, index * 0.03);
    general.scale.setScalar(index + 1);
    const jade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.02), new THREE.MeshStandardMaterial({ color: 0xf4f4ed }));
    general.add(jade);
    const name = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.001, 0.01), new THREE.MeshStandardMaterial({ color: 0x27231f }));
    name.userData.text_role = "general-name";
    general.add(name);
    root.add(general);
    return general;
  });
  const heaven = node("plate/heaven");
  heaven.position.set(0, 0.02, 0);
  root.add(heaven);
  const generalSeat = node("plate/generals");
  generalSeat.position.set(0, 0.01, 0);
  root.add(generalSeat);
  const core = node("plate/core");
  core.position.set(0, 0.03, 0);
  root.add(core);
  const generalSlots = new Map<EarthlyBranch, THREE.Group>();
  EARTHLY_BRANCHES.forEach((earth, index) => {
    const slot = node(`general-slot/${earth}`);
    slot.position.set(index * 0.01, 0.04 + index * 0.001, index * 0.02);
    root.add(slot);
    generalSlots.set(earth, slot);
  });
  const monthGlyphs = new Map<string, THREE.Mesh>();
  for (const month of ["胜光", "小吉", "传送", "从魁", "河魁", "登明", "神后", "大吉", "功曹", "太冲", "天罡", "太乙"]) {
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.001, 0.01), new THREE.MeshStandardMaterial({ color: 0xa33a25 }));
    glyph.userData = { node_id: `month-general/${month}`, text_role: "month-general" };
    heaven.add(glyph);
    monthGlyphs.set(`month-general/${month}`, glyph);
  }
  const interactionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.17, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  interactionRing.userData.node_id = "interaction/month-general-ring";
  root.add(interactionRing);
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
  const earthBranchMaterial = new THREE.MeshStandardMaterial({ color: 0x27231f });
  const branchNodes = new Map<string, THREE.Mesh>();
  EARTHLY_BRANCHES.forEach((branch, index) => {
      const id = `branch/earth/${branch}`;
      const branchNode = new THREE.Mesh(
        branchGeometry,
        options.invalidBranchMaterialId === id
          ? new THREE.MeshBasicMaterial()
          : earthBranchMaterial,
      );
      branchNode.userData.node_id = id;
      branchNode.position.set((index - 5.5) * 0.018, 0, 0);
      root.add(branchNode);
      branchNodes.set(id, branchNode);
  });
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
      ["plate/heaven", heaven] as const,
      ["plate/generals", generalSeat] as const,
      ["plate/core", core] as const,
      ...[...generalSlots].map(([earth, slot]) => [`general-slot/${earth}`, slot] as const),
      ...monthGlyphs,
      ["interaction/month-general-ring", interactionRing] as const,
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
    onMonthGeneralInput: vi.fn(),
  };
  const addEventListener = options.observeListeners ? vi.spyOn(canvas, "addEventListener") : undefined;
  const removeEventListener = options.observeListeners ? vi.spyOn(canvas, "removeEventListener") : undefined;
  const monthGlyphOriginalMaterials = new Map(
    [...monthGlyphs].map(([id, glyph]) => [id, glyph.material]),
  );
  const generalNameOriginalMaterials = generalNodes.map((general) => (general.children[1] as THREE.Mesh).material);
  const controller = new ArtifactSceneController(renderer, artifact, callbacks, {
    createControls: () => controls,
    createEnvironment: () => ({ texture: environmentTexture, dispose: environmentDispose }),
    now: () => nowMs,
  });
  return {
    artifact, callbacks, canvas, controller, controls, geometry,
    branchGeometry, branchNodes, earthBranchMaterial,
    labelSurface: labelSurfaces.get("dynamic/calendar")!, labelSurfaces,
    environmentDispose, environmentTexture, generalNodes, material, movingNode, renderer,
    trace, traceGeometry, traceMaterial, legacyOverlay,
    heaven, generalSeat, core, generalSlots, monthGlyphs, interactionRing,
    monthGlyphOriginalMaterials, generalNameOriginalMaterials,
    addEventListener, removeEventListener,
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
    jadePlate: jadeMotion(),
    labelOpacity: {},
    courseTraceOpacity: 0,
    generalDirection: "forward",
    generalSequence: [],
  };
}

function jadeMotion(overrides: Partial<JadePlateMotion> = {}): JadePlateMotion {
  return {
    monthAngleRad: 0,
    activeMonthGeneralNodeId: "month-general/胜光",
    activeMonthGoldProgress: 0,
    generals: generals.map(([, id], index) => ({
      nodeId: `general/${id}`,
      targetEarth: EARTHLY_BRANCHES[index],
      visible: false,
      heightMeters: 0.0275,
      seatProgress: 0,
      goldProgress: 0,
    })),
    ...overrides,
  };
}

function projectedMeshHeightPx(
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  viewportHeight: number,
) {
  const position = mesh.geometry.getAttribute("position");
  const projectedY = Array.from({ length: position.count }, (_, index) =>
    new THREE.Vector3()
      .fromBufferAttribute(position, index)
      .applyMatrix4(mesh.matrixWorld)
      .project(camera).y,
  );
  return (Math.max(...projectedY) - Math.min(...projectedY)) * viewportHeight / 2;
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
    jadePlate: jadeMotion({
      generals: jadeMotion().generals.map((piece, index) => index === 0
        ? { ...piece, targetEarth, heightMeters: 0 }
        : piece),
    }),
  };
}

function eventAtRing(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  type: string,
  point = new THREE.Vector3(0.14, 0, 0),
  pointerId = 7,
) {
  const projected = point.project(camera);
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: (projected.x + 1) * 100,
    clientY: (1 - projected.y) * 100,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
}

function enabledRingFixture() {
  const current = fixture();
  Object.defineProperty(current.canvas, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 200, height: 200 }) });
  Object.defineProperty(current.canvas, "setPointerCapture", { value: vi.fn() });
  Object.defineProperty(current.canvas, "releasePointerCapture", { value: vi.fn() });
  current.controller.setMonthGeneralInteractionEnabled(true);
  current.controller.resize(200, 200, 1);
  current.controller.render();
  current.canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 100 }));
  return {
    ...current,
    camera: vi.mocked(current.renderer.render).mock.calls.at(-1)![1] as THREE.Camera,
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
  it("keeps the physical artifact geometry visible without a reference-surface replacement", () => {
    const { branchNodes, legacyOverlay } = fixture(["dynamic/calendar"], { includeLegacyOverlay: true });

    expect(legacyOverlay!.visible).toBe(true);
    expect(branchNodes.get("branch/earth/子")!.visible).toBe(true);
  });

  it("configures an AgX sRGB museum-lighting scene and resizes without WebGL construction", () => {
    const { controller, controls, environmentTexture, interactionRing, renderer } = fixture();

    controller.resize(800, 400, 2);
    controller.render();

    expect(renderer.toneMapping).toBe(THREE.AgXToneMapping);
    expect(renderer.toneMappingExposure).toBe(0.72);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledWith(800, 400, false);
    const scene = vi.mocked(renderer.render).mock.calls[0][0] as THREE.Scene;
    expect(scene.background).toEqual(new THREE.Color(0x8b8984));
    expect(scene.environment).toBe(environmentTexture);
    expect(scene.environmentIntensity).toBe(0.45);
    expect(controls.minPolarAngle).toBeCloseTo(Math.PI / 9);
    expect(controls.maxPolarAngle).toBeCloseTo(5 * Math.PI / 12);
    expect(controls.minAzimuthAngle).toBe(-Infinity);
    expect(controls.maxAzimuthAngle).toBe(Infinity);
    const lights = scene.children.filter((child) => child instanceof THREE.Light) as THREE.Light[];
    expect(lights).toHaveLength(4);
    expect(lights.map((light) => light.intensity)).toEqual([1.35, 0.78, 0.45, 0.55]);
    expect(lights[0].color).toEqual(new THREE.Color(0xfff4df));
    expect(lights[1]).toBeInstanceOf(THREE.HemisphereLight);
    expect(lights[2]).toBeInstanceOf(THREE.DirectionalLight);
    const camera = vi.mocked(renderer.render).mock.calls[0][1] as THREE.PerspectiveCamera;
    expect(camera).toMatchObject({ fov: 34, near: 0.05, far: 4 });
    expect(controls.autoRotate).toBe(false);
    expect(interactionRing.material).toMatchObject({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false });
  });

  it("keeps only the fixed black earthly-branch glyphs without void recoloring", () => {
    const {
      artifact, branchNodes, controller, earthBranchMaterial,
    } = fixture();
    const ownedMaterials = [...branchNodes.values()].map((mesh) => mesh.material);

    expect(new Set(ownedMaterials).size).toBe(1);
    expect(ownedMaterials).toContain(earthBranchMaterial);
    controller.setDisplayState({
      ...completeDisplayState,
      calendar: { ...completeDisplayState.calendar, voidBranches: ["子", "丑"] },
    });

    expect(((artifact.nodes.get("branch/earth/子") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe("27231f");
    expect(((artifact.nodes.get("branch/earth/寅") as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString())
      .toBe("27231f");
    expect((artifact.nodes.get("branch/earth/子") as THREE.Mesh).material).toBe(ownedMaterials[0]);
  });

  it("rejects a branch inlay that is not backed by a standard material", () => {
    expect(() => fixture(["dynamic/calendar"], { invalidBranchMaterialId: "branch/earth/亥" }))
      .toThrow("Invalid branch inlay branch/earth/亥");
  });

  it("applies ring motion to fixed slots while changing only independently owned text materials", () => {
    const {
      controller, core, generalNameOriginalMaterials, generalNodes, generalSeat, generalSlots,
      heaven, monthGlyphs, monthGlyphOriginalMaterials,
    } = fixture();
    const monthGlyph = monthGlyphs.get("month-general/胜光")!;
    const generalJade = generalNodes[0].children[0] as THREE.Mesh;
    const generalName = generalNodes[0].children[1] as THREE.Mesh;
    const jadeMaterial = generalJade.material;
    const motion = jadeMotion({
      monthAngleRad: Math.PI / 3,
      activeMonthGoldProgress: 1,
      generals: jadeMotion().generals.map((piece, index) => ({
        ...piece,
        targetEarth: index === 0 ? "卯" : piece.targetEarth,
        visible: index === 0,
        heightMeters: index === 0 ? 0.0275 : piece.heightMeters,
        goldProgress: index === 0 ? 1 : 0,
      })),
    });

    controller.applyJadePlateMotion(motion);

    const slot = generalSlots.get("卯")!;
    expect(heaven.rotation.y).toBeCloseTo(motion.monthAngleRad);
    expect(generalNodes[0].position.y).toBeCloseTo(slot.position.y + 0.0275);
    expect(generalNodes[0].visible).toBe(true);
    expect(generalJade.material).toBe(jadeMaterial);
    expect(monthGlyph.material).not.toBe(monthGlyphOriginalMaterials.get("month-general/胜光"));
    expect(generalName.material).not.toBe(generalNameOriginalMaterials[0]);
    expect((monthGlyph.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("b98a38");
    expect((generalName.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("b98a38");
    expect(generalSeat.position.toArray()).toEqual([0, 0.01, 0]);
    expect(core.position.toArray()).toEqual([0, 0.03, 0]);
  });

  it("captures only the interaction ring and emits normalized enabled gestures", () => {
    const { callbacks, canvas, controller, controls, renderer } = fixture();
    Object.defineProperty(canvas, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 200, height: 200 }) });
    const capture = vi.fn();
    const release = vi.fn();
    Object.defineProperty(canvas, "setPointerCapture", { value: capture });
    Object.defineProperty(canvas, "releasePointerCapture", { value: release });
    controller.setMonthGeneralInteractionEnabled(true);
    controller.resize(200, 200, 1);
    controller.render();
    const camera = vi.mocked(renderer.render).mock.calls.at(-1)![1] as THREE.Camera;

    canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 100 }));
    expect(callbacks.onMonthGeneralInput).not.toHaveBeenCalled();
    expect(controls.enabled).toBe(true);

    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointerdown"));
    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "drag-start" }));
    expect(capture).toHaveBeenCalledWith(7);
    expect(controls.enabled).toBe(false);

    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointerup"));
    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "drag-end" }));
    expect(release).toHaveBeenCalledWith(7);
    expect(controls.enabled).toBe(true);

    const wheel = new Event("wheel", { bubbles: true, cancelable: true });
    Object.defineProperty(wheel, "deltaY", { value: 1 });
    canvas.dispatchEvent(wheel);
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "step", delta: 1 }));
    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "step", delta: -1 }));
    expect(canvas.tabIndex).toBe(0);

    controller.setMonthGeneralInteractionEnabled(false);
    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointerdown"));
    expect(controls.enabled).toBe(true);
  });

  it("handles confirmed ring and wheel input before an OrbitControls bubble listener", () => {
    const { callbacks, camera, canvas, controls, controller } = enabledRingFixture();
    const orbitPointer = vi.fn();
    const orbitWheel = vi.fn();
    canvas.addEventListener("pointerdown", orbitPointer);
    canvas.addEventListener("wheel", orbitWheel);

    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointerdown"));
    const wheel = new Event("wheel", { bubbles: true, cancelable: true });
    Object.defineProperty(wheel, "deltaY", { value: 1 });
    canvas.dispatchEvent(wheel);

    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "drag-start" }));
    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "step", delta: 1 }));
    expect(controls.enabled).toBe(false);
    expect(orbitPointer).not.toHaveBeenCalled();
    expect(orbitWheel).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("leaves disabled and non-ring pointer, wheel, and key events to other handlers", () => {
    const { callbacks, camera, canvas, controller } = enabledRingFixture();
    const orbitPointer = vi.fn();
    const orbitWheel = vi.fn();
    const orbitKey = vi.fn();
    canvas.addEventListener("pointerdown", orbitPointer);
    canvas.addEventListener("wheel", orbitWheel);
    canvas.addEventListener("keydown", orbitKey);

    canvas.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 100 }));
    controller.setMonthGeneralInteractionEnabled(false);
    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointerdown"));
    const disabledWheel = new Event("wheel", { bubbles: true, cancelable: true });
    Object.defineProperty(disabledWheel, "deltaY", { value: 1 });
    canvas.dispatchEvent(disabledWheel);
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));

    expect(callbacks.onMonthGeneralInput).not.toHaveBeenCalled();
    expect(orbitPointer).toHaveBeenCalledTimes(2);
    expect(orbitWheel).toHaveBeenCalledOnce();
    expect(orbitKey).toHaveBeenCalledOnce();
  });

  it("emits ArrowRight only while ring interaction is enabled", () => {
    const { callbacks, canvas } = enabledRingFixture();

    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));

    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "step", delta: 1 }));
  });

  it("normalizes a wraparound drag and restores capture exactly once on cancellation", () => {
    const { callbacks, camera, canvas, controls } = enabledRingFixture();
    const capture = canvas.setPointerCapture as unknown as ReturnType<typeof vi.fn>;
    const release = canvas.releasePointerCapture as unknown as ReturnType<typeof vi.fn>;
    const unrelatedMove = vi.fn();
    const start = new THREE.Vector3(0.01, 0, -0.14);
    const acrossBoundary = new THREE.Vector3(-0.01, 0, -0.14);
    canvas.addEventListener("pointermove", unrelatedMove);

    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointerdown", start));
    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointermove", acrossBoundary, 8));
    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointermove", acrossBoundary));
    canvas.dispatchEvent(eventAtRing(canvas, camera, "pointercancel", acrossBoundary));

    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "drag-move", angleRad: expect.any(Number) }));
    expect(callbacks.onMonthGeneralInput).toHaveBeenCalledWith(expect.objectContaining({ type: "drag-end", angularVelocityRadMs: 0 }));
    expect(capture).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(unrelatedMove).toHaveBeenCalledOnce();
    expect(controls.enabled).toBe(true);
  });

  it("restores a captured gesture after callback, render, disable, and disposal errors", () => {
    const callbackFailure = enabledRingFixture();
    callbackFailure.callbacks.onMonthGeneralInput.mockImplementationOnce(() => { throw new Error("callback failed"); });
    callbackFailure.canvas.dispatchEvent(eventAtRing(callbackFailure.canvas, callbackFailure.camera, "pointerdown"));
    expect(callbackFailure.controls.enabled).toBe(true);
    expect(callbackFailure.canvas.releasePointerCapture).toHaveBeenCalledOnce();

    const renderFailure = enabledRingFixture();
    renderFailure.canvas.dispatchEvent(eventAtRing(renderFailure.canvas, renderFailure.camera, "pointerdown"));
    vi.mocked(renderFailure.renderer.render).mockImplementation(() => { throw new Error("render failed"); });
    renderFailure.controller.render();
    expect(renderFailure.controls.enabled).toBe(true);
    expect(renderFailure.canvas.releasePointerCapture).toHaveBeenCalledOnce();

    const disabled = enabledRingFixture();
    disabled.canvas.dispatchEvent(eventAtRing(disabled.canvas, disabled.camera, "pointerdown"));
    disabled.controller.setMonthGeneralInteractionEnabled(false);
    disabled.controller.dispose();
    expect(disabled.controls.enabled).toBe(true);
    expect(disabled.canvas.releasePointerCapture).toHaveBeenCalledOnce();

    const disposed = enabledRingFixture();
    disposed.canvas.dispatchEvent(eventAtRing(disposed.canvas, disposed.camera, "pointerdown"));
    disposed.controller.dispose();
    expect(disposed.controls.enabled).toBe(true);
    expect(disposed.canvas.releasePointerCapture).toHaveBeenCalledOnce();
  });

  it("removes capture listeners with the exact options used for registration", () => {
    const observed = fixture(["dynamic/calendar"], { observeListeners: true });
    observed.controller.dispose();

    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel"]) {
      const added = observed.addEventListener!.mock.calls.find(([eventType]) => eventType === type)!;
      const removed = observed.removeEventListener!.mock.calls.find(([eventType]) => eventType === type)!;
      expect(added[2]).toEqual(type === "wheel" ? { capture: true, passive: false } : { capture: true });
      expect(removed[2]).toBe(added[2]);
    }
  });

  it("measures actual projected branch vertices instead of an inflated world AABB", () => {
    const { branchNodes, controller, renderer } = fixture();
    const asymmetricGlyph = new THREE.BufferGeometry();
    asymmetricGlyph.setAttribute("position", new THREE.Float32BufferAttribute([
      -0.006, -0.016, -0.002,
      0.021, 0.004, 0.001,
      -0.004, 0.013, 0.017,
    ], 3));
    for (const branch of branchNodes.values()) {
      branch.geometry = asymmetricGlyph;
      branch.position.set(0.04, -0.02, 0.03);
      branch.rotation.set(0.4, -0.3, 0.6);
    }
    controller.resize(800, 600, 1);
    controller.applyCameraPreset({ position: [0.31, 0.73, 0.77], target: [0, 0.05, 0] }, true);
    controller.render();
    const camera = vi.mocked(renderer.render).mock.calls.at(-1)![1] as THREE.PerspectiveCamera;

    const first = controller.measureMinimumBranchProjectionPx();
    const expected = Math.min(
      ...[...branchNodes.values()].map((mesh) => projectedMeshHeightPx(mesh, camera, 600)),
    );
    const inflatedAabb = new THREE.Box3().setFromObject(branchNodes.values().next().value!);
    const inflatedY = [inflatedAabb.min.x, inflatedAabb.max.x].flatMap((x) =>
      [inflatedAabb.min.y, inflatedAabb.max.y].flatMap((y) =>
        [inflatedAabb.min.z, inflatedAabb.max.z].map((z) =>
          new THREE.Vector3(x, y, z).project(camera).y),
      ),
    );
    const inflatedHeight = (Math.max(...inflatedY) - Math.min(...inflatedY)) * 300;
    expect(first).toBeCloseTo(expected);
    expect(first).toBeLessThan(inflatedHeight * 0.95);
    expect(first).toBeGreaterThan(0);
    expect(controller.measureMinimumBranchProjectionPx()).toBe(first);

    controller.resize(800, 300, 1);
    expect(controller.measureMinimumBranchProjectionPx()).toBeCloseTo(first / 2);
  });

  it("reports the minimum canvas-edge margin across every functional branch mesh", () => {
    const { branchNodes, controller } = fixture();
    controller.resize(800, 600, 1);
    controller.applyCameraPreset({ position: [0, 0, 1], target: [0, 0, 0] }, true);

    const measure = () => controller.measureMinimumBranchEdgeMarginPx();
    expect(measure()).toBeGreaterThan(100);

    branchNodes.values().next().value!.position.x = 2;
    expect(measure()).toBeLessThan(0);
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

  it("fits a review preset for a portrait canvas without altering the landscape preset", () => {
    const { controller, controls, renderer } = fixture();
    const preset = reviewStageFor("course").camera;

    controller.resize(344, 506, 1);
    controller.applyCameraPreset(preset, true);
    controller.render();
    const camera = vi.mocked(renderer.render).mock.calls.at(-1)![1] as THREE.PerspectiveCamera;
    expect(camera.position.x).toBeCloseTo(0.295816336, 6);
    expect(camera.position.y).toBeCloseTo(1.490955952, 6);
    expect(camera.position.z).toBeCloseTo(0.777731775, 6);
    expect(controls.target.x).toBeCloseTo(-0.014842619, 6);
    expect(controls.target.y).toBeCloseTo(0.05, 6);
    expect(controls.target.z).toBeCloseTo(0.005974668, 6);

    controller.resize(672, 520, 1);
    controller.applyCameraPreset(preset, true);
    controller.render();
    expect(camera.position.toArray()).toEqual(preset.position);
    expect(controls.target.toArray()).toEqual(preset.target);
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
    const { artifact, callbacks, controller, renderer } = fixture();
    (artifact.nodes as Map<string, THREE.Object3D>).delete("plate/heaven");

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

  it("reports the one frame on which a camera preset finishes settling", () => {
    const { controller, setNow } = fixture();
    controller.applyCameraPreset(reviewStageFor("course").camera);

    setNow(699);
    expect(controller.render()).toBe(false);
    setNow(700);
    expect(controller.render()).toBe(true);
    expect(controller.render()).toBe(false);
  });

  it("selects general destination palaces from frozen slots without pose history", () => {
    const { controller, generalNodes, generalSlots } = fixture();
    const targetSlot = generalSlots.get("卯")!;
    const targetQuaternion = targetSlot.quaternion.toArray();

    controller.applyPose(generalPose("卯"));
    const firstPosition = generalNodes[0].position.toArray();
    const firstQuaternion = generalNodes[0].quaternion.toArray();
    const firstScale = generalNodes[0].scale.toArray();
    controller.applyPose(generalPose("酉"));
    generalNodes[0].position.set(999, 999, 999);
    controller.applyPose(generalPose("卯"));

    expect(firstPosition).toEqual(targetSlot.position.toArray());
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
