import type { CalendarSnapshot } from "../domain/calendar/types";
import type { CourseInput, CourseResult, CourseSession, RuleStageId, RuleSnapshot } from "../domain/chart/types";
import { stageDependencies } from "../domain/chart/stages";

function snapshot<Stage extends RuleStageId>(stage: Stage, value: unknown): RuleSnapshot<unknown, Stage> {
  return { stage, dependsOn: stageDependencies[stage], ruleId: "reference-layout-only", source: "manual", value };
}

const referenceInput: CourseInput = {
  civilDateTime: "2026-08-14T23:57:00",
  timeZone: "Asia/Shanghai",
  locationName: "参考课式",
  longitude: 116.4074,
  latitude: 39.9042,
  corrections: {},
};
const calendarSnapshot = {
  stage: "calendar",
  dependsOn: [],
  ruleId: "calendar/traditional-beijing-zi-v1",
  source: "automatic",
  value: {
    civilDateTime: "2026-08-14T23:57:00",
    effectiveGanzhiDate: "2026-08-15",
    lunarDate: {
      year: 2026,
      month: 7,
      day: 2,
      isLeapMonth: false,
      display: "二〇二六年七月初二",
    },
    pillars: {
      year: { automatic: "丙午", effective: "丙午", source: "automatic" },
      month: { automatic: "丙申", effective: "丙申", source: "automatic" },
      day: { automatic: "辛酉", effective: "辛酉", source: "automatic" },
      hour: { automatic: "戊子", effective: "戊子", source: "automatic" },
    },
    monthBuild: "申",
    monthGeneral: {
      automatic: { name: "胜光", branch: "午" },
      effective: { name: "胜光", branch: "午" },
      source: "automatic",
    },
    divinationHour: { automatic: "子", effective: "子", source: "automatic" },
    boundaries: {
      previousJie: {
        name: "立秋",
        kind: "jie",
        beijingDateTime: "2026-08-07T19:42:43",
        utcEpochMs: 1786102963000,
      },
      nextJie: {
        name: "白露",
        kind: "jie",
        beijingDateTime: "2026-09-07T22:41:16",
        utcEpochMs: 1788792076000,
      },
      previousZhongQi: {
        name: "大暑",
        kind: "zhongqi",
        beijingDateTime: "2026-07-23T03:13:05",
        utcEpochMs: 1784747585000,
      },
      nextZhongQi: {
        name: "处暑",
        kind: "zhongqi",
        beijingDateTime: "2026-08-23T10:18:49",
        utcEpochMs: 1787451529000,
      },
    },
    evidence: [
      {
        ruleId: "calendar/beijing-time-v1",
        field: "civilDateTime",
        input: "2026-08-14T23:57:00",
        conclusion: "按固定 UTC+8 解释为北京时间 2026-08-14T23:57:00",
      },
      {
        ruleId: "calendar/zi-initial-rollover-v1",
        field: "effectiveGanzhiDate",
        input: "北京时间 2026-08-14T23:57:00，日界 23:00",
        conclusion: "处于 23:00–23:59，干支日从民用日期前推至 2026-08-15",
      },
      {
        ruleId: "calendar/year-at-li-chun-v1",
        field: "yearPillar",
        input: "立春 2026-02-04T04:02:08",
        conclusion: "已到立春交接，年柱为 丙午",
      },
      {
        ruleId: "calendar/month-at-jie-v1",
        field: "monthPillar",
        input: "立秋 2026-08-07T19:42:43",
        conclusion: "当前节为立秋，月建为申，月柱为丙申",
      },
      {
        ruleId: "calendar/day-cycle-v1",
        field: "dayPillar",
        input: "民用日柱 庚申",
        conclusion: "按生效干支日期 2026-08-15 取日柱 辛酉",
      },
      {
        ruleId: "calendar/hour-double-hour-v1",
        field: "divinationHour",
        input: "北京时间 23:57:00",
        conclusion: "当前双时辰为子时，占时为子",
      },
      {
        ruleId: "calendar/hour-stem-v1",
        field: "hourPillar",
        input: "生效日柱 辛酉，时支 子",
        conclusion: "由生效日干推得时柱 戊子",
      },
      {
        ruleId: "calendar/month-general-at-zhongqi-v1",
        field: "monthGeneral",
        input: "大暑 2026-07-23T03:13:05",
        conclusion: "当前中气为大暑，月将为胜光（午）",
      },
    ],
  },
} as const satisfies CalendarSnapshot;

export const referenceSession: CourseSession = {
  input: referenceInput,
  snapshots: {
    calendar: calendarSnapshot,
    "heaven-earth": snapshot("heaven-earth", { centerLabel: "时课天地盘", branches: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] }),
    "four-lessons": snapshot("four-lessons", { labels: ["四课", "三课", "二课", "一课"] }),
    "three-transmissions": snapshot("three-transmissions", { labels: ["初传", "中传", "末传"] }),
    "heavenly-generals": snapshot("heavenly-generals", { count: 12 }),
    course: snapshot("course", {
      lessonType: "时课排盘",
      transmissions: [
        { label: "初传", value: "甲寅", relation: "妻财", general: "白虎" },
        { label: "中传", value: "庚申", relation: "兄弟", general: "螣蛇" },
        { label: "末传", value: "甲寅", relation: "妻财", general: "白虎" },
      ],
      lessons: [
        { label: "四课", upper: "申", lower: "寅", general: "螣蛇" },
        { label: "三课", upper: "寅", lower: "申", general: "白虎" },
        { label: "二课", upper: "申", lower: "寅", general: "螣蛇" },
        { label: "一课", upper: "寅", lower: "庚", general: "白虎" },
      ],
      palaces: [
        { branch: "巳", heaven: "亥", general: "勾陈" }, { branch: "午", heaven: "子", general: "青龙" },
        { branch: "未", heaven: "丑", general: "天空" }, { branch: "申", heaven: "寅", general: "白虎" },
        { branch: "酉", heaven: "卯", general: "太常" }, { branch: "戌", heaven: "辰", general: "玄武" },
        { branch: "亥", heaven: "巳", general: "太阴" }, { branch: "子", heaven: "午", general: "天后" },
        { branch: "丑", heaven: "未", general: "贵人" }, { branch: "寅", heaven: "申", general: "螣蛇" },
        { branch: "卯", heaven: "酉", general: "朱雀" }, { branch: "辰", heaven: "戌", general: "六合" },
      ],
      auxiliary: { 当前月将: "胜光 午", 驿马: "寅", 格局: "返吟 · 涉害" },
    } satisfies CourseResult),
  },
};
