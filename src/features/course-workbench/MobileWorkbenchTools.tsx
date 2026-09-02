import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { RULE_STAGE_ORDER } from "../../domain/chart/stages";
import type { RuleStageId } from "../../domain/chart/types";
import { RuleStageRail } from "../rule-review/RuleStageRail";

export type MobileToolId = "context" | "parts" | "timeline" | "evidence";

const TOOLS: readonly { id: MobileToolId; label: string }[] = [
  { id: "context", label: "上下文" },
  { id: "parts", label: "部件" },
  { id: "timeline", label: "时间轴" },
  { id: "evidence", label: "阶段证据" },
];

function subscribeToMobileWorkbench(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function mobileWorkbenchSnapshot(): boolean {
  return window.innerWidth < 900;
}

export function useMobileWorkbenchLayout(): boolean {
  return useSyncExternalStore(subscribeToMobileWorkbench, mobileWorkbenchSnapshot, () => false);
}

interface MobileWorkbenchToolsProps {
  activeTool?: MobileToolId;
  onActiveToolChange(tool?: MobileToolId): void;
  selectedStage: RuleStageId;
  onSelectStage(stage: RuleStageId): void;
  context: ReactNode;
  parts: ReactNode;
  timeline: ReactNode;
  evidence: ReactNode;
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
}: MobileWorkbenchToolsProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const stageNavigationRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<Partial<Record<MobileToolId, HTMLButtonElement | null>>>({});
  const openerRef = useRef<HTMLElement | null>(null);
  const lastActiveToolRef = useRef<MobileToolId | undefined>(undefined);
  const content = { context, parts, timeline, evidence };
  const panelIdFor = (tool: MobileToolId) => `${panelId}-${tool}`;

  useEffect(() => {
    const selected = stageNavigationRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selectedStage]);

  useEffect(() => {
    if (activeTool) {
      lastActiveToolRef.current = activeTool;
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body) {
        openerRef.current = activeElement;
      } else {
        openerRef.current ??= triggerRefs.current[activeTool] ?? null;
      }
      panelRef.current?.focus();
      return;
    }
    const lastActiveTool = lastActiveToolRef.current;
    const opener = openerRef.current;
    if (opener?.isConnected) opener.focus();
    else if (lastActiveTool) triggerRefs.current[lastActiveTool]?.focus();
    openerRef.current = null;
    lastActiveToolRef.current = undefined;
  }, [activeTool]);

  useEffect(() => {
    if (!activeTool) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onActiveToolChange(undefined);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [activeTool, onActiveToolChange]);

  return (
    <section className="mobile-workbench-tools" aria-label="移动工作台">
      <nav ref={stageNavigationRef} className="mobile-workbench-tools__stages" aria-label="移动推演阶段">
        <RuleStageRail completed={RULE_STAGE_ORDER} selected={selectedStage} onSelect={onSelectStage} />
      </nav>

      {TOOLS.map((tool) => {
        const active = activeTool === tool.id;
        return (
          <div
            key={tool.id}
            ref={active ? panelRef : undefined}
            id={panelIdFor(tool.id)}
            className="mobile-workbench-tools__panel"
            role="region"
            aria-label="移动工具面板"
            tabIndex={-1}
            hidden={!active}
          >
            <header>
              <h2>{tool.label}</h2>
              <button type="button" aria-label="关闭移动工具面板" onClick={() => onActiveToolChange(undefined)}>关闭</button>
            </header>
            <div className="mobile-workbench-tools__panel-content">{content[tool.id]}</div>
          </div>
        );
      })}

      <div className="mobile-workbench-tools__toolbar" role="toolbar" aria-label="工作台工具">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            ref={(element) => { triggerRefs.current[tool.id] = element; }}
            type="button"
            aria-expanded={activeTool === tool.id}
            aria-controls={panelIdFor(tool.id)}
            onClick={() => onActiveToolChange(activeTool === tool.id ? undefined : tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </div>
    </section>
  );
}
