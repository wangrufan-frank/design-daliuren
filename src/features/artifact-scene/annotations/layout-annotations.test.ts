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

function rectanglesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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

  it("keeps every card and card-side leader endpoint outside the protected subject", () => {
    const safeArea = {
      top: 72,
      right: 12,
      bottom: 128,
      left: 12,
      subject: { x: 220, y: 80, width: 560, height: 440 },
    };
    const result = layoutArtifactAnnotations(
      allIds.map((id, index): ProjectedAnchor => ({
        id,
        x: 180 + index * 28,
        y: 84 + (index % 10) * 48,
        depth: 0,
        behindCamera: false,
        occluded: index >= 18,
      })),
      { width: 1_000, height: 640 },
      { safeArea },
    );

    expect(result.length).toBeGreaterThan(0);
    for (const { labelRect, leaderPath } of result) {
      expect(labelRect.y).toBeGreaterThanOrEqual(72);
      expect(labelRect.y + labelRect.height).toBeLessThanOrEqual(512);
      expect(rectanglesOverlap(labelRect, safeArea.subject)).toBe(false);
      const [, endpointX, endpointY] = leaderPath.match(/L ([\d.]+) ([\d.]+)$/)!.map(Number);
      expect(rectanglesOverlap({ x: endpointX, y: endpointY, width: 0.01, height: 0.01 }, safeArea.subject)).toBe(false);
    }
  });

  it("deterministically omits the lowest-priority occluded card when safe rails are full", () => {
    const constrained = ids.slice(0, 5).map((id, index): ProjectedAnchor => ({
      id,
      x: 80 + index * 60,
      y: 30 + index * 18,
      depth: 0,
      behindCamera: false,
      occluded: index === 1 || index === 4,
    }));
    const viewport = { width: 400, height: 144 };
    const safeArea = {
      top: 20,
      right: 12,
      bottom: 20,
      left: 12,
      subject: { x: 120, y: 32, width: 160, height: 80 },
    };

    const first = layoutArtifactAnnotations(constrained, viewport, { safeArea });
    const repeated = layoutArtifactAnnotations(constrained, viewport, { safeArea });

    expect(first).toEqual(repeated);
    expect(first.map(({ id }) => id)).toEqual(ids.slice(0, 4));
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

  it("keeps 22 cards at least 44px tall with an 8px same-side gap in a short viewport", () => {
    const viewport = { width: 1200, height: 691 };
    const clustered = allIds.map((id, index): ProjectedAnchor => ({
      id,
      x: 180 + index,
      y: 80 + index * 24,
      depth: 0,
      behindCamera: false,
      occluded: false,
    }));
    const layouts = layoutArtifactAnnotations(clustered, viewport);

    expect(layouts).toHaveLength(22);
    layouts.forEach(({ labelRect }) => expect(labelRect.height).toBeGreaterThanOrEqual(44));
    for (const x of new Set(layouts.map(({ labelRect }) => labelRect.x))) {
      const side = layouts.filter(({ labelRect }) => labelRect.x === x).sort((a, b) => a.labelRect.y - b.labelRect.y);
      side.slice(1).forEach((layout, index) => {
        expect(layout.labelRect.y - (side[index].labelRect.y + side[index].labelRect.height)).toBeGreaterThanOrEqual(8);
      });
    }
  });

  it("omits excess desktop cards instead of crossing the real protected subject", () => {
    const viewport = { width: 672, height: 691 };
    const subjectWidth = viewport.width * 0.68;
    const subjectHeight = viewport.height * 0.7;
    const safeArea = {
      top: 72,
      right: 12,
      bottom: 128,
      left: 12,
      subject: {
        x: (viewport.width - subjectWidth) / 2,
        y: (viewport.height - subjectHeight) / 2,
        width: subjectWidth,
        height: subjectHeight,
      },
    };
    const anchors = allIds.map((id, index): ProjectedAnchor => ({
      id,
      x: 120 + index * 8,
      y: 80 + index * 24,
      depth: 0,
      behindCamera: false,
      occluded: false,
    }));

    const layouts = layoutArtifactAnnotations(anchors, viewport, { safeArea });

    expect(layouts.map(({ id }) => id)).toEqual(allIds.slice(0, 18));
    layouts.forEach(({ labelRect }) => {
      expect(labelRect.x).toBeGreaterThanOrEqual(safeArea.left);
      expect(labelRect.y).toBeGreaterThanOrEqual(safeArea.top);
      expect(labelRect.x + labelRect.width).toBeLessThanOrEqual(viewport.width - safeArea.right);
      expect(labelRect.y + labelRect.height).toBeLessThanOrEqual(viewport.height - safeArea.bottom);
      expect(rectanglesOverlap(labelRect, safeArea.subject)).toBe(false);
    });
    layouts.forEach((layout, index) => layouts.slice(index + 1).forEach((other) => {
      expect(overlaps(layout.labelRect, other.labelRect)).toBe(false);
    }));
  });

  it("rejects a viewport too short for 22 minimum-height cards with 8px gaps", () => {
    const clustered = allIds.map((id, index): ProjectedAnchor => ({
      id,
      x: 180 + index,
      y: 80 + index * 24,
      depth: 0,
      behindCamera: false,
      occluded: false,
    }));

    expect(() => layoutArtifactAnnotations(clustered, { width: 1200, height: 563 })).toThrow(
      new RangeError("Viewport is too short to place 44px annotation cards with an 8px gap"),
    );
  });

  it("rejects viewports too narrow for bounded left and right card slots", () => {
    expect(() => layoutArtifactAnnotations([
      { id: "calendar/slip", x: 0, y: 0, depth: 0, behindCamera: false, occluded: false },
    ], { width: 1, height: 800 })).toThrow(RangeError);
  });

  it("never shrinks a safe-area card below the 44px touch floor", () => {
    const layouts = layoutArtifactAnnotations([
      { id: "calendar/slip", x: 40, y: 100, depth: 0, behindCamera: false, occluded: false },
    ], { width: 160, height: 240 }, {
      safeArea: {
        top: 20,
        right: 8,
        bottom: 20,
        left: 8,
        subject: { x: 55, y: 40, width: 50, height: 160 },
      },
    });

    expect(layouts).toHaveLength(1);
    expect(layouts[0].labelRect.width).toBeGreaterThanOrEqual(44);
    expect(layouts[0].labelRect.height).toBeGreaterThanOrEqual(44);
  });
});
