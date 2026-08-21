import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
  addEventListener(type: "start", listener: () => void): void;
  removeEventListener(type: "start", listener: () => void): void;
  update(): void;
  dispose(): void;
}

interface ArtifactSceneDependencies {
  createControls(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement): ControlsLike;
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

function defaultDependencies(): ArtifactSceneDependencies {
  return { createControls: (camera, canvas) => new OrbitControls(camera, canvas) };
}

export class ArtifactSceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 20);
  private readonly controls: ControlsLike;
  private readonly baseTransforms = new Map<string, BaseTransform>();
  private readonly generalSlots = new Map<EarthlyBranch, BaseTransform>();
  private readonly labelBindings = new Map<string, LabelBinding>();
  private readonly labels: LabelTextureCache;
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
    this.scene.background = new THREE.Color(0x121817);
    this.scene.add(artifact.root);

    const key = new THREE.DirectionalLight(0xffd7b0, 1);
    key.position.set(0.5, 0.75, 0.45);
    const fill = new THREE.HemisphereLight(0x879b92, 0x26322f, 0.3);
    const rim = new THREE.DirectionalLight(0xc2c6bb, 0.18);
    rim.position.set(-0.55, 0.28, -0.5);
    this.scene.add(key, fill, rim);

    this.camera.position.copy(this.initialCameraPosition);
    this.camera.lookAt(this.initialTarget);
    this.controls = dependencies.createControls(this.camera, renderer.domElement);
    this.controls.target.copy(this.initialTarget);
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

    artifact.root.traverse((object) => {
      const dynamicId = object.userData.dynamic_label_id;
      if (!(object instanceof THREE.Mesh) || typeof dynamicId !== "string") return;
      const originalMaterial = object.material;
      const material = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      object.material = material;
      this.labelBindings.set(dynamicId, { mesh: object, originalMaterial, material });
    });
    this.labels = new LabelTextureCache(renderer.capabilities.getMaxAnisotropy());
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
        text: `${state.calendar.pillars.join("　")}\n月建${state.calendar.monthBuild}　月将${state.calendar.monthGeneral}　占时${state.calendar.divinationHour}`,
        style: "celadon",
        ...CALENDAR_LABEL_SIZE,
        marker: calendarMarker,
      });
      for (const lesson of state.lessons) {
        this.bindLabel(`dynamic/lesson/${lesson.id}`, {
          text: `${lesson.label}\n${lesson.general}　${lesson.upper}/${lesson.lower.value}`,
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
    } catch (error) {
      this.callbacks.onError(error);
    }
  }

  applyPose(pose: ArtifactPose): void {
    if (this.disposed) return;
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
        object.position.copy(targetSlot.position);
        object.quaternion.copy(targetSlot.quaternion);
        object.scale.copy(targetSlot.scale);
      }
      object.position.add(new THREE.Vector3(delta.translationX, delta.translationY, delta.translationZ));
      object.rotateZ(delta.rotationZ);
    }
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
    this.labels.dispose();
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
}
