import type { CalendarCorrectionField } from "../../domain/calendar/types";
import type { RuleStageId } from "../../domain/chart/types";
import { CalendarReview } from "../calendar-review/CalendarReview";
import { CourseSheet } from "../course-sheet/CourseSheet";
import { FourLessonsReview } from "../four-lessons-review/FourLessonsReview";
import { HeavenlyGeneralsReview } from "../heavenly-generals-review/HeavenlyGeneralsReview";
import { HeavenEarthReview } from "../heaven-earth-review/HeavenEarthReview";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { ThreeTransmissionsReview } from "../three-transmissions-review/ThreeTransmissionsReview";

interface StageReviewContentProps {
  stage: RuleStageId;
  source: ArtifactSourceResults;
  onSelectStage(stage: RuleStageId): void;
  onSetCalendarCorrection?(field: CalendarCorrectionField, rawValue: string): void;
  onResetCalendarCorrection?(field: CalendarCorrectionField): void;
  calendarCorrectionError?: { field: CalendarCorrectionField; message: string };
}

const noOp = () => undefined;

export function StageReviewContent({
  stage,
  source,
  onSelectStage,
  onSetCalendarCorrection = noOp,
  onResetCalendarCorrection = noOp,
  calendarCorrectionError,
}: StageReviewContentProps) {
  switch (stage) {
    case "calendar":
      return <CalendarReview result={source.calendar} onSetCorrection={onSetCalendarCorrection} onResetCorrection={onResetCalendarCorrection} correctionError={calendarCorrectionError} />;
    case "heaven-earth":
      return <HeavenEarthReview result={source.plate} />;
    case "four-lessons":
      return <FourLessonsReview result={source.lessons} generals={source.generals} onReviewCalendar={() => onSelectStage("calendar")} onReviewHeavenEarth={() => onSelectStage("heaven-earth")} />;
    case "three-transmissions":
      return <ThreeTransmissionsReview result={source.transmissions} generals={source.generals} onReviewFourLessons={() => onSelectStage("four-lessons")} onReviewHeavenEarth={() => onSelectStage("heaven-earth")} />;
    case "heavenly-generals":
      return <HeavenlyGeneralsReview result={source.generals} fourLessons={source.lessons} threeTransmissions={source.transmissions} onReviewCalendar={() => onSelectStage("calendar")} onReviewHeavenEarth={() => onSelectStage("heaven-earth")} onReviewFourLessons={() => onSelectStage("four-lessons")} onReviewThreeTransmissions={() => onSelectStage("three-transmissions")} />;
    case "course":
      return <CourseSheet result={source.course} />;
  }
}
