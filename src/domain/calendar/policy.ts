import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import {
  CALENDAR_RULE_IDS,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  JIA_ZI,
  JIE_TO_MONTH_BUILD,
  ZHONG_QI_TO_MONTH_GENERAL,
} from "./constants";
import type {
  BeijingDateTime,
  CalendarEngineInput,
  CalendarEvidenceStep,
  LunarDateValue,
  MonthGeneralName,
  SolarTermBoundary,
  StemBranch,
} from "./types";

export interface AutomaticCalendarResult {
  civilDateTime: string;
  effectiveGanzhiDate: string;
  lunarDate: LunarDateValue;
  pillars: { year: StemBranch; month: StemBranch; day: StemBranch; hour: StemBranch };
  monthBuild: EarthlyBranch;
  monthGeneral: { name: MonthGeneralName; branch: EarthlyBranch };
  divinationHour: EarthlyBranch;
  boundaries: {
    previousJie: SolarTermBoundary;
    nextJie: SolarTermBoundary;
    previousZhongQi: SolarTermBoundary;
    nextZhongQi: SolarTermBoundary;
  };
  evidence: readonly CalendarEvidenceStep[];
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function stemIndex(pillar: StemBranch): number {
  return HEAVENLY_STEMS.indexOf(pillar[0] as HeavenlyStem);
}

function activeBoundary(
  time: BeijingDateTime,
  previous: SolarTermBoundary,
  next: SolarTermBoundary,
): SolarTermBoundary {
  return time.utcEpochMs >= next.utcEpochMs ? next : previous;
}

function formatDate(time: BeijingDateTime, dayOffset: number): string {
  const date = new Date(Date.UTC(time.year, time.month - 1, time.day + dayOffset));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function nextStemBranch(value: StemBranch): StemBranch {
  const index = JIA_ZI.indexOf(value);
  if (index < 0) throw new Error(`无效干支：${value}`);
  return JIA_ZI[(index + 1) % JIA_ZI.length];
}

export function deriveYearPillar(time: BeijingDateTime, liChun: SolarTermBoundary): StemBranch {
  const effectiveYear = time.utcEpochMs >= liChun.utcEpochMs ? time.year : time.year - 1;
  const yearCycleIndex = modulo(effectiveYear - 1984, 60);
  return JIA_ZI[yearCycleIndex];
}

export function deriveMonthPillar(yearPillar: StemBranch, jieName: string): StemBranch {
  const monthOffsetFromYin = Object.keys(JIE_TO_MONTH_BUILD).indexOf(jieName);
  if (monthOffsetFromYin < 0) throw new Error(`未知节：${jieName}`);

  const yearStemIndex = stemIndex(yearPillar);
  const yinMonthStemIndex = ((yearStemIndex % 5) * 2 + 2) % 10;
  const monthStemIndex = (yinMonthStemIndex + monthOffsetFromYin) % 10;
  const monthBuild = JIE_TO_MONTH_BUILD[jieName as keyof typeof JIE_TO_MONTH_BUILD];
  return `${HEAVENLY_STEMS[monthStemIndex]}${monthBuild}` as StemBranch;
}

export function deriveDayPillar(civilDayPillar: StemBranch, time: BeijingDateTime): StemBranch {
  return time.hour === 23 ? nextStemBranch(civilDayPillar) : civilDayPillar;
}

function deriveHourBranch(time: BeijingDateTime): EarthlyBranch {
  const hourBranchIndex = Math.floor((time.hour + 1) / 2) % 12;
  return EARTHLY_BRANCHES[hourBranchIndex];
}

export function deriveHourPillar(dayPillar: StemBranch, time: BeijingDateTime): StemBranch {
  const hourBranchIndex = Math.floor((time.hour + 1) / 2) % 12;
  const dayStemIndex = stemIndex(dayPillar);
  const ziHourStemIndex = (dayStemIndex % 5) * 2;
  const hourStemIndex = (ziHourStemIndex + hourBranchIndex) % 10;
  return `${HEAVENLY_STEMS[hourStemIndex]}${EARTHLY_BRANCHES[hourBranchIndex]}` as StemBranch;
}

export function deriveMonthGeneral(zhongQiName: string): { name: MonthGeneralName; branch: EarthlyBranch } {
  const monthGeneral = ZHONG_QI_TO_MONTH_GENERAL[zhongQiName as keyof typeof ZHONG_QI_TO_MONTH_GENERAL];
  if (!monthGeneral) throw new Error(`未知中气：${zhongQiName}`);
  return monthGeneral;
}

export function deriveAutomaticCalendar({ time, primitives }: CalendarEngineInput): AutomaticCalendarResult {
  const jie = activeBoundary(time, primitives.previousJie, primitives.nextJie);
  const zhongQi = activeBoundary(time, primitives.previousZhongQi, primitives.nextZhongQi);
  const yearPillar = deriveYearPillar(time, primitives.liChun);
  const monthPillar = deriveMonthPillar(yearPillar, jie.name);
  const dayPillar = deriveDayPillar(primitives.civilDayPillar, time);
  const hourPillar = deriveHourPillar(dayPillar, time);
  const divinationHour = deriveHourBranch(time);
  const monthBuild = JIE_TO_MONTH_BUILD[jie.name as keyof typeof JIE_TO_MONTH_BUILD];
  const monthGeneral = deriveMonthGeneral(zhongQi.name);
  const effectiveGanzhiDate = formatDate(time, time.hour === 23 ? 1 : 0);
  const evidence: CalendarEvidenceStep[] = [
    {
      ruleId: CALENDAR_RULE_IDS.beijingTime,
      field: "civilDateTime",
      input: time.isoLocal,
      conclusion: `按固定 UTC+8 解释为北京时间 ${time.isoLocal}`,
    },
    {
      ruleId: CALENDAR_RULE_IDS.ziInitial,
      field: "effectiveGanzhiDate",
      input: `北京时间 ${time.isoLocal}，日界 23:00`,
      conclusion: `${time.hour === 23 ? "已进入子初新日" : "尚未进入子初新日"}，生效干支日期为 ${effectiveGanzhiDate}`,
    },
    {
      ruleId: CALENDAR_RULE_IDS.year,
      field: "yearPillar",
      input: `立春 ${primitives.liChun.beijingDateTime}`,
      conclusion: `${time.utcEpochMs >= primitives.liChun.utcEpochMs ? "已到" : "未到"}立春交接，年柱为 ${yearPillar}`,
    },
    {
      ruleId: CALENDAR_RULE_IDS.month,
      field: "monthPillar",
      input: `${jie.name} ${jie.beijingDateTime}`,
      conclusion: `当前节为${jie.name}，月建为${monthBuild}，月柱为${monthPillar}`,
    },
    {
      ruleId: CALENDAR_RULE_IDS.day,
      field: "dayPillar",
      input: `民用日柱 ${primitives.civilDayPillar}`,
      conclusion: `按生效干支日期 ${effectiveGanzhiDate} 取日柱 ${dayPillar}`,
    },
    {
      ruleId: CALENDAR_RULE_IDS.hourBranch,
      field: "divinationHour",
      input: `北京时间 ${time.isoLocal.slice(11)}`,
      conclusion: `当前双时辰为${divinationHour}时，占时为${divinationHour}`,
    },
    {
      ruleId: CALENDAR_RULE_IDS.hourStem,
      field: "hourPillar",
      input: `生效日柱 ${dayPillar}，时支 ${divinationHour}`,
      conclusion: `由生效日干推得时柱 ${hourPillar}`,
    },
    {
      ruleId: CALENDAR_RULE_IDS.monthGeneral,
      field: "monthGeneral",
      input: `${zhongQi.name} ${zhongQi.beijingDateTime}`,
      conclusion: `当前中气为${zhongQi.name}，月将为${monthGeneral.name}（${monthGeneral.branch}）`,
    },
  ];

  return {
    civilDateTime: time.isoLocal,
    effectiveGanzhiDate,
    lunarDate: primitives.lunarDate,
    pillars: { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar },
    monthBuild,
    monthGeneral,
    divinationHour,
    boundaries: {
      previousJie: primitives.previousJie,
      nextJie: primitives.nextJie,
      previousZhongQi: primitives.previousZhongQi,
      nextZhongQi: primitives.nextZhongQi,
    },
    evidence,
  };
}
