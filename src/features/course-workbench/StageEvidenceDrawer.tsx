import { useId, useState, type ReactNode } from "react";
import type { ArtifactReviewStage } from "../artifact-scene/timeline/review-stages";

interface StageEvidenceDrawerProps {
  stage: ArtifactReviewStage;
  children: ReactNode;
}

export function StageEvidenceDrawer({ stage, children }: StageEvidenceDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <section className="stage-evidence-drawer" aria-label="阶段证据抽屉">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={titleId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "收起阶段证据" : "查看阶段证据"}
      </button>
      {open ? (
        <aside className="stage-evidence-drawer__panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <header>
            <p>推演依据</p>
            <h2 id={titleId}>{stage.label}证据</h2>
          </header>
          {children}
        </aside>
      ) : null}
    </section>
  );
}
