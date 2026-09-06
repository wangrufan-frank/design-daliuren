import { describe, expect, it } from "vitest";
import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";
import { referenceSession } from "../../test/reference-session";
import { createArtifactBlueprint } from "./artifact-blueprint";

const source = {
  calendar: referenceSession.snapshots.calendar!.value,
  plate: referenceSession.snapshots["heaven-earth"]!.value,
  lessons: referenceSession.snapshots["four-lessons"]!.value,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value,
  generals: referenceSession.snapshots["heavenly-generals"]!.value,
  course: referenceSession.snapshots.course!.value,
} as ArtifactSourceResults;

describe("createArtifactBlueprint", () => {
  it("describes a complete model within the mini-tool budget", () => {
    const blueprint = createArtifactBlueprint(source);
    expect(blueprint.base).toBeDefined();
    expect(blueprint.earth).toBeDefined();
    expect(blueprint.heaven.angleRad).toBe(source.plate.offset * Math.PI / 6);
    expect(blueprint.branches).toHaveLength(12);
    expect(blueprint.generals).toHaveLength(12);
    expect(blueprint.beads).toHaveLength(4);
    expect(blueprint.budget).toMatchObject({ triangles: expect.any(Number), drawCalls: expect.any(Number), textureSize: 1024 });
    expect(blueprint.budget.triangles).toBeLessThanOrEqual(50000);
    expect(blueprint.budget.drawCalls).toBeLessThanOrEqual(50);
  });

  it("matches the website dial, general, bead, and zoom layout", () => {
    const blueprint = createArtifactBlueprint(source);
    expect(blueprint.branches[0]).toMatchObject({ label: "子", angle: Math.PI });
    expect(blueprint.branches[6]).toMatchObject({ label: "午", angle: Math.PI * 2 });
    expect(blueprint.generals.every((item) => item.outerRadius < blueprint.heaven.branchRadius)).toBe(true);
    expect(blueprint.beads.every((item) => item.radius > blueprint.heaven.radius && item.fixedTo === "earth")).toBe(true);
    expect(blueprint.zoom.maxDistance).toBeGreaterThanOrEqual(32);
  });
});
