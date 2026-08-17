import { isCalendarSnapshot } from "../calendar/result-guard";
import type { CalendarSnapshot } from "../calendar/types";
import { invalidateFrom } from "../chart/snapshots";
import type { CourseSession, HeavenlyStem, RuleStageId } from "../chart/types";
import {
  FOUR_LESSONS_SNAPSHOT_RULE_ID,
  fourLessonsResultSource,
  isFourLessonsResult,
  matchesFourLessonsInputs,
} from "../four-lessons/result-guard";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import {
  HEAVEN_EARTH_SNAPSHOT_RULE_ID,
  heavenEarthResultSource,
  isHeavenEarthResult,
} from "../heaven-earth/result-guard";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import {
  THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID,
  isThreeTransmissionsResult,
  matchesThreeTransmissionsInputs,
  threeTransmissionsResultSource,
} from "../three-transmissions/result-guard";
import type { ThreeTransmissionsSnapshot } from "../three-transmissions/types";
import { HeavenlyGeneralsPolicyError, deriveHeavenlyGenerals } from "./policy";
import * as resultGuard from "./result-guard";
import type {
  HeavenlyGeneralsOutcome,
  HeavenlyGeneralsStageOutcome,
} from "./types";

function hasDependencies(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((dependency, index) => dependency === expected[index]);
}

function isPlateSnapshot(value: HeavenEarthSnapshot | undefined): value is HeavenEarthSnapshot {
  return Boolean(value
    && value.stage === "heaven-earth"
    && hasDependencies(value.dependsOn, ["calendar"])
    && value.ruleId === HEAVEN_EARTH_SNAPSHOT_RULE_ID
    && isHeavenEarthResult(value.value)
    && value.source === heavenEarthResultSource(value.value));
}

function isPlateSnapshotForCalendar(
  value: HeavenEarthSnapshot | undefined,
  calendar: CalendarSnapshot,
): value is HeavenEarthSnapshot {
  return Boolean(isPlateSnapshot(value)
    && value.value.monthGeneral.name === calendar.value.monthGeneral.effective.name
    && value.value.monthGeneral.branch === calendar.value.monthGeneral.effective.branch
    && value.value.monthGeneral.source === calendar.value.monthGeneral.source
    && value.value.divinationHour.branch === calendar.value.divinationHour.effective
    && value.value.divinationHour.source === calendar.value.divinationHour.source);
}

function isFourLessonsSnapshotForCurrentInputs(
  value: FourLessonsSnapshot | undefined,
  calendar: CalendarSnapshot,
  plate: HeavenEarthSnapshot,
): value is FourLessonsSnapshot {
  return Boolean(value
    && value.stage === "four-lessons"
    && hasDependencies(value.dependsOn, ["calendar", "heaven-earth"])
    && value.ruleId === FOUR_LESSONS_SNAPSHOT_RULE_ID
    && isFourLessonsResult(value.value)
    && value.source === fourLessonsResultSource(calendar.value, plate.source)
    && matchesFourLessonsInputs(value.value, calendar.value, plate.value));
}

function isThreeTransmissionsSnapshotForCurrentInputs(
  value: ThreeTransmissionsSnapshot | undefined,
  plate: HeavenEarthSnapshot,
  fourLessons: FourLessonsSnapshot,
): value is ThreeTransmissionsSnapshot {
  return Boolean(value
    && value.stage === "three-transmissions"
    && hasDependencies(value.dependsOn, ["heaven-earth", "four-lessons"])
    && value.ruleId === THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID
    && isThreeTransmissionsResult(value.value)
    && value.source === threeTransmissionsResultSource(plate.source, fourLessons.source)
    && matchesThreeTransmissionsInputs(value.value, plate.value, fourLessons.value));
}

function invalidStageOutcome(
  session: CourseSession,
  invalidFromStage: RuleStageId,
): HeavenlyGeneralsStageOutcome {
  return {
    ok: false,
    error: { code: "INVALID_HEAVENLY_GENERALS_INPUT", message: "缺少有效且一致的历法、天地盘、四课或三传快照" },
    session: invalidateFrom(session, invalidFromStage),
  };
}

export function computeHeavenlyGenerals(
  calendar?: CalendarSnapshot,
  plate?: HeavenEarthSnapshot,
  fourLessons?: FourLessonsSnapshot,
  transmissions?: ThreeTransmissionsSnapshot,
): HeavenlyGeneralsOutcome {
  if (!isCalendarSnapshot(calendar)
    || !isPlateSnapshotForCalendar(plate, calendar)
    || !isFourLessonsSnapshotForCurrentInputs(fourLessons, calendar, plate)
    || !isThreeTransmissionsSnapshotForCurrentInputs(transmissions, plate, fourLessons)) {
    return {
      ok: false,
      error: { code: "INVALID_HEAVENLY_GENERALS_INPUT", message: "缺少有效且一致的历法、天地盘、四课或三传快照" },
    };
  }
  try {
    const dayStem = calendar.value.pillars.day.effective[0] as HeavenlyStem;
    const value = deriveHeavenlyGenerals(dayStem, calendar.value.divinationHour.effective, plate.value);
    if (!resultGuard.isHeavenlyGeneralsResult(value)
      || !resultGuard.matchesHeavenlyGeneralsInputs(
        value,
        dayStem,
        calendar.value.divinationHour.effective,
        plate.value,
      )) {
      return {
        ok: false,
        error: { code: "HEAVENLY_GENERALS_RESULT_GUARD_FAILED", message: "天将结果未通过完整性校验" },
      };
    }
    return {
      ok: true,
      value,
      snapshot: {
        stage: "heavenly-generals",
        dependsOn: ["calendar", "heaven-earth", "three-transmissions"],
        ruleId: resultGuard.HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
        source: resultGuard.heavenlyGeneralsResultSource(calendar.value, plate.source),
        value,
      },
    };
  } catch (cause) {
    if (cause instanceof HeavenlyGeneralsPolicyError) {
      const code = {
        "noble-branch-lookup-failed": "NOBLE_BRANCH_LOOKUP_FAILED",
        "noble-palace-not-unique": "NOBLE_PALACE_NOT_UNIQUE",
        "invalid-direction": "INVALID_HEAVENLY_GENERALS_DIRECTION",
        "placement-incomplete": "HEAVENLY_GENERALS_PLACEMENT_INCOMPLETE",
      } as const;
      return { ok: false, error: { code: code[cause.kind], message: cause.message, cause } };
    }
    return {
      ok: false,
      error: { code: "HEAVENLY_GENERALS_RESULT_INCOMPLETE", message: "天将结果不完整", cause },
    };
  }
}

export function runHeavenlyGeneralsStage(session: CourseSession): HeavenlyGeneralsStageOutcome {
  const calendar = session.snapshots.calendar;
  if (!isCalendarSnapshot(calendar)) return invalidStageOutcome(session, "calendar");
  const plate = session.snapshots["heaven-earth"] as HeavenEarthSnapshot | undefined;
  if (!isPlateSnapshotForCalendar(plate, calendar)) return invalidStageOutcome(session, "heaven-earth");
  const fourLessons = session.snapshots["four-lessons"] as FourLessonsSnapshot | undefined;
  if (!isFourLessonsSnapshotForCurrentInputs(fourLessons, calendar, plate)) {
    return invalidStageOutcome(session, "four-lessons");
  }
  const transmissions = session.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot | undefined;
  if (!isThreeTransmissionsSnapshotForCurrentInputs(transmissions, plate, fourLessons)) {
    return invalidStageOutcome(session, "three-transmissions");
  }
  const outcome = computeHeavenlyGenerals(calendar, plate, fourLessons, transmissions);
  const invalidated = invalidateFrom(session, "heavenly-generals");
  if (!outcome.ok) return { ...outcome, session: invalidated };
  return {
    ok: true,
    value: outcome.value,
    session: {
      ...invalidated,
      snapshots: { ...invalidated.snapshots, "heavenly-generals": outcome.snapshot },
    },
  };
}
