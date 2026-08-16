import type { StemBranch } from "../calendar/types";
import type {
  CourseSession,
  EarthlyBranch,
  HeavenlyStem,
  RuleSnapshot,
} from "../chart/types";
import type { FourLessonId } from "../four-lessons/types";

export type TransmissionMethod =
  | "贼克" | "比用" | "涉害" | "遥克" | "昴星"
  | "别责" | "八专" | "伏吟" | "反吟";

export type TransmissionSubtype =
  | "始入" | "元首" | "重审" | "知一"
  | "见机" | "察微" | "缀瑕"
  | "蒿矢" | "弹射" | "虎视" | "冬蛇掩目"
  | "不虞" | "自任" | "自信" | "井栏";

export type TransmissionVariant = "复等" | "杜传";
export type SixRelation = "父母" | "子孙" | "官鬼" | "妻财" | "兄弟";
export type TransmissionPosition = "initial" | "middle" | "final";
export type FiveElement = "木" | "火" | "土" | "金" | "水";
export type Polarity = "yang" | "yin";

export type ThreeTransmissionsRuleId =
  | "three-transmissions/plate-classification-v1"
  | "three-transmissions/lesson-deduplication-v1"
  | "three-transmissions/vertical-relations-v1"
  | "three-transmissions/thief-overcoming-v1"
  | "three-transmissions/comparison-v1"
  | "three-transmissions/shehai-path-v1"
  | "three-transmissions/remote-overcoming-v1"
  | "three-transmissions/mao-star-v1"
  | "three-transmissions/separate-responsibility-v1"
  | "three-transmissions/eight-special-v1"
  | "three-transmissions/fuyin-v1"
  | "three-transmissions/fanyin-v1"
  | "three-transmissions/initial-v1"
  | "three-transmissions/middle-v1"
  | "three-transmissions/final-v1"
  | "three-transmissions/six-relation-v1";

export interface Transmission {
  position: TransmissionPosition;
  label: "初传" | "中传" | "末传";
  branch: EarthlyBranch;
  relation: SixRelation;
  derivation: string;
  evidenceIds: readonly string[];
}

export interface SheHaiPalaceEvidence {
  kind: "shehai-palace";
  candidateLesson: FourLessonId;
  earth: EarthlyBranch;
  branchElement: FiveElement;
  residentStems: readonly HeavenlyStem[];
  increment: number;
  total: number;
}

export interface ThreeTransmissionsEvidenceStep {
  id: string;
  ruleId: ThreeTransmissionsRuleId;
  phase: "plate" | "lessons" | "candidates" | "selection" | "initial" | "middle" | "final" | "relation";
  transmission?: TransmissionPosition;
  input: string;
  conclusion: string;
  details?: readonly SheHaiPalaceEvidence[];
}

export type EvidenceDraft = Omit<ThreeTransmissionsEvidenceStep, "id">;

export interface ThreeTransmissionsResult {
  dayPillar: StemBranch;
  plateOffset: number;
  method: TransmissionMethod;
  subtype?: TransmissionSubtype;
  variants: readonly TransmissionVariant[];
  transmissions: readonly [Transmission, Transmission, Transmission];
  evidence: readonly ThreeTransmissionsEvidenceStep[];
}

export type ThreeTransmissionsErrorCode =
  | "INVALID_THREE_TRANSMISSIONS_INPUT"
  | "THREE_TRANSMISSIONS_RULE_UNRESOLVED"
  | "THREE_TRANSMISSIONS_RESULT_INCOMPLETE";

export type ThreeTransmissionsSnapshot = RuleSnapshot<ThreeTransmissionsResult, "three-transmissions">;

export type ThreeTransmissionsOutcome =
  | { ok: true; value: ThreeTransmissionsResult; snapshot: ThreeTransmissionsSnapshot }
  | { ok: false; error: { code: ThreeTransmissionsErrorCode; message: string; cause?: unknown } };

export type ThreeTransmissionsStageOutcome =
  | { ok: true; value: ThreeTransmissionsResult; session: CourseSession }
  | {
      ok: false;
      error: { code: ThreeTransmissionsErrorCode; message: string; cause?: unknown };
      session: CourseSession;
    };
