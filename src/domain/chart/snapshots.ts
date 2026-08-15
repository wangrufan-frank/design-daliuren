import { RULE_STAGE_ORDER, stageDependencies } from "./stages";
import type { CourseSession, RuleStageId } from "./types";
import {
  CALENDAR_SNAPSHOT_RULE_ID,
  calendarResultSource,
  isCalendarResult,
} from "../calendar/result-guard";
import {
  HEAVEN_EARTH_SNAPSHOT_RULE_ID,
  heavenEarthResultSource,
  isHeavenEarthResult,
} from "../heaven-earth/result-guard";

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
