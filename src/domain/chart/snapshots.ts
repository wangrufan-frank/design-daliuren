import { RULE_STAGE_ORDER, stageDependencies } from "./stages";
import type { CourseContextInput, CourseSession, HeavenlyStem, RuleSnapshot, RuleStageId } from "./types";
import type { CalendarSnapshot } from "../calendar/types";
import {
  CALENDAR_SNAPSHOT_RULE_ID,
  calendarResultSource,
  isCalendarResult,
  isCalendarSnapshot,
} from "../calendar/result-guard";
import {
  HEAVEN_EARTH_SNAPSHOT_RULE_ID,
  heavenEarthResultSource,
  isHeavenEarthResult,
} from "../heaven-earth/result-guard";
import {
  FOUR_LESSONS_SNAPSHOT_RULE_ID,
  fourLessonsResultSource,
  isFourLessonsResult,
  matchesFourLessonsInputs,
} from "../four-lessons/result-guard";
import {
  THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID,
  isThreeTransmissionsResult,
  matchesThreeTransmissionsInputs,
  threeTransmissionsResultSource,
} from "../three-transmissions/result-guard";
import {
  HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
  heavenlyGeneralsResultSource,
  isHeavenlyGeneralsResult,
  matchesHeavenlyGeneralsInputs,
} from "../heavenly-generals/result-guard";
import type { HeavenlyGeneralsSnapshot } from "../heavenly-generals/types";
import {
  COURSE_SNAPSHOT_RULE_ID,
  courseResultSource,
  isCourseResult,
  matchesCourseInputs,
} from "../course/result-guard";
import type { CourseSnapshot } from "../course/types";

function dependenciesEqual(actual: unknown, expected: readonly RuleStageId[]): boolean {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((dependency, index) => dependency === expected[index]);
}

export function isHeavenlyGeneralsSnapshotForCurrentInputs(
  snapshot: RuleSnapshot<unknown, "heavenly-generals"> | undefined,
  calendar: CalendarSnapshot | undefined,
  plate: RuleSnapshot<unknown, "heaven-earth"> | undefined,
): snapshot is HeavenlyGeneralsSnapshot {
  const expectedDependencies = stageDependencies["heavenly-generals"];
  if (!snapshot
    || snapshot.stage !== "heavenly-generals"
    || !dependenciesEqual(snapshot.dependsOn, expectedDependencies)
    || snapshot.ruleId !== HEAVENLY_GENERALS_SNAPSHOT_RULE_ID
    || !isCalendarSnapshot(calendar)
    || !plate
    || !isHeavenEarthResult(plate.value)
    || snapshot.source !== heavenlyGeneralsResultSource(calendar.value, plate.source)
    || !isHeavenlyGeneralsResult(snapshot.value)) return false;
  const dayStem = calendar.value.pillars.day.effective[0] as HeavenlyStem;
  return matchesHeavenlyGeneralsInputs(
    snapshot.value,
    dayStem,
    calendar.value.divinationHour.effective,
    plate.value,
  );
}

export function isCourseSnapshotForCurrentInputs(
  snapshot: RuleSnapshot<unknown, "course"> | undefined,
  contextInput: CourseContextInput | undefined,
  calendar: CalendarSnapshot | undefined,
  lessons: RuleSnapshot<unknown, "four-lessons"> | undefined,
  transmissions: RuleSnapshot<unknown, "three-transmissions"> | undefined,
  generals: RuleSnapshot<unknown, "heavenly-generals"> | undefined,
): snapshot is CourseSnapshot {
  return Boolean(
    snapshot
    && contextInput !== undefined
    && snapshot.stage === "course"
    && dependenciesEqual(snapshot.dependsOn, stageDependencies.course)
    && snapshot.ruleId === COURSE_SNAPSHOT_RULE_ID
    && isCalendarSnapshot(calendar)
    && lessons && isFourLessonsResult(lessons.value)
    && transmissions && isThreeTransmissionsResult(transmissions.value)
    && generals && isHeavenlyGeneralsResult(generals.value)
    && snapshot.source === courseResultSource([calendar.source, lessons.source, transmissions.source, generals.source])
    && isCourseResult(snapshot.value)
    && matchesCourseInputs(snapshot.value, contextInput, calendar.value, lessons.value, transmissions.value, generals.value)
  );
}

export function validateSession(session: CourseSession): readonly string[] {
  const errors: string[] = [];
  for (const stage of RULE_STAGE_ORDER) {
    const snapshot = session.snapshots[stage];
    if (!snapshot) continue;
    if (snapshot.stage !== stage) errors.push(`${stage} 快照阶段与键不一致: ${snapshot.stage}`);
    if (stage === "calendar") {
      if (!isCalendarResult(snapshot.value)) {
        errors.push("calendar 快照结果无效");
      } else {
        if (snapshot.ruleId !== CALENDAR_SNAPSHOT_RULE_ID) errors.push("calendar 快照规则编号无效");
        const expectedSource = calendarResultSource(snapshot.value);
        if (snapshot.source !== expectedSource) errors.push(`calendar 快照来源无效，应为 ${expectedSource}`);
      }
    }
    if (stage === "heaven-earth") {
      if (!isHeavenEarthResult(snapshot.value)) {
        errors.push("heaven-earth 快照结果无效");
      } else {
        if (snapshot.ruleId !== HEAVEN_EARTH_SNAPSHOT_RULE_ID) errors.push("heaven-earth 快照规则编号无效");
        const expectedSource = heavenEarthResultSource(snapshot.value);
        if (snapshot.source !== expectedSource) errors.push(`heaven-earth 快照来源无效，应为 ${expectedSource}`);
        const calendar = session.snapshots.calendar;
        if (isCalendarSnapshot(calendar)) {
          if (snapshot.value.monthGeneral.name !== calendar.value.monthGeneral.effective.name) {
            errors.push("heaven-earth 月将名称与 calendar 生效值不一致");
          }
          if (snapshot.value.monthGeneral.branch !== calendar.value.monthGeneral.effective.branch) {
            errors.push("heaven-earth 月将地支与 calendar 生效值不一致");
          }
          if (snapshot.value.monthGeneral.source !== calendar.value.monthGeneral.source) {
            errors.push("heaven-earth 月将来源与 calendar 来源不一致");
          }
          if (snapshot.value.divinationHour.branch !== calendar.value.divinationHour.effective) {
            errors.push("heaven-earth 占时地支与 calendar 生效值不一致");
          }
          if (snapshot.value.divinationHour.source !== calendar.value.divinationHour.source) {
            errors.push("heaven-earth 占时来源与 calendar 来源不一致");
          }
        }
      }
    }
    if (stage === "four-lessons") {
      if (!isFourLessonsResult(snapshot.value)) {
        errors.push("four-lessons 快照结果无效");
      } else {
        if (snapshot.ruleId !== FOUR_LESSONS_SNAPSHOT_RULE_ID) {
          errors.push("four-lessons 快照规则编号无效");
        }
        const calendar = session.snapshots.calendar;
        const plate = session.snapshots["heaven-earth"];
        if (isCalendarSnapshot(calendar) && plate && isHeavenEarthResult(plate.value)) {
          const expectedSource = fourLessonsResultSource(calendar.value, plate.source);
          if (snapshot.source !== expectedSource) {
            errors.push(`four-lessons 快照来源无效，应为 ${expectedSource}`);
          }
          if (!matchesFourLessonsInputs(snapshot.value, calendar.value, plate.value)) {
            errors.push("four-lessons 与生效日柱或天地盘不一致");
          }
        }
      }
    }
    if (stage === "three-transmissions") {
      if (!isThreeTransmissionsResult(snapshot.value)) {
        errors.push("three-transmissions 快照结果无效");
      } else {
        if (snapshot.ruleId !== THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID) {
          errors.push("three-transmissions 快照规则编号无效");
        }
        const plate = session.snapshots["heaven-earth"];
        const fourLessons = session.snapshots["four-lessons"];
        if (plate && isHeavenEarthResult(plate.value) && fourLessons && isFourLessonsResult(fourLessons.value)) {
          const expectedSource = threeTransmissionsResultSource(plate.source, fourLessons.source);
          if (snapshot.source !== expectedSource) {
            errors.push(`three-transmissions 快照来源无效，应为 ${expectedSource}`);
          }
          if (!matchesThreeTransmissionsInputs(snapshot.value, plate.value, fourLessons.value)) {
            errors.push("three-transmissions 与生效天地盘或四课不一致");
          }
        }
      }
    }
    if (stage === "heavenly-generals") {
      if (!isHeavenlyGeneralsResult(snapshot.value)) {
        errors.push("heavenly-generals 快照结果无效");
      } else {
        if (snapshot.ruleId !== HEAVENLY_GENERALS_SNAPSHOT_RULE_ID) {
          errors.push("heavenly-generals 快照规则编号无效");
        }
        const calendar = session.snapshots.calendar;
        const plate = session.snapshots["heaven-earth"];
        const fourLessons = session.snapshots["four-lessons"];
        const transmissions = session.snapshots["three-transmissions"];
        if (isCalendarSnapshot(calendar)
          && plate && isHeavenEarthResult(plate.value)
          && fourLessons && isFourLessonsResult(fourLessons.value)
          && transmissions && isThreeTransmissionsResult(transmissions.value)) {
          const expectedSource = heavenlyGeneralsResultSource(calendar.value, plate.source);
          if (snapshot.source !== expectedSource) {
            errors.push(`heavenly-generals 快照来源无效，应为 ${expectedSource}`);
          }
          const dayStem = calendar.value.pillars.day.effective[0] as HeavenlyStem;
          if (!matchesHeavenlyGeneralsInputs(
            snapshot.value,
            dayStem,
            calendar.value.divinationHour.effective,
            plate.value,
          )) errors.push("heavenly-generals 与生效日干、占时或天地盘不一致");
        }
      }
    }
    if (stage === "course") {
      if (!isCourseResult(snapshot.value)) {
        errors.push("course 快照结果无效");
      } else {
        if (snapshot.ruleId !== COURSE_SNAPSHOT_RULE_ID) {
          errors.push("course 快照规则编号无效");
        }
        const calendar = session.snapshots.calendar;
        const lessons = session.snapshots["four-lessons"];
        const transmissions = session.snapshots["three-transmissions"];
        const generals = session.snapshots["heavenly-generals"];
        if (isCalendarSnapshot(calendar)
          && lessons && isFourLessonsResult(lessons.value)
          && transmissions && isThreeTransmissionsResult(transmissions.value)
          && generals && isHeavenlyGeneralsResult(generals.value)) {
          const expectedSource = courseResultSource([
            calendar.source,
            lessons.source,
            transmissions.source,
            generals.source,
          ]);
          if (snapshot.source !== expectedSource) {
            errors.push(`course 快照来源无效，应为 ${expectedSource}`);
          }
          if (!matchesCourseInputs(
            snapshot.value,
            { reason: session.input.reason, ...(session.input.locationName && { locationName: session.input.locationName }) },
            calendar.value,
            lessons.value,
            transmissions.value,
            generals.value,
          )) errors.push("course 与当前起课输入或上游快照不一致");
        }
      }
    }
    const expectedDependencies = stageDependencies[stage];
    if (!dependenciesEqual(snapshot.dependsOn, expectedDependencies)) {
      errors.push(`${stage} 依赖声明无效，应为 ${expectedDependencies.join(", ")}`);
    }
    for (const dependency of stageDependencies[stage]) {
      if (!session.snapshots[dependency]) errors.push(`${stage} 缺少依赖 ${dependency}`);
    }
  }
  return errors;
}

export function invalidateFrom(session: CourseSession, changed: RuleStageId): CourseSession {
  const invalid = new Set<RuleStageId>([changed]);
  for (const stage of RULE_STAGE_ORDER) {
    if (stageDependencies[stage].some((dependency) => invalid.has(dependency))) invalid.add(stage);
  }
  const snapshots = Object.fromEntries(
    Object.entries(session.snapshots).filter(([stage]) => !invalid.has(stage as RuleStageId)),
  );
  return { ...session, snapshots };
}
