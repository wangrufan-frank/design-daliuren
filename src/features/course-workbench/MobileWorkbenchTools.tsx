import { useEffect, useId, useRef, type ReactNode } from "react";
import { RULE_STAGE_ORDER } from "../../domain/chart/stages";
import type { RuleStageId } from "../../domain/chart/types";
import { RuleStageRail } from "../rule-review/RuleStageRail";

export type MobileToolId = "context" | "parts" | "timeline" | "evidence" | "course";

const TOOLS: readonly { id: MobileToolId; label: string }[] = [
  { id: "context", label: "上下文" },
  { id: "parts", label: "部件" },
  { id: "timeline", label: "时间轴" },
  { id: "evidence", label: "阶段证据" },
  { id: "course", label: "文字课式" },
];

interface MobileWorkbenchToolsProps {
  activeTool?: MobileToolId;
  onActiveToolChange(tool?: MobileToolId): void;
  selectedStage: RuleStageId;
  onSelectStage(stage: RuleStageId): void;
  context: ReactNode;
  parts: ReactNode;
  timeline: ReactNode;
  evidence: ReactNode;
  course: ReactNode;
}

export function MobileWorkbenchTools({
  activeTool,
  onActiveToolChange,
  selectedStage,
  onSelectStage,
  context,
  parts,
  timeline,
  evidence,
  course,
}: MobileWorkbenchToolsProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const stageNavigationRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<Partial<Record<MobileToolId, HTMLButtonElement | null>>>({});
  const lastActiveToolRef = useRef<MobileToolId | undefined>(undefined);
  const content = { context, parts, timeline, evidence, course };

  useEffect(() => {
    const selected = stageNavigationRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selectedStage]);

  useEffect(() => {
    if (activeTool) {
      lastActiveToolRef.current = activeTool;
      panelRef.current?.focus();
      return;
    }
    const lastActiveTool = lastActiveToolRef.current;
    if (lastActiveTool) triggerRefs.current[lastActiveTool]?.focus();
    lastActiveToolRef.current = undefined;
  }, [activeTool]);

  return (
    <section className="mobile-workbench-tools" aria-label="移动工作台">
      <nav ref={stageNavigationRef} className="mobile-workbench-tools__stages" aria-label="移动推演阶段">
        <RuleStageRail completed={RULE_STAGE_ORDER} selected={selectedStage} onSelect={onSelectStage} />
      </nav>

      {activeTool ? (
        <div
          ref={panelRef}
          id={panelId}
          className="mobile-workbench-tools__panel"
          role="region"
          aria-label="移动工具面板"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") onActiveToolChange(undefined);
          }}
        >
          <header>
            <h2>{TOOLS.find((tool) => tool.id === activeTool)?.label}</h2>
            <button type="button" aria-label="关闭移动工具面板" onClick={() => onActiveToolChange(undefined)}>关闭</button>
          </header>
          <div className="mobile-workbench-tools__panel-content">{content[activeTool]}</div>
        </div>
      ) : null}

      <div className="mobile-workbench-tools__toolbar" role="toolbar" aria-label="工作台工具">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            ref={(element) => { triggerRefs.current[tool.id] = element; }}
            type="button"
            aria-expanded={activeTool === tool.id}
            aria-controls={activeTool === tool.id ? panelId : undefined}
            onClick={() => onActiveToolChange(activeTool === tool.id ? undefined : tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>
    </section>
  );
}
