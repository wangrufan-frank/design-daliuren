import { describe, expect, it } from "vitest";
import { REQUIRED_NODE_IDS, selectArtifactLod } from "./asset-contract";

describe("artifact asset contract", () => {
  it("selects LOD2 for narrow or high-density mobile viewports", () => {
    expect(selectArtifactLod(390, 3)).toBe(2);
    expect(selectArtifactLod(1280, 1)).toBe(1);
    expect(selectArtifactLod(1920, 1)).toBe(0);
  });

  it("contains every frozen runtime node exactly once", () => {
    expect(new Set(REQUIRED_NODE_IDS).size).toBe(REQUIRED_NODE_IDS.length);
    expect(REQUIRED_NODE_IDS).toContain("plate/heaven");
    expect(REQUIRED_NODE_IDS).toContain("general/noble");
    expect(REQUIRED_NODE_IDS).toContain("anchor/course-copy/transmissions");
  });
});
