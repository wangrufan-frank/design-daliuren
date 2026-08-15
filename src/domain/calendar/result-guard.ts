import type { EarthlyBranch, ValueSource } from "../chart/types";
import { parseBeijingDateTime } from "./beijing-time";
import {
  CALENDAR_RULE_IDS,
  EARTHLY_BRANCHES,
  JIE_TO_MONTH_BUILD,
  ZHONG_QI_TO_MONTH_GENERAL,
  isStemBranch,
} from "./constants";
import { deriveHourBranch, deriveHourPillar, deriveMonthPillar } from "./policy";
import type {
  BeijingDateTime,
  CalendarPrimitives,
  CalendarResult,
  ReviewedValue,
  SolarTermBoundary,
} from "./types";

export const CALENDAR_SNAPSHOT_RULE_ID = "calendar/traditional-beijing-zi-v1";

const JIE_NAMES = Object.keys(JIE_TO_MONTH_BUILD);
const ZHONG_QI_NAMES = Object.keys(ZHONG_QI_TO_MONTH_GENERAL);
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

function isReviewed<T>(
  value: unknown,
  valid: (candidate: unknown) => candidate is T,
  equal: (automatic: T, effective: T) => boolean,
): value is ReviewedValue<T> {
  if (!isRecord(value) || !valid(value.automatic) || !valid(value.effective)) return false;
  if (value.source !== "automatic" && value.source !== "manual") return false;
  return value.source === "manual" || equal(value.automatic, value.effective);
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

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validBoundary(value: unknown, kind: SolarTermBoundary["kind"]): value is SolarTermBoundary {
  if (!isRecord(value) || value.kind !== kind || typeof value.name !== "string") return false;
  const names = kind === "jie" ? JIE_NAMES : ZHONG_QI_NAMES;
  const epoch = fixedUtc8Epoch(value.beijingDateTime);
  return names.includes(value.name)
    && epoch !== undefined
    && typeof value.utcEpochMs === "number"
    && Number.isFinite(value.utcEpochMs)
    && value.utcEpochMs === epoch;
}

function adjacent(previous: string, next: string, names: readonly string[]): boolean {
  const previousIndex = names.indexOf(previous);
  return previousIndex >= 0 && names[(previousIndex + 1) % names.length] === next;
}

function validLunarDate(value: unknown): boolean {
  return isRecord(value)
    && Number.isInteger(value.year)
    && Number(value.year) >= 1899
    && Number(value.year) <= 2100
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

function validMonthGeneral(value: unknown): value is CalendarResult["monthGeneral"]["automatic"] {
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

export function hasValidCalendarPrimitiveCore(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && validLunarDate(value.lunarDate)
    && typeof value.civilDayPillar === "string"
    && isStemBranch(value.civilDayPillar);
}

export function isCalendarPrimitives(value: unknown, time: BeijingDateTime): value is CalendarPrimitives {
  if (!hasValidCalendarPrimitiveCore(value)) return false;
  if (!validBoundary(value.liChun, "jie") || value.liChun.name !== "立春") return false;
  if (!validBoundary(value.previousJie, "jie") || !validBoundary(value.nextJie, "jie")) return false;
  if (!validBoundary(value.previousZhongQi, "zhongqi") || !validBoundary(value.nextZhongQi, "zhongqi")) return false;
  return value.previousJie.utcEpochMs <= time.utcEpochMs
    && time.utcEpochMs < value.nextJie.utcEpochMs
    && adjacent(value.previousJie.name, value.nextJie.name, JIE_NAMES)
    && value.previousZhongQi.utcEpochMs <= time.utcEpochMs
    && time.utcEpochMs < value.nextZhongQi.utcEpochMs
    && adjacent(value.previousZhongQi.name, value.nextZhongQi.name, ZHONG_QI_NAMES);
}

export function isCalendarResult(value: unknown): value is CalendarResult {
  if (!isRecord(value) || typeof value.civilDateTime !== "string") return false;
  let time: BeijingDateTime;
  try {
    time = parseBeijingDateTime(value.civilDateTime);
  } catch {
    return false;
  }
  if (time.isoLocal !== value.civilDateTime) return false;
  if (!validIsoDate(value.effectiveGanzhiDate) || value.effectiveGanzhiDate !== expectedGanzhiDate(time)) return false;
  if (!validLunarDate(value.lunarDate) || !isBranch(value.monthBuild)) return false;
  if (!isRecord(value.pillars)) return false;
  const validPillar = (candidate: unknown): candidate is CalendarResult["pillars"]["year"]["automatic"] => (
    typeof candidate === "string" && isStemBranch(candidate)
  );
  if (!isReviewed(value.pillars.year, validPillar, (automatic, effective) => automatic === effective)) return false;
  if (!isReviewed(value.pillars.month, validPillar, (automatic, effective) => automatic === effective)) return false;
  if (!isReviewed(value.pillars.day, validPillar, (automatic, effective) => automatic === effective)) return false;
  if (!isReviewed(value.pillars.hour, validPillar, (automatic, effective) => automatic === effective)) return false;
  if (!isReviewed(
    value.monthGeneral,
    validMonthGeneral,
    (automatic, effective) => automatic.name === effective.name && automatic.branch === effective.branch,
  )) return false;
  if (!isReviewed(value.divinationHour, isBranch, (automatic, effective) => automatic === effective)) return false;
  if (!isRecord(value.boundaries)) return false;
  const { previousJie, nextJie, previousZhongQi, nextZhongQi } = value.boundaries;
  if (!validBoundary(previousJie, "jie") || !validBoundary(nextJie, "jie")) return false;
  if (!validBoundary(previousZhongQi, "zhongqi") || !validBoundary(nextZhongQi, "zhongqi")) return false;
  if (
    previousJie.utcEpochMs > time.utcEpochMs
    || time.utcEpochMs >= nextJie.utcEpochMs
    || !adjacent(previousJie.name, nextJie.name, JIE_NAMES)
    || previousZhongQi.utcEpochMs > time.utcEpochMs
    || time.utcEpochMs >= nextZhongQi.utcEpochMs
    || !adjacent(previousZhongQi.name, nextZhongQi.name, ZHONG_QI_NAMES)
  ) return false;
  if (value.monthBuild !== JIE_TO_MONTH_BUILD[previousJie.name as keyof typeof JIE_TO_MONTH_BUILD]) return false;
  if (value.divinationHour.automatic !== deriveHourBranch(time)) return false;
  if (value.pillars.month.automatic !== deriveMonthPillar(value.pillars.year.automatic, previousJie.name)) return false;
  if (value.pillars.hour.automatic !== deriveHourPillar(value.pillars.day.automatic, time)) return false;
  const expectedMonthGeneral = ZHONG_QI_TO_MONTH_GENERAL[
    previousZhongQi.name as keyof typeof ZHONG_QI_TO_MONTH_GENERAL
  ];
  if (
    value.monthGeneral.automatic.name !== expectedMonthGeneral.name
    || value.monthGeneral.automatic.branch !== expectedMonthGeneral.branch
  ) return false;
  return validEvidence(value.evidence, value);
}

export function calendarResultSource(value: CalendarResult): ValueSource {
  return [
    value.pillars.year,
    value.pillars.month,
    value.pillars.day,
    value.pillars.hour,
    value.monthGeneral,
    value.divinationHour,
  ].some(({ source }) => source === "manual") ? "manual" : "automatic";
}
