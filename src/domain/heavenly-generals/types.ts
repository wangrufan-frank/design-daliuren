import type { CourseSession, EarthlyBranch, HeavenlyStem, RuleSnapshot } from "../chart/types";

export type HeavenlyGeneral = "贵人" | "螣蛇" | "朱雀" | "六合" | "勾陈" | "青龙" | "天空" | "白虎" | "太常" | "玄武" | "太阴" | "天后";
export type NobleDayNight = "day" | "night";
export type GeneralDirection = "forward" | "reverse";
export interface GeneralPlacement { order: number; general: HeavenlyGeneral; earth: EarthlyBranch; heaven: EarthlyBranch; evidenceId: string; }
type EvidenceBase = { id: string; input: string; conclusion: string };
export type HeavenlyGeneralsEvidenceStep =
  | (EvidenceBase & { ruleId: "heavenly-generals/day-night-v1"; phase: "day-night"; details: { divinationHour: EarthlyBranch; dayNight: NobleDayNight } })
  | (EvidenceBase & { ruleId: "heavenly-generals/noble-branch-v1"; phase: "noble-branch"; details: { dayStem: HeavenlyStem; dayNight: NobleDayNight; dayNoble: EarthlyBranch; nightNoble: EarthlyBranch; selected: EarthlyBranch } })
  | (EvidenceBase & { ruleId: "heavenly-generals/noble-palace-v1"; phase: "noble-palace"; details: { nobleHeaven: EarthlyBranch; nobleEarth: EarthlyBranch } })
  | (EvidenceBase & { ruleId: "heavenly-generals/direction-v1"; phase: "direction"; details: { nobleEarth: EarthlyBranch; direction: GeneralDirection } })
  | (EvidenceBase & { ruleId: "heavenly-generals/placement-v1"; phase: "placement"; details: { order: number; general: HeavenlyGeneral; previousEarth?: EarthlyBranch; earth: EarthlyBranch; heaven: EarthlyBranch; direction: GeneralDirection } });
export interface HeavenlyGeneralsResult { dayStem: HeavenlyStem; divinationHour: EarthlyBranch; dayNight: NobleDayNight; nobleHeaven: EarthlyBranch; nobleEarth: EarthlyBranch; direction: GeneralDirection; placements: readonly GeneralPlacement[]; evidence: readonly HeavenlyGeneralsEvidenceStep[]; }
export type HeavenlyGeneralsErrorCode = "INVALID_HEAVENLY_GENERALS_INPUT" | "NOBLE_BRANCH_LOOKUP_FAILED" | "NOBLE_PALACE_NOT_UNIQUE" | "HEAVENLY_GENERALS_RESULT_INCOMPLETE";
export type HeavenlyGeneralsSnapshot = RuleSnapshot<HeavenlyGeneralsResult, "heavenly-generals">;
export type HeavenlyGeneralsOutcome = { ok: true; value: HeavenlyGeneralsResult; snapshot: HeavenlyGeneralsSnapshot } | { ok: false; error: { code: HeavenlyGeneralsErrorCode; message: string; cause?: unknown } };
export type HeavenlyGeneralsStageOutcome = { ok: true; value: HeavenlyGeneralsResult; session: CourseSession } | { ok: false; error: { code: HeavenlyGeneralsErrorCode; message: string; cause?: unknown }; session: CourseSession };
