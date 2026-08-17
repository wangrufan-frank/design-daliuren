import type { CalendarSnapshot, StemBranch } from "../calendar/types";

export type EarthlyBranch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳"
  | "午" | "未" | "申" | "酉" | "戌" | "亥";

export type HeavenlyStem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸";

export type RuleStageId =
  | "calendar"
  | "heaven-earth"
  | "four-lessons"
  | "three-transmissions"
  | "heavenly-generals"
  | "course";

export type ValueSource = "automatic" | "manual";

export interface CourseInput {
  civilDateTime: string;
  timeZone: "Asia/Shanghai";
  locationName: string;
  longitude: number;
  latitude: number;
  corrections: Partial<{
    yearPillar: StemBranch;
    monthPillar: StemBranch;
    dayPillar: StemBranch;
    hourPillar: StemBranch;
    monthGeneral: EarthlyBranch;
    divinationHour: EarthlyBranch;
  }>;
}

export interface RuleSnapshot<T, Stage extends RuleStageId = RuleStageId> {
  stage: Stage;
  dependsOn: readonly RuleStageId[];
  ruleId: string;
  source: ValueSource;
  value: T;
}

export type RuleSnapshots = {
  calendar?: CalendarSnapshot;
} & {
  [Stage in Exclude<RuleStageId, "calendar">]?: RuleSnapshot<unknown, Stage>;
};

export interface CourseSession {
  input: CourseInput;
  snapshots: RuleSnapshots;
}
