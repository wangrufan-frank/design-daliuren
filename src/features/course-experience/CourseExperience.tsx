import { useMemo, useState } from "react";
import { ArtifactExperience } from "../artifact-scene/ArtifactExperience";
import { mapArtifactState } from "../artifact-scene/model/map-artifact-state";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { CourseSheet } from "../course-sheet/CourseSheet";

type CourseMode = "artifact" | "text";

interface CourseExperienceProps {
  source: ArtifactSourceResults;
}

export function CourseExperience({ source }: CourseExperienceProps) {
  const [requestedMode, setRequestedMode] = useState<CourseMode>("artifact");
  const artifactAvailable = useMemo(() => {
    try {
      mapArtifactState(source);
      return true;
    } catch {
      return false;
    }
  }, [source]);
  const mode: CourseMode = artifactAvailable ? requestedMode : "text";
  const selectMode = (nextMode: CourseMode) => {
    setRequestedMode(nextMode);
  };
  const showArtifact = artifactAvailable && mode === "artifact";

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
            onShowCourse={() => selectMode("text")}
            showPartDirectory={false}
            showTimeline={false}
            startInteractive
          />
        ) : (
          <CourseSheet result={source.course} />
        )}
      </div>
    </section>
  );
}
