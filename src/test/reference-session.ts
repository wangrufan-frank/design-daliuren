import type { CalendarSnapshot } from "../domain/calendar/types";
import type { CourseInput, CourseSession, HeavenlyStem } from "../domain/chart/types";
import { stageDependencies } from "../domain/chart/stages";
import { deriveCourse } from "../domain/course/policy";
import { COURSE_SNAPSHOT_RULE_ID, courseResultSource } from "../domain/course/result-guard";
import type { CourseSnapshot } from "../domain/course/types";
import { deriveHeavenEarth } from "../domain/heaven-earth/policy";
import type { HeavenEarthSnapshot } from "../domain/heaven-earth/types";
import { deriveFourLessons, FOUR_LESSONS_RULE_ID } from "../domain/four-lessons/policy";
import type { FourLessonsSnapshot } from "../domain/four-lessons/types";
import { deriveThreeTransmissions } from "../domain/three-transmissions/policy";
import { THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID } from "../domain/three-transmissions/result-guard";
import type { ThreeTransmissionsSnapshot } from "../domain/three-transmissions/types";
import { deriveHeavenlyGenerals } from "../domain/heavenly-generals/policy";
import {
  HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
  heavenlyGeneralsResultSource,
} from "../domain/heavenly-generals/result-guard";
import type { HeavenlyGeneralsSnapshot } from "../domain/heavenly-generals/types";

const referenceInput: CourseInput = {
  civilDateTime: "2026-08-14T23:57:00",
  timeZone: "Asia/Shanghai",
  locationName: "参考课式",
  reason: "商务决策复盘",
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
        ruleId: "calendar/lunar-date-v1",
        field: "lunarDate",
        input: "民用日期 2026-08-14，适配器农历 二〇二六年七月初二",
        conclusion: "按民用日期读取适配器农历结果 二〇二六年七月初二",
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
        ruleId: "calendar/month-build-at-jie-v1",
        field: "monthBuild",
        input: "立秋 2026-08-07T19:42:43",
        conclusion: "当前活动节为立秋，月建为申",
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

const heavenEarthSnapshot = {
  stage: "heaven-earth",
  dependsOn: ["calendar"],
  ruleId: "heaven-earth/month-general-over-hour-v1",
  source: "automatic",
  value: deriveHeavenEarth(calendarSnapshot.value),
} as const satisfies HeavenEarthSnapshot;

const fourLessonsSnapshot = {
  stage: "four-lessons",
  dependsOn: ["calendar", "heaven-earth"],
  ruleId: FOUR_LESSONS_RULE_ID,
  source: "automatic",
  value: deriveFourLessons(calendarSnapshot.value, heavenEarthSnapshot.value),
} as const satisfies FourLessonsSnapshot;

const threeTransmissionsSnapshot = {
  stage: "three-transmissions",
  dependsOn: ["heaven-earth", "four-lessons"],
  ruleId: THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID,
  source: "automatic",
  value: deriveThreeTransmissions(heavenEarthSnapshot.value, fourLessonsSnapshot.value),
} as const satisfies ThreeTransmissionsSnapshot;

const heavenlyGeneralsSnapshot = {
  stage: "heavenly-generals",
  dependsOn: ["calendar", "heaven-earth", "three-transmissions"],
  ruleId: HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
  source: heavenlyGeneralsResultSource(calendarSnapshot.value, heavenEarthSnapshot.source),
  value: deriveHeavenlyGenerals(
    calendarSnapshot.value.pillars.day.effective[0] as HeavenlyStem,
    calendarSnapshot.value.divinationHour.effective,
    heavenEarthSnapshot.value,
  ),
} as const satisfies HeavenlyGeneralsSnapshot;

const courseValue = deriveCourse(
  { reason: referenceInput.reason, locationName: referenceInput.locationName },
  calendarSnapshot.value,
  fourLessonsSnapshot.value,
  threeTransmissionsSnapshot.value,
  heavenlyGeneralsSnapshot.value,
);

const courseSnapshot = {
  stage: "course",
  dependsOn: ["calendar", "four-lessons", "three-transmissions", "heavenly-generals"],
  ruleId: COURSE_SNAPSHOT_RULE_ID,
  source: courseResultSource([
    calendarSnapshot.source,
    fourLessonsSnapshot.source,
    threeTransmissionsSnapshot.source,
    heavenlyGeneralsSnapshot.source,
  ]),
  value: courseValue,
} as const satisfies CourseSnapshot;

export const referenceSession: CourseSession = {
  input: referenceInput,
  snapshots: {
    calendar: calendarSnapshot,
    "heaven-earth": heavenEarthSnapshot,
    "four-lessons": fourLessonsSnapshot,
    "three-transmissions": threeTransmissionsSnapshot,
    "heavenly-generals": heavenlyGeneralsSnapshot,
    course: courseSnapshot,
  },
};
