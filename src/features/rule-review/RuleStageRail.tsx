import type { RuleStageId } from "../../domain/chart/types";
import { ARTIFACT_REVIEW_STAGES } from "../artifact-scene/timeline/review-stages";

const statusLabels = {
  completed: "已完成",
  current: "进行中",
  locked: "待进行",
} as const;

interface RuleStageRailProps {
  completed: readonly RuleStageId[];
  current?: RuleStageId;
  selected?: RuleStageId;
  onSelect?: (stage: RuleStageId) => void;
}

export function RuleStageRail({ completed, current, selected, onSelect }: RuleStageRailProps) {
  return (
    <ol className="rule-stage-rail" aria-label="传统规则阶段">
      {ARTIFACT_REVIEW_STAGES.map((stage) => {
        const status = completed.includes(stage.id) ? "completed" : stage.id === current ? "current" : "locked";
        const stageProps = {
          "data-status": status,
          "aria-label": `${stage.label}，${statusLabels[status]}`,
        };

        return (
          <li key={stage.id}>
            {status === "completed" ? (
              <button type="button" {...stageProps} aria-current={stage.id === selected ? "page" : undefined} onClick={() => onSelect?.(stage.id)}>
                {stage.label}
              </button>
            ) : (
              <span {...stageProps} aria-current={status === "current" ? "step" : undefined}>{stage.label}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
