import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EARTHLY_BRANCHES } from "../../../domain/calendar/constants";
import type { EarthlyBranch } from "../../../domain/chart/types";
import type { ArtifactDisplayState } from "../model/types";
import { formatVoidBranch, type VoidSurface } from "../model/format-void-branch";
import type { ArtifactPose, JadePlateMotion } from "../timeline/types";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "../annotations/descriptors";
import { projectArtifactAnnotations } from "../annotations/project-annotations";
import type { ArtifactAnnotationId, ProjectedAnchor } from "../annotations/types";
import { disposeArtifact } from "./dispose-artifact";
import type { LoadedArtifact } from "./load-artifact";
import { angleOnPlatePlane } from "./month-general-pointer";
import {
  createLabelMaterial,
  LabelTextureCache,
  type LabelDescriptor,
} from "./dynamic-labels";

interface ArtifactSceneCallbacks {
  onUserControlStart(): void;
  onContextLost(): void;
  onError(error: unknown): void;
  onAnnotationError?(error: unknown): void;
  onMonthGeneralInput?(event: MonthGeneralInputEvent): void;
}

export type MonthGeneralInputEvent =
  | { type: "drag-start"; angleRad: number; nowMs: number }
  | { type: "drag-move"; angleRad: number; nowMs: number }
  | { type: "drag-end"; angularVelocityRadMs: number; nowMs: number }
  | { type: "step"; delta: -1 | 1; nowMs: number };

export interface AnnotationFrame {
  viewport: { width: number; height: number };
  anchors: readonly ProjectedAnchor[];
}

export interface AnnotationFrameSource {
  captureAnnotationFrame(ids: readonly ArtifactAnnotationId[]): AnnotationFrame;
  focusNode(nodeId: string): void;
}

interface ControlsLike {
  target: THREE.Vector3;
  autoRotate: boolean;
  enabled: boolean;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  addEventListener(type: "start", listener: () => void): void;
  removeEventListener(type: "start", listener: () => void): void;
  update(): void;
  dispose(): void;
}

interface ArtifactSceneDependencies {
  createControls(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): ControlsLike;
  createEnvironment(renderer: THREE.WebGLRenderer): { texture: THREE.Texture; dispose(): void };
  now?(): number;
}

interface BaseTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface CameraTween {
  startedAtMs: number;
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPosition: THREE.Vector3;
  toTarget: THREE.Vector3;
}

export interface ArtifactCameraPreset {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

interface LabelBinding {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  material: THREE.MeshBasicMaterial;
  texture?: THREE.CanvasTexture;
}

export interface ArtifactAppliedState {
  nodes: Readonly<Record<string, Readonly<{
    position: readonly [number, number, number];
    quaternion: readonly [number, number, number, number];
    scale: readonly [number, number, number];
    visible: boolean;
  }>>>;
  labelOpacity: Readonly<Record<string, number>>;
  courseTraceOpacity: number;
}

const GENERAL_DYNAMIC_IDS = {
  贵人: "dynamic/general/noble",
  螣蛇: "dynamic/general/snake",
  朱雀: "dynamic/general/vermilion-bird",
  六合: "dynamic/general/harmony",
  勾陈: "dynamic/general/hook-array",
  青龙: "dynamic/general/azure-dragon",
  天空: "dynamic/general/void",
  白虎: "dynamic/general/white-tiger",
  太常: "dynamic/general/constant",
  玄武: "dynamic/general/black-tortoise",
  太阴: "dynamic/general/yin",
  天后: "dynamic/general/queen-of-heaven",
} as const;
const ANNOTATION_DESCRIPTORS_BY_ID = new Map(
  ARTIFACT_ANNOTATION_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor]),
);
const CAMERA_TWEEN_DURATION_MS = 700;
const REVIEW_HORIZONTAL_FOV_DEGREES = 20.4268144654051;
const REVIEW_CAMERA_SHIFT_X = 0.12208956;
const REVIEW_CAMERA_SHIFT_Y = -0.04859297;
const REVIEW_CAMERA_ROLL_RADIANS = -0.0997904;
const PORTRAIT_REVIEW_CAMERA_DISTANCE_SCALE = 0.74;
const PORTRAIT_REVIEW_CAMERA_ELEVATION = THREE.MathUtils.degToRad(69);
const PORTRAIT_REVIEW_CAMERA_LATERAL_SHIFT = 0.016;

const LABEL_SIZE = { width: 512, height: 256 } as const;
const CALENDAR_LABEL_SIZE = { width: 1024, height: 256 } as const;
const DAY_NIGHT_TEXT = { day: "昼", night: "夜" } as const;
const OLD_GOLD = new THREE.Color(0xb98a38);
const RING_CAPTURE_OPTIONS = { capture: true } as const;
const WHEEL_CAPTURE_OPTIONS = { capture: true, passive: false } as const;

interface TextMaterialBinding {
  mesh: THREE.Mesh;
  originalMaterial: THREE.MeshStandardMaterial;
  material: THREE.MeshStandardMaterial;
  originalColor: THREE.Color;
  originalMetalness: number;
  originalRoughness: number;
  nodeId: string;
}

function defaultDependencies(): ArtifactSceneDependencies {
  return {
    createControls: (camera, canvas) => new OrbitControls(camera, canvas),
    createEnvironment: (renderer) => {
      const generator = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const target = generator.fromScene(room, 0.04);
      room.dispose();
      generator.dispose();
      return { texture: target.texture, dispose: () => target.dispose() };
    },
  };
}

function createStoneGround(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
  const geometry = new THREE.PlaneGeometry(6, 6, 48, 48);
  const positions = geometry.getAttribute("position");
  const colors: number[] = [];
  const base = new THREE.Color(0xd8d2c8);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const variation = 0.035 * (
      Math.sin(x * 8.3 + y * 3.1)
      + Math.sin(x * 19.7 - y * 13.9) * 0.45
    );
    colors.push(
      THREE.MathUtils.clamp(base.r + variation, 0, 1),
      THREE.MathUtils.clamp(base.g + variation * 0.96, 0, 1),
      THREE.MathUtils.clamp(base.b + variation * 0.90, 0, 1),
    );
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.9,
    vertexColors: true,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.name = "environment/stone-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  return ground;
}

export class ArtifactSceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(REVIEW_HORIZONTAL_FOV_DEGREES, 1, 0.05, 4);
  private readonly controls: ControlsLike;
  private readonly environment: ReturnType<ArtifactSceneDependencies["createEnvironment"]>;
  private readonly stoneGround = createStoneGround();
  private readonly baseTransforms = new Map<string, BaseTransform>();
  private readonly generalSlots = new Map<EarthlyBranch, BaseTransform>();
  private readonly labelBindings = new Map<string, LabelBinding>();
  private readonly branchMeshes = new Map<string, THREE.Mesh>();
  private readonly monthGlyphMaterials = new Map<string, TextMaterialBinding>();
  private readonly generalNameMaterials = new Map<string, TextMaterialBinding>();
  private readonly interactionRing: THREE.Object3D;
  private readonly courseTraceMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly courseTraceMaterial: THREE.MeshStandardMaterial;
  private readonly courseTraceOriginalMaterial: THREE.MeshStandardMaterial;
  private readonly labels: LabelTextureCache;
  private readonly initialCameraPosition = new THREE.Vector3(0.62, 0.58, 0.78);
  private readonly initialTarget = new THREE.Vector3(0, 0.05, 0);
  private readonly now: () => number;
  private readonly annotationRaycaster = new THREE.Raycaster();
  private readonly interactionRaycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly reportedAnnotationErrors = new Set<ArtifactAnnotationId>();
  private annotationViewport = { width: 1, height: 1 };
  private cameraTween: CameraTween | undefined;
  private interactionEnabled = false;
  private activeRingGesture: { pointerId: number; angleRad: number; atMs: number; controlsEnabled: boolean } | undefined;
  private stopped = false;
  private disposed = false;

  private readonly handleControlStart = () => {
    this.cameraTween = undefined;
    this.callbacks.onUserControlStart();
  };
  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    this.restoreRingGesture();
    this.stopped = true;
    this.callbacks.onContextLost();
  };
  private readonly handlePointerDown = (event: PointerEvent) => this.startRingGesture(event);
  private readonly handlePointerMove = (event: PointerEvent) => this.moveRingGesture(event);
  private readonly handlePointerUp = (event: PointerEvent) => this.endRingGesture(event);
  private readonly handlePointerCancel = (event: PointerEvent) => this.endRingGesture(event, true);
  private readonly handleWheel = (event: WheelEvent) => {
    if (!this.interactionEnabled || event.deltaY === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      this.emitMonthGeneralInput({ type: "step", delta: event.deltaY > 0 ? 1 : -1, nowMs: this.now() });
    } catch (error) {
      this.restoreRingGesture();
      this.callbacks.onError(error);
    }
  };
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!this.interactionEnabled || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      this.emitMonthGeneralInput({ type: "step", delta: event.key === "ArrowRight" ? 1 : -1, nowMs: this.now() });
    } catch (error) {
      this.restoreRingGesture();
      this.callbacks.onError(error);
    }
  };

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly artifact: LoadedArtifact,
    private readonly callbacks: ArtifactSceneCallbacks,
    dependencies: ArtifactSceneDependencies = defaultDependencies(),
  ) {
    for (const branch of EARTHLY_BRANCHES) {
      const id = `branch/earth/${branch}`;
      const mesh = artifact.nodes.get(id);
      if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) {
        throw new Error(`Invalid branch inlay ${id}`);
      }
      this.branchMeshes.set(id, mesh);
    }
    const interactionRing = artifact.nodes.get("interaction/month-general-ring");
    if (!interactionRing) throw new Error("Missing interaction ring interaction/month-general-ring");
    this.interactionRing = interactionRing;
    const courseTrace = artifact.nodes.get("trace/course");
    const courseTraceOriginalMaterial = courseTrace instanceof THREE.Mesh ? courseTrace.material : undefined;
    if (!(courseTrace instanceof THREE.Mesh)
      || !(courseTraceOriginalMaterial instanceof THREE.MeshStandardMaterial)) {
      throw new Error("Invalid course trace trace/course");
    }

    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMappingExposure = 1.12;
    this.scene.background = new THREE.Color(0xd8d2c8);
    this.environment = dependencies.createEnvironment(renderer);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.9;
    this.configureInteractionRing();
    this.centerJadePlate();
    this.harmonizeJadeSurfaces();
    this.scene.add(artifact.root);
    this.now = dependencies.now ?? (() => performance.now());

    const keyLight = new THREE.DirectionalLight(0xfff7e8, 1.65);
    keyLight.position.set(-0.65, 0.95, 0.7);
    const fillLight = new THREE.HemisphereLight(0xf1f3ef, 0x8f8981, 1.05);
    const sideFill = new THREE.DirectionalLight(0xdce9e3, 0.65);
    sideFill.position.set(0.75, 0.5, 0.35);
    const rimLight = new THREE.DirectionalLight(0xffe8bb, 0.7);
    rimLight.position.set(-0.5, 0.8, -0.7);
    this.scene.add(this.stoneGround, keyLight, fillLight, sideFill, rimLight);

    this.camera.position.copy(this.initialCameraPosition);
    this.camera.lookAt(this.initialTarget);
    this.controls = dependencies.createControls(this.camera, renderer.domElement);
    this.controls.target.copy(this.initialTarget);
    this.controls.autoRotate = false;
    this.controls.minPolarAngle = Math.PI / 9;
    this.controls.maxPolarAngle = 5 * Math.PI / 12;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.controls.update();
    this.controls.addEventListener("start", this.handleControlStart);
    if (renderer.domElement.tabIndex < 0) renderer.domElement.tabIndex = 0;
    renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost);
    renderer.domElement.addEventListener("pointerdown", this.handlePointerDown, RING_CAPTURE_OPTIONS);
    renderer.domElement.addEventListener("pointermove", this.handlePointerMove, RING_CAPTURE_OPTIONS);
    renderer.domElement.addEventListener("pointerup", this.handlePointerUp, RING_CAPTURE_OPTIONS);
    renderer.domElement.addEventListener("pointercancel", this.handlePointerCancel, RING_CAPTURE_OPTIONS);
    renderer.domElement.addEventListener("wheel", this.handleWheel, WHEEL_CAPTURE_OPTIONS);
    renderer.domElement.addEventListener("keydown", this.handleKeyDown);

    for (const [id, object] of artifact.nodes) {
      this.baseTransforms.set(id, {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      });
    }
    this.courseTraceMesh = courseTrace as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    this.courseTraceOriginalMaterial = courseTraceOriginalMaterial;
    this.courseTraceMaterial = courseTraceOriginalMaterial.clone();
    this.courseTraceMaterial.transparent = true;
    this.courseTraceMaterial.opacity = 0;
    this.courseTraceMaterial.depthWrite = true;
    this.courseTraceMesh.material = this.courseTraceMaterial;
    EARTHLY_BRANCHES.forEach((earth) => {
      const transform = this.baseTransforms.get(`general-slot/${earth}`);
      if (transform) this.generalSlots.set(earth, transform);
    });

    this.bindJadeTextMaterials();

    this.labels = new LabelTextureCache(renderer.capabilities.getMaxAnisotropy());
    artifact.root.traverse((object) => {
      const dynamicId = object.userData.dynamic_label_id;
      if (!(object instanceof THREE.Mesh) || typeof dynamicId !== "string") return;
      const originalMaterial = object.material;
      const material = createLabelMaterial();
      object.material = material;
      this.labelBindings.set(dynamicId, { mesh: object, originalMaterial, material });
    });
  }

  resize(width: number, height: number, dpr: number): void {
    if (this.disposed) return;
    this.annotationViewport = { width: Math.max(1, width), height: Math.max(1, height) };
    this.camera.aspect = this.annotationViewport.width / this.annotationViewport.height;
    const landscapeFovScale = 1 + Math.max(0, this.camera.aspect - 1) * 0.065;
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(
      Math.tan(THREE.MathUtils.degToRad(REVIEW_HORIZONTAL_FOV_DEGREES * landscapeFovScale) / 2) / this.camera.aspect,
    ));
    this.camera.updateProjectionMatrix();
    this.camera.projectionMatrix.elements[8] = 2 * REVIEW_CAMERA_SHIFT_X;
    const verticalShiftScale = this.camera.aspect <= 1 ? this.camera.aspect : 2.7 * this.camera.aspect - 1.7;
    this.camera.projectionMatrix.elements[9] = 2 * REVIEW_CAMERA_SHIFT_Y * verticalShiftScale;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
  }

  captureAnnotationFrame(ids: readonly ArtifactAnnotationId[]): AnnotationFrame {
    if (this.disposed) return { viewport: this.annotationViewport, anchors: [] };
    this.artifact.root.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const anchors = ids.flatMap((id) => {
      const descriptor = ANNOTATION_DESCRIPTORS_BY_ID.get(id);
      const object = descriptor ? this.artifact.nodes.get(descriptor.nodeId) : undefined;
      if (!descriptor || !object) {
        if (!this.reportedAnnotationErrors.has(id)) {
          this.reportedAnnotationErrors.add(id);
          const nodeId = descriptor?.nodeId ?? id;
          this.callbacks.onAnnotationError?.(new Error(
            `Artifact annotation "${id}" requires missing node "${nodeId}"`,
          ));
        }
        return [];
      }
      this.reportedAnnotationErrors.delete(id);
      const position = object.getWorldPosition(new THREE.Vector3());
      const cameraToAnchor = position.clone().sub(this.camera.position);
      const anchorDistance = cameraToAnchor.length();
      let occluded = false;
      if (anchorDistance > 0.002) {
        this.annotationRaycaster.set(this.camera.position, cameraToAnchor.normalize());
        this.annotationRaycaster.near = 0;
        this.annotationRaycaster.far = anchorDistance - 0.002;
        occluded = this.annotationRaycaster.intersectObject(this.artifact.root, true).some((intersection) => (
          intersection.object instanceof THREE.Mesh
          && intersection.distance <= anchorDistance - 0.002
          && !this.isNodeOrDescendant(intersection.object, object)
        ));
      }
      return [{ id, position: position.toArray() as [number, number, number], occluded }];
    });
    const viewProjection = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    return {
      viewport: this.annotationViewport,
      anchors: projectArtifactAnnotations(anchors, viewProjection.elements, this.annotationViewport),
    };
  }

  setDisplayState(state: ArtifactDisplayState): void {
    if (this.disposed) return;
    try {
      const markVoid = (branch: string, surface: VoidSurface = "neutral") => formatVoidBranch(
        branch,
        state.calendar.voidBranches,
        surface,
      );
      const calendarMarker = state.calendar.manualFields.length > 0 ? "manual" : undefined;
      this.bindLabel("dynamic/calendar", {
        text: `${state.calendar.pillars.join("　")}\n月建${state.calendar.monthBuild}　月将${state.calendar.monthGeneral}${state.calendar.monthGeneralBranch}　占时${state.calendar.divinationHour}　旬空${state.calendar.voidBranches.join("")}　${DAY_NIGHT_TEXT[state.noble.dayNight]}贵${state.noble.nobleHeaven}`,
        style: "celadon",
        ...CALENDAR_LABEL_SIZE,
        marker: calendarMarker,
      });
      for (const lesson of state.lessons) {
        this.bindLabel(`dynamic/lesson/${lesson.id}`, {
          text: `${lesson.label}\n${lesson.general}　${markVoid(lesson.upper, "heaven")}/${markVoid(lesson.lower.value, "earth")}　查地盘${lesson.lookupEarth}`,
          style: "ash",
          ...LABEL_SIZE,
        });
      }
      for (const transmission of state.transmissions) {
        this.bindLabel(`dynamic/transmission/${transmission.position}`, {
          text: `${transmission.label}\n${transmission.general}　${markVoid(transmission.branch)}　${transmission.relation}`,
          style: "ash",
          ...LABEL_SIZE,
        });
      }
      this.bindLabel("dynamic/transmission/method", {
        text: state.methodLabel,
        style: "celadon",
        ...CALENDAR_LABEL_SIZE,
        marker: state.noble.direction === "forward" ? "direction-forward" : "direction-reverse",
      });
      for (const placement of state.generals) {
        this.bindLabel(GENERAL_DYNAMIC_IDS[placement.general], {
          text: `${placement.general}\n${markVoid(placement.heaven, "heaven")}/${markVoid(placement.earth, "earth")}`,
          style: placement.general === "贵人" ? "old-gold" : "ash",
          ...LABEL_SIZE,
          marker: placement.general === "贵人" ? "noble" : undefined,
        });
      }
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  setMonthGeneralInteractionEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.interactionEnabled = enabled;
    if (!enabled) this.restoreRingGesture();
  }

  applyJadePlateMotion(motion: JadePlateMotion): void {
    if (this.disposed) return;
    const heaven = this.artifact.nodes.get("plate/heaven");
    if (heaven) {
      this.restoreTransform("plate/heaven", heaven);
      heaven.rotateY(motion.monthAngleRad);
    }
    for (const id of ["plate/generals", "plate/core"]) {
      const object = this.artifact.nodes.get(id);
      if (object) this.restoreTransform(id, object);
    }
    for (const general of motion.generals) {
      const object = this.artifact.nodes.get(general.nodeId);
      const base = this.baseTransforms.get(general.nodeId);
      const slot = this.generalSlots.get(general.targetEarth);
      if (!object || !base || !slot) continue;
      object.position.copy(slot.position);
      object.quaternion.copy(slot.quaternion);
      object.scale.copy(base.scale);
      object.position.y += general.heightMeters;
      object.visible = general.visible;
      this.applyTextColor(this.generalNameMaterials.get(general.nodeId), general.goldProgress);
    }
    for (const [nodeId, binding] of this.monthGlyphMaterials) {
      this.applyTextColor(binding, nodeId === motion.activeMonthGeneralNodeId ? motion.activeMonthGoldProgress : 0);
    }
  }

  applyPose(pose: ArtifactPose): ArtifactAppliedState {
    if (this.disposed) return this.captureAppliedState(pose);
    for (const [id, base] of this.baseTransforms) {
      const object = this.artifact.nodes.get(id);
      if (!object) continue;
      object.position.copy(base.position);
      object.quaternion.copy(base.quaternion);
      object.scale.copy(base.scale);
    }
    for (const [id, delta] of Object.entries(pose.nodes)) {
      const object = this.artifact.nodes.get(id);
      if (!object) continue;
      const targetSlot = delta.targetEarth ? this.generalSlots.get(delta.targetEarth) : undefined;
      if (targetSlot) {
        object.position.x = targetSlot.position.x;
        object.position.y = targetSlot.position.y;
        object.quaternion.copy(targetSlot.quaternion);
      }
      object.position.x += delta.translationX;
      object.position.y += delta.translationY;
      object.position.z += delta.translationZ;
      object.rotateX(delta.rotationX);
      object.rotateY(delta.rotationY);
      object.rotateZ(delta.rotationZ);
      if (delta.visible !== undefined) object.visible = delta.visible;
    }
    this.applyJadePlateMotion(pose.jadePlate);
    for (const [dynamicId, binding] of this.labelBindings) {
      binding.material.opacity = pose.labelOpacity[dynamicId] ?? 0;
    }
    this.courseTraceMaterial.opacity = pose.courseTraceOpacity;
    return this.captureAppliedState(pose);
  }

  measureMinimumBranchProjectionPx(): number {
    if (this.disposed) return 0;
    this.artifact.root.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    let minimum = Infinity;
    for (const mesh of this.branchMeshes.values()) {
      const positions = mesh.geometry.getAttribute("position");
      const vertex = new THREE.Vector3();
      let minimumY = Infinity;
      let maximumY = -Infinity;
      for (let index = 0; index < positions.count; index += 1) {
        vertex
          .fromBufferAttribute(positions, index)
          .applyMatrix4(mesh.matrixWorld)
          .project(this.camera);
        minimumY = Math.min(minimumY, vertex.y);
        maximumY = Math.max(maximumY, vertex.y);
      }
      if (Number.isFinite(minimumY) && Number.isFinite(maximumY)) {
        minimum = Math.min(
          minimum,
          (maximumY - minimumY) * this.annotationViewport.height / 2,
        );
      }
    }
    return Number.isFinite(minimum) ? minimum : 0;
  }

  measureMinimumBranchEdgeMarginPx(): number {
    if (this.disposed) return 0;
    this.artifact.root.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    let minimum = Infinity;
    for (const mesh of this.branchMeshes.values()) {
      const positions = mesh.geometry.getAttribute("position");
      const vertex = new THREE.Vector3();
      for (let index = 0; index < positions.count; index += 1) {
        vertex
          .fromBufferAttribute(positions, index)
          .applyMatrix4(mesh.matrixWorld)
          .project(this.camera);
        const x = (vertex.x + 1) * this.annotationViewport.width / 2;
        const y = (1 - vertex.y) * this.annotationViewport.height / 2;
        minimum = Math.min(
          minimum,
          x,
          this.annotationViewport.width - x,
          y,
          this.annotationViewport.height - y,
        );
      }
    }
    return Number.isFinite(minimum) ? minimum : 0;
  }

  focusNode(nodeId: string): void {
    if (this.disposed) return;
    const object = this.artifact.nodes.get(nodeId);
    if (!object) {
      this.callbacks.onError(new Error(`Unknown artifact node: ${nodeId}`));
      return;
    }
    this.cameraTween = undefined;
    const target = object.getWorldPosition(new THREE.Vector3());
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
  }

  resetCamera(): void {
    if (this.disposed) return;
    this.cameraTween = undefined;
    this.camera.position.copy(this.initialCameraPosition);
    this.controls.target.copy(this.initialTarget);
    this.camera.lookAt(this.initialTarget);
    this.controls.update();
  }

  applyCameraPreset(preset: ArtifactCameraPreset, immediate = false): void {
    if (this.disposed) return;
    const toTarget = new THREE.Vector3(...preset.target);
    const toPosition = new THREE.Vector3(...preset.position);
    if (this.annotationViewport.width < this.annotationViewport.height) {
      const offset = toPosition.sub(toTarget);
      const distance = offset.length() * PORTRAIT_REVIEW_CAMERA_DISTANCE_SCALE;
      const horizontalDirection = new THREE.Vector2(offset.x, offset.z).normalize();
      const horizontalDistance = distance * Math.cos(PORTRAIT_REVIEW_CAMERA_ELEVATION);
      toTarget.x -= horizontalDirection.y * PORTRAIT_REVIEW_CAMERA_LATERAL_SHIFT;
      toTarget.z += horizontalDirection.x * PORTRAIT_REVIEW_CAMERA_LATERAL_SHIFT;
      toPosition.set(
        toTarget.x + horizontalDirection.x * horizontalDistance,
        toTarget.y + distance * Math.sin(PORTRAIT_REVIEW_CAMERA_ELEVATION),
        toTarget.z + horizontalDirection.y * horizontalDistance,
      );
    }
    if (immediate) {
      this.cameraTween = undefined;
      this.camera.position.copy(toPosition);
      this.controls.target.copy(toTarget);
      this.camera.lookAt(toTarget);
      this.controls.update();
      return;
    }
    this.cameraTween = {
      startedAtMs: this.now(),
      fromPosition: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPosition,
      toTarget,
    };
  }

  render(timestampMs = this.now()): boolean {
    if (this.disposed || this.stopped) return false;
    const cameraWasMoving = this.cameraTween !== undefined;
    try {
      this.updateCameraTween(timestampMs);
      this.controls.update();
      this.camera.lookAt(this.controls.target);
      this.camera.rotateZ(REVIEW_CAMERA_ROLL_RADIANS);
      this.camera.userData.v10HeroRollRadians = REVIEW_CAMERA_ROLL_RADIANS;
      this.renderer.render(this.scene, this.camera);
      return cameraWasMoving && this.cameraTween === undefined;
    } catch (error) {
      this.restoreRingGesture();
      this.stopped = true;
      this.callbacks.onError(error);
      return false;
    }
  }

  private updateCameraTween(timestampMs: number): void {
    const tween = this.cameraTween;
    if (!tween) return;
    const rawProgress = Math.min(1, Math.max(0, (timestampMs - tween.startedAtMs) / CAMERA_TWEEN_DURATION_MS));
    const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
    this.camera.position.lerpVectors(tween.fromPosition, tween.toPosition, progress);
    this.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, progress);
    if (rawProgress === 1) this.cameraTween = undefined;
  }

  private configureInteractionRing(): void {
    this.interactionRing.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.transparent = true;
        material.opacity = 0;
        material.colorWrite = false;
        material.depthWrite = false;
        material.needsUpdate = true;
      }
    });
  }

  private centerJadePlate(): void {
    for (const id of ["plate/heaven", "plate/generals", "plate/core"]) {
      const object = this.artifact.nodes.get(id);
      if (!object) continue;
      object.position.x = 0;
      object.position.z = 0;
    }
    const branchCenter = new THREE.Vector2();
    for (const mesh of this.branchMeshes.values()) {
      branchCenter.x += mesh.position.x;
      branchCenter.y += mesh.position.z;
    }
    branchCenter.multiplyScalar(1 / this.branchMeshes.size);
    for (const mesh of this.branchMeshes.values()) {
      mesh.position.x -= branchCenter.x;
      mesh.position.z -= branchCenter.y;
    }
  }

  private harmonizeJadeSurfaces(): void {
    const pearlJade = new THREE.MeshPhysicalMaterial({
      name: "runtime/pearl-jade",
      color: 0xf5f1e8,
      metalness: 0,
      roughness: 0.2,
      transmission: 0,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      ior: 1.46,
      clearcoat: 0.16,
      clearcoatRoughness: 0.24,
    });
    this.artifact.root.traverse((object) => {
      if (object instanceof THREE.Mesh && (
        object.userData.surface_treatment === "general-seat-recess"
        || object.name.includes("general-recess/")
        || object.userData.visual_role === "generals"
      )) {
        object.visible = false;
      }
      if (object instanceof THREE.Mesh
        && object.userData.domain === "general"
        && typeof object.userData.node_id === "string"
        && object.userData.node_id.startsWith("general/")) {
        const hideCarrier = (material: THREE.Material) => {
          const hidden = material.clone();
          hidden.visible = false;
          return hidden;
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(hideCarrier)
          : hideCarrier(object.material);
      }
      if (object instanceof THREE.Mesh && (
        object.userData.visual_role === "corner-pearl"
        || /corner-pearl-\d+$/.test(object.name)
      )) {
        object.material = pearlJade;
      }
    });
  }

  private bindJadeTextMaterials(): void {
    this.artifact.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const textRole = object.userData.text_role;
      if (textRole !== "month-general" && textRole !== "general-name") return;
      if (!(object.material instanceof THREE.MeshStandardMaterial)) {
        throw new Error(`Invalid jade text material on ${object.name}`);
      }
      const nodeId = textRole === "month-general"
        ? object.userData.node_id
        : this.ancestorNodeId(object, "general/");
      if (typeof nodeId !== "string") throw new Error(`Missing jade text owner on ${object.name}`);
      const originalMaterial = object.material;
      const material = originalMaterial.clone();
      object.material = material;
      const binding: TextMaterialBinding = {
        mesh: object,
        originalMaterial,
        material,
        originalColor: originalMaterial.color.clone(),
        originalMetalness: originalMaterial.metalness,
        originalRoughness: originalMaterial.roughness,
        nodeId,
      };
      (textRole === "month-general" ? this.monthGlyphMaterials : this.generalNameMaterials).set(nodeId, binding);
    });
  }

  private applyTextColor(binding: TextMaterialBinding | undefined, progress: number): void {
    if (!binding) return;
    const amount = Math.min(1, Math.max(0, progress));
    binding.material.color.lerpColors(binding.originalColor, OLD_GOLD, amount);
    binding.material.metalness = THREE.MathUtils.lerp(binding.originalMetalness, 1, amount);
    binding.material.roughness = THREE.MathUtils.lerp(binding.originalRoughness, 0.38, amount);
  }

  private restoreTransform(id: string, object: THREE.Object3D): void {
    const base = this.baseTransforms.get(id);
    if (!base) return;
    object.position.copy(base.position);
    object.quaternion.copy(base.quaternion);
    object.scale.copy(base.scale);
  }

  private ancestorNodeId(object: THREE.Object3D, prefix: string): string | undefined {
    let current: THREE.Object3D | null = object;
    while (current) {
      const nodeId = current.userData.node_id;
      if (typeof nodeId === "string" && nodeId.startsWith(prefix)) return nodeId;
      current = current.parent;
    }
    return undefined;
  }

  private startRingGesture(event: PointerEvent): void {
    if (!this.interactionEnabled || this.activeRingGesture) return;
    try {
      const angleRad = this.angleFromPointer(event, true);
      if (angleRad === undefined) return;
      const nowMs = this.now();
      this.activeRingGesture = {
        pointerId: event.pointerId,
        angleRad,
        atMs: nowMs,
        controlsEnabled: this.controls.enabled,
      };
      this.controls.enabled = false;
      this.renderer.domElement.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopImmediatePropagation();
      this.emitMonthGeneralInput({ type: "drag-start", angleRad, nowMs });
    } catch (error) {
      this.restoreRingGesture();
      this.callbacks.onError(error);
    }
  }

  private moveRingGesture(event: PointerEvent): void {
    const gesture = this.activeRingGesture;
    if (!this.interactionEnabled || !gesture || event.pointerId !== gesture.pointerId) return;
    try {
      const angleRad = this.angleFromPointer(event, false);
      if (angleRad === undefined) return;
      const nowMs = this.now();
      gesture.angleRad = angleRad;
      gesture.atMs = nowMs;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.emitMonthGeneralInput({ type: "drag-move", angleRad, nowMs });
    } catch (error) {
      this.restoreRingGesture();
      this.callbacks.onError(error);
    }
  }

  private endRingGesture(event: PointerEvent, cancelled = false): void {
    const gesture = this.activeRingGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    try {
      const angleRad = this.angleFromPointer(event, false) ?? gesture.angleRad;
      const nowMs = this.now();
      const elapsedMs = Math.max(1, nowMs - gesture.atMs);
      const delta = Math.atan2(Math.sin(angleRad - gesture.angleRad), Math.cos(angleRad - gesture.angleRad));
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.interactionEnabled) {
        this.emitMonthGeneralInput({
          type: "drag-end",
          angularVelocityRadMs: cancelled ? 0 : delta / elapsedMs,
          nowMs,
        });
      }
    } catch (error) {
      this.callbacks.onError(error);
    } finally {
      this.restoreRingGesture();
    }
  }

  private restoreRingGesture(): void {
    const gesture = this.activeRingGesture;
    if (!gesture) return;
    this.activeRingGesture = undefined;
    this.controls.enabled = gesture.controlsEnabled;
    this.renderer.domElement.releasePointerCapture?.(gesture.pointerId);
  }

  private angleFromPointer(event: PointerEvent, requireRingHit: boolean): number | undefined {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return undefined;
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.artifact.root.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    this.interactionRaycaster.setFromCamera(this.pointer, this.camera);
    if (requireRingHit && this.interactionRaycaster.intersectObject(this.interactionRing, true).length === 0) return undefined;
    const heaven = this.artifact.nodes.get("plate/heaven");
    const center = heaven?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y);
    return angleOnPlatePlane(this.interactionRaycaster.ray, plane, center);
  }

  private emitMonthGeneralInput(event: MonthGeneralInputEvent): void {
    this.callbacks.onMonthGeneralInput?.(event);
  }

  private isNodeOrDescendant(candidate: THREE.Object3D, node: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = candidate;
    while (current) {
      if (current === node) return true;
      current = current.parent;
    }
    return false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopped = true;
    this.restoreRingGesture();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown, RING_CAPTURE_OPTIONS);
    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove, RING_CAPTURE_OPTIONS);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp, RING_CAPTURE_OPTIONS);
    this.renderer.domElement.removeEventListener("pointercancel", this.handlePointerCancel, RING_CAPTURE_OPTIONS);
    this.renderer.domElement.removeEventListener("wheel", this.handleWheel, WHEEL_CAPTURE_OPTIONS);
    this.renderer.domElement.removeEventListener("keydown", this.handleKeyDown);
    this.controls.removeEventListener("start", this.handleControlStart);
    this.controls.dispose();

    for (const binding of this.labelBindings.values()) {
      if (binding.texture) this.labels.release(binding.texture);
      binding.material.map = null;
      binding.material.dispose();
      binding.mesh.material = binding.originalMaterial;
    }
    for (const binding of [...this.monthGlyphMaterials.values(), ...this.generalNameMaterials.values()]) {
      binding.mesh.material = binding.originalMaterial;
      binding.material.dispose();
    }
    this.courseTraceMesh.material = this.courseTraceOriginalMaterial;
    this.courseTraceMaterial.dispose();
    this.labels.dispose();
    this.stoneGround.geometry.dispose();
    this.stoneGround.material.dispose();
    this.scene.environment = null;
    this.environment.dispose();
    disposeArtifact(this.artifact.root);
    this.renderer.dispose();
  }

  private bindLabel(dynamicId: string, descriptor: LabelDescriptor): void {
    const binding = this.labelBindings.get(dynamicId);
    if (!binding) return;
    const texture = this.labels.acquire(descriptor);
    const previous = binding.texture;
    binding.texture = texture;
    binding.material.map = texture;
    binding.material.needsUpdate = true;
    if (previous) this.labels.release(previous);
  }

  private captureAppliedState(pose: ArtifactPose): ArtifactAppliedState {
    const nodes: Record<string, ArtifactAppliedState["nodes"][string]> = {};
    for (const id of Object.keys(pose.nodes)) {
      const object = this.artifact.nodes.get(id);
      if (!object) continue;
      nodes[id] = {
        position: object.position.toArray() as [number, number, number],
        quaternion: object.quaternion.toArray() as [number, number, number, number],
        scale: object.scale.toArray() as [number, number, number],
        visible: object.visible,
      };
    }
    const labelOpacity = Object.fromEntries(
      [...this.labelBindings].map(([dynamicId, binding]) => [dynamicId, binding.material.opacity]),
    );
    return {
      nodes,
      labelOpacity,
      courseTraceOpacity: this.courseTraceMaterial.opacity,
    };
  }
}
