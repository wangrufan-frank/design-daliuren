import { describe, expect, it } from "vitest";
import type { ProjectedAnchor } from "./types";
import { layoutArtifactAnnotations } from "./layout-annotations";

const ids = [
  "calendar/slip", "plate/earth", "plate/heaven", "lesson/first",
  "lesson/second", "lesson/third", "lesson/fourth", "transmission/initial",
] as const;

const allIds = [
  "calendar/slip", "plate/earth", "plate/heaven", "lesson/first", "lesson/second", "lesson/third", "lesson/fourth",
  "transmission/initial", "transmission/middle", "transmission/final", "general/noble", "general/snake", "general/vermilion-bird",
  "general/harmony", "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger", "general/constant",
  "general/black-tortoise", "general/yin", "general/queen-of-heaven",
] as const;

function crossingAnchors(): ProjectedAnchor[] {
  return ids.map((id, index) => ({
    id,
    x: index % 2 === 0 ? 440 + index * 10 : 760 - index * 10,
    y: 100 + index * 70,
    depth: 0,
    behindCamera: false,
    occluded: index === 0,
  }));
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width + 8 && a.x + a.width + 8 > b.x && a.y < b.y + b.height + 8 && a.y + a.height + 8 > b.y;
}

describe("layoutArtifactAnnotations", () => {
  it("lays crossing anchors into deterministic non-overlapping slots with elbow leaders", () => {
    const viewport = { width: 1200, height: 800 };
    const layouts = layoutArtifactAnnotations(crossingAnchors(), viewport);
    const repeated = layoutArtifactAnnotations(crossingAnchors(), viewport);

    expect(layouts).toEqual(repeated);
    expect(layouts).toHaveLength(8);
    expect(layouts.find(({ id }) => id === "calendar/slip")?.occluded).toBe(true);
    layouts.forEach((layout) => {
      expect(layout.leaderPath).toMatch(new RegExp(`^M ${layout.anchor[0]} ${layout.anchor[1]} L `));
      expect(layout.leaderPath.split(" L ")).toHaveLength(3);
      expect(layout.labelRect.x === 12 || layout.labelRect.x + layout.labelRect.width === viewport.width - 12).toBe(true);
    });
    layouts.forEach((layout, index) => layouts.slice(index + 1).forEach((other) => {
      expect(overlaps(layout.labelRect, other.labelRect)).toBe(false);
    }));
  });

  it("keeps a prior side when its anchor moves less than 12 pixels and omits behind-camera anchors", () => {
    const viewport = { width: 1200, height: 800 };
    const before = layoutArtifactAnnotations([{ id: "calendar/slip", x: 598, y: 200, depth: 0, behindCamera: false, occluded: false }], viewport);
    const after = layoutArtifactAnnotations([{ id: "calendar/slip", x: 605, y: 205, depth: 0, behindCamera: false, occluded: false }], viewport, { previous: before });
    const omitted = layoutArtifactAnnotations([{ id: "plate/earth", x: 600, y: 400, depth: 0, behindCamera: true, occluded: false }], viewport);

    expect(after[0].labelRect.x).toBe(before[0].labelRect.x);
    expect(omitted).toEqual([]);
  });

  it("rebalances 22 same-side anchors without overflowing cards or losing stable slots", () => {
    const viewport = { width: 1200, height: 800 };
    const clustered = allIds.map((id, index): ProjectedAnchor => ({
      id,
      x: 180 + index,
      y: 80 + index * 24,
      depth: 0,
      behindCamera: false,
      occluded: false,
    }));
    const first = layoutArtifactAnnotations(clustered, viewport);
    const repeated = layoutArtifactAnnotations(clustered, viewport);
    const moved = layoutArtifactAnnotations(clustered.map((anchor) => ({ ...anchor, x: anchor.x + 5, y: anchor.y + 5 })), viewport, { previous: first });

    expect(first).toEqual(repeated);
    expect(first).toHaveLength(22);
    first.forEach(({ labelRect }) => {
      expect(labelRect.x).toBeGreaterThanOrEqual(0);
      expect(labelRect.y).toBeGreaterThanOrEqual(0);
      expect(labelRect.x + labelRect.width).toBeLessThanOrEqual(viewport.width);
      expect(labelRect.y + labelRect.height).toBeLessThanOrEqual(viewport.height);
    });
    for (const x of new Set(first.map(({ labelRect }) => labelRect.x))) {
      const side = first.filter(({ labelRect }) => labelRect.x === x).sort((a, b) => a.labelRect.y - b.labelRect.y);
      side.slice(1).forEach((layout, index) => expect(layout.labelRect.y - (side[index].labelRect.y + side[index].labelRect.height)).toBeGreaterThanOrEqual(8));
    }
    moved.forEach((layout) => expect(layout.labelRect.x).toBe(first.find(({ id }) => id === layout.id)?.labelRect.x));
  });

  it("rejects viewports too narrow for bounded left and right card slots", () => {
    expect(() => layoutArtifactAnnotations([
      { id: "calendar/slip", x: 0, y: 0, depth: 0, behindCamera: false, occluded: false },
    ], { width: 1, height: 800 })).toThrow(RangeError);
  });
});
