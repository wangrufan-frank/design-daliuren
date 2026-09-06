import * as THREE from "three";
import type { AtlasId } from "../../features/element-atlas/entries";
import { mountAtlasPicking } from "../../features/artifact-scene/three/atlas-picking";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import { applyParityState } from "./apply-parity-state";
import { mountArtifactInteraction } from "./artifact-interaction";
import { decodeParityModel, type DecodedModelMaterial } from "./model-data";
import { frameParityArtifact } from "./parity-camera";
import { MODEL_PARITY_BUDGET, MODEL_PARITY_RUNTIME } from "./model-parity-contract";

export interface MountedArtifact { resize(): void; dispose(): void }

interface ArtifactTestCanvas extends HTMLCanvasElement {
  __setGeneralSurfaceVisibility?: (ownerId: string, visible: boolean) => void;
  __setHeavenRotation?: (rotationDelta: number) => void;
  __setHeavenSurfaceVisibility?: (visible: boolean) => void;
}

const EARTH_BOARD_MATERIAL = "RT_M_JadeBody_outer_board_v10";
const MATERIALS = {
  jade: { color: 0xf0eadd, roughness: 0.27, metalness: 0 },
  translucentJade: { color: 0xf5f1e8, roughness: 0.2, metalness: 0 },
  recess: { color: 0xadaaa0, roughness: 0.6, metalness: 0 },
  ink: { color: 0x171817, roughness: 0.7, metalness: 0 },
  cinnabar: { color: 0xb94732, roughness: 0.58, metalness: 0 },
  gold: { color: 0xb98a38, roughness: 0.38, metalness: 0.6 },
} as const;

function createMaterial(material: DecodedModelMaterial): THREE.MeshStandardMaterial {
  if (material.kind === "canvas-label") throw new Error("Canvas label materials are not supported by the parity model.");
  if (material.kind === "jade" || material.kind === "translucentJade") {
    return new THREE.MeshPhysicalMaterial({
      ...MATERIALS[material.kind],
      transmission: 0,
      transparent: false,
      opacity: 1,
      depthTest: true,
      depthWrite: true,
      ior: 1.46,
      clearcoat: material.kind === "translucentJade" ? 0.16 : 0.1,
      clearcoatRoughness: material.kind === "translucentJade" ? 0.24 : 0.28,
    });
  }
  return new THREE.MeshStandardMaterial(MATERIALS[material.kind]);
}

export function mountParityArtifact(
  canvas: HTMLCanvasElement,
  source: ArtifactSourceResults,
  textureUrl: string,
  onUnavailable: () => void,
  onReady: () => void = () => {},
  onAtlasSelect?: (id: AtlasId) => void,
): MountedArtifact {
  void source;
  const parts = window.__DALIUREN_MODEL_PARTS__;
  if (!parts) throw new Error("Parity model data is unavailable.");
  const model = decodeParityModel(parts);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "default" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0xd8d2c8, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8d2c8);
  const camera = new THREE.PerspectiveCamera(20.4268144654051, 1, 0.01, 4);
  const key = new THREE.DirectionalLight(0xfff7e8, 1.65);
  key.position.set(-0.65, 0.95, 0.7);
  const fill = new THREE.HemisphereLight(0xf1f3ef, 0x8f8981, 1.05);
  const sideFill = new THREE.DirectionalLight(0xdce9e3, 0.65);
  sideFill.position.set(0.75, 0.5, 0.35);
  const rim = new THREE.DirectionalLight(0xffe8bb, 0.7);
  rim.position.set(-0.5, 0.8, -0.7);
  scene.add(key, fill, sideFill, rim);

  const nodeObjects = new Map<string, THREE.Group>();
  for (const node of model.nodes.values()) {
    const object = new THREE.Group();
    object.name = node.id;
    object.userData.node_id = node.id;
    nodeObjects.set(node.id, object);
  }
  for (const node of model.nodes.values()) {
    const object = nodeObjects.get(node.id)!;
    const worldMatrix = new THREE.Matrix4().fromArray(node.matrix);
    if (node.parentId) {
      const parentNode = model.nodes.get(node.parentId);
      const parent = nodeObjects.get(node.parentId);
      if (!parentNode || !parent) throw new Error(`Missing parity model parent ${node.parentId}.`);
      const localMatrix = new THREE.Matrix4().fromArray(parentNode.matrix).invert().multiply(worldMatrix);
      localMatrix.decompose(object.position, object.quaternion, object.scale);
      parent.add(object);
    } else {
      worldMatrix.decompose(object.position, object.quaternion, object.scale);
      scene.add(object);
    }
  }

  const textureMeshes: THREE.Mesh[] = [];
  let boardTextureLoaded = false;
  let lifecycleState: "loading" | "ready" | "unavailable" | "disposed" = "loading";
  function unavailable() {
    if (lifecycleState === "unavailable" || lifecycleState === "disposed") return;
    lifecycleState = "unavailable";
    onUnavailable();
  }
  function revealArtifact() {
    if (lifecycleState !== "loading" || !boardTextureLoaded) return;
    lifecycleState = "ready";
    onReady();
  }
  const textureLoader = new THREE.TextureLoader();
  const boardTexture = textureLoader.load(
    textureUrl,
    () => {
      if (lifecycleState !== "loading") return;
      boardTextureLoaded = true;
      textureMeshes.forEach((mesh) => { mesh.visible = true; });
      revealArtifact();
    },
    undefined,
    () => {
      if (lifecycleState === "loading") unavailable();
    },
  );
  boardTexture.colorSpace = THREE.SRGBColorSpace;
  boardTexture.flipY = false;
  boardTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const decodedMaterials = new Map(model.materials.map((material) => [material.id, material]));
  const materials = new Map<string, THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  let solidMeshCount = 0;
  let generalMeshCount = 0;
  const hiddenMeshKeys = new Set(MODEL_PARITY_RUNTIME.hiddenMeshKeys);
  for (const meshData of model.meshes) {
    if (hiddenMeshKeys.has(`${meshData.nodeId}\0${meshData.materialId}`)) continue;
    const parent = nodeObjects.get(meshData.nodeId);
    const decodedMaterial = decodedMaterials.get(meshData.materialId);
    if (!parent || !decodedMaterial) throw new Error(`Invalid parity mesh ${meshData.nodeId}/${meshData.materialId}.`);
    let material = materials.get(meshData.materialId);
    if (!material) {
      material = meshData.materialId === EARTH_BOARD_MATERIAL
        ? new THREE.MeshStandardMaterial({ map: boardTexture, color: 0xffffff, roughness: 0.32, metalness: 0 })
        : createMaterial(decodedMaterial);
      materials.set(meshData.materialId, material);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(meshData.position, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(meshData.normal, 3));
    if (meshData.texcoord) geometry.setAttribute("uv", new THREE.BufferAttribute(meshData.texcoord, 2));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = meshData.nodeId;
    mesh.userData.node_id = meshData.nodeId;
    mesh.userData.material_id = meshData.materialId;
    if (meshData.materialId === EARTH_BOARD_MATERIAL) {
      mesh.visible = false;
      textureMeshes.push(mesh);
    }
    parent.add(mesh);
    solidMeshCount += 1;
    if (meshData.nodeId.startsWith("general/")) generalMeshCount += 1;
  }
  const applied = applyParityState(nodeObjects, source);
  canvas.dataset.courseTraceCount = String(applied.courseTracePoints.length);
  canvas.dataset.courseTraceTopology = applied.courseTracePoints.map(({ earth }) => earth).join(">");
  canvas.dataset.courseTraceEndpoints = applied.courseTracePoints.map(({ position }) => (
    `${position[0].toFixed(4)},${position[2].toFixed(4)}`
  )).join(">");
  canvas.dataset.generalPlacements = applied.generalSlots.map(({ nodeId, earth }) => `${nodeId}:${earth}`).join(">");
  const artifactRoot = nodeObjects.get("artifact/root");
  const heaven = nodeObjects.get("plate/heaven");
  if (!artifactRoot || !heaven) throw new Error("Parity artifact interaction nodes are unavailable.");
  const testCanvas = canvas as ArtifactTestCanvas;
  const visualTestEnabled = !import.meta.env.PROD
    || new URLSearchParams(window.location.search).get("visual-test") === "1";
  if (visualTestEnabled) {
    testCanvas.__setGeneralSurfaceVisibility = (ownerId, visible) => {
      const general = nodeObjects.get(ownerId);
      if (!general) throw new Error(`General ${ownerId} is unavailable.`);
      general.visible = visible;
    };
    testCanvas.__setHeavenRotation = (rotationDelta) => {
      heaven.rotation.y = applied.heavenAngleRad + rotationDelta;
      canvas.dataset.heavenSurfaceProjection = "rigid";
    };
    testCanvas.__setHeavenSurfaceVisibility = (visible) => {
      heaven.visible = visible;
    };
  }
  artifactRoot.updateMatrixWorld(true);
  const artifactBounds = new THREE.Box3().setFromObject(artifactRoot);
  const heavenBounds = new THREE.Box3().setFromObject(heaven);
  const generalBounds = new THREE.Box3();
  for (const { nodeId } of applied.generalSlots) {
    const general = nodeObjects.get(nodeId);
    if (general) generalBounds.expandByObject(general);
  }
  canvas.dataset.solidMeshCount = String(solidMeshCount);
  canvas.dataset.generalMeshCount = String(generalMeshCount);
  canvas.dataset.heavenThickness = String(heavenBounds.getSize(new THREE.Vector3()).y);
  canvas.dataset.generalThickness = String(generalBounds.getSize(new THREE.Vector3()).y);
  const heavenCenter = heaven.getWorldPosition(new THREE.Vector3());
  const heavenRadius = Math.max(
    Math.abs(heavenBounds.min.x - heavenCenter.x),
    Math.abs(heavenBounds.max.x - heavenCenter.x),
    Math.abs(heavenBounds.min.z - heavenCenter.z),
    Math.abs(heavenBounds.max.z - heavenCenter.z),
  );

  let width = 0;
  let height = 0;
  function resize() {
    const nextWidth = Math.max(1, canvas.clientWidth);
    const nextHeight = Math.max(1, canvas.clientHeight);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    const maxDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelBudgetDpr = Math.sqrt(2000000 / (width * height));
    renderer.setPixelRatio(Math.max(0.75, Math.min(maxDpr, pixelBudgetDpr)));
    renderer.setSize(width, height, false);
    frameParityArtifact(camera, artifactBounds, { width, height });
  }
  resize();
  const cameraTarget = artifactBounds.getCenter(new THREE.Vector3()).setY(artifactBounds.max.y);
  const framedDistance = camera.position.distanceTo(cameraTarget);
  const maxDistance = framedDistance * 2.5;
  camera.far = Math.max(camera.far, maxDistance + artifactBounds.getSize(new THREE.Vector3()).length());
  camera.updateProjectionMatrix();
  const disposeAtlasPicking = mountAtlasPicking(canvas, camera, artifactRoot, onAtlasSelect);
  const interaction = mountArtifactInteraction({
    canvas,
    camera,
    root: artifactRoot,
    heaven,
    target: cameraTarget,
    innerRadius: heavenRadius * 0.72,
    outerRadius: heavenRadius,
    minDistance: framedDistance * 0.55,
    maxDistance,
  });

  let frame = 0;
  let running = !document.hidden;
  function draw() {
    if (!running || lifecycleState === "unavailable" || lifecycleState === "disposed") return;
    resize();
    canvas.dataset.heavenSurfaceProjection = "rigid";
    canvas.dataset.heavenRotationDelta = String(heaven!.rotation.y - applied.heavenAngleRad);
    renderer.render(scene, camera);
    const drawCalls = renderer.info.render.calls;
    canvas.dataset.renderDrawCalls = String(drawCalls);
    if (drawCalls > MODEL_PARITY_BUDGET.drawCalls) {
      unavailable();
      return;
    }
    frame = requestAnimationFrame(draw);
  }
  function visibility() {
    if (lifecycleState === "unavailable" || lifecycleState === "disposed") {
      running = false;
      cancelAnimationFrame(frame);
      return;
    }
    running = !document.hidden;
    if (running) draw(); else cancelAnimationFrame(frame);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    running = false;
    cancelAnimationFrame(frame);
    interaction.dispose();
    disposeAtlasPicking();
    unavailable();
  }
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("webglcontextlost", contextLost);
  draw();

  return {
    resize,
    dispose() {
      if (lifecycleState === "disposed") return;
      lifecycleState = "disposed";
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      delete testCanvas.__setGeneralSurfaceVisibility;
      delete testCanvas.__setHeavenRotation;
      delete testCanvas.__setHeavenSurfaceVisibility;
      interaction.dispose();
      disposeAtlasPicking();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      boardTexture.dispose();
      renderer.dispose();
    },
  };
}
