import type { CalendarResult } from "../../../domain/calendar/types";
import type { EarthlyBranch } from "../../../domain/chart/types";
import type { CourseResult } from "../../../domain/course/types";
import type { FourLessonsResult } from "../../../domain/four-lessons/types";
import type { HeavenlyGeneralsResult } from "../../../domain/heavenly-generals/types";
import type { HeavenEarthResult } from "../../../domain/heaven-earth/types";
import type { ThreeTransmissionsResult } from "../../../domain/three-transmissions/types";

export interface ArtifactSourceResults {
  calendar: CalendarResult;
  plate: HeavenEarthResult;
  lessons: FourLessonsResult;
  transmissions: ThreeTransmissionsResult;
  generals: HeavenlyGeneralsResult;
  course: CourseResult;
}

export interface ArtifactDisplayState {
  calendar: {
    pillars: readonly [string, string, string, string];
    monthBuild: EarthlyBranch;
    monthGeneral: string;
    divinationHour: EarthlyBranch;
    manualFields: readonly string[];
  };
  plate: { offset: number; palaces: readonly { earth: EarthlyBranch; heaven: EarthlyBranch }[] };
  lessons: CourseResult["lessons"];
  transmissions: CourseResult["transmissions"];
  methodLabel: string;
  generals: HeavenlyGeneralsResult["placements"];
  noble: CourseResult["noble"];
}
