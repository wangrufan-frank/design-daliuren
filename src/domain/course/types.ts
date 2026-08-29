import type { StemBranch, MonthGeneralName } from "../calendar/types";
import type { CourseSession, EarthlyBranch, NatalInfo, RuleSnapshot, RuleStageId } from "../chart/types";
import type { FourLessonId, FourLessonLabel, FourLessonLower } from "../four-lessons/types";
import type { GeneralDirection, HeavenlyGeneral, NobleDayNight } from "../heavenly-generals/types";
import type { SixRelation, TransmissionMethod, TransmissionPosition, TransmissionSubtype, TransmissionVariant } from "../three-transmissions/types";

export interface CourseResult {
  context: {
    civilDateTime: string;
    effectiveGanzhiDate: string;
    locationName?: string;
    reason: string;
    lunarDateDisplay: string;
    pillars: { year: StemBranch; month: StemBranch; day: StemBranch; hour: StemBranch };
    voidBranches: readonly [EarthlyBranch, EarthlyBranch];
    natal: NatalInfo;
    monthBuild: EarthlyBranch;
    monthGeneral: { name: MonthGeneralName; branch: EarthlyBranch };
    divinationHour: EarthlyBranch;
  };
  method: { method: TransmissionMethod; subtype?: TransmissionSubtype; variants: readonly TransmissionVariant[] };
  transmissions: readonly {
    position: TransmissionPosition;
    label: "初传" | "中传" | "末传";
    branch: EarthlyBranch;
    relation: SixRelation;
    general: HeavenlyGeneral;
  }[];
  lessons: readonly {
    id: FourLessonId;
    label: FourLessonLabel;
    upper: EarthlyBranch;
    lower: FourLessonLower;
    general: HeavenlyGeneral;
  }[];
  palaces: readonly {
    earth: EarthlyBranch;
    heaven: EarthlyBranch;
    general: HeavenlyGeneral;
    noble: boolean;
  }[];
  noble: {
    dayNight: NobleDayNight;
    nobleHeaven: EarthlyBranch;
    nobleEarth: EarthlyBranch;
    direction: GeneralDirection;
  };
}

export type CourseErrorCode =
  | "INVALID_COURSE_INPUT"
  | "COURSE_GENERAL_MAPPING_INCOMPLETE"
  | "COURSE_RESULT_GUARD_FAILED"
  | "COURSE_RESULT_INCOMPLETE";
export type CourseSnapshot = RuleSnapshot<CourseResult, "course">;
export type CourseOutcome =
  | { ok: true; value: CourseResult; snapshot: CourseSnapshot }
  | { ok: false; error: { code: CourseErrorCode; message: string; upstreamStage?: Exclude<RuleStageId, "course">; cause?: unknown } };
export type CourseStageOutcome =
  | { ok: true; value: CourseResult; session: CourseSession }
  | { ok: false; error: Extract<CourseOutcome, { ok: false }>["error"]; session: CourseSession };
