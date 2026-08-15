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

export function RuleStageRail({ completed, current }: { completed: readonly RuleStageId[]; current: RuleStageId }) {
  return (
    <ol className="rule-stage-rail" aria-label="传统规则阶段">
      {RULE_STAGE_ORDER.map((stage) => {
        const status = completed.includes(stage) ? "completed" : stage === current ? "current" : "locked";

        return (
          <li key={stage}>
            <span data-status={status} aria-current={status === "current" ? "step" : undefined}>{labels[stage]}</span>
          </li>
        );
      })}
    </ol>
  );
}
