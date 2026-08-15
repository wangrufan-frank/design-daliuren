import type { CourseInput, EarthlyBranch, HeavenlyStem, RuleSnapshot } from "../chart/types";

export type StemBranch = `${HeavenlyStem}${EarthlyBranch}`;
export type MonthGeneralName = "登明" | "河魁" | "从魁" | "传送" | "小吉" | "胜光" | "太乙" | "天罡" | "太冲" | "功曹" | "大吉" | "神后";
export type CalendarCorrectionField = "yearPillar" | "monthPillar" | "dayPillar" | "hourPillar" | "monthGeneral" | "divinationHour";

export interface BeijingDateTime {
  isoLocal: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  utcEpochMs: number;
}

export interface ReviewedValue<T> {
  automatic: T;
  effective: T;
  source: "automatic" | "manual";
}

export interface SolarTermBoundary {
  name: string;
  kind: "jie" | "zhongqi";
  beijingDateTime: string;
  utcEpochMs: number;
}

export interface LunarDateValue {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  display: string;
}

export interface CalendarEvidenceStep {
  ruleId: string;
  field: string;
  input: string;
  conclusion: string;
}

export interface CalendarPrimitives {
  lunarDate: LunarDateValue;
  civilDayPillar: StemBranch;
  liChun: SolarTermBoundary;
  previousJie: SolarTermBoundary;
  nextJie: SolarTermBoundary;
  previousZhongQi: SolarTermBoundary;
  nextZhongQi: SolarTermBoundary;
}

export interface CalendarResult {
  civilDateTime: string;
  effectiveGanzhiDate: string;
  lunarDate: LunarDateValue;
  pillars: {
    year: ReviewedValue<StemBranch>;
    month: ReviewedValue<StemBranch>;
    day: ReviewedValue<StemBranch>;
    hour: ReviewedValue<StemBranch>;
  };
  monthBuild: EarthlyBranch;
  monthGeneral: ReviewedValue<{ name: MonthGeneralName; branch: EarthlyBranch }>;
  divinationHour: ReviewedValue<EarthlyBranch>;
  boundaries: {
    previousJie: SolarTermBoundary;
    nextJie: SolarTermBoundary;
    previousZhongQi: SolarTermBoundary;
    nextZhongQi: SolarTermBoundary;
  };
  evidence: readonly CalendarEvidenceStep[];
}

export type CalendarErrorCode =
  | "OUT_OF_SUPPORTED_RANGE"
  | "INVALID_BEIJING_DATETIME"
  | "CALENDAR_ADAPTER_FAILURE"
  | "SOLAR_TERM_BOUNDARY_FAILURE"
  | "INVALID_CALENDAR_CORRECTION"
  | "CALENDAR_RESULT_INCOMPLETE"
  | "CROSS_CHECK_DISCREPANCY";

export interface CalendarError {
  code: CalendarErrorCode;
  message: string;
  field?: CalendarCorrectionField;
}

export class CalendarDomainError extends Error {
  constructor(public readonly detail: CalendarError) {
    super(detail.message);
  }
}

export type CalendarOutcome =
  | { ok: true; value: CalendarResult; snapshot: CalendarSnapshot }
  | { ok: false; error: CalendarError };
export type CalendarSnapshot = RuleSnapshot<CalendarResult, "calendar">;

export interface CalendarAdapter {
  read(time: BeijingDateTime): CalendarPrimitives;
}

export interface CalendarEngineInput {
  input: CourseInput;
  time: BeijingDateTime;
  primitives: CalendarPrimitives;
}
