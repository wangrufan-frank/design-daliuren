import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { MonthGeneralName, StemBranch } from "./types";

export const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const satisfies readonly HeavenlyStem[];
export const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const satisfies readonly EarthlyBranch[];
export const JIA_ZI = Array.from(
  { length: 60 },
  (_, index) => `${HEAVENLY_STEMS[index % 10]}${EARTHLY_BRANCHES[index % 12]}` as StemBranch,
);

export const JIE_TO_MONTH_BUILD = {
  立春: "寅", 惊蛰: "卯", 清明: "辰", 立夏: "巳", 芒种: "午", 小暑: "未",
  立秋: "申", 白露: "酉", 寒露: "戌", 立冬: "亥", 大雪: "子", 小寒: "丑",
} as const;

export const ZHONG_QI_TO_MONTH_GENERAL = {
  雨水: { name: "登明", branch: "亥" }, 春分: { name: "河魁", branch: "戌" },
  谷雨: { name: "从魁", branch: "酉" }, 小满: { name: "传送", branch: "申" },
  夏至: { name: "小吉", branch: "未" }, 大暑: { name: "胜光", branch: "午" },
  处暑: { name: "太乙", branch: "巳" }, 秋分: { name: "天罡", branch: "辰" },
  霜降: { name: "太冲", branch: "卯" }, 小雪: { name: "功曹", branch: "寅" },
  冬至: { name: "大吉", branch: "丑" }, 大寒: { name: "神后", branch: "子" },
} as const satisfies Record<string, { name: MonthGeneralName; branch: EarthlyBranch }>;

export const CALENDAR_RULE_IDS = {
  beijingTime: "calendar/beijing-time-v1",
  ziInitial: "calendar/zi-initial-rollover-v1",
  lunarDate: "calendar/lunar-date-v1",
  year: "calendar/year-at-li-chun-v1",
  month: "calendar/month-at-jie-v1",
  monthBuild: "calendar/month-build-at-jie-v1",
  day: "calendar/day-cycle-v1",
  hourBranch: "calendar/hour-double-hour-v1",
  hourStem: "calendar/hour-stem-v1",
  monthGeneral: "calendar/month-general-at-zhongqi-v1",
  correction: "calendar/manual-correction-v1",
} as const;

export function isStemBranch(value: string): value is StemBranch {
  return (JIA_ZI as readonly string[]).includes(value);
}
