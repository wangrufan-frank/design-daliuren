import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EARTHLY_BRANCHES } from "../../../domain/calendar/constants";
import type { EarthlyBranch } from "../../../domain/chart/types";
import type { ArtifactDisplayState } from "../model/types";
import type { ArtifactPose } from "../timeline/types";
import { disposeArtifact } from "./dispose-artifact";
import type { LoadedArtifact } from "./load-artifact";
import {
  LabelTextureCache,
  type LabelDescriptor,
} from "./dynamic-labels";

interface ArtifactSceneCallbacks {
  onUserControlStart(): void;
  onContextLost(): void;
  onError(error: unknown): void;
}

interface ControlsLike {
  target: THREE.Vector3;
  autoRotate: boolean;
  addEventListener(type: "start", listener: () => void): void;
  removeEventListener(type: "start", listener: () => void): void;
  update(): void;
  dispose(): void;
}

interface ArtifactSceneDependencies {
  createControls(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): ControlsLike;
  createEnvironment(renderer: THREE.WebGLRenderer): { texture: THREE.Texture; dispose(): void };
}

interface BaseTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface LabelBinding {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  material: THREE.MeshBasicMaterial;
  texture?: THREE.CanvasTexture;
}

type CopyKey = keyof ArtifactPose["copy"];

interface CopyBinding {
  anchorPosition: THREE.Vector3;
  sourceNodeIds: readonly string[];
  surface: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  sourceLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  texture?: THREE.CanvasTexture;
}

export interface ArtifactAppliedState {
  nodes: Readonly<Record<string, Readonly<{
    position: readonly [number, number, number];
    quaternion: readonly [number, number, number, number];
    scale: readonly [number, number, number];
  }>>>;
  copy: ArtifactPose["copy"];
  generalDirection: ArtifactPose["generalDirection"];
  generalSequence: ArtifactPose["generalSequence"];
  cameraOrbitRequested: boolean;
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

const LABEL_SIZE = { width: 512, height: 256 } as const;
const CALENDAR_LABEL_SIZE = { width: 1024, height: 256 } as const;
const COPY_LABEL_SIZE = { width: 1024, height: 512 } as const;
const DAY_NIGHT_TEXT = { day: "昼", night: "夜" } as const;
const COPY_BINDINGS = {
  lessons: {
    anchorId: "anchor/course-copy/lessons",
    sourceNodeIds: ["lesson/first", "lesson/second", "lesson/third", "lesson/fourth"],
  },
  transmissions: {
    anchorId: "anchor/course-copy/transmissions",
    sourceNodeIds: ["transmission/initial", "transmission/middle", "transmission/final"],
  },
  generals: {
    anchorId: "anchor/course-copy/generals",
    sourceNodeIds: GENERAL_SLOT_NODE_IDS,
  },
} as const satisfies Record<CopyKey, { anchorId: string; sourceNodeIds: readonly string[] }>;

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
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20);
  private readonly controls: ControlsLike;
  private readonly environment: ReturnType<ArtifactSceneDependencies["createEnvironment"]>;
  private readonly baseTransforms = new Map<string, BaseTransform>();
  private readonly generalSlots = new Map<EarthlyBranch, BaseTransform>();
  private readonly labelBindings = new Map<string, LabelBinding>();
  private readonly copyBindings = new Map<CopyKey, CopyBinding>();
  private readonly labels: LabelTextureCache;
  private readonly copyGeometry = new THREE.PlaneGeometry(0.16, 0.072);
  private readonly generalDirectionGeometry = new THREE.BufferGeometry();
  private readonly generalDirectionMaterial = new THREE.LineBasicMaterial({
    color: 0xb7a36b,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  private readonly generalDirectionLine = new THREE.Line(
    this.generalDirectionGeometry,
    this.generalDirectionMaterial,
  );
  private readonly initialCameraPosition = new THREE.Vector3(0.56, 0.44, 0.56);
  private readonly initialTarget = new THREE.Vector3(0, 0, 0);
  private stopped = false;
  private disposed = false;

  private readonly handleControlStart = () => this.callbacks.onUserControlStart();
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
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMappingExposure = 1.18;
    this.scene.background = new THREE.Color(0xdce5df);
    this.environment = dependencies.createEnvironment(renderer);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 1.25;
    this.scene.add(artifact.root);

    const keyLight = new THREE.DirectionalLight(0xffd7b0, 1.35);
    keyLight.position.set(0.5, 0.75, 0.45);
    const fillLight = new THREE.HemisphereLight(0x879b92, 0x26322f, 0.65);
    const rimLight = new THREE.DirectionalLight(0xc2c6bb, 0.75);
    rimLight.position.set(-0.55, 0.28, -0.5);
    this.scene.add(keyLight, fillLight, rimLight);

    this.camera.position.copy(this.initialCameraPosition);
    this.camera.lookAt(this.initialTarget);
    this.controls = dependencies.createControls(this.camera, renderer.domElement);
    this.controls.target.copy(this.initialTarget);
    this.controls.autoRotate = false;
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
    EARTHLY_BRANCHES.forEach((earth, index) => {
      const transform = this.baseTransforms.get(GENERAL_SLOT_NODE_IDS[index]);
      if (transform) this.generalSlots.set(earth, transform);
    });

    this.labels = new LabelTextureCache(renderer.capabilities.getMaxAnisotropy());
    artifact.root.traverse((object) => {
      const dynamicId = object.userData.dynamic_label_id;
      if (!(object instanceof THREE.Mesh) || typeof dynamicId !== "string") return;
      const originalMaterial = object.material;
      const material = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      object.material = material;
      this.labelBindings.set(dynamicId, { mesh: object, originalMaterial, material });
    });
    artifact.root.updateMatrixWorld(true);
    for (const [key, definition] of Object.entries(COPY_BINDINGS) as [CopyKey, typeof COPY_BINDINGS[CopyKey]][]) {
      const anchor = artifact.nodes.get(definition.anchorId);
      if (!anchor) continue;
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const surface = new THREE.Mesh(this.copyGeometry, material);
      surface.name = `artifact-copy-${key}`;
      surface.rotation.x = -Math.PI / 2;
      surface.visible = false;
      anchor.add(surface);
      const sourceLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0x879b92, transparent: true, opacity: 0, depthWrite: false }),
      );
      sourceLine.name = `artifact-source-line-${key}`;
      sourceLine.visible = false;
      this.scene.add(sourceLine);
      this.copyBindings.set(key, {
        anchorPosition: anchor.getWorldPosition(new THREE.Vector3()).clone(),
        sourceNodeIds: definition.sourceNodeIds,
        surface,
        sourceLine,
      });
    }
    this.generalDirectionLine.name = "artifact-general-direction";
    this.generalDirectionLine.visible = false;
    this.scene.add(this.generalDirectionLine);
  }

  resize(width: number, height: number, dpr: number): void {
    if (this.disposed) return;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
  }

  setDisplayState(state: ArtifactDisplayState): void {
    if (this.disposed) return;
    try {
      const calendarMarker = state.calendar.manualFields.length > 0 ? "manual" : undefined;
      this.bindLabel("dynamic/calendar", {
        text: `${state.calendar.pillars.join("　")}\n月建${state.calendar.monthBuild}　月将${state.calendar.monthGeneral}${state.calendar.monthGeneralBranch}　占时${state.calendar.divinationHour}　${DAY_NIGHT_TEXT[state.noble.dayNight]}贵${state.noble.nobleHeaven}`,
        style: "celadon",
        ...CALENDAR_LABEL_SIZE,
        marker: calendarMarker,
      });
      for (const lesson of state.lessons) {
        this.bindLabel(`dynamic/lesson/${lesson.id}`, {
          text: `${lesson.label}\n${lesson.general}　${lesson.upper}/${lesson.lower.value}　查地盘${lesson.lookupEarth}`,
          style: "ash",
          ...LABEL_SIZE,
        });
      }
      for (const transmission of state.transmissions) {
        this.bindLabel(`dynamic/transmission/${transmission.position}`, {
          text: `${transmission.label}\n${transmission.general}　${transmission.branch}　${transmission.relation}`,
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
          text: `${placement.general}\n${placement.heaven}/${placement.earth}`,
          style: placement.general === "贵人" ? "old-gold" : "ash",
          ...LABEL_SIZE,
          marker: placement.general === "贵人" ? "noble" : undefined,
        });
      }
      this.bindCopyLabel("lessons", {
        text: state.lessons.map((lesson) => `${lesson.label} ${lesson.upper}/${lesson.lower.value} 查${lesson.lookupEarth}`).join("　"),
        style: "ash",
        ...COPY_LABEL_SIZE,
      });
      this.bindCopyLabel("transmissions", {
        text: state.transmissions.map((item) => `${item.label} ${item.branch} ${item.relation}`).join("　"),
        style: "celadon",
        ...COPY_LABEL_SIZE,
      });
      this.bindCopyLabel("generals", {
        text: state.generals.map((item) => `${item.general}${item.earth}`).join("　"),
        style: "old-gold",
        ...COPY_LABEL_SIZE,
        marker: state.noble.direction === "forward" ? "direction-forward" : "direction-reverse",
      });
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
      object.position.add(new THREE.Vector3(delta.translationX, delta.translationY, delta.translationZ));
      object.rotateZ(delta.rotationZ);
    }
    for (const key of Object.keys(COPY_BINDINGS) as CopyKey[]) this.applyCopyPose(key, pose.copy[key]);
    this.applyGeneralDirection(pose);
    this.controls.autoRotate = pose.cameraOrbitRequested;
    return this.captureAppliedState(pose);
  }

  focusNode(nodeId: string): void {
    if (this.disposed) return;
    const object = this.artifact.nodes.get(nodeId);
    if (!object) {
      this.callbacks.onError(new Error(`Unknown artifact node: ${nodeId}`));
      return;
    }
    const target = object.getWorldPosition(new THREE.Vector3());
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
  }

  resetCamera(): void {
    if (this.disposed) return;
    this.camera.position.copy(this.initialCameraPosition);
    this.controls.target.copy(this.initialTarget);
    this.camera.lookAt(this.initialTarget);
    this.controls.update();
  }

  render(): void {
    if (this.disposed || this.stopped) return;
    try {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      this.stopped = true;
      this.callbacks.onError(error);
    }
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
    for (const binding of this.copyBindings.values()) {
      if (binding.texture) this.labels.release(binding.texture);
      binding.surface.removeFromParent();
      binding.sourceLine.removeFromParent();
      binding.surface.material.map = null;
      binding.surface.material.dispose();
      binding.sourceLine.geometry.dispose();
      binding.sourceLine.material.dispose();
    }
    this.copyGeometry.dispose();
    this.generalDirectionLine.removeFromParent();
    this.generalDirectionGeometry.dispose();
    this.generalDirectionMaterial.dispose();
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

  private bindCopyLabel(key: CopyKey, descriptor: LabelDescriptor): void {
    const binding = this.copyBindings.get(key);
    if (!binding) return;
    const texture = this.labels.acquire(descriptor);
    const previous = binding.texture;
    binding.texture = texture;
    binding.surface.material.map = texture;
    binding.surface.material.needsUpdate = true;
    if (previous) this.labels.release(previous);
  }

  private applyCopyPose(key: CopyKey, pose: ArtifactPose["copy"][CopyKey]): void {
    const binding = this.copyBindings.get(key);
    if (!binding) return;
    binding.surface.material.opacity = pose.opacity;
    binding.surface.visible = pose.opacity > 0;
    const source = this.sourceCenter(binding.sourceNodeIds);
    const endpoint = source.clone().lerp(binding.anchorPosition, pose.sourceLineProgress);
    const positions = binding.sourceLine.geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.setXYZ(0, source.x, source.y, source.z);
    positions.setXYZ(1, endpoint.x, endpoint.y, endpoint.z);
    positions.needsUpdate = true;
    binding.sourceLine.material.opacity = pose.sourceLineOpacity;
    binding.sourceLine.visible = pose.sourceLineOpacity > 0 && pose.sourceLineProgress > 0;
  }

  private sourceCenter(nodeIds: readonly string[]): THREE.Vector3 {
    const center = new THREE.Vector3();
    let count = 0;
    this.artifact.root.updateMatrixWorld(true);
    for (const nodeId of nodeIds) {
      const object = this.artifact.nodes.get(nodeId);
      if (!object) continue;
      center.add(object.getWorldPosition(new THREE.Vector3()));
      count += 1;
    }
    return count > 0 ? center.multiplyScalar(1 / count) : center;
  }

  private applyGeneralDirection(pose: ArtifactPose): void {
    this.artifact.root.updateMatrixWorld(true);
    const points = pose.generalSequence.flatMap((nodeId) => {
      const object = this.artifact.nodes.get(nodeId);
      return object ? [object.getWorldPosition(new THREE.Vector3())] : [];
    });
    const deployedCount = pose.generalSequence.filter(
      (nodeId) => Math.abs(pose.nodes[nodeId]?.translationZ ?? 0) > Number.EPSILON,
    ).length;
    this.generalDirectionGeometry.setFromPoints(points);
    this.generalDirectionLine.visible = points.length > 1
      && deployedCount > 0
      && deployedCount < pose.generalSequence.length;
    this.generalDirectionLine.userData.sequence = [...pose.generalSequence];
    this.generalDirectionLine.userData.direction = pose.generalDirection;
    this.generalDirectionMaterial.color.setHex(pose.generalDirection === "forward" ? 0x879b92 : 0xb7a36b);
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
      };
    }
    const copy = Object.fromEntries((Object.keys(COPY_BINDINGS) as CopyKey[]).map((key) => {
      const binding = this.copyBindings.get(key);
      if (!binding) return [key, { opacity: 0, sourceLineProgress: 0, sourceLineOpacity: 0 }];
      const positions = binding.sourceLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      const source = new THREE.Vector3(positions.getX(0), positions.getY(0), positions.getZ(0));
      const endpoint = new THREE.Vector3(positions.getX(1), positions.getY(1), positions.getZ(1));
      const fullDistance = source.distanceTo(binding.anchorPosition);
      return [key, {
        opacity: binding.surface.material.opacity,
        sourceLineProgress: fullDistance > 0 ? source.distanceTo(endpoint) / fullDistance : 0,
        sourceLineOpacity: binding.sourceLine.material.opacity,
      }];
    })) as unknown as ArtifactPose["copy"];
    return {
      nodes,
      copy,
      generalDirection: this.generalDirectionLine.userData.direction ?? pose.generalDirection,
      generalSequence: Object.freeze([...(this.generalDirectionLine.userData.sequence ?? pose.generalSequence)]),
      cameraOrbitRequested: this.controls.autoRotate,
    };
  }
}
