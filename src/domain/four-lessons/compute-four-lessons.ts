import { isCalendarSnapshot } from "../calendar/result-guard";
import type { CalendarSnapshot } from "../calendar/types";
import { invalidateFrom } from "../chart/snapshots";
import type { CourseSession } from "../chart/types";
import {
  HEAVEN_EARTH_SNAPSHOT_RULE_ID,
  heavenEarthResultSource,
  isHeavenEarthResult,
} from "../heaven-earth/result-guard";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import { deriveFourLessons } from "./policy";
import {
  FOUR_LESSONS_SNAPSHOT_RULE_ID,
  fourLessonsResultSource,
  isFourLessonsResult,
  matchesFourLessonsInputs,
} from "./result-guard";
import type { FourLessonsOutcome, FourLessonsStageOutcome } from "./types";

export { isFourLessonsResult } from "./result-guard";

function isPlateSnapshotForCalendar(
  calendar: CalendarSnapshot,
  plate: HeavenEarthSnapshot | undefined,
): plate is HeavenEarthSnapshot {
  if (!plate || plate.stage !== "heaven-earth" || !isHeavenEarthResult(plate.value)) return false;
  return plate.dependsOn.length === 1
    && plate.dependsOn[0] === "calendar"
    && plate.ruleId === HEAVEN_EARTH_SNAPSHOT_RULE_ID
    && plate.source === heavenEarthResultSource(plate.value)
    && plate.value.monthGeneral.name === calendar.value.monthGeneral.effective.name
    && plate.value.monthGeneral.branch === calendar.value.monthGeneral.effective.branch
    && plate.value.monthGeneral.source === calendar.value.monthGeneral.source
    && plate.value.divinationHour.branch === calendar.value.divinationHour.effective
    && plate.value.divinationHour.source === calendar.value.divinationHour.source;
}

export function computeFourLessons(
  calendar?: CalendarSnapshot,
  plate?: HeavenEarthSnapshot,
): FourLessonsOutcome {
  if (!isCalendarSnapshot(calendar) || !isPlateSnapshotForCalendar(calendar, plate)) {
    return { ok: false, error: { code: "INVALID_FOUR_LESSONS_INPUT", message: "缺少有效的日柱或天地盘快照" } };
  }
  try {
    const value = deriveFourLessons(calendar.value, plate.value);
    if (!isFourLessonsResult(value) || !matchesFourLessonsInputs(value, calendar.value, plate.value)) {
      return { ok: false, error: { code: "FOUR_LESSONS_RESULT_INCOMPLETE", message: "四课结果不完整" } };
    }
    return {
      ok: true,
      value,
      snapshot: {
        stage: "four-lessons",
        dependsOn: ["calendar", "heaven-earth"],
        ruleId: FOUR_LESSONS_SNAPSHOT_RULE_ID,
        source: fourLessonsResultSource(calendar.value, plate.source),
        value,
      },
    };
  } catch (cause) {
    return { ok: false, error: { code: "FOUR_LESSONS_RESULT_INCOMPLETE", message: "四课结果不完整", cause } };
  }
}

export function runFourLessonsStage(session: CourseSession): FourLessonsStageOutcome {
  const outcome = computeFourLessons(
    session.snapshots.calendar,
    session.snapshots["heaven-earth"] as HeavenEarthSnapshot | undefined,
  );
  const invalidated = invalidateFrom(session, "four-lessons");
  if (!outcome.ok) return { ...outcome, session: invalidated };
  return {
    ok: true,
    value: outcome.value,
    session: { ...invalidated, snapshots: { ...invalidated.snapshots, "four-lessons": outcome.snapshot } },
  };
}
