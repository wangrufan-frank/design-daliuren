export const ordinaryCalendarCase = {
  input: "2024-02-10T14:30:00",
  expected: {
    lunarDisplay: "二〇二四年正月初一",
    effectiveGanzhiDate: "2024-02-10",
    pillars: { year: "甲辰", month: "丙寅", day: "甲辰", hour: "辛未" },
    monthBuild: "寅",
    monthGeneral: { name: "神后", branch: "子" },
    divinationHour: "未",
  },
} as const;

export const ziInitialCases = [
  {
    input: "2026-08-14T22:59:00",
    expected: { lunarDisplay: "二〇二六年七月初二", effectiveGanzhiDate: "2026-08-14", day: "庚申", hour: "丁亥", divinationHour: "亥" },
  },
  {
    input: "2026-08-14T23:00:00",
    expected: { lunarDisplay: "二〇二六年七月初二", effectiveGanzhiDate: "2026-08-15", day: "辛酉", hour: "戊子", divinationHour: "子" },
  },
  {
    input: "2026-08-14T23:01:00",
    expected: { lunarDisplay: "二〇二六年七月初二", effectiveGanzhiDate: "2026-08-15", day: "辛酉", hour: "戊子", divinationHour: "子" },
  },
] as const;

export const termBoundaryCases = [
  { input: "2024-02-04T16:27:06", expected: { year: "癸卯", month: "乙丑", previousJie: "小寒" } },
  { input: "2024-02-04T16:27:07", expected: { year: "甲辰", month: "丙寅", previousJie: "立春" } },
  { input: "2024-02-04T16:27:08", expected: { year: "甲辰", month: "丙寅", previousJie: "立春" } },
  { input: "2024-03-05T10:22:44", expected: { year: "甲辰", month: "丙寅", previousJie: "立春" } },
  { input: "2024-03-05T10:22:45", expected: { year: "甲辰", month: "丁卯", previousJie: "惊蛰" } },
  { input: "2024-03-05T10:22:46", expected: { year: "甲辰", month: "丁卯", previousJie: "惊蛰" } },
  { input: "2024-02-19T12:13:11", expected: { monthGeneral: { name: "神后", branch: "子" }, previousZhongQi: "大寒" } },
  { input: "2024-02-19T12:13:12", expected: { monthGeneral: { name: "登明", branch: "亥" }, previousZhongQi: "雨水" } },
  { input: "2024-02-19T12:13:13", expected: { monthGeneral: { name: "登明", branch: "亥" }, previousZhongQi: "雨水" } },
] as const;

export const solarTermCrossChecks = [
  { name: "立春", primary: "2024-02-04T16:27:07+08:00", independent: "2024-02-04T16:26:49.630+08:00", differenceSeconds: 17.37 },
  { name: "雨水", primary: "2024-02-19T12:13:12+08:00", independent: "2024-02-19T12:13:03.396+08:00", differenceSeconds: 8.604 },
  { name: "惊蛰", primary: "2024-03-05T10:22:45+08:00", independent: "2024-03-05T10:22:28.877+08:00", differenceSeconds: 16.123 },
] as const;
