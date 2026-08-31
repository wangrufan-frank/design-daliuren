import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EARTHLY_BRANCHES } from "../../../domain/calendar/constants";
import type { EarthlyBranch } from "../../../domain/chart/types";
import type { ArtifactDisplayState } from "../model/types";
import { formatVoidBranch, VOID_SURFACE_COLORS, type VoidSurface } from "../model/format-void-branch";
import type { ArtifactPose } from "../timeline/types";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "../annotations/descriptors";
import { projectArtifactAnnotations } from "../annotations/project-annotations";
import type { ArtifactAnnotationId, ProjectedAnchor } from "../annotations/types";
import { disposeArtifact } from "./dispose-artifact";
import type { LoadedArtifact } from "./load-artifact";
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
}

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
const GENERAL_SLOT_NODE_IDS = [
  "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
  "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger",
  "general/constant", "general/black-tortoise", "general/yin", "general/queen-of-heaven",
] as const;
const ANNOTATION_DESCRIPTORS_BY_ID = new Map(
  ARTIFACT_ANNOTATION_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor]),
);
const CAMERA_TWEEN_DURATION_MS = 700;
const PORTRAIT_REVIEW_CAMERA_DISTANCE_SCALE = 1.56;
const PORTRAIT_REVIEW_CAMERA_ELEVATION = THREE.MathUtils.degToRad(60);
const PORTRAIT_REVIEW_CAMERA_LATERAL_SHIFT = 0.016;

const LABEL_SIZE = { width: 512, height: 256 } as const;
const CALENDAR_LABEL_SIZE = { width: 1024, height: 256 } as const;
const DAY_NIGHT_TEXT = { day: "昼", night: "夜" } as const;
const REFERENCE_REPLACED_PREFIXES = (
  ["branch/", "divider/", "detail/branch-bed/", "inscription/"] as const
);

function isReplacedByReferenceSurface(object: THREE.Object3D): boolean {
  const nodeId = typeof object.userData.node_id === "string" ? object.userData.node_id : "";
  return object.userData.detail_id === "structure/bronze-inlay-branch-bed"
    || typeof object.userData.inscription_role === "string"
    || ["_divider_", "_detail_branch-bed_", "_inscription_"].some((token) => object.name.includes(token))
    || REFERENCE_REPLACED_PREFIXES.some((prefix) => (
    object.name.startsWith(prefix)
    || object.name.includes(`/${prefix}`)
    || nodeId.startsWith(prefix)
    ));
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

export class ArtifactSceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.05, 4);
  private readonly controls: ControlsLike;
  private readonly environment: ReturnType<ArtifactSceneDependencies["createEnvironment"]>;
  private readonly baseTransforms = new Map<string, BaseTransform>();
  private readonly generalSlots = new Map<EarthlyBranch, BaseTransform>();
  private readonly labelBindings = new Map<string, LabelBinding>();
  private readonly branchMeshes = new Map<string, THREE.Mesh>();
  private readonly branchMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly branchOriginalMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly branchNormalColors = new Map<string, THREE.Color>();
  private readonly courseTraceMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly courseTraceMaterial: THREE.MeshStandardMaterial;
  private readonly courseTraceOriginalMaterial: THREE.MeshStandardMaterial;
  private readonly labels: LabelTextureCache;
  private readonly initialCameraPosition = new THREE.Vector3(0.62, 0.58, 0.78);
  private readonly initialTarget = new THREE.Vector3(0, 0.05, 0);
  private readonly now: () => number;
  private readonly annotationRaycaster = new THREE.Raycaster();
  private readonly reportedAnnotationErrors = new Set<ArtifactAnnotationId>();
  private annotationViewport = { width: 1, height: 1 };
  private cameraTween: CameraTween | undefined;
  private stopped = false;
  private disposed = false;

  private readonly handleControlStart = () => {
    this.cameraTween = undefined;
    this.callbacks.onUserControlStart();
  };
  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    this.stopped = true;
    this.callbacks.onContextLost();
  };

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly artifact: LoadedArtifact,
    private readonly callbacks: ArtifactSceneCallbacks,
    dependencies: ArtifactSceneDependencies = defaultDependencies(),
  ) {
    const branchEntries: Array<readonly [string, THREE.Mesh, THREE.MeshStandardMaterial]> = [];
    for (const surface of ["earth", "heaven"] as const) {
      for (const branch of EARTHLY_BRANCHES) {
        const id = `branch/${surface}/${branch}`;
        const mesh = artifact.nodes.get(id);
        const material = mesh instanceof THREE.Mesh ? mesh.material : undefined;
        if (!(mesh instanceof THREE.Mesh) || !(material instanceof THREE.MeshStandardMaterial)) {
          throw new Error(`Invalid branch inlay ${id}`);
        }
        branchEntries.push([id, mesh, material]);
      }
    }
    const courseTrace = artifact.nodes.get("trace/course");
    const courseTraceOriginalMaterial = courseTrace instanceof THREE.Mesh ? courseTrace.material : undefined;
    if (!(courseTrace instanceof THREE.Mesh)
      || !(courseTraceOriginalMaterial instanceof THREE.MeshStandardMaterial)) {
      throw new Error("Invalid course trace trace/course");
    }

    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMappingExposure = 0.72;
    this.scene.background = new THREE.Color(0x8b8984);
    this.environment = dependencies.createEnvironment(renderer);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.45;
    artifact.root.traverse((object) => {
      if (object instanceof THREE.Mesh && isReplacedByReferenceSurface(object)) {
        object.visible = false;
      }
    });
    this.scene.add(artifact.root);
    this.now = dependencies.now ?? (() => performance.now());

    const keyLight = new THREE.DirectionalLight(0xfff4df, 1.35);
    keyLight.position.set(-0.65, 0.95, 0.7);
    const fillLight = new THREE.HemisphereLight(0xdfe5df, 0x615d57, 0.78);
    const sideFill = new THREE.DirectionalLight(0xc8d8d1, 0.45);
    sideFill.position.set(0.75, 0.5, 0.35);
    const rimLight = new THREE.DirectionalLight(0xf3dba8, 0.55);
    rimLight.position.set(-0.5, 0.8, -0.7);
    this.scene.add(keyLight, fillLight, sideFill, rimLight);

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
    renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost);

    for (const [id, object] of artifact.nodes) {
      this.baseTransforms.set(id, {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      });
    }
    for (const [id, mesh, originalMaterial] of branchEntries) {
      const material = originalMaterial.clone();
      mesh.material = material;
      this.branchMeshes.set(id, mesh);
      this.branchMaterials.set(id, material);
      this.branchOriginalMaterials.set(id, originalMaterial);
      this.branchNormalColors.set(id, originalMaterial.color.clone());
    }
    this.courseTraceMesh = courseTrace as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    this.courseTraceOriginalMaterial = courseTraceOriginalMaterial;
    this.courseTraceMaterial = courseTraceOriginalMaterial.clone();
    this.courseTraceMaterial.transparent = true;
    this.courseTraceMaterial.opacity = 0;
    this.courseTraceMaterial.depthWrite = true;
    this.courseTraceMesh.material = this.courseTraceMaterial;
    EARTHLY_BRANCHES.forEach((earth, index) => {
      const transform = this.baseTransforms.get(GENERAL_SLOT_NODE_IDS[index]);
      if (transform) this.generalSlots.set(earth, transform);
    });

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
    this.camera.updateProjectionMatrix();
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
      for (const surface of ["earth", "heaven"] as const) {
        for (const branch of EARTHLY_BRANCHES) {
          const id = `branch/${surface}/${branch}`;
          const material = this.branchMaterials.get(id)!;
          material.color.copy(this.branchNormalColors.get(id)!);
          if (state.calendar.voidBranches.includes(branch)) {
            material.color.set(VOID_SURFACE_COLORS[surface]);
          }
        }
      }
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
    for (const [dynamicId, binding] of this.labelBindings) {
      binding.material.opacity = pose.labelOpacity[dynamicId] ?? 1;
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
      this.renderer.render(this.scene, this.camera);
      return cameraWasMoving && this.cameraTween === undefined;
    } catch (error) {
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
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
    this.controls.removeEventListener("start", this.handleControlStart);
    this.controls.dispose();

    for (const binding of this.labelBindings.values()) {
      if (binding.texture) this.labels.release(binding.texture);
      binding.material.map = null;
      binding.material.dispose();
      binding.mesh.material = binding.originalMaterial;
    }
    for (const [id, mesh] of this.branchMeshes) {
      mesh.material = this.branchOriginalMaterials.get(id)!;
      this.branchMaterials.get(id)!.dispose();
    }
    this.courseTraceMesh.material = this.courseTraceOriginalMaterial;
    this.courseTraceMaterial.dispose();
    this.labels.dispose();
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
