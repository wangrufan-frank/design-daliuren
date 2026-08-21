import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REQUIRED_NODE_IDS } from "../model/asset-contract";
import { disposeArtifact } from "./dispose-artifact";
import { indexArtifactNodes, loadArtifact } from "./load-artifact";

const ktx2Loaders = vi.hoisted(() => [] as Array<{
  setTranscoderPath: ReturnType<typeof vi.fn>;
  detectSupport: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}>);
const ktx2SetupFailure = vi.hoisted(() => ({ cause: undefined as Error | undefined }));

vi.mock("three/examples/jsm/loaders/KTX2Loader.js", () => ({
  KTX2Loader: class {
    readonly setTranscoderPath = vi.fn().mockReturnThis();
    readonly detectSupport = vi.fn(() => {
      if (ktx2SetupFailure.cause) throw ktx2SetupFailure.cause;
      return this;
    });
    readonly dispose = vi.fn();

    constructor() {
      ktx2Loaders.push(this);
    }
  },
}));

afterEach(() => {
  ktx2SetupFailure.cause = undefined;
});

function node(id: string) {
  const object = new THREE.Group();
  object.userData.node_id = id;
  return object;
}

function artifactRoot() {
  const root = new THREE.Group();
  for (const id of REQUIRED_NODE_IDS) root.add(node(id));
  return root;
}

function sharedResourceFixture() {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture();
  const environment = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture, envMap: environment });
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));

  return {
    root,
    geometry: vi.spyOn(geometry, "dispose"),
    material: vi.spyOn(material, "dispose"),
    texture: vi.spyOn(texture, "dispose"),
    environment: vi.spyOn(environment, "dispose"),
  };
}

describe("artifact loader", () => {
  it("rejects missing and duplicate runtime ids together", () => {
    const scene = new THREE.Group();
    scene.add(node("plate/heaven"), node("plate/heaven"));

    expect(() => indexArtifactNodes(scene, ["plate/heaven", "artifact/root"]))
      .toThrow(/duplicate plate\/heaven.*missing artifact\/root/);
  });

  it("returns the loaded root, node map, animations, and source URL", async () => {
    ktx2Loaders.length = 0;
    const root = artifactRoot();
    const animations = [new THREE.AnimationClip("open")];
    const loader = { loadAsync: vi.fn().mockResolvedValue({ scene: root, animations }) };

    const artifact = await loadArtifact("/models/daliuren/daliuren-artifact-lod1.glb", {} as THREE.WebGLRenderer, loader);

    expect(artifact.root).toBe(root);
    expect(artifact.nodes.get("plate/heaven")).toBeDefined();
    expect(artifact.animations).toEqual(animations);
    expect(artifact.url).toBe("/models/daliuren/daliuren-artifact-lod1.glb");
    expect(ktx2Loaders[0].setTranscoderPath).toHaveBeenCalledWith("/three/basis/");
    expect(ktx2Loaders[0].detectSupport).toHaveBeenCalledWith(expect.any(Object));
    expect(ktx2Loaders[0].dispose).toHaveBeenCalledOnce();
  });

  it("preserves the loading cause and disposes KTX2 support after failure", async () => {
    ktx2Loaders.length = 0;
    const cause = new Error("network unavailable");
    const loader = { loadAsync: vi.fn().mockRejectedValue(cause) };

    await expect(loadArtifact("/models/daliuren/daliuren-artifact-lod1.glb", {} as THREE.WebGLRenderer, loader))
      .rejects.toMatchObject({ cause });

    expect(ktx2Loaders[0].dispose).toHaveBeenCalledOnce();
  });

  it("disposes a successfully loaded scene when runtime-node indexing fails", async () => {
    ktx2Loaders.length = 0;
    const root = artifactRoot();
    root.remove(root.children.find((child) => child.userData.node_id === "plate/heaven")!);
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    root.add(new THREE.Mesh(geometry, material));
    const loader = { loadAsync: vi.fn().mockResolvedValue({ scene: root, animations: [] }) };

    await expect(loadArtifact("/models/daliuren/daliuren-artifact-lod1.glb", {} as THREE.WebGLRenderer, loader))
      .rejects.toThrow(/missing plate\/heaven/);

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(ktx2Loaders[0].dispose).toHaveBeenCalledOnce();
  });

  it("disposes KTX2 support and preserves the cause when support detection fails", async () => {
    ktx2Loaders.length = 0;
    const cause = new Error("unsupported renderer");
    ktx2SetupFailure.cause = cause;

    await expect(loadArtifact("/models/daliuren/daliuren-artifact-lod1.glb", {} as THREE.WebGLRenderer))
      .rejects.toMatchObject({ cause });

    expect(ktx2Loaders[0].dispose).toHaveBeenCalledOnce();
  });

  it("disposes KTX2 support and preserves the cause when GLTF setup fails", async () => {
    ktx2Loaders.length = 0;
    const cause = new Error("GLTF setup failed");
    const loader = {
      loadAsync: vi.fn(),
      setKTX2Loader: vi.fn(() => { throw cause; }),
    };

    await expect(loadArtifact("/models/daliuren/daliuren-artifact-lod1.glb", {} as THREE.WebGLRenderer, loader))
      .rejects.toMatchObject({ cause });

    expect(loader.loadAsync).not.toHaveBeenCalled();
    expect(ktx2Loaders[0].dispose).toHaveBeenCalledOnce();
  });

  it("disposes shared geometry, material, and textures exactly once", () => {
    const { root, geometry, material, texture, environment } = sharedResourceFixture();

    disposeArtifact(root);
    disposeArtifact(root);

    expect(geometry).toHaveBeenCalledOnce();
    expect(material).toHaveBeenCalledOnce();
    expect(texture).toHaveBeenCalledOnce();
    expect(environment).not.toHaveBeenCalled();
  });
});
