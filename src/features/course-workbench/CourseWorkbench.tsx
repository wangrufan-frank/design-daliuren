import type { CourseInput, RuleStageId } from "../../domain/chart/types";
import type { CalendarCorrectionField } from "../../domain/calendar/types";
import { CourseExperience } from "../course-experience/CourseExperience";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import "./course-workbench.css";

interface CourseWorkbenchProps {
  input: CourseInput;
  source: ArtifactSourceResults;
  selectedStage: RuleStageId;
  onSelectStage(stage: RuleStageId): void;
  onSetCalendarCorrection?(field: CalendarCorrectionField, rawValue: string): void;
  onResetCalendarCorrection?(field: CalendarCorrectionField): void;
  calendarCorrectionError?: { field: CalendarCorrectionField; message: string };
  stageErrorMessage?: string;
  onRestart(): void;
}

export function CourseWorkbench({
  source,
  stageErrorMessage,
}: CourseWorkbenchProps) {
  return (
    <main className="course-workbench">
      <header className="course-workbench__header">
        <p>传统术式</p>
        <h1>大六壬演式</h1>
      </header>
      {stageErrorMessage ? <p className="course-workbench__error" role="alert">{stageErrorMessage}</p> : null}
      <div className="course-workbench__content">
        <section className="course-workbench__stage" aria-label="课式展示">
          <CourseExperience source={source} />
        </section>
      </div>
    </main>
  );
}
