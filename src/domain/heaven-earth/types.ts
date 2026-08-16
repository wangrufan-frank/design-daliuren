import type { MonthGeneralName } from "../calendar/types";
import type { CourseSession, EarthlyBranch, RuleSnapshot, ValueSource } from "../chart/types";

export interface HeavenEarthInputValue {
  branch: EarthlyBranch;
  source: ValueSource;
}

export interface HeavenEarthResult {
  monthGeneral: HeavenEarthInputValue & { name: MonthGeneralName };
  divinationHour: HeavenEarthInputValue;
  offset: number;
  palaces: readonly { earth: EarthlyBranch; heaven: EarthlyBranch }[];
  evidence: readonly {
    ruleId: string;
    field: "plate" | `palace.${EarthlyBranch}`;
    input: string;
    conclusion: string;
  }[];
}

export type HeavenEarthErrorCode =
  | "INVALID_HEAVEN_EARTH_INPUT"
  | "HEAVEN_EARTH_RESULT_INCOMPLETE";

export type HeavenEarthSnapshot = RuleSnapshot<HeavenEarthResult, "heaven-earth">;

export type HeavenEarthOutcome =
  | { ok: true; value: HeavenEarthResult; snapshot: HeavenEarthSnapshot }
  | { ok: false; error: { code: HeavenEarthErrorCode; message: string; cause?: unknown } };

export type HeavenEarthStageOutcome =
  | { ok: true; value: HeavenEarthResult; session: CourseSession }
  | { ok: false; error: { code: HeavenEarthErrorCode; message: string; cause?: unknown }; session: CourseSession };
