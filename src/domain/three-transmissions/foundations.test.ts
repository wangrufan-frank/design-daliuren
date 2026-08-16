import { describe, expect, it } from "vitest";
import {
  clashOf,
  nextTrineBranch,
  postHorseOf,
  punishmentOf,
  relationFor,
} from "./foundations";

describe("three-transmissions foundations", () => {
  it.each([
    ["甲", "亥", "父母"],
    ["甲", "午", "子孙"],
    ["甲", "申", "官鬼"],
    ["甲", "丑", "妻财"],
    ["甲", "寅", "兄弟"],
  ] as const)("derives %s/%s as %s", (stem, branch, expected) => {
    expect(relationFor(stem, branch)).toBe(expected);
  });

  it("freezes punishment, clash, trine, and post-horse direction", () => {
    expect([punishmentOf("寅"), punishmentOf("巳"), punishmentOf("申")]).toEqual(["巳", "申", "寅"]);
    expect(punishmentOf("辰")).toBe("辰");
    expect(clashOf("子")).toBe("午");
    expect(nextTrineBranch("酉")).toBe("丑");
    expect(postHorseOf("丑")).toBe("亥");
  });
});
