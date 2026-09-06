import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAtlasImage } from "./render-atlas-image";

const input = { title: "青龙", summary: "东方木德", meaning: "主生发与喜庆。", imageUrl: "/atlas/dragon.webp", credit: "图源：古画公共领域" };

function mockImage(outcome: "load" | "error" | "pending") {
  vi.stubGlobal("Image", class {
    naturalWidth = 1200;
    naturalHeight = 800;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      void Promise.resolve().then(() => {
        if (outcome === "load") this.onload?.();
        if (outcome === "error") this.onerror?.();
      });
    }
  });
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("renderAtlasImage", () => {
  it("rejects a failed artwork load instead of exporting an empty image", async () => {
    mockImage("error");
    await expect(renderAtlasImage(input)).rejects.toThrow(/图片.*加载/);
  });

  it("rejects when an artwork never completes loading", async () => {
    vi.useFakeTimers();
    mockImage("pending");
    await Promise.all([
      expect(renderAtlasImage(input)).rejects.toThrow(/超时/),
      vi.advanceTimersByTimeAsync(15000),
    ]);
  });

  it("wraps long Chinese text without clipping and keeps the artwork and credit", async () => {
    mockImage("load");
    const drawn: { value: string; x: number; y: number; size: number; width: number }[] = [];
    let canvas: HTMLCanvasElement;
    const context = {
      font: "26px serif", fillStyle: "", textBaseline: "top", textAlign: "left",
      fillRect() {}, drawImage: vi.fn(),
      measureText(value: string) { return { width: [...value].length * Number(this.font.match(/(\d+)px/)![1]) }; },
      fillText(value: string, x: number, y: number) {
        drawn.push({ value, x, y, size: Number(this.font.match(/(\d+)px/)![1]), width: this.measureText(value).width });
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      canvas = this;
      return context as unknown as CanvasRenderingContext2D;
    });
    const serialize = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("exported-png");
    const longInput = { ...input, title: "东方苍龙与四象中的木德生发".repeat(3), meaning: "苍龙七宿随四时升降，象征万物生长与东方之气。".repeat(65) };

    expect(await renderAtlasImage(longInput)).toBe("exported-png");
    expect(serialize).toHaveBeenCalledWith("image/png");
    expect(canvas!.width).toBe(900);
    expect(canvas!.height).toBeLessThanOrEqual(4096);
    expect(context.drawImage).toHaveBeenCalledOnce();
    const content = drawn.map((line) => line.value).join("");
    for (const value of [longInput.title, input.summary, longInput.meaning, input.credit]) expect(content).toContain(value);
    for (const line of drawn) {
      expect(line.x).toBeGreaterThanOrEqual(24);
      expect(line.x + line.width).toBeLessThanOrEqual(876);
      expect(line.y + line.size).toBeLessThan(canvas!.height);
    }
    for (let index = 1; index < drawn.length; index++) expect(drawn[index].y).toBeGreaterThanOrEqual(drawn[index - 1].y + drawn[index - 1].size);
    expect(drawn.at(-1)!.value).toBe(input.credit);
    expect(drawn.at(-1)!.y).toBeGreaterThan(canvas!.height - 140);
  });
});
