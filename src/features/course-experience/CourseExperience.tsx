import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArtifactExperience } from "../artifact-scene/ArtifactExperience";
import { mapArtifactState } from "../artifact-scene/model/map-artifact-state";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { CourseSheet } from "../course-sheet/CourseSheet";
import type { RuleStageId } from "../../domain/chart/types";
import { reviewStageFor } from "../artifact-scene/timeline/review-stages";
import type { MobileToolId } from "../course-workbench/MobileWorkbenchTools";

type CourseMode = "artifact" | "text";

function subscribeToMobileWorkbench(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function mobileWorkbenchSnapshot(): boolean {
  return window.innerWidth < 900;
}

export interface CourseExperienceMobileTools {
  activeTool?: MobileToolId;
  onActiveToolChange(tool?: MobileToolId): void;
  onSelectStage(stage: RuleStageId): void;
  context: ReactNode;
  evidence: ReactNode;
}

interface CourseExperienceProps {
  source: ArtifactSourceResults;
  selectedStage?: RuleStageId;
  mobileTools?: CourseExperienceMobileTools;
}

export function CourseExperience({ source, selectedStage = "calendar", mobileTools }: CourseExperienceProps) {
  const [requestedMode, setRequestedMode] = useState<CourseMode>("artifact");
  const mobileLayout = useSyncExternalStore(subscribeToMobileWorkbench, mobileWorkbenchSnapshot, () => false);
  const artifactAvailable = useMemo(() => {
    try {
      mapArtifactState(source);
      return true;
    } catch {
      return false;
    }
  }, [source]);
  const mode: CourseMode = artifactAvailable
    ? mobileTools ? (mobileTools.activeTool === "course" ? "text" : "artifact") : requestedMode
    : "text";
  const stage = reviewStageFor(selectedStage);
  const selectMode = (nextMode: CourseMode) => {
    if (mobileTools) mobileTools.onActiveToolChange(nextMode === "text" ? "course" : undefined);
    else setRequestedMode(nextMode);
  };
  const showArtifact = artifactAvailable && (mode === "artifact" || (mobileTools !== undefined && mobileLayout));

  return (
    <section className="course-experience" data-mode={mode}>
      <div className="course-experience__modes" role="toolbar" aria-label="课式视图">
        <button
          type="button"
          aria-pressed={mode === "artifact"}
          disabled={!artifactAvailable}
          onClick={() => selectMode("artifact")}
        >
          三维推演
        </button>
        <button
          type="button"
          aria-pressed={mode === "text"}
          onClick={() => selectMode("text")}
        >
          文字课式
        </button>
      </div>
      <div className="course-experience__stage">
        {showArtifact ? (
          <ArtifactExperience
            source={source}
            selectedStage={selectedStage}
            onShowCourse={() => selectMode("text")}
            mobileTools={mobileTools && mobileLayout ? {
              ...mobileTools,
              selectedStage,
              course: <CourseSheet result={source.course} />,
            } : undefined}
          />
        ) : (
          <CourseSheet result={source.course} />
        )}
      </div>
      <div className="course-experience__caption" aria-label={`${stage.label}阶段说明`}>
        <p>{stage.caption[0]}</p>
        <p>{stage.caption[1]}</p>
      </div>
    </section>
  );
}
