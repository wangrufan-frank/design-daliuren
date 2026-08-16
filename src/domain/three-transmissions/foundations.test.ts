import { describe, expect, it } from "vitest";
import {
  clashOf,
  earthUnder,
  heavenAt,
  nextTrineBranch,
  postHorseOf,
  punishmentOf,
  relationFor,
} from "./foundations";
import { makePlate } from "./test-helpers";

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

  it.each([
    ["missing earth", (plate: ReturnType<typeof makePlate>) => ({
      ...plate,
      palaces: plate.palaces.filter(({ earth }) => earth !== "子"),
    }), () => heavenAt, "天地盘地支 子不存在"],
    ["duplicate earth", (plate: ReturnType<typeof makePlate>) => ({
      ...plate,
      palaces: plate.palaces.map((palace) => palace.earth === "丑" ? { ...palace, earth: "子" as const } : palace),
    }), () => heavenAt, "天地盘地支 子重复"],
    ["missing heaven", (plate: ReturnType<typeof makePlate>) => ({
      ...plate,
      palaces: plate.palaces.filter(({ heaven }) => heaven !== "子"),
    }), () => earthUnder, "天地盘天支 子不存在"],
    ["duplicate heaven", (plate: ReturnType<typeof makePlate>) => ({
      ...plate,
      palaces: plate.palaces.map((palace) => palace.heaven === "丑" ? { ...palace, heaven: "子" as const } : palace),
    }), () => earthUnder, "天地盘天支 子重复"],
  ] as const)("rejects a %s palace lookup", (_name, mutate, lookup, message) => {
    expect(() => lookup()(mutate(makePlate("子", "子")), "子")).toThrow(message);
  });
});
