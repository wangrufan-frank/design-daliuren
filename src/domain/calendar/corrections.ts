import type { CourseInput, EarthlyBranch } from "../chart/types";
import { CALENDAR_RULE_IDS, EARTHLY_BRANCHES, ZHONG_QI_TO_MONTH_GENERAL, isStemBranch } from "./constants";
import { deriveVoidBranches, type AutomaticCalendarResult } from "./policy";
import {
  CalendarDomainError,
  type CalendarCorrectionField,
  type CalendarEvidenceStep,
  type CalendarResult,
  type ReviewedValue,
  type StemBranch,
} from "./types";

const PILLAR_FIELDS = new Set<CalendarCorrectionField>([
  "yearPillar",
  "monthPillar",
  "dayPillar",
  "hourPillar",
]);

function correctionError(field: CalendarCorrectionField): CalendarDomainError {
  return new CalendarDomainError({
    code: "INVALID_CALENDAR_CORRECTION",
    message: "人工修正值无效",
    field,
  });
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function assertCorrection(field: CalendarCorrectionField, value: unknown): void {
  if (PILLAR_FIELDS.has(field) ? typeof value !== "string" || !isStemBranch(value) : !isBranch(value)) {
    throw correctionError(field);
  }
}

export function setCalendarCorrection(
  input: CourseInput,
  field: CalendarCorrectionField,
  rawValue: string,
): CourseInput {
  assertCorrection(field, rawValue);
  return {
    ...input,
    corrections: { ...input.corrections, [field]: rawValue },
  } as CourseInput;
}

export function resetCalendarCorrection(input: CourseInput, field: CalendarCorrectionField): CourseInput {
  const corrections = { ...input.corrections };
  delete corrections[field];
  return { ...input, corrections };
}

function reviewed<T>(automatic: T, correction: T | undefined): ReviewedValue<T> {
  return correction === undefined
    ? { automatic, effective: automatic, source: "automatic" }
    : { automatic, effective: correction, source: "manual" };
}

function correctionValue(
  corrections: CourseInput["corrections"],
  field: CalendarCorrectionField,
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(corrections, field)) return undefined;
  const value = corrections[field];
  assertCorrection(field, value);
  return value;
}

function manualEvidence(
  field: CalendarCorrectionField,
  automatic: string,
  effective: string,
): CalendarEvidenceStep {
  return {
    ruleId: CALENDAR_RULE_IDS.correction,
    field,
    input: `自动值 ${automatic}，人工值 ${effective}`,
    conclusion: `${field} 采用人工有效值 ${effective}`,
  };
}

export function applyCalendarCorrections(
  automatic: AutomaticCalendarResult,
  corrections: CourseInput["corrections"],
): CalendarResult {
  if (!corrections || typeof corrections !== "object" || Array.isArray(corrections)) {
    throw correctionError("yearPillar");
  }
  for (const field of Object.keys(corrections)) {
    if (![...PILLAR_FIELDS, "monthGeneral", "divinationHour"].includes(field as CalendarCorrectionField)) {
      throw correctionError("yearPillar");
    }
  }

  const yearPillar = correctionValue(corrections, "yearPillar") as StemBranch | undefined;
  const monthPillar = correctionValue(corrections, "monthPillar") as StemBranch | undefined;
  const dayPillar = correctionValue(corrections, "dayPillar") as StemBranch | undefined;
  const hourPillar = correctionValue(corrections, "hourPillar") as StemBranch | undefined;
  const monthGeneralBranch = correctionValue(corrections, "monthGeneral") as EarthlyBranch | undefined;
  const divinationHour = correctionValue(corrections, "divinationHour") as EarthlyBranch | undefined;
  const monthGeneral = monthGeneralBranch === undefined
    ? undefined
    : Object.values(ZHONG_QI_TO_MONTH_GENERAL).find(({ branch }) => branch === monthGeneralBranch);
  if (monthGeneralBranch !== undefined && !monthGeneral) throw correctionError("monthGeneral");

  const correctionEvidence = [
    yearPillar === undefined ? undefined : manualEvidence("yearPillar", automatic.pillars.year, yearPillar),
    monthPillar === undefined ? undefined : manualEvidence("monthPillar", automatic.pillars.month, monthPillar),
    dayPillar === undefined ? undefined : manualEvidence("dayPillar", automatic.pillars.day, dayPillar),
    hourPillar === undefined ? undefined : manualEvidence("hourPillar", automatic.pillars.hour, hourPillar),
    monthGeneral === undefined ? undefined : manualEvidence(
      "monthGeneral",
      `${automatic.monthGeneral.name}（${automatic.monthGeneral.branch}）`,
      `${monthGeneral.name}（${monthGeneral.branch}）`,
    ),
    divinationHour === undefined ? undefined : manualEvidence("divinationHour", automatic.divinationHour, divinationHour),
  ].filter((step): step is CalendarEvidenceStep => step !== undefined);

  return {
    ...automatic,
    pillars: {
      year: reviewed(automatic.pillars.year, yearPillar),
      month: reviewed(automatic.pillars.month, monthPillar),
      day: reviewed(automatic.pillars.day, dayPillar),
      hour: reviewed(automatic.pillars.hour, hourPillar),
    },
    voidBranches: deriveVoidBranches(dayPillar ?? automatic.pillars.day),
    monthGeneral: reviewed(automatic.monthGeneral, monthGeneral),
    divinationHour: reviewed(automatic.divinationHour, divinationHour),
    evidence: [...automatic.evidence, ...correctionEvidence],
  };
}
