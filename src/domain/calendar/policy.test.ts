import { describe, expect, it } from "vitest";
import { LunarTypescriptAdapter } from "../../adapters/calendar/lunar-typescript-adapter";
import { ordinaryCalendarCase, termBoundaryCases, ziInitialCases } from "../../test/calendar-cases";
import { parseBeijingDateTime } from "./beijing-time";
import { CALENDAR_RULE_IDS } from "./constants";
import {
  deriveAutomaticCalendar,
  deriveHourPillar,
  deriveMonthPillar,
  nextStemBranch,
} from "./policy";
import type { BeijingDateTime, CalendarEngineInput, CalendarPrimitives } from "./types";

const adapter = new LunarTypescriptAdapter();

function engineInput(value: string): CalendarEngineInput {
  const time = parseBeijingDateTime(value);
  return {
    input: {
      civilDateTime: time.isoLocal,
      timeZone: "Asia/Shanghai",
      locationName: "北京",
      longitude: 116.4074,
      latitude: 39.9042,
      corrections: {},
    },
    time,
    primitives: adapter.read(time),
  };
}

function timeAtHour(hour: number): BeijingDateTime {
  return parseBeijingDateTime(`2024-02-10T${String(hour).padStart(2, "0")}:30:00`);
}

describe("deriveAutomaticCalendar", () => {
  it("derives the complete locked ordinary result", () => {
    const result = deriveAutomaticCalendar(engineInput(ordinaryCalendarCase.input));

    expect(result).toMatchObject({
      civilDateTime: ordinaryCalendarCase.input,
      effectiveGanzhiDate: ordinaryCalendarCase.expected.effectiveGanzhiDate,
      lunarDate: { display: ordinaryCalendarCase.expected.lunarDisplay },
      pillars: ordinaryCalendarCase.expected.pillars,
      monthBuild: ordinaryCalendarCase.expected.monthBuild,
      monthGeneral: ordinaryCalendarCase.expected.monthGeneral,
      divinationHour: ordinaryCalendarCase.expected.divinationHour,
    });
  });

  it.each(ziInitialCases)("keeps the civil lunar date while applying the 23:00 Ganzhi rollover at $input", ({ input, expected }) => {
    const result = deriveAutomaticCalendar(engineInput(input));

    expect(result.lunarDate.display).toBe(expected.lunarDisplay);
    expect(result.effectiveGanzhiDate).toBe(expected.effectiveGanzhiDate);
    expect(result.pillars.day).toBe(expected.day);
    expect(result.pillars.hour).toBe(expected.hour);
    expect(result.divinationHour).toBe(expected.divinationHour);
  });

  it.each(termBoundaryCases)("uses the new exact-second interval at $input", ({ input, expected }) => {
    const result = deriveAutomaticCalendar(engineInput(input));

    if ("year" in expected) expect(result.pillars.year).toBe(expected.year);
    if ("month" in expected) expect(result.pillars.month).toBe(expected.month);
    if ("previousJie" in expected) expect(result.boundaries.previousJie.name).toBe(expected.previousJie);
    if ("monthGeneral" in expected) expect(result.monthGeneral).toEqual(expected.monthGeneral);
    if ("previousZhongQi" in expected) expect(result.boundaries.previousZhongQi.name).toBe(expected.previousZhongQi);
  });

  it("emits exactly the eight reviewed decision categories with stable rule IDs and displayable conclusions", () => {
    const result = deriveAutomaticCalendar(engineInput(ordinaryCalendarCase.input));

    expect(result.evidence.map(({ ruleId, field }) => ({ ruleId, field }))).toEqual([
      { ruleId: CALENDAR_RULE_IDS.beijingTime, field: "civilDateTime" },
      { ruleId: CALENDAR_RULE_IDS.ziInitial, field: "effectiveGanzhiDate" },
      { ruleId: CALENDAR_RULE_IDS.year, field: "yearPillar" },
      { ruleId: CALENDAR_RULE_IDS.month, field: "monthPillar" },
      { ruleId: CALENDAR_RULE_IDS.day, field: "dayPillar" },
      { ruleId: CALENDAR_RULE_IDS.hourBranch, field: "divinationHour" },
      { ruleId: CALENDAR_RULE_IDS.hourStem, field: "hourPillar" },
      { ruleId: CALENDAR_RULE_IDS.monthGeneral, field: "monthGeneral" },
    ]);
    expect(result.evidence.every(({ input, conclusion }) => input.length > 0 && conclusion.length > 0)).toBe(true);
    expect(result.evidence.map(({ conclusion }) => conclusion).join("\n")).toContain(ordinaryCalendarCase.expected.pillars.year);
    expect(result.evidence.map(({ conclusion }) => conclusion).join("\n")).toContain(ordinaryCalendarCase.expected.monthGeneral.name);
  });

  it("covers every reviewed Jie/month-build and Zhongqi/month-general mapping", () => {
    const base = engineInput(ordinaryCalendarCase.input);
    const mappingCases = [
      ["立春", "寅", "雨水", { name: "登明", branch: "亥" }],
      ["惊蛰", "卯", "春分", { name: "河魁", branch: "戌" }],
      ["清明", "辰", "谷雨", { name: "从魁", branch: "酉" }],
      ["立夏", "巳", "小满", { name: "传送", branch: "申" }],
      ["芒种", "午", "夏至", { name: "小吉", branch: "未" }],
      ["小暑", "未", "大暑", { name: "胜光", branch: "午" }],
      ["立秋", "申", "处暑", { name: "太乙", branch: "巳" }],
      ["白露", "酉", "秋分", { name: "天罡", branch: "辰" }],
      ["寒露", "戌", "霜降", { name: "太冲", branch: "卯" }],
      ["立冬", "亥", "小雪", { name: "功曹", branch: "寅" }],
      ["大雪", "子", "冬至", { name: "大吉", branch: "丑" }],
      ["小寒", "丑", "大寒", { name: "神后", branch: "子" }],
    ] as const;

    mappingCases.forEach(([jie, monthBuild, zhongQi, monthGeneral]) => {
      const primitives: CalendarPrimitives = {
        ...base.primitives,
        previousJie: { ...base.primitives.previousJie, name: jie },
        previousZhongQi: { ...base.primitives.previousZhongQi, name: zhongQi },
      };

      const result = deriveAutomaticCalendar({ ...base, primitives });

      expect(result.monthBuild).toBe(monthBuild);
      expect(result.monthGeneral).toEqual(monthGeneral);
    });
  });
});

describe("traditional pillar formulas", () => {
  it("wraps the sixty-day cycle from 癸亥 to 甲子", () => {
    expect(nextStemBranch("癸亥")).toBe("甲子");
  });

  it.each([
    ["甲辰", "丙寅"], ["己巳", "丙寅"],
    ["乙巳", "戊寅"], ["庚午", "戊寅"],
    ["丙午", "庚寅"], ["辛未", "庚寅"],
    ["丁未", "壬寅"], ["壬申", "壬寅"],
    ["戊申", "甲寅"], ["癸酉", "甲寅"],
  ] as const)("derives the 寅-month stem from year pillar %s", (yearPillar, expected) => {
    expect(deriveMonthPillar(yearPillar, "立春")).toBe(expected);
  });

  it.each([
    ["甲子", "甲子"],
    ["乙丑", "丙子"],
    ["丙寅", "戊子"],
    ["丁卯", "庚子"],
    ["戊辰", "壬子"],
  ] as const)("derives the Zi-hour stem from effective day pillar %s", (dayPillar, expected) => {
    expect(deriveHourPillar(dayPillar, timeAtHour(23))).toBe(expected);
  });

  it.each([
    [23, "甲子"], [1, "乙丑"], [3, "丙寅"], [5, "丁卯"],
    [7, "戊辰"], [9, "己巳"], [11, "庚午"], [13, "辛未"],
    [15, "壬申"], [17, "癸酉"], [19, "甲戌"], [21, "乙亥"],
  ] as const)("derives the complete double-hour cycle at hour %i", (hour, expected) => {
    expect(deriveHourPillar("甲子", timeAtHour(hour))).toBe(expected);
  });
});
