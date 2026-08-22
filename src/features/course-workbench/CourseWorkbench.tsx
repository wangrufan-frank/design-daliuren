import { RULE_STAGE_ORDER } from "../../domain/chart/stages";
import type { CourseInput, RuleStageId } from "../../domain/chart/types";
import { CourseExperience } from "../course-experience/CourseExperience";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { RuleStageRail } from "../rule-review/RuleStageRail";
import { CourseContextSummary } from "./CourseContextSummary";
import "./course-workbench.css";

interface CourseWorkbenchProps {
  input: CourseInput;
  source: ArtifactSourceResults;
  selectedStage: RuleStageId;
  onSelectStage(stage: RuleStageId): void;
  onRestart(): void;
}

export function CourseWorkbench({
  input,
  source,
  selectedStage,
  onSelectStage,
  onRestart,
}: CourseWorkbenchProps) {
  return (
    <main className="course-workbench">
      <header className="course-workbench__header">
        <p>传统术式 · 六阶段回看</p>
        <h1>大六壬演式</h1>
      </header>
      <div className="course-workbench__grid">
        <CourseContextSummary input={input} onRestart={onRestart} />
        <section className="course-workbench__stage" aria-label="三维阶段回看">
          <CourseExperience source={source} />
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
