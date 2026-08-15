import { RULE_STAGE_ORDER, stageDependencies } from "./stages";
import type { CourseSession, RuleStageId } from "./types";

export function validateSession(session: CourseSession): readonly string[] {
  const errors: string[] = [];
  for (const stage of RULE_STAGE_ORDER) {
    if (!session.snapshots[stage]) continue;
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
