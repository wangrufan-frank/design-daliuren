import { useState } from "react";
import { ArtifactExperience } from "../artifact-scene/ArtifactExperience";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { CourseSheet } from "../course-sheet/CourseSheet";

type CourseMode = "artifact" | "text";

export function CourseExperience({ source }: { source: ArtifactSourceResults }) {
  const [mode, setMode] = useState<CourseMode>("artifact");

  return (
    <section className="course-experience" data-mode={mode}>
      <div className="course-experience__modes" role="group" aria-label="课式视图">
        <button
          type="button"
          aria-pressed={mode === "artifact"}
          onClick={() => setMode("artifact")}
        >
          三维推演
        </button>
        <button
          type="button"
          aria-pressed={mode === "text"}
          onClick={() => setMode("text")}
        >
          文字课式
        </button>
      </div>
      <div className="course-experience__stage">
        {mode === "artifact" ? (
          <ArtifactExperience source={source} onShowCourse={() => setMode("text")} />
        ) : (
          <CourseSheet result={source.course} />
        )}
      </div>
    </section>
  );
}
