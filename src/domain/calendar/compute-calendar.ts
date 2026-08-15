import type { CourseInput, CourseSession, EarthlyBranch } from "../chart/types";
import { invalidateFrom } from "../chart/snapshots";
import { parseBeijingDateTime } from "./beijing-time";
import {
  CALENDAR_RULE_IDS,
  EARTHLY_BRANCHES,
  JIE_TO_MONTH_BUILD,
  ZHONG_QI_TO_MONTH_GENERAL,
  isStemBranch,
} from "./constants";
import { applyCalendarCorrections } from "./corrections";
import { deriveAutomaticCalendar } from "./policy";
import {
  CalendarDomainError,
  type BeijingDateTime,
  type CalendarAdapter,
  type CalendarCorrectionField,
  type CalendarError,
  type CalendarOutcome,
  type CalendarPrimitives,
  type CalendarResult,
  type ReviewedValue,
  type SolarTermBoundary,
} from "./types";

const CORRECTION_FIELDS = new Set<CalendarCorrectionField>([
  "yearPillar",
  "monthPillar",
  "dayPillar",
  "hourPillar",
  "monthGeneral",
  "divinationHour",
]);
const BASE_EVIDENCE = [
  [CALENDAR_RULE_IDS.beijingTime, "civilDateTime"],
  [CALENDAR_RULE_IDS.ziInitial, "effectiveGanzhiDate"],
  [CALENDAR_RULE_IDS.year, "yearPillar"],
  [CALENDAR_RULE_IDS.month, "monthPillar"],
  [CALENDAR_RULE_IDS.day, "dayPillar"],
  [CALENDAR_RULE_IDS.hourBranch, "divinationHour"],
  [CALENDAR_RULE_IDS.hourStem, "hourPillar"],
  [CALENDAR_RULE_IDS.monthGeneral, "monthGeneral"],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return left === right;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function isReviewed<T>(
  value: unknown,
  valid: (candidate: unknown) => candidate is T,
): value is ReviewedValue<T> {
  if (!isRecord(value) || !valid(value.automatic) || !valid(value.effective)) return false;
  if (value.source !== "automatic" && value.source !== "manual") return false;
  return value.source === "manual" || sameValue(value.automatic, value.effective);
}

function fixedUtc8Epoch(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const civilEpoch = Date.UTC(year, month - 1, day, hour, minute, second);
  const civil = new Date(civilEpoch);
  if (
    civil.getUTCFullYear() !== year
    || civil.getUTCMonth() !== month - 1
    || civil.getUTCDate() !== day
    || civil.getUTCHours() !== hour
    || civil.getUTCMinutes() !== minute
    || civil.getUTCSeconds() !== second
  ) return undefined;
  return civilEpoch - 8 * 60 * 60 * 1_000;
}

function validBoundary(value: unknown, kind: SolarTermBoundary["kind"]): value is SolarTermBoundary {
  if (!isRecord(value) || value.kind !== kind || typeof value.name !== "string") return false;
  const names = kind === "jie" ? Object.keys(JIE_TO_MONTH_BUILD) : Object.keys(ZHONG_QI_TO_MONTH_GENERAL);
  const epoch = fixedUtc8Epoch(value.beijingDateTime);
  return names.includes(value.name)
    && epoch !== undefined
    && typeof value.utcEpochMs === "number"
    && Number.isFinite(value.utcEpochMs)
    && value.utcEpochMs === epoch;
}

function validLunarDate(value: unknown): boolean {
  return isRecord(value)
    && Number.isInteger(value.year)
    && Number.isInteger(value.month)
    && Number(value.month) >= 1
    && Number(value.month) <= 12
    && Number.isInteger(value.day)
    && Number(value.day) >= 1
    && Number(value.day) <= 30
    && typeof value.isLeapMonth === "boolean"
    && typeof value.display === "string"
    && value.display.trim().length > 0;
}

function validMonthGeneral(value: unknown): value is { name: CalendarResult["monthGeneral"]["automatic"]["name"]; branch: EarthlyBranch } {
  if (!isRecord(value) || typeof value.name !== "string" || !isBranch(value.branch)) return false;
  return Object.values(ZHONG_QI_TO_MONTH_GENERAL).some(
    ({ name, branch }) => value.name === name && value.branch === branch,
  );
}

function expectedGanzhiDate(time: BeijingDateTime): string {
  const date = new Date(Date.UTC(time.year, time.month - 1, time.day + (time.hour === 23 ? 1 : 0)));
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function validEvidence(value: unknown, result: Record<string, unknown>): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  const meaningful = value.every((step) => isRecord(step)
    && typeof step.ruleId === "string"
    && step.ruleId.startsWith("calendar/")
    && typeof step.field === "string"
    && step.field.trim().length > 0
    && typeof step.input === "string"
    && step.input.trim().length > 0
    && typeof step.conclusion === "string"
    && step.conclusion.trim().length > 0);
  if (!meaningful) return false;
  if (!BASE_EVIDENCE.every(([ruleId, field]) => value.some((step) => step.ruleId === ruleId && step.field === field))) {
    return false;
  }

  const manualFields = [
    ["yearPillar", (result.pillars as Record<string, unknown>)?.year],
    ["monthPillar", (result.pillars as Record<string, unknown>)?.month],
    ["dayPillar", (result.pillars as Record<string, unknown>)?.day],
    ["hourPillar", (result.pillars as Record<string, unknown>)?.hour],
    ["monthGeneral", result.monthGeneral],
    ["divinationHour", result.divinationHour],
  ] as const;
  return manualFields.every(([field, reviewed]) => !isRecord(reviewed)
    || reviewed.source !== "manual"
    || value.some((step) => step.ruleId === CALENDAR_RULE_IDS.correction && step.field === field));
}

function validPrimitiveCore(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && validLunarDate(value.lunarDate)
    && typeof value.civilDayPillar === "string"
    && isStemBranch(value.civilDayPillar);
}

function validPrimitives(value: unknown, time: BeijingDateTime): value is CalendarPrimitives {
  if (!validPrimitiveCore(value)) return false;
  if (!validBoundary(value.liChun, "jie") || value.liChun.name !== "立春") return false;
  if (!validBoundary(value.previousJie, "jie") || !validBoundary(value.nextJie, "jie")) return false;
  if (!validBoundary(value.previousZhongQi, "zhongqi") || !validBoundary(value.nextZhongQi, "zhongqi")) return false;
  return value.previousJie.utcEpochMs <= time.utcEpochMs
    && time.utcEpochMs < value.nextJie.utcEpochMs
    && value.previousZhongQi.utcEpochMs <= time.utcEpochMs
    && time.utcEpochMs < value.nextZhongQi.utcEpochMs;
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

export function isCalendarResult(value: unknown): value is CalendarResult {
  if (!isRecord(value)) return false;
  let time: BeijingDateTime;
  try {
    time = parseBeijingDateTime(value.civilDateTime as string);
  } catch {
    return false;
  }
  if (time.isoLocal !== value.civilDateTime || value.effectiveGanzhiDate !== expectedGanzhiDate(time)) return false;
  if (!validLunarDate(value.lunarDate) || !isBranch(value.monthBuild)) return false;
  if (!isRecord(value.pillars)) return false;
  if (!isReviewed(value.pillars.year, (candidate): candidate is CalendarResult["pillars"]["year"]["automatic"] => typeof candidate === "string" && isStemBranch(candidate))) return false;
  if (!isReviewed(value.pillars.month, (candidate): candidate is CalendarResult["pillars"]["month"]["automatic"] => typeof candidate === "string" && isStemBranch(candidate))) return false;
  if (!isReviewed(value.pillars.day, (candidate): candidate is CalendarResult["pillars"]["day"]["automatic"] => typeof candidate === "string" && isStemBranch(candidate))) return false;
  if (!isReviewed(value.pillars.hour, (candidate): candidate is CalendarResult["pillars"]["hour"]["automatic"] => typeof candidate === "string" && isStemBranch(candidate))) return false;
  if (!isReviewed(value.monthGeneral, validMonthGeneral) || !isReviewed(value.divinationHour, isBranch)) return false;
  if (!isRecord(value.boundaries)) return false;
  const { previousJie, nextJie, previousZhongQi, nextZhongQi } = value.boundaries;
  if (!validBoundary(previousJie, "jie") || !validBoundary(nextJie, "jie")) return false;
  if (!validBoundary(previousZhongQi, "zhongqi") || !validBoundary(nextZhongQi, "zhongqi")) return false;
  if (
    previousJie.utcEpochMs > time.utcEpochMs
    || time.utcEpochMs >= nextJie.utcEpochMs
    || previousZhongQi.utcEpochMs > time.utcEpochMs
    || time.utcEpochMs >= nextZhongQi.utcEpochMs
  ) return false;
  return validEvidence(value.evidence, value);
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
  if (!validPrimitives(primitives, time)) {
    const coreIsValid = validPrimitiveCore(primitives);
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
      ruleId: "calendar/traditional-beijing-zi-v1",
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
