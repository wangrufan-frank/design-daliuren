import type { CourseInput, CourseSession, EarthlyBranch } from "../chart/types";
import { invalidateFrom } from "../chart/snapshots";
import { parseBeijingDateTime } from "./beijing-time";
import { EARTHLY_BRANCHES, isStemBranch } from "./constants";
import { applyCalendarCorrections } from "./corrections";
import { deriveAutomaticCalendar } from "./policy";
import {
  CALENDAR_SNAPSHOT_RULE_ID,
  hasValidCalendarPrimitiveCore,
  isCalendarPrimitives,
  isCalendarResult,
} from "./result-guard";
import {
  CalendarDomainError,
  type BeijingDateTime,
  type CalendarAdapter,
  type CalendarCorrectionField,
  type CalendarError,
  type CalendarOutcome,
  type CalendarPrimitives,
  type CalendarResult,
} from "./types";

export { isCalendarResult } from "./result-guard";

const CORRECTION_FIELDS = new Set<CalendarCorrectionField>([
  "yearPillar",
  "monthPillar",
  "dayPillar",
  "hourPillar",
  "monthGeneral",
  "divinationHour",
]);
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function errorOutcome(error: CalendarError): CalendarOutcome {
  return { ok: false, error };
}

function validateCorrections(input: CourseInput): CalendarError | undefined {
  if (!isRecord(input.corrections)) {
    return { code: "INVALID_CALENDAR_CORRECTION", message: "人工修正值无效" };
  }
  for (const [field, value] of Object.entries(input.corrections)) {
    if (!CORRECTION_FIELDS.has(field as CalendarCorrectionField)) {
      return { code: "INVALID_CALENDAR_CORRECTION", message: "人工修正值无效" };
    }
    const pillar = field.endsWith("Pillar");
    if (pillar ? typeof value !== "string" || !isStemBranch(value) : !isBranch(value)) {
      return {
        code: "INVALID_CALENDAR_CORRECTION",
        message: "人工修正值无效",
        field: field as CalendarCorrectionField,
      };
    }
  }
  return undefined;
}

export function computeCalendar(input: CourseInput, adapter: CalendarAdapter): CalendarOutcome {
  let time: BeijingDateTime;
  try {
    time = parseBeijingDateTime(input.civilDateTime);
  } catch (error) {
    if (error instanceof CalendarDomainError) return errorOutcome(error.detail);
    return errorOutcome({ code: "INVALID_BEIJING_DATETIME", message: "请输入有效的北京时间", cause: error });
  }

  const correctionError = validateCorrections(input);
  if (correctionError) return errorOutcome(correctionError);

  let primitives: CalendarPrimitives;
  try {
    primitives = adapter.read(time);
  } catch (cause) {
    return errorOutcome({ code: "CALENDAR_ADAPTER_FAILURE", message: "历法数据读取失败", cause });
  }
  if (!isCalendarPrimitives(primitives, time)) {
    const coreIsValid = hasValidCalendarPrimitiveCore(primitives);
    return errorOutcome({
      code: coreIsValid ? "SOLAR_TERM_BOUNDARY_FAILURE" : "CALENDAR_ADAPTER_FAILURE",
      message: coreIsValid ? "节气边界数据不完整" : "历法数据读取失败",
    });
  }

  let value: CalendarResult;
  try {
    value = applyCalendarCorrections(deriveAutomaticCalendar({ input, time, primitives }), input.corrections);
  } catch (error) {
    if (error instanceof CalendarDomainError) return errorOutcome(error.detail);
    return errorOutcome({ code: "CALENDAR_RESULT_INCOMPLETE", message: "历法结果不完整", cause: error });
  }
  if (!isCalendarResult(value)) {
    return errorOutcome({ code: "CALENDAR_RESULT_INCOMPLETE", message: "历法结果不完整" });
  }

  const source = Object.values(input.corrections).some((correction) => correction !== undefined)
    ? "manual"
    : "automatic";
  return {
    ok: true,
    value,
    snapshot: {
      stage: "calendar",
      dependsOn: [],
      ruleId: CALENDAR_SNAPSHOT_RULE_ID,
      source,
      value,
    },
  };
}

export function runCalendarStage(
  session: CourseSession,
  adapter: CalendarAdapter,
): { ok: true; session: CourseSession; value: CalendarResult } | { ok: false; error: CalendarError } {
  const outcome = computeCalendar(session.input, adapter);
  if (!outcome.ok) return outcome;
  const invalidated = invalidateFrom(session, "calendar");
  return {
    ok: true,
    value: outcome.value,
    session: {
      ...invalidated,
      snapshots: { ...invalidated.snapshots, calendar: outcome.snapshot },
    },
  };
}
