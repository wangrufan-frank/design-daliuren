import * as THREE from "three";
import { EARTHLY_BRANCHES } from "../../domain/calendar/constants";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import manifestJson from "../assets/reference-surfaces/manifest.json";
import type { AppliedParityState } from "./apply-parity-state";

export interface ReferenceSurfaceLayer {
  readonly id: string;
  readonly kind: "earth" | "heaven" | "general" | "core" | "trace";
  readonly ownerId: string;
  readonly texture: string;
  readonly name?: string;
  readonly baselineEarth?: string;
  readonly sectorIndex?: number;
  readonly sourceRect?: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
}

export interface ReferenceSurfaceManifest {
  readonly canonical: { readonly width: number; readonly height: number };
  readonly transform: {
    readonly a: number; readonly b: number; readonly c: number;
    readonly d: number; readonly e: number; readonly f: number;
    readonly g: number; readonly h: number;
  };
  readonly referenceHeavenAngleRad: number;
  readonly layers: readonly ReferenceSurfaceLayer[];
  readonly nativeLayers: readonly ReferenceSurfaceLayer[];
  readonly trace: {
    readonly center: readonly [number, number];
    readonly radius: readonly [number, number];
    readonly referenceEarths: readonly string[];
  };
}

export interface AttachedReferenceSurfaces {
  readonly layers: readonly {
    readonly kind: string;
    readonly owner: THREE.Object3D;
    readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  }[];
  readonly trace: THREE.Group;
  readonly bounds: THREE.Box3;
  setHeavenVisible(visible: boolean): void;
  setVisible(visible: boolean): void;
  update(): "native" | "blended" | "rectified";
  dispose(): void;
}

interface AttachReferenceSurfacesOptions {
  readonly nodes: ReadonlyMap<string, THREE.Object3D>;
  readonly source: ArtifactSourceResults;
  readonly applied: AppliedParityState;
  readonly manifest: ReferenceSurfaceManifest;
  readonly textures: ReadonlyMap<string, THREE.Texture>;
}

export const REFERENCE_SURFACE_MANIFEST = manifestJson as unknown as ReferenceSurfaceManifest;

const DYNAMIC_TRACE_HEIGHT = 0.065;
const NATIVE_HEAVEN_ROTATION_LIMIT = Math.PI / 12;

function referenceHeavenBlend(rotationDelta: number): number {
  const normalized = Math.atan2(Math.sin(rotationDelta), Math.cos(rotationDelta));
  const progress = Math.min(1, Math.abs(normalized) / (NATIVE_HEAVEN_ROTATION_LIMIT * 2));
  const half = progress < 0.5 ? progress * 2 : (progress - 0.5) * 2;
  const eased = half * half * (3 - 2 * half);
  return progress < 0.5 ? eased / 2 : 0.5 + eased / 2;
}

export function referenceHeavenProjection(rotationDelta: number): "native" | "blended" | "rectified" {
  const blend = referenceHeavenBlend(rotationDelta);
  if (blend === 0) return "native";
  return blend === 1 ? "rectified" : "blended";
}

function sourceToRoot(manifest: ReferenceSurfaceManifest, source: THREE.Vector2, y: number): THREE.Vector3 {
  return new THREE.Vector3(
    (source.x - manifest.canonical.width / 2) / manifest.canonical.height,
    y,
    (source.y - manifest.canonical.height / 2) / manifest.canonical.height,
  );
}

function layerRotation(manifest: ReferenceSurfaceManifest, layer: ReferenceSurfaceLayer, applied: AppliedParityState): number {
  if (layer.kind === "heaven") return applied.heavenAngleRad - manifest.referenceHeavenAngleRad;
  if (layer.kind !== "general" || !layer.baselineEarth) return 0;
  const currentEarth = applied.generalSlots.find((slot) => slot.nodeId === layer.ownerId)?.earth;
  const baseline = EARTHLY_BRANCHES.indexOf(layer.baselineEarth as (typeof EARTHLY_BRANCHES)[number]);
  const current = EARTHLY_BRANCHES.indexOf(currentEarth as (typeof EARTHLY_BRANCHES)[number]);
  if (baseline < 0 || current < 0) throw new Error(`Reference general placement is unavailable for ${layer.id}.`);
  return (current - baseline) * Math.PI / 6;
}

function createNativeGeometry(
  manifest: ReferenceSurfaceManifest,
  layer: ReferenceSurfaceLayer,
  ownerFromRoot: THREE.Matrix4,
  rotation: number,
  height: number,
): THREE.BufferGeometry {
  const rect = layer.sourceRect;
  if (!rect) throw new Error(`Native source rectangle is unavailable for ${layer.id}.`);
  const [centerX, centerY] = manifest.trace.center;
  const rotateSource = (x: number, y: number) => {
    const offsetX = x - centerX;
    const offsetY = y - centerY;
    return new THREE.Vector2(
      centerX + offsetX * Math.cos(rotation) - offsetY * Math.sin(rotation),
      centerY + offsetX * Math.sin(rotation) + offsetY * Math.cos(rotation),
    );
  };
  const position = (x: number, y: number) => sourceToRoot(manifest, rotateSource(x, y), height).applyMatrix4(ownerFromRoot);
  const left = rect.left;
  const top = rect.top;
  const right = left + rect.width;
  const bottom = top + rect.height;
  const corners = [
    position(left, top), position(left, bottom), position(right, top),
    position(right, top), position(left, bottom), position(right, bottom),
  ];
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  corners.forEach((point) => positions.push(point.x, point.y, point.z));
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function createTransitionGeometry(
  manifest: ReferenceSurfaceManifest,
  nativeLayer: ReferenceSurfaceLayer,
  ownerFromRoot: THREE.Matrix4,
): THREE.BufferGeometry {
  const nativeRect = nativeLayer.sourceRect;
  if (!nativeRect) throw new Error("Native heaven source rectangle is unavailable.");
  const segments = 32;
  const positions: number[] = [];
  const rectifiedPositions: number[] = [];
  const nativeUvs: number[] = [];
  const rectifiedUvs: number[] = [];
  const addVertex = (u: number, v: number) => {
    const transform = manifest.transform;
    const divisor = transform.g * u + transform.h * v + 1;
    const source = new THREE.Vector2(
      (transform.a * u + transform.b * v + transform.c) / divisor,
      (transform.d * u + transform.e * v + transform.f) / divisor,
    );
    const native = sourceToRoot(manifest, source, 0).applyMatrix4(ownerFromRoot);
    const rectified = new THREE.Vector3(u - 0.5, 0, v - 0.5).applyMatrix4(ownerFromRoot);
    positions.push(native.x, native.y, native.z);
    rectifiedPositions.push(rectified.x, rectified.y, rectified.z);
    nativeUvs.push(
      (source.x - nativeRect.left) / nativeRect.width,
      (source.y - nativeRect.top) / nativeRect.height,
    );
    rectifiedUvs.push(u, v);
  };
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const left = column / segments;
      const right = (column + 1) / segments;
      const top = row / segments;
      const bottom = (row + 1) / segments;
      [
        [left, top], [left, bottom], [right, top],
        [right, top], [left, bottom], [right, bottom],
      ].forEach(([u, v]) => addVertex(u, v));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(nativeUvs, 2));
  geometry.setAttribute("rectifiedUv", new THREE.Float32BufferAttribute(rectifiedUvs, 2));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(rectifiedPositions, 3)];
  geometry.boundingBox = new THREE.Box3().setFromPoints([
    [nativeRect.left, nativeRect.top],
    [nativeRect.left, nativeRect.top + nativeRect.height],
    [nativeRect.left + nativeRect.width, nativeRect.top],
    [nativeRect.left + nativeRect.width, nativeRect.top + nativeRect.height],
  ].map(([x, y]) => sourceToRoot(manifest, new THREE.Vector2(x, y), 0).applyMatrix4(ownerFromRoot)));
  geometry.computeBoundingSphere();
  return geometry;
}

function isReferenceTrace(applied: AppliedParityState, manifest: ReferenceSurfaceManifest): boolean {
  return Math.abs(applied.heavenAngleRad - manifest.referenceHeavenAngleRad) < 1e-7
    && applied.courseTracePoints.length === manifest.trace.referenceEarths.length
    && applied.courseTracePoints.every(({ earth }, index) => earth === manifest.trace.referenceEarths[index]);
}

function createDynamicLineGeometry(
  points: AppliedParityState["courseTracePoints"],
  ownerFromRoot: THREE.Matrix4,
): THREE.BufferGeometry {
  const width = 0.0045;
  const positions: number[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = new THREE.Vector3(points[index].position[0], DYNAMIC_TRACE_HEIGHT, points[index].position[2]);
    const end = new THREE.Vector3(points[index + 1].position[0], DYNAMIC_TRACE_HEIGHT, points[index + 1].position[2]);
    const direction = end.clone().sub(start);
    const length = Math.hypot(direction.x, direction.z);
    if (length === 0) continue;
    const offset = new THREE.Vector3(-direction.z / length * width, 0, direction.x / length * width);
    const corners = [
      start.clone().add(offset), end.clone().add(offset), start.clone().sub(offset),
      end.clone().add(offset), end.clone().sub(offset), start.clone().sub(offset),
    ];
    corners.forEach((point) => {
      point.applyMatrix4(ownerFromRoot);
      positions.push(point.x, point.y, point.z);
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createDynamicNodeGeometry(
  points: AppliedParityState["courseTracePoints"],
  ownerFromRoot: THREE.Matrix4,
): THREE.BufferGeometry {
  const radius = 0.006;
  const segments = 20;
  const positions: number[] = [];
  points.forEach((point) => {
    const center = new THREE.Vector3(point.position[0], DYNAMIC_TRACE_HEIGHT + 0.0005, point.position[2]);
    for (let segment = 0; segment < segments; segment += 1) {
      const firstAngle = segment / segments * Math.PI * 2;
      const secondAngle = (segment + 1) / segments * Math.PI * 2;
      const triangle = [
        center.clone(),
        center.clone().add(new THREE.Vector3(Math.cos(secondAngle) * radius, 0, Math.sin(secondAngle) * radius)),
        center.clone().add(new THREE.Vector3(Math.cos(firstAngle) * radius, 0, Math.sin(firstAngle) * radius)),
      ];
      triangle.forEach((vertex) => {
        vertex.applyMatrix4(ownerFromRoot);
        positions.push(vertex.x, vertex.y, vertex.z);
      });
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createTrace(
  owner: THREE.Object3D,
  ownerFromRoot: THREE.Matrix4,
  manifest: ReferenceSurfaceManifest,
  applied: AppliedParityState,
  layer: ReferenceSurfaceLayer,
  texture: THREE.Texture,
): { group: THREE.Group; geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } {
  const earths = applied.courseTracePoints.map(({ earth }) => earth);
  const group = new THREE.Group();
  group.name = "reference/course-trace";
  group.userData.courseEarths = earths;
  owner.add(group);

  if (isReferenceTrace(applied, manifest)) {
    const lineGeometry = createNativeGeometry(manifest, layer, ownerFromRoot, 0, 0);
    const lineMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.01,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.Mesh(lineGeometry, lineMaterial);
    line.name = "reference/course-line";
    line.renderOrder = 20;
    group.add(line);
    return { group, geometries: [lineGeometry], materials: [lineMaterial] };
  }

  const lineGeometry = createDynamicLineGeometry(applied.courseTracePoints, ownerFromRoot);
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0xb17a23,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  lineMaterial.forceSinglePass = true;
  const line = new THREE.Mesh(lineGeometry, lineMaterial);
  line.name = "dynamic/course-line";
  line.renderOrder = 20;
  group.add(line);

  const nodeMaterial = new THREE.MeshBasicMaterial({
    color: 0x226b92,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
  });
  nodeMaterial.forceSinglePass = true;
  const nodeGeometry = createDynamicNodeGeometry(applied.courseTracePoints, ownerFromRoot);
  const nodes = new THREE.Mesh(nodeGeometry, nodeMaterial);
  nodes.name = "dynamic/course-nodes";
  nodes.renderOrder = 21;
  group.add(nodes);
  applied.courseTracePoints.forEach((point, index) => {
    const node = new THREE.Group();
    node.name = `dynamic/course-node/${index}`;
    node.position.copy(new THREE.Vector3(point.position[0], DYNAMIC_TRACE_HEIGHT + 0.0005, point.position[2]).applyMatrix4(ownerFromRoot));
    group.add(node);
  });
  return {
    group,
    geometries: [lineGeometry, nodeGeometry],
    materials: [lineMaterial, nodeMaterial],
  };
}

export function attachReferenceSurfaces(options: AttachReferenceSurfacesOptions): AttachedReferenceSurfaces {
  const { nodes, applied, manifest, textures } = options;
  const root = nodes.get("artifact/root");
  if (!root) throw new Error("Reference surface root is unavailable.");
  root.updateWorldMatrix(true, true);
  const layers: AttachedReferenceSurfaces["layers"][number][] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  for (const layer of manifest.nativeLayers.filter(({ kind }) => kind !== "trace" && kind !== "heaven")) {
    const owner = nodes.get(layer.ownerId);
    const texture = textures.get(layer.texture);
    if (!owner || !texture) throw new Error(`Reference surface dependency is unavailable for ${layer.id}.`);
    owner.updateWorldMatrix(true, false);
    const ownerFromRoot = owner.matrixWorld.clone().invert().multiply(root.matrixWorld);
    const geometry = createNativeGeometry(
      manifest,
      layer,
      ownerFromRoot,
      layerRotation(manifest, layer, applied),
      0,
    );
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.01,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = layer.id;
    mesh.userData.referenceSurface = true;
    if (layer.name) mesh.userData.generalName = layer.name;
    mesh.renderOrder = { earth: 10, heaven: 11, general: 12, core: 13, trace: 14 }[layer.kind];
    mesh.frustumCulled = false;
    owner.add(mesh);
    layers.push({ kind: layer.kind, owner, mesh });
    geometries.push(geometry);
    materials.push(material);
  }

  const heaven = nodes.get("plate/heaven");
  const nativeHeavenLayer = manifest.nativeLayers.find(({ kind }) => kind === "heaven");
  const nativeHeavenTexture = nativeHeavenLayer && textures.get(nativeHeavenLayer.texture);
  const rectifiedHeavenLayer = manifest.layers.find(({ kind }) => kind === "heaven");
  const rectifiedHeavenTexture = rectifiedHeavenLayer && textures.get(rectifiedHeavenLayer.texture);
  if (!heaven || !nativeHeavenLayer || !nativeHeavenTexture || !rectifiedHeavenLayer || !rectifiedHeavenTexture) {
    throw new Error("Heaven surface dependency is unavailable.");
  }
  heaven.updateWorldMatrix(true, false);
  const heavenGeometry = createTransitionGeometry(
    manifest,
    nativeHeavenLayer,
    heaven.matrixWorld.clone().invert().multiply(root.matrixWorld),
  );
  const heavenBlendUniform = { value: 0 };
  const heavenMaterial = new THREE.MeshBasicMaterial({
    map: nativeHeavenTexture,
    transparent: true,
    alphaTest: 0.01,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  heavenMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.heavenRectifiedMap = { value: rectifiedHeavenTexture };
    shader.uniforms.heavenBlend = heavenBlendUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <uv_pars_vertex>",
        "#include <uv_pars_vertex>\nattribute vec2 rectifiedUv;\nvarying vec2 vHeavenRectifiedUv;",
      )
      .replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\nvHeavenRectifiedUv = rectifiedUv;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_pars_fragment>",
        "#include <map_pars_fragment>\nuniform sampler2D heavenRectifiedMap;\nuniform float heavenBlend;\nvarying vec2 vHeavenRectifiedUv;",
      )
      .replace(
        "#include <map_fragment>",
        [
          "vec4 nativeHeavenColor = texture2D( map, vMapUv );",
          "vec4 rectifiedHeavenColor = texture2D( heavenRectifiedMap, vHeavenRectifiedUv );",
          "float nativeUvCoverage = step( 0.0, vMapUv.x ) * step( vMapUv.x, 1.0 ) * step( 0.0, vMapUv.y ) * step( vMapUv.y, 1.0 );",
          "nativeHeavenColor.a *= nativeUvCoverage;",
          "float nativeHeavenWeight = ( 1.0 - heavenBlend ) * nativeHeavenColor.a;",
          "float rectifiedHeavenWeight = heavenBlend * rectifiedHeavenColor.a;",
          "float heavenWeight = nativeHeavenWeight + rectifiedHeavenWeight;",
          "vec3 heavenColor = heavenWeight > 0.0",
          "  ? ( nativeHeavenColor.rgb * nativeHeavenWeight + rectifiedHeavenColor.rgb * rectifiedHeavenWeight ) / heavenWeight",
          "  : vec3( 0.0 );",
          "diffuseColor *= vec4( heavenColor, heavenWeight );",
        ].join("\n"),
      );
  };
  heavenMaterial.customProgramCacheKey = () => "reference-heaven-composite-v1";
  const heavenSurface = new THREE.Mesh(heavenGeometry, heavenMaterial);
  heavenSurface.name = nativeHeavenLayer.id;
  heavenSurface.userData.referenceSurface = true;
  heavenSurface.renderOrder = 11;
  heavenSurface.frustumCulled = false;
  heaven.add(heavenSurface);
  layers.push({ kind: "heaven", owner: heaven, mesh: heavenSurface });
  geometries.push(heavenGeometry);
  materials.push(heavenMaterial);

  const core = nodes.get("plate/core");
  if (!core) throw new Error("Reference course trace owner is unavailable.");
  const traceLayer = manifest.nativeLayers.find(({ kind }) => kind === "trace");
  const traceTexture = traceLayer && textures.get(traceLayer.texture);
  if (!traceLayer || !traceTexture) throw new Error("Reference course trace texture is unavailable.");
  core.updateWorldMatrix(true, false);
  const traceResult = createTrace(
    core,
    core.matrixWorld.clone().invert().multiply(root.matrixWorld),
    manifest,
    applied,
    traceLayer,
    traceTexture,
  );
  geometries.push(...traceResult.geometries);
  materials.push(...traceResult.materials);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-manifest.canonical.width / manifest.canonical.height / 2, 0, -0.5),
    new THREE.Vector3(
      manifest.canonical.width / manifest.canonical.height / 2,
      isReferenceTrace(applied, manifest) ? 0 : DYNAMIC_TRACE_HEIGHT,
      0.5,
    ),
  );
  const initialHeavenRotation = heaven.rotation.y;
  let surfacesVisible = true;
  let heavenVisible = true;

  function update(): "native" | "blended" | "rectified" {
    const rotationDelta = heaven!.rotation.y - initialHeavenRotation;
    const blend = referenceHeavenBlend(rotationDelta);
    const projection = referenceHeavenProjection(rotationDelta);
    heavenMaterial.opacity = 1;
    heavenBlendUniform.value = blend;
    if (!heavenSurface.morphTargetInfluences) throw new Error("Heaven projection morph is unavailable.");
    heavenSurface.morphTargetInfluences[0] = blend;
    heavenSurface.visible = surfacesVisible && heavenVisible;
    return projection;
  }

  return {
    layers,
    trace: traceResult.group,
    bounds,
    setHeavenVisible(visible) {
      heavenVisible = visible;
      update();
    },
    setVisible(visible) {
      surfacesVisible = visible;
      layers.forEach(({ kind, mesh }) => { if (kind !== "heaven") mesh.visible = visible; });
      traceResult.group.visible = visible;
      update();
    },
    update,
    dispose() {
      layers.forEach(({ mesh }) => mesh.removeFromParent());
      traceResult.group.removeFromParent();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
