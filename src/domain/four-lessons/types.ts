import type { StemBranch } from "../calendar/types";
import type {
  CourseSession,
  EarthlyBranch,
  HeavenlyStem,
  RuleSnapshot,
} from "../chart/types";

export type FourLessonId = "first" | "second" | "third" | "fourth";
export type FourLessonLabel = "一课" | "二课" | "三课" | "四课";
export type FourLessonLower =
  | { kind: "stem"; value: HeavenlyStem }
  | { kind: "branch"; value: EarthlyBranch };

export interface FourLesson {
  id: FourLessonId;
  label: FourLessonLabel;
  upper: EarthlyBranch;
  lower: FourLessonLower;
  lookupEarth: EarthlyBranch;
}

export interface FourLessonsEvidenceStep {
  ruleId: "four-lessons/stem-residence-v1" | "four-lessons/derive-v1";
  lesson: FourLessonId;
  input: string;
  lookupEarth: EarthlyBranch;
  conclusion: string;
}

export interface FourLessonsResult {
  dayPillar: StemBranch;
  stemResidence: { stem: HeavenlyStem; earth: EarthlyBranch };
  lessons: readonly [FourLesson, FourLesson, FourLesson, FourLesson];
  evidence: readonly FourLessonsEvidenceStep[];
}

export type FourLessonsErrorCode =
  | "INVALID_FOUR_LESSONS_INPUT"
  | "FOUR_LESSONS_RESULT_INCOMPLETE";
export type FourLessonsSnapshot = RuleSnapshot<FourLessonsResult, "four-lessons">;
export type FourLessonsOutcome =
  | { ok: true; value: FourLessonsResult; snapshot: FourLessonsSnapshot }
  | { ok: false; error: { code: FourLessonsErrorCode; message: string; cause?: unknown } };
export type FourLessonsStageOutcome =
  | { ok: true; value: FourLessonsResult; session: CourseSession }
  | {
      ok: false;
      error: { code: FourLessonsErrorCode; message: string; cause?: unknown };
      session: CourseSession;
    };
