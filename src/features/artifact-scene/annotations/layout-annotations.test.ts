import { describe, expect, it } from "vitest";
import type { ProjectedAnchor } from "./types";
import { layoutArtifactAnnotations } from "./layout-annotations";

const ids = [
  "calendar/slip", "plate/earth", "plate/heaven", "lesson/first",
  "lesson/second", "lesson/third", "lesson/fourth", "transmission/initial",
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
});
