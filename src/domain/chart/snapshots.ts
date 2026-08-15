import { RULE_STAGE_ORDER, stageDependencies } from "./stages";
import type { CourseSession, RuleStageId } from "./types";
import { isCalendarResult } from "../calendar/compute-calendar";

export function validateSession(session: CourseSession): readonly string[] {
  const errors: string[] = [];
  for (const stage of RULE_STAGE_ORDER) {
    const snapshot = session.snapshots[stage];
    if (!snapshot) continue;
    if (snapshot.stage !== stage) errors.push(`${stage} 快照阶段与键不一致: ${snapshot.stage}`);
    if (stage === "calendar" && !isCalendarResult(snapshot.value)) errors.push("calendar 快照结果无效");
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
