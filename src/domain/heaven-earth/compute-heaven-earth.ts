import { invalidateFrom } from "../chart/snapshots";
import type { CourseSession } from "../chart/types";
import { isCalendarSnapshot } from "../calendar/result-guard";
import type { CalendarSnapshot } from "../calendar/types";
import { deriveHeavenEarth } from "./policy";
import {
  HEAVEN_EARTH_SNAPSHOT_RULE_ID,
  heavenEarthResultSource,
  isHeavenEarthResult,
} from "./result-guard";
import type { HeavenEarthOutcome, HeavenEarthStageOutcome } from "./types";

export { isHeavenEarthResult } from "./result-guard";

export function computeHeavenEarth(calendar?: CalendarSnapshot): HeavenEarthOutcome {
  if (!isCalendarSnapshot(calendar)) {
    return {
      ok: false,
      error: { code: "INVALID_HEAVEN_EARTH_INPUT", message: "缺少有效的历法与月将快照" },
    };
  }
  try {
    const value = deriveHeavenEarth(calendar.value);
    if (!isHeavenEarthResult(value)) {
      return {
        ok: false,
        error: { code: "HEAVEN_EARTH_RESULT_INCOMPLETE", message: "天地盘结果不完整" },
      };
    }
    return {
      ok: true,
      value,
      snapshot: {
        stage: "heaven-earth",
        dependsOn: ["calendar"],
        ruleId: HEAVEN_EARTH_SNAPSHOT_RULE_ID,
        source: heavenEarthResultSource(value),
        value,
      },
    };
  } catch (cause) {
    return {
      ok: false,
      error: { code: "HEAVEN_EARTH_RESULT_INCOMPLETE", message: "天地盘结果不完整", cause },
    };
  }
}

export function runHeavenEarthStage(session: CourseSession): HeavenEarthStageOutcome {
  const outcome = computeHeavenEarth(session.snapshots.calendar);
  const invalidated = invalidateFrom(session, "heaven-earth");
  if (!outcome.ok) return { ...outcome, session: invalidated };
  return {
    ok: true,
    value: outcome.value,
    session: {
      ...invalidated,
      snapshots: { ...invalidated.snapshots, "heaven-earth": outcome.snapshot },
    },
  };
}
