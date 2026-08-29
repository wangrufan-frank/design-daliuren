import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LABEL_COLORS,
  LabelTextureCache,
  createLabelMaterial,
  createLabelTexture,
} from "./dynamic-labels";

const context = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  setLineDash: vi.fn(),
  strokeRect: vi.fn(),
  textAlign: "center",
  textBaseline: "middle",
  fillStyle: "",
  strokeStyle: "",
  font: "",
  lineWidth: 1,
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.values(context).forEach((value) => {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  });
});

describe("dynamic artifact labels", () => {
  it("creates one depth-stable untone-mapped material per physical readout", () => {
    const first = createLabelMaterial();
    const second = createLabelMaterial();

    expect(first).not.toBe(second);
    expect(first).toMatchObject({
      transparent: true,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  });

  it("renders Chinese labels at stable high-resolution canvas dimensions", () => {
    const texture = createLabelTexture("贵人", {
      width: 512,
      height: 256,
      color: LABEL_COLORS.ash,
    });

    expect(texture.image.width).toBe(512);
    expect(texture.image.height).toBe(256);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it.each([
    ["noble", "◆"],
    ["manual", "✎"],
    ["direction-forward", "↻"],
    ["direction-reverse", "↺"],
  ] as const)("adds a non-color %s marker and border", (marker, glyph) => {
    createLabelTexture("贵人", {
      width: 512,
      height: 256,
      color: LABEL_COLORS.oldGold,
      marker,
    });

    expect(context.fillText).toHaveBeenCalledWith(glyph, expect.any(Number), expect.any(Number));
    expect(context.strokeRect).toHaveBeenCalled();
  });

  it("caches by text, style, and size until every owner releases the texture", () => {
    const cache = new LabelTextureCache(8);
    const descriptor = { text: "贵人", style: "old-gold", width: 512, height: 256 } as const;
    const first = cache.acquire(descriptor);
    const dispose = vi.spyOn(first, "dispose");

    expect(cache.acquire(descriptor)).toBe(first);
    expect(first.anisotropy).toBe(8);
    cache.release(first);
    expect(dispose).not.toHaveBeenCalled();
    cache.release(first);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("disposes every cached texture once even when dispose is repeated", () => {
    const cache = new LabelTextureCache(4);
    const texture = cache.acquire({ text: "一课", style: "celadon", width: 512, height: 256 });
    const dispose = vi.spyOn(texture, "dispose");

    cache.dispose();
    cache.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });
});
