import { describe, expect, it } from "vitest";
import { GENERAL_INLAY_DIMENSIONS_METERS, REQUIRED_NODE_IDS, selectArtifactLod } from "./asset-contract";

describe("artifact asset contract", () => {
  it("selects LOD2 for narrow or high-density mobile viewports", () => {
    expect(selectArtifactLod(390, 3)).toBe(2);
    expect(selectArtifactLod(1280, 1)).toBe(1);
    expect(selectArtifactLod(1920, 1)).toBe(0);
  });

  it("requires the layered jade plate nodes", () => {
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
    for (const branch of "子丑寅卯辰巳午未申酉戌亥") {
      expect(REQUIRED_NODE_IDS).toContain(`branch/earth/${branch}`);
      expect(REQUIRED_NODE_IDS).not.toContain(`branch/heaven/${branch}`);
      expect(REQUIRED_NODE_IDS).toContain(`general-slot/${branch}`);
    }
    for (const month of ["胜光", "小吉", "传送", "从魁", "河魁", "登明", "神后", "大吉", "功曹", "太冲", "天罡", "太乙"]) {
      expect(REQUIRED_NODE_IDS).toContain(`month-general/${month}`);
    }
    expect(REQUIRED_NODE_IDS).toContain("interaction/month-general-ring");
  });

  it("describes general inlays as annular sectors rather than 28mm discs", () => {
    expect(GENERAL_INLAY_DIMENSIONS_METERS).toEqual([0.055427, 0.004, 0.045989]);
  });
});
