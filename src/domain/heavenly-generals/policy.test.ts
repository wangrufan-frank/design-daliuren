import { describe, expect, it } from "vitest";
import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { EarthlyBranch } from "../chart/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import {
  DAY_BRANCHES,
  GENERAL_ORDER,
  NOBLE_BRANCHES,
  classifyDayNight,
  deriveHeavenlyGenerals,
  generalForEarth,
  generalForHeaven,
} from "./policy";

const EXPECTED_NOBLES = [
  ["甲", "day", "丑"], ["甲", "night", "未"], ["乙", "day", "子"], ["乙", "night", "申"],
  ["丙", "day", "亥"], ["丙", "night", "酉"], ["丁", "day", "亥"], ["丁", "night", "酉"],
  ["戊", "day", "丑"], ["戊", "night", "未"], ["己", "day", "子"], ["己", "night", "申"],
  ["庚", "day", "丑"], ["庚", "night", "未"], ["辛", "day", "午"], ["辛", "night", "寅"],
  ["壬", "day", "巳"], ["壬", "night", "卯"], ["癸", "day", "巳"], ["癸", "night", "卯"],
] as const;

function makePlate(offset: number): HeavenEarthResult {
  return {
    monthGeneral: { branch: "子", name: "神后", source: "automatic" },
    divinationHour: { branch: "子", source: "automatic" }, offset,
    palaces: EARTHLY_BRANCHES.map((earth, index) => ({ earth, heaven: EARTHLY_BRANCHES[(index + offset) % 12] })), evidence: [],
  };
}

describe("heavenly generals policy", () => {
  it.each(EXPECTED_NOBLES)("maps %s/%s to noble branch %s", (stem, dayNight, branch) => {
    expect(NOBLE_BRANCHES[stem][dayNight]).toBe(branch);
  });
  it.each([["卯", "day"], ["申", "day"], ["酉", "night"], ["寅", "night"]] as const)("classifies boundary hour %s as %s", (hour, expected) => expect(classifyDayNight(hour)).toBe(expected));
  it("keeps approved sets exact", () => {
    expect(DAY_BRANCHES).toEqual(["卯", "辰", "巳", "午", "未", "申"]);
    expect(GENERAL_ORDER).toEqual(["贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后"]);
  });
  it("locates noble heaven branch before forward placement", () => {
    const result = deriveHeavenlyGenerals("甲", "卯", makePlate(0));
    expect(result.nobleHeaven).toBe("丑"); expect(result.nobleEarth).toBe("丑"); expect(result.direction).toBe("forward");
    expect(result.placements.slice(0, 3)).toMatchObject([{ order: 0, general: "贵人", earth: "丑", heaven: "丑" }, { order: 1, general: "螣蛇", earth: "寅", heaven: "寅" }, { order: 2, general: "朱雀", earth: "卯", heaven: "卯" }]);
  });
  it("locates noble heaven branch before reverse placement", () => {
    const result = deriveHeavenlyGenerals("辛", "子", makePlate(6));
    expect(result.nobleHeaven).toBe("寅"); expect(result.nobleEarth).toBe("申"); expect(result.direction).toBe("reverse");
    expect(result.placements.slice(0, 3)).toMatchObject([{ order: 0, general: "贵人", earth: "申", heaven: "寅" }, { order: 1, general: "螣蛇", earth: "未", heaven: "丑" }, { order: 2, general: "朱雀", earth: "午", heaven: "子" }]);
  });
  it("provides lookup by earth and heaven", () => { const result = deriveHeavenlyGenerals("辛", "子", makePlate(6)); for (const p of result.placements) { expect(generalForEarth(result, p.earth)).toBe(p.general); expect(generalForHeaven(result, p.heaven)).toBe(p.general); } });
  it("derives byte-stable evidence", () => expect(JSON.stringify(deriveHeavenlyGenerals("壬", "申", makePlate(4)))).toBe(JSON.stringify(deriveHeavenlyGenerals("壬", "申", makePlate(4)))));
  it.each([["甲", "卯", 0, "丑", "forward"], ["辛", "子", 0, "寅", "forward"], ["甲", "卯", 6, "未", "reverse"], ["辛", "子", 6, "申", "reverse"]] as const)("places %s/%s offset %d from %s in %s", (stem, hour, offset, earth, direction) => expect(deriveHeavenlyGenerals(stem, hour, makePlate(offset))).toMatchObject({ nobleEarth: earth, direction }));
  it("rejects non-unique noble palace", () => { const plate = structuredClone(makePlate(0)); const palaces = plate.palaces as Array<{ earth: EarthlyBranch; heaven: EarthlyBranch }>; palaces[1].heaven = "丑"; palaces[2].heaven = "丑"; expect(() => deriveHeavenlyGenerals("甲", "卯", plate)).toThrow("贵人天盘支丑所临地盘宫不唯一"); });
  it("rejects noncanonical mapping", () => { const plate = structuredClone(makePlate(0)); const palaces = plate.palaces as Array<{ earth: EarthlyBranch; heaven: EarthlyBranch }>; [palaces[2], palaces[3]] = [palaces[3], palaces[2]]; expect(() => deriveHeavenlyGenerals("甲", "卯", plate)).toThrow("天地盘十二支布列无效"); });
});
