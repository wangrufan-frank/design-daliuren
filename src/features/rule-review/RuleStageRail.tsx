import { RULE_STAGE_ORDER } from "../../domain/chart/stages";
import type { RuleStageId } from "../../domain/chart/types";

const labels: Record<RuleStageId, string> = {
  calendar: "历法与月将",
  "heaven-earth": "天地盘加临",
  "four-lessons": "四课生成",
  "three-transmissions": "三传取法",
  "heavenly-generals": "天将排列",
  course: "复制结课",
};

const statusLabels = {
  completed: "已完成",
  current: "进行中",
  locked: "待进行",
} as const;

interface RuleStageRailProps {
  completed: readonly RuleStageId[];
  current: RuleStageId;
  selected?: RuleStageId;
  onSelect?: (stage: RuleStageId) => void;
}

export function RuleStageRail({ completed, current, selected, onSelect }: RuleStageRailProps) {
  return (
    <ol className="rule-stage-rail" aria-label="传统规则阶段">
      {RULE_STAGE_ORDER.map((stage) => {
        const status = completed.includes(stage) ? "completed" : stage === current ? "current" : "locked";
        const stageProps = {
          "data-status": status,
          "aria-label": `${labels[stage]}，${statusLabels[status]}`,
        };

        return (
          <li key={stage}>
            {status === "completed" ? (
              <button type="button" {...stageProps} aria-current={stage === selected ? "page" : undefined} onClick={() => onSelect?.(stage)}>
                {labels[stage]}
              </button>
            ) : (
              <span {...stageProps} aria-current={status === "current" ? "step" : undefined}>{labels[stage]}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
