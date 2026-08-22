import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { RuleStageId } from "../../domain/chart/types";
import type { ArtifactAnnotationDescriptor, ArtifactAnnotationId } from "./annotations/types";
import { ARTIFACT_REVIEW_STAGES } from "./timeline/review-stages";

interface ArtifactPartDirectoryProps {
  stage: RuleStageId;
  descriptors: readonly ArtifactAnnotationDescriptor[];
  onFocus(id: ArtifactAnnotationId): void;
}

type ArtifactOwnerStage = Exclude<RuleStageId, "course">;

const OWNER_BY_ID: Readonly<Record<ArtifactAnnotationId, ArtifactOwnerStage>> = {
  "calendar/slip": "calendar",
  "plate/earth": "heaven-earth",
  "plate/heaven": "heaven-earth",
  "lesson/first": "four-lessons",
  "lesson/second": "four-lessons",
  "lesson/third": "four-lessons",
  "lesson/fourth": "four-lessons",
  "transmission/initial": "three-transmissions",
  "transmission/middle": "three-transmissions",
  "transmission/final": "three-transmissions",
  "general/noble": "heavenly-generals",
  "general/snake": "heavenly-generals",
  "general/vermilion-bird": "heavenly-generals",
  "general/harmony": "heavenly-generals",
  "general/hook-array": "heavenly-generals",
  "general/azure-dragon": "heavenly-generals",
  "general/void": "heavenly-generals",
  "general/white-tiger": "heavenly-generals",
  "general/constant": "heavenly-generals",
  "general/black-tortoise": "heavenly-generals",
  "general/yin": "heavenly-generals",
  "general/queen-of-heaven": "heavenly-generals",
};

export function ArtifactPartDirectory({ stage, descriptors, onFocus }: ArtifactPartDirectoryProps) {
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<RuleStageId>>(() => new Set([stage]));
  const [focusedId, setFocusedId] = useState<ArtifactAnnotationId>();
  const groups = useMemo(() => {
    const stages = [
      ...ARTIFACT_REVIEW_STAGES.filter((item) => item.id === stage),
      ...ARTIFACT_REVIEW_STAGES.filter((item) => item.id !== stage),
    ];
    return stages.map((item) => ({
      stage: item,
      descriptors: descriptors.filter((descriptor) => OWNER_BY_ID[descriptor.id] === item.id),
    }));
  }, [descriptors, stage]);
  const focused = descriptors.find((descriptor) => descriptor.id === focusedId);

  useEffect(() => setExpanded(new Set([stage])), [stage]);
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpenRef.current) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  const toggleGroup = (groupId: RuleStageId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <section className="artifact-part-directory" aria-labelledby={titleId}>
      <div className="artifact-part-directory__bar">
        <h2 id={titleId}>部件目录</h2>
        {focused && <p role="status">当前聚焦：{focused.label}</p>}
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-label={open ? "关闭部件目录" : "打开部件目录"}
          onClick={() => {
            if (!open) setExpanded(new Set([stage]));
            setOpen(!open);
          }}
        >
          {open ? "收起" : `查看全部 ${descriptors.length} 项`}
        </button>
      </div>
      {open && (
        <div
          className="artifact-part-directory__sheet"
          role="dialog"
          aria-label="全部部件"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <header className="artifact-part-directory__sheet-header">
            <p>全部 22 个部件</p>
            <button ref={closeRef} type="button" aria-label="关闭部件目录" onClick={() => setOpen(false)}>关闭</button>
          </header>
          <div className="artifact-part-directory__scroll">
            {groups.map(({ stage: group, descriptors: entries }) => {
              const isExpanded = expanded.has(group.id);
              const panelId = `${titleId}-${group.id}`;
              return (
                <section key={group.id} className="artifact-part-directory__group" data-testid="artifact-part-group">
                  <button
                    type="button"
                    className="artifact-part-directory__group-toggle"
                    aria-controls={panelId}
                    aria-expanded={isExpanded}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span>{group.label}</span>
                    <small aria-hidden="true">{group.id === "course" ? "总览" : `${entries.length} 项`}</small>
                  </button>
                  <div id={panelId} className="artifact-part-directory__entries" hidden={!isExpanded}>
                    {group.id === "course" && <p className="artifact-part-directory__overview">无新增部件，可查看全部22项</p>}
                    {entries.map((descriptor) => (
                      <button
                        key={descriptor.id}
                        type="button"
                        data-part-id={descriptor.id}
                        onClick={() => {
                          onFocus(descriptor.id);
                          setFocusedId(descriptor.id);
                          setOpen(false);
                        }}
                      >
                        <strong>{descriptor.label}</strong>
                        <span>{descriptor.detail}</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
