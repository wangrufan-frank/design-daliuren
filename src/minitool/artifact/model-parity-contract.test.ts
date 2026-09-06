import { describe, expect, it } from "vitest";
import { EARTHLY_BRANCHES } from "../../domain/calendar/constants";
import { GENERAL_NODE_IDS, MONTH_GENERAL_NODE_IDS } from "../../features/artifact-scene/model/jade-plate-layout";
import {
  MINITOOL_MODEL_GROUPS,
  MINITOOL_MODEL_NODE_IDS,
  MODEL_PARITY_BUDGET,
  MODEL_PARITY_REFERENCE,
  MODEL_PARITY_RUNTIME,
} from "./model-parity-contract";

describe("minitool model parity contract", () => {
  it("keeps every visible reference-model component and excludes presentation panels", () => {
    expect(MINITOOL_MODEL_NODE_IDS).toEqual(expect.arrayContaining([
      "artifact/root", "base/body", "plate/earth", "plate/heaven",
      "plate/generals", "plate/core", "trace/course",
      ...EARTHLY_BRANCHES.map((branch) => `branch/earth/${branch}`),
      ...Object.values(MONTH_GENERAL_NODE_IDS),
      ...Object.values(GENERAL_NODE_IDS),
    ]));
    const presentationPanelIds = ["calendar/slip", "lesson/first", "transmission/initial"];
    expect(MINITOOL_MODEL_NODE_IDS.filter((id) => presentationPanelIds.includes(id))).toEqual([]);
    expect(MODEL_PARITY_BUDGET).toMatchObject({ triangles: 100000, drawCalls: 50, textureSize: 1024 });
    expect(MODEL_PARITY_RUNTIME.hiddenMeshKeys).toEqual([
      "plate/generals\0RT_lod2_M_JadeRecess_hero",
      "plate/generals\0RT_lod2_M_OldGold_hero",
    ]);
    expect(MODEL_PARITY_RUNTIME.referenceSurfaceDrawCalls).toBe(0);
  });

  it("partitions model nodes into the four render groups", () => {
    expect(Object.keys(MINITOOL_MODEL_GROUPS)).toEqual(["earth", "heaven", "generals", "core"]);
    const grouped = Object.values(MINITOOL_MODEL_GROUPS).flatMap((group) => group.nodeIds);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(new Set(grouped)).toEqual(new Set(MINITOOL_MODEL_NODE_IDS));
    expect(MINITOOL_MODEL_GROUPS.earth.visualRoles).toContain("corner-pearl");
  });

  it("records the user reference image at its source dimensions", () => {
    expect(MODEL_PARITY_REFERENCE).toEqual({
      path: "e2e/fixtures/minitool-model-reference.png",
      width: 1286,
      height: 1223,
    });
  });
});
