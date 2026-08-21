import { useMemo, useState } from "react";
import { ArtifactExperience } from "../artifact-scene/ArtifactExperience";
import { mapArtifactState } from "../artifact-scene/model/map-artifact-state";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { CourseSheet } from "../course-sheet/CourseSheet";

type CourseMode = "artifact" | "text";

export function CourseExperience({ source }: { source: ArtifactSourceResults }) {
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

  return (
    <section className="course-experience" data-mode={mode}>
      <div className="course-experience__modes" role="group" aria-label="课式视图">
        <button
          type="button"
          aria-pressed={mode === "artifact"}
          disabled={!artifactAvailable}
          onClick={() => setRequestedMode("artifact")}
        >
          三维推演
        </button>
        <button
          type="button"
          aria-pressed={mode === "text"}
          onClick={() => setRequestedMode("text")}
        >
          文字课式
        </button>
      </div>
      <div className="course-experience__stage">
        {mode === "artifact" ? (
          <ArtifactExperience source={source} onShowCourse={() => setRequestedMode("text")} />
        ) : (
          <CourseSheet result={source.course} />
        )}
      </div>
    </section>
  );
}
