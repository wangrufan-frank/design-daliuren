import { RULE_STAGE_ORDER, stageDependencies } from "./stages";
import type { CourseSession, RuleStageId } from "./types";
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
    const expectedDependencies = stageDependencies[stage];
    if (
      !Array.isArray(snapshot.dependsOn)
      || snapshot.dependsOn.length !== expectedDependencies.length
      || snapshot.dependsOn.some((dependency, index) => dependency !== expectedDependencies[index])
    ) {
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
