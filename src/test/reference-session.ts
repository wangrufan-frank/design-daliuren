import type { CourseResult, CourseSession, RuleStageId, RuleSnapshot } from "../domain/chart/types";
import { stageDependencies } from "../domain/chart/stages";

function snapshot<Stage extends RuleStageId>(stage: Stage, value: unknown): RuleSnapshot<unknown, Stage> {
  return { stage, dependsOn: stageDependencies[stage], ruleId: "reference-layout-only", source: "manual", value };
}

export const referenceSession: CourseSession = {
  input: {
    civilDateTime: "2026-08-14T23:57:00+08:00",
    timeZone: "Asia/Shanghai",
    locationName: "参考课式",
    longitude: 116.4074,
    latitude: 39.9042,
    corrections: {},
  },
  snapshots: {
    calendar: snapshot("calendar", { lunarDate: "丙午年七月初二", pillars: ["丙午", "丙申", "庚申", "戊子"] }),
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
