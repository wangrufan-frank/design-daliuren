import type { MonthGeneralPhase } from "./interaction/month-general-machine";

interface MonthGeneralControlsProps {
  enabled: boolean;
  phase: MonthGeneralPhase;
  detent: number;
  activeMonthGeneral?: string;
  aligned?: boolean;
  seatedCount?: number;
  onStep(delta: -1 | 1): void;
}

const phaseLabel: Record<MonthGeneralPhase, string> = {
  locked: "自动演示中",
  landing: "神将入位中",
  seated: "已入位",
  exiting: "神将离位中",
  exploring: "探索宫位",
};

export function MonthGeneralControls({
  enabled,
  phase,
  detent,
  activeMonthGeneral,
  aligned = false,
  seatedCount = 0,
  onStep,
}: MonthGeneralControlsProps) {
  const status = enabled
    ? `月将 ${activeMonthGeneral ?? ""}；第${detent + 1}宫；${aligned ? "对位" : "未对位"}；已入位 ${seatedCount} 枚；${phaseLabel[phase]}`
    : "自动演示中，月将环暂不可操作";
  return (
    <div className="month-general-controls" role="group" aria-label="月将环操作">
      <button type="button" disabled={!enabled} aria-label="月将环向左一宫" onClick={() => onStep(-1)}>‹</button>
      <p className="artifact-visually-hidden" role="status" aria-live="off">{status}</p>
      <button type="button" disabled={!enabled} aria-label="月将环向右一宫" onClick={() => onStep(1)}>›</button>
    </div>
  );
}
