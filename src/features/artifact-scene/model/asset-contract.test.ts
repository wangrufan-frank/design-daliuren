import { describe, expect, it } from "vitest";
import { REQUIRED_NODE_IDS, selectArtifactLod } from "./asset-contract";

describe("artifact asset contract", () => {
  it("selects LOD2 for narrow or high-density mobile viewports", () => {
    expect(selectArtifactLod(390, 3)).toBe(2);
    expect(selectArtifactLod(1280, 1)).toBe(1);
    expect(selectArtifactLod(1920, 1)).toBe(0);
  });

  it("replaces mechanical nodes with branch inlays and independent slips", () => {
    expect(new Set(REQUIRED_NODE_IDS).size).toBe(REQUIRED_NODE_IDS.length);
    expect(REQUIRED_NODE_IDS).toContain("plate/heaven");
    expect(REQUIRED_NODE_IDS).toContain("plate/generals");
    expect(REQUIRED_NODE_IDS).toContain("plate/core");
    expect(REQUIRED_NODE_IDS).toContain("general/noble");
    expect(REQUIRED_NODE_IDS).not.toContain("transmission/bridge");
    expect(REQUIRED_NODE_IDS).not.toContain("anchor/course-copy/lessons");
    expect(REQUIRED_NODE_IDS).not.toContain("anchor/course-copy/transmissions");
    expect(REQUIRED_NODE_IDS).not.toContain("anchor/course-copy/generals");
    expect(REQUIRED_NODE_IDS).toContain("transmission/method");
    expect(REQUIRED_NODE_IDS).toContain("trace/course");
    for (const surface of ["earth", "heaven"]) {
      for (const branch of "子丑寅卯辰巳午未申酉戌亥") {
        expect(REQUIRED_NODE_IDS).toContain(`branch/${surface}/${branch}`);
      }
    }
  });
});
