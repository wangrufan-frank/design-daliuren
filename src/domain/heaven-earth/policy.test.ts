import { describe, expect, it } from "vitest";
import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { CalendarResult, MonthGeneralName } from "../calendar/types";
import type { EarthlyBranch } from "../chart/types";
import { referenceSession } from "../../test/reference-session";
import { deriveHeavenEarth, HEAVEN_EARTH_RULE_ID } from "./policy";

const MONTH_GENERAL_NAME_BY_BRANCH: Record<EarthlyBranch, MonthGeneralName> = {
  子: "神后", 丑: "大吉", 寅: "功曹", 卯: "太冲", 辰: "天罡", 巳: "太乙",
  午: "胜光", 未: "小吉", 申: "传送", 酉: "从魁", 戌: "河魁", 亥: "登明",
};

function calendarFixture(general: EarthlyBranch, hour: EarthlyBranch): CalendarResult {
  const base = structuredClone(referenceSession.snapshots.calendar!.value);
  const name = MONTH_GENERAL_NAME_BY_BRANCH[general];
  return {
    ...base,
    monthGeneral: {
      automatic: { name, branch: general },
      effective: { name, branch: general },
      source: "automatic",
    },
    divinationHour: { automatic: hour, effective: hour, source: "automatic" },
  };
}

describe("deriveHeavenEarth", () => {
  it.each([
    {
      name: "同支：子加临子",
      general: "子",
      hour: "子",
      offset: 0,
      palaces: [
        { earth: "子", heaven: "子" }, { earth: "丑", heaven: "丑" },
        { earth: "寅", heaven: "寅" }, { earth: "卯", heaven: "卯" },
        { earth: "辰", heaven: "辰" }, { earth: "巳", heaven: "巳" },
        { earth: "午", heaven: "午" }, { earth: "未", heaven: "未" },
        { earth: "申", heaven: "申" }, { earth: "酉", heaven: "酉" },
        { earth: "戌", heaven: "戌" }, { earth: "亥", heaven: "亥" },
      ],
    },
    {
      name: "相冲：午加临子",
      general: "午",
      hour: "子",
      offset: 6,
      palaces: [
        { earth: "子", heaven: "午" }, { earth: "丑", heaven: "未" },
        { earth: "寅", heaven: "申" }, { earth: "卯", heaven: "酉" },
        { earth: "辰", heaven: "戌" }, { earth: "巳", heaven: "亥" },
        { earth: "午", heaven: "子" }, { earth: "未", heaven: "丑" },
        { earth: "申", heaven: "寅" }, { earth: "酉", heaven: "卯" },
        { earth: "戌", heaven: "辰" }, { earth: "亥", heaven: "巳" },
      ],
    },
    {
      name: "普通错位：子加临未",
      general: "子",
      hour: "未",
      offset: 5,
      palaces: [
        { earth: "子", heaven: "巳" }, { earth: "丑", heaven: "午" },
        { earth: "寅", heaven: "未" }, { earth: "卯", heaven: "申" },
        { earth: "辰", heaven: "酉" }, { earth: "巳", heaven: "戌" },
        { earth: "午", heaven: "亥" }, { earth: "未", heaven: "子" },
        { earth: "申", heaven: "丑" }, { earth: "酉", heaven: "寅" },
        { earth: "戌", heaven: "卯" }, { earth: "亥", heaven: "辰" },
      ],
    },
  ] as const)("locks the complete $name plate", ({ general, hour, offset, palaces }) => {
    const result = deriveHeavenEarth(calendarFixture(general, hour));

    expect(result.offset).toBe(offset);
    expect(result.palaces).toEqual(palaces);
  });

  it("emits evidence for the plate and every palace", () => {
    const result = deriveHeavenEarth(calendarFixture("午", "子"));

    expect(result.evidence).toHaveLength(13);
    expect(result.evidence[0]).toEqual({
      ruleId: HEAVEN_EARTH_RULE_ID,
      field: "plate",
      input: "月将 午，占时 子",
      conclusion: "月将加临占时，天盘顺布，转位数 6",
    });
    expect(result.evidence[1]).toEqual({
      ruleId: HEAVEN_EARTH_RULE_ID,
      field: "palace.子",
      input: "从占时宫按十二支顺序检查地盘 子，顺布距离 0",
      conclusion: "天盘午加临地盘子",
    });
  });

  it("preserves the reviewed calendar value sources", () => {
    const calendar = calendarFixture("午", "子");
    calendar.monthGeneral.source = "manual";
    calendar.divinationHour.source = "manual";

    const result = deriveHeavenEarth(calendar);

    expect(result.monthGeneral).toEqual({ name: "胜光", branch: "午", source: "manual" });
    expect(result.divinationHour).toEqual({ branch: "子", source: "manual" });
  });

  it("maintains a complete one-to-one plate for every general and hour", () => {
    for (const general of EARTHLY_BRANCHES) {
      for (const hour of EARTHLY_BRANCHES) {
        const result = deriveHeavenEarth(calendarFixture(general, hour));

        expect(result.palaces).toHaveLength(12);
        expect(new Set(result.palaces.map(({ earth }) => earth)).size).toBe(12);
        expect(new Set(result.palaces.map(({ heaven }) => heaven)).size).toBe(12);
        expect(result.palaces.find(({ earth }) => earth === hour)?.heaven).toBe(general);
        result.palaces.forEach((palace, index) => {
          const nextPalace = result.palaces[(index + 1) % 12];
          const earthIndex = EARTHLY_BRANCHES.indexOf(palace.earth);
          const heavenIndex = EARTHLY_BRANCHES.indexOf(palace.heaven);
          expect(nextPalace.earth).toBe(EARTHLY_BRANCHES[(earthIndex + 1) % 12]);
          expect(nextPalace.heaven).toBe(EARTHLY_BRANCHES[(heavenIndex + 1) % 12]);
        });
      }
    }
  });
});
