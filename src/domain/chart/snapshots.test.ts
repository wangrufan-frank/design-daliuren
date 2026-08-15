import { describe, expect, it } from "vitest";
import { RULE_STAGE_ORDER, stageDependencies } from "./stages";

describe("rule stage metadata", () => {
  it("orders every calculation dependency before its consumer", () => {
    for (const [index, stage] of RULE_STAGE_ORDER.entries()) {
      for (const dependency of stageDependencies[stage]) {
        expect(RULE_STAGE_ORDER.indexOf(dependency)).toBeLessThan(index);
      }
    }
  });
});
