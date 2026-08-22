import { describe, expect, it } from "vitest";
import { projectArtifactAnnotations } from "./project-annotations";

const identity = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

describe("projectArtifactAnnotations", () => {
  it("projects homogeneous coordinates into the viewport and clamps edges", () => {
    const [center, edge] = projectArtifactAnnotations([
      { id: "calendar/slip", position: [0, 0, 0], occluded: true },
      { id: "plate/earth", position: [2, -2, 0.5] },
    ], identity, { width: 1200, height: 800 });

    expect(center).toMatchObject({ x: 600, y: 400, depth: 0, behindCamera: false, occluded: true });
    expect(edge).toMatchObject({ x: 1200, y: 800, depth: 0.5, behindCamera: false, occluded: false });
  });

  it("marks negative homogeneous w anchors as behind the camera", () => {
    const behind = projectArtifactAnnotations(
      [{ id: "calendar/slip", position: [0, 0, 0] }],
      [1, 0, 0, -1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1],
      { width: 1200, height: 800 },
    )[0];

    expect(behind.behindCamera).toBe(true);
  });
});
