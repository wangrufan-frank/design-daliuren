import { RULE_STAGE_ORDER } from "../../domain/chart/stages";
import type { CourseInput, RuleStageId } from "../../domain/chart/types";
import type { CalendarCorrectionField } from "../../domain/calendar/types";
import { CourseExperience } from "../course-experience/CourseExperience";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { RuleStageRail } from "../rule-review/RuleStageRail";
import { CourseContextSummary } from "./CourseContextSummary";
import { StageEvidenceDrawer } from "./StageEvidenceDrawer";
import { StageReviewContent } from "../rule-review/StageReviewContent";
import { reviewStageFor } from "../artifact-scene/timeline/review-stages";
import { useState } from "react";
import type { MobileToolId } from "./MobileWorkbenchTools";
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
  input,
  source,
  selectedStage,
  onSelectStage,
  onSetCalendarCorrection,
  onResetCalendarCorrection,
  calendarCorrectionError,
  stageErrorMessage,
  onRestart,
}: CourseWorkbenchProps) {
  const stage = reviewStageFor(selectedStage);
  const [activeMobileTool, setActiveMobileTool] = useState<MobileToolId>();
  const context = <CourseContextSummary input={input} onRestart={onRestart} />;
  const evidence = (
    <StageReviewContent
      stage={selectedStage}
      source={source}
      onSelectStage={onSelectStage}
      onSetCalendarCorrection={onSetCalendarCorrection}
      onResetCalendarCorrection={onResetCalendarCorrection}
      calendarCorrectionError={calendarCorrectionError}
    />
  );
  return (
    <main className="course-workbench">
      <header className="course-workbench__header">
        <p>传统术式 · 六阶段回看</p>
        <h1>大六壬演式</h1>
      </header>
      {stageErrorMessage ? <p className="course-workbench__error" role="alert">{stageErrorMessage}</p> : null}
      <div className="course-workbench__grid">
        {context}
        <section className="course-workbench__stage" aria-label="三维阶段回看">
          <CourseExperience
            source={source}
            selectedStage={selectedStage}
            mobileTools={{
              activeTool: activeMobileTool,
              onActiveToolChange: setActiveMobileTool,
              onSelectStage,
              context: <CourseContextSummary input={input} onRestart={onRestart} />,
              evidence,
            }}
          />
          <StageEvidenceDrawer stage={stage}>
            {evidence}
          </StageEvidenceDrawer>
        </section>
        <nav className="course-workbench__stages" aria-label="推演阶段">
          <p>六阶段校准</p>
          <RuleStageRail
            completed={RULE_STAGE_ORDER}
            selected={selectedStage}
            onSelect={onSelectStage}
          />
        </nav>
      </div>
    </main>
  );
}
