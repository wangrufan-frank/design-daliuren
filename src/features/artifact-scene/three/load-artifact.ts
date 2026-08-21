import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { REQUIRED_NODE_IDS } from "../model/asset-contract";

export interface LoadedArtifact {
  root: THREE.Object3D;
  nodes: ReadonlyMap<string, THREE.Object3D>;
  animations: readonly THREE.AnimationClip[];
  url: string;
}

export type ArtifactLoader = Pick<GLTFLoader, "loadAsync"> &
  Partial<Pick<GLTFLoader, "setKTX2Loader">>;

export function createArtifactRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  return new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
}

export function indexArtifactNodes(
  scene: THREE.Object3D,
  requiredIds: readonly string[],
): ReadonlyMap<string, THREE.Object3D> {
  const nodes = new Map<string, THREE.Object3D>();
  const duplicates = new Set<string>();

  scene.traverse((object) => {
    const nodeId = object.userData.node_id;
    if (typeof nodeId !== "string" || !requiredIds.includes(nodeId)) return;
    if (nodes.has(nodeId)) duplicates.add(nodeId);
    else nodes.set(nodeId, object);
  });

  const violations = [
    ...[...duplicates].sort().map((nodeId) => `duplicate ${nodeId}`),
    ...requiredIds.filter((nodeId) => !nodes.has(nodeId)).map((nodeId) => `missing ${nodeId}`),
  ];
  if (violations.length > 0) throw new Error(`Invalid artifact nodes: ${violations.join("; ")}`);

  return nodes;
}

export async function loadArtifact(
  url: string,
  renderer: THREE.WebGLRenderer,
  loader: ArtifactLoader = new GLTFLoader(),
): Promise<LoadedArtifact> {
  const ktx2Loader = new KTX2Loader();

  try {
    ktx2Loader.setTranscoderPath("/three/basis/").detectSupport(renderer);
    loader.setKTX2Loader?.(ktx2Loader);
    const gltf = await loader.loadAsync(url);
    return {
      root: gltf.scene,
      nodes: indexArtifactNodes(gltf.scene, REQUIRED_NODE_IDS),
      animations: gltf.animations,
      url,
    };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Failed to load artifact ${url}: ${detail}`, { cause });
  } finally {
    ktx2Loader.dispose();
  }
}
