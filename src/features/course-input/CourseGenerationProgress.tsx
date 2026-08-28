import { useEffect, useRef } from "react";
import { RULE_STAGE_ORDER } from "../../domain/chart/stages";
import { reviewStageFor } from "../artifact-scene/timeline/review-stages";
import "./course-entry.css";

const COMPLETION_DELAY_MS = 720;

export function CourseGenerationProgress({
  onComplete,
  reducedMotion,
}: {
  onComplete(): void;
  reducedMotion: boolean;
}) {
  const completed = useRef(false);
  const stages = RULE_STAGE_ORDER.map(reviewStageFor);

  useEffect(() => {
    if (completed.current) return;

    if (reducedMotion) {
      completed.current = true;
      onComplete();
      return;
    }

    const timer = window.setTimeout(() => {
      if (completed.current) return;
      completed.current = true;
      onComplete();
    }, COMPLETION_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [onComplete, reducedMotion]);

  return (
    <section className="course-generation-progress" aria-label="课式生成进度">
      <p className="course-generation-progress__status" role="status">正在生成完整课式 · {stages[0].label}</p>
      <ol className="course-generation-progress__stages" aria-label="生成阶段">
        {stages.map((stage, index) => (
          <li key={stage.id} style={{ animationDelay: `${index * 120}ms` }}>{stage.label}</li>
        ))}
      </ol>
    </section>
  );
}
