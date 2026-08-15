import type { StemBranch } from "../calendar/types";

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
  [Stage in RuleStageId]?: RuleSnapshot<unknown, Stage>;
};

export interface CourseSession {
  input: CourseInput;
  snapshots: RuleSnapshots;
}

export interface CourseResult {
  lessonType: "时课排盘" | "日课排盘" | "月课排盘";
  transmissions: readonly { label: "初传" | "中传" | "末传"; value: string; relation: string; general: string }[];
  lessons: readonly { label: "四课" | "三课" | "二课" | "一课"; upper: string; lower: string; general: string }[];
  palaces: readonly { branch: EarthlyBranch; heaven: EarthlyBranch; general: string }[];
  auxiliary: Readonly<Record<string, string>>;
}
