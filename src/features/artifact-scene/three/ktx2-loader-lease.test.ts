import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { acquireKtx2Loader, basisTranscoderPath } from "./ktx2-loader-lease";

const ktx2Loaders = vi.hoisted(() => [] as Array<{
  setTranscoderPath: ReturnType<typeof vi.fn>;
  detectSupport: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}>);

vi.mock("three/examples/jsm/loaders/KTX2Loader.js", () => ({
  KTX2Loader: class {
    readonly setTranscoderPath = vi.fn().mockReturnThis();
    readonly detectSupport = vi.fn().mockReturnThis();
    readonly dispose = vi.fn();

    constructor() {
      ktx2Loaders.push(this);
    }
  },
}));

describe("KTX2 loader lease", () => {
  beforeEach(() => {
    ktx2Loaders.length = 0;
  });

  it("resolves the transcoder beneath the deployed Vite base path", () => {
    expect(basisTranscoderPath("/design-daliuren/")).toBe("/design-daliuren/three/basis/");
  });

  it("shares one active loader and disposes it after the final release", () => {
    const renderer = {} as THREE.WebGLRenderer;
    const first = acquireKtx2Loader(renderer);
    const second = acquireKtx2Loader(renderer);

    expect(ktx2Loaders).toHaveLength(1);
    first.release();
    expect(ktx2Loaders[0].dispose).not.toHaveBeenCalled();
    second.release();
    expect(ktx2Loaders[0].dispose).toHaveBeenCalledOnce();
  });

  it("ignores repeated releases from the same lease", () => {
    const renderer = {} as THREE.WebGLRenderer;
    const first = acquireKtx2Loader(renderer);
    const second = acquireKtx2Loader(renderer);

    first.release();
    first.release();
    expect(ktx2Loaders[0].dispose).not.toHaveBeenCalled();
    second.release();
    second.release();
    expect(ktx2Loaders[0].dispose).toHaveBeenCalledOnce();
  });

  it("creates a fresh loader after the previous lease group is fully released", () => {
    const renderer = {} as THREE.WebGLRenderer;

    acquireKtx2Loader(renderer).release();
    acquireKtx2Loader(renderer).release();

    expect(ktx2Loaders).toHaveLength(2);
  });
});
