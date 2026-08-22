import { isCalendarSnapshot } from "../calendar/result-guard";
import type { CalendarSnapshot } from "../calendar/types";
import { invalidateFrom, validateSession } from "../chart/snapshots";
import type { CourseContextInput, CourseSession } from "../chart/types";
import { FOUR_LESSONS_SNAPSHOT_RULE_ID, isFourLessonsResult } from "../four-lessons/result-guard";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import { HEAVENLY_GENERALS_SNAPSHOT_RULE_ID, isHeavenlyGeneralsResult } from "../heavenly-generals/result-guard";
import type { HeavenlyGeneralsSnapshot } from "../heavenly-generals/types";
import { THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID, isThreeTransmissionsResult } from "../three-transmissions/result-guard";
import type { ThreeTransmissionsSnapshot } from "../three-transmissions/types";
import { CourseProjectionError, deriveCourse } from "./policy";
import { COURSE_SNAPSHOT_RULE_ID, courseResultSource, isCourseResult, matchesCourseInputs } from "./result-guard";
import type { CourseOutcome, CourseStageOutcome } from "./types";

const COURSE_UPSTREAM_ORDER = ["calendar", "heaven-earth", "four-lessons", "three-transmissions", "heavenly-generals"] as const;

function firstInvalidCourseUpstream(session: CourseSession): typeof COURSE_UPSTREAM_ORDER[number] | undefined {
  for (const [index, stage] of COURSE_UPSTREAM_ORDER.entries()) {
    if (!session.snapshots[stage]) return stage;
    const allowed = new Set<string>(COURSE_UPSTREAM_ORDER.slice(0, index + 1));
    const prefix = {
      ...session,
      snapshots: Object.fromEntries(Object.entries(session.snapshots).filter(([key]) => allowed.has(key))),
    };
    if (validateSession(prefix).length) return stage;
  }
  return undefined;
}

function dependenciesEqual(actual: unknown, expected: readonly string[]): boolean {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((item, index) => item === expected[index]);
}

export function computeCourse(
  contextInput: CourseContextInput,
  calendar?: CalendarSnapshot,
  lessons?: FourLessonsSnapshot,
  transmissions?: ThreeTransmissionsSnapshot,
  generals?: HeavenlyGeneralsSnapshot,
): CourseOutcome {
  if (!isCalendarSnapshot(calendar)
    || lessons?.stage !== "four-lessons"
    || lessons.ruleId !== FOUR_LESSONS_SNAPSHOT_RULE_ID
    || !dependenciesEqual(lessons.dependsOn, ["calendar", "heaven-earth"])
    || !isFourLessonsResult(lessons.value)
    || transmissions?.stage !== "three-transmissions"
    || transmissions.ruleId !== THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID
    || !dependenciesEqual(transmissions.dependsOn, ["heaven-earth", "four-lessons"])
    || !isThreeTransmissionsResult(transmissions.value)
    || generals?.stage !== "heavenly-generals"
    || generals.ruleId !== HEAVENLY_GENERALS_SNAPSHOT_RULE_ID
    || !dependenciesEqual(generals.dependsOn, ["calendar", "heaven-earth", "three-transmissions"])
    || !isHeavenlyGeneralsResult(generals.value)) {
    return { ok: false, error: { code: "INVALID_COURSE_INPUT", message: "缺少有效课式上游快照" } };
  }
  try {
    const value = deriveCourse(contextInput, calendar.value, lessons.value, transmissions.value, generals.value);
    if (!isCourseResult(value) || !matchesCourseInputs(value, contextInput, calendar.value, lessons.value, transmissions.value, generals.value)) {
      return { ok: false, error: { code: "COURSE_RESULT_GUARD_FAILED", message: "课式结果未通过完整性校验" } };
    }
    return {
      ok: true,
      value,
      snapshot: {
        stage: "course",
        dependsOn: ["calendar", "four-lessons", "three-transmissions", "heavenly-generals"],
        ruleId: COURSE_SNAPSHOT_RULE_ID,
        source: courseResultSource([calendar.source, lessons.source, transmissions.source, generals.source]),
        value,
      },
    };
  } catch (cause) {
    if (cause instanceof CourseProjectionError) {
      return { ok: false, error: { code: "COURSE_GENERAL_MAPPING_INCOMPLETE", message: cause.message, cause } };
    }
    return { ok: false, error: { code: "COURSE_RESULT_INCOMPLETE", message: "课式结果不完整", cause } };
  }
}

export function runCourseStage(session: CourseSession): CourseStageOutcome {
  const invalidStage = firstInvalidCourseUpstream(session);
  if (invalidStage) {
    return {
      ok: false,
      error: { code: "INVALID_COURSE_INPUT", message: `课式上游${invalidStage}无效`, upstreamStage: invalidStage },
      session: invalidateFrom(session, invalidStage),
    };
  }
  const invalidated = invalidateFrom(session, "course");
  const outcome = computeCourse(
    { reason: session.input.reason, ...(session.input.locationName && { locationName: session.input.locationName }) },
    session.snapshots.calendar as CalendarSnapshot,
    session.snapshots["four-lessons"] as FourLessonsSnapshot,
    session.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot,
    session.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot,
  );
  if (!outcome.ok) return { ...outcome, session: invalidated };
  return { ok: true, value: outcome.value, session: { ...invalidated, snapshots: { ...invalidated.snapshots, course: outcome.snapshot } } };
}
