import { invalidateFrom } from "../chart/snapshots";
import type { CourseSession } from "../chart/types";
import {
  FOUR_LESSONS_SNAPSHOT_RULE_ID,
  isFourLessonsResult,
} from "../four-lessons/result-guard";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import {
  HEAVEN_EARTH_SNAPSHOT_RULE_ID,
  heavenEarthResultSource,
  isHeavenEarthResult,
} from "../heaven-earth/result-guard";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import { deriveThreeTransmissions, ThreeTransmissionsRuleUnresolvedError } from "./policy";
import {
  THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID,
  isThreeTransmissionsResult,
  matchesThreeTransmissionsInputs,
  threeTransmissionsResultSource,
} from "./result-guard";
import type { ThreeTransmissionsOutcome, ThreeTransmissionsStageOutcome } from "./types";

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

function isFourLessonsSnapshotForPlate(
  value: FourLessonsSnapshot | undefined,
  plate: HeavenEarthSnapshot,
): value is FourLessonsSnapshot {
  return Boolean(value
    && value.stage === "four-lessons"
    && hasDependencies(value.dependsOn, ["calendar", "heaven-earth"])
    && value.ruleId === FOUR_LESSONS_SNAPSHOT_RULE_ID
    && isFourLessonsResult(value.value)
    && (value.source === "automatic" || value.source === "manual")
    && (plate.source !== "manual" || value.source === "manual")
    && value.value.lessons.every((lesson) => (
      plate.value.palaces.find((palace) => palace.earth === lesson.lookupEarth)?.heaven === lesson.upper
    )));
}

export function computeThreeTransmissions(
  plate?: HeavenEarthSnapshot,
  fourLessons?: FourLessonsSnapshot,
): ThreeTransmissionsOutcome {
  if (!isPlateSnapshot(plate) || !isFourLessonsSnapshotForPlate(fourLessons, plate)) {
    return {
      ok: false,
      error: { code: "INVALID_THREE_TRANSMISSIONS_INPUT", message: "缺少有效且一致的天地盘或四课快照" },
    };
  }
  try {
    const value = deriveThreeTransmissions(plate.value, fourLessons.value);
    if (!isThreeTransmissionsResult(value) || !matchesThreeTransmissionsInputs(value, plate.value, fourLessons.value)) {
      return {
        ok: false,
        error: { code: "THREE_TRANSMISSIONS_RESULT_INCOMPLETE", message: "三传结果不完整" },
      };
    }
    return {
      ok: true,
      value,
      snapshot: {
        stage: "three-transmissions",
        dependsOn: ["heaven-earth", "four-lessons"],
        ruleId: THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID,
        source: threeTransmissionsResultSource(plate.source, fourLessons.source),
        value,
      },
    };
  } catch (cause) {
    if (cause instanceof ThreeTransmissionsRuleUnresolvedError) {
      return {
        ok: false,
        error: { code: "THREE_TRANSMISSIONS_RULE_UNRESOLVED", message: cause.message, cause },
      };
    }
    return {
      ok: false,
      error: { code: "THREE_TRANSMISSIONS_RESULT_INCOMPLETE", message: "三传结果不完整", cause },
    };
  }
}

export function runThreeTransmissionsStage(session: CourseSession): ThreeTransmissionsStageOutcome {
  const outcome = computeThreeTransmissions(
    session.snapshots["heaven-earth"] as HeavenEarthSnapshot | undefined,
    session.snapshots["four-lessons"] as FourLessonsSnapshot | undefined,
  );
  const invalidated = invalidateFrom(session, "three-transmissions");
  if (!outcome.ok) return { ...outcome, session: invalidated };
  return {
    ok: true,
    value: outcome.value,
    session: {
      ...invalidated,
      snapshots: { ...invalidated.snapshots, "three-transmissions": outcome.snapshot },
    },
  };
}
