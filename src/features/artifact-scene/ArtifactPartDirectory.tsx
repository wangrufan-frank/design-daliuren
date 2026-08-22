import { useEffect, useId, useMemo, useState } from "react";
import type { RuleStageId } from "../../domain/chart/types";
import type { ArtifactAnnotationDescriptor, ArtifactAnnotationId } from "./annotations/types";
import { ARTIFACT_REVIEW_STAGES } from "./timeline/review-stages";

interface ArtifactPartDirectoryProps {
  stage: RuleStageId;
  descriptors: readonly ArtifactAnnotationDescriptor[];
  onFocus(id: ArtifactAnnotationId): void;
}

export function ArtifactPartDirectory({ stage, descriptors, onFocus }: ArtifactPartDirectoryProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<RuleStageId>>(() => new Set([stage]));
  const [focusedId, setFocusedId] = useState<ArtifactAnnotationId>();
  const groups = useMemo(() => {
    const stages = [
      ...ARTIFACT_REVIEW_STAGES.filter((item) => item.id === stage),
      ...ARTIFACT_REVIEW_STAGES.filter((item) => item.id !== stage),
    ];
    return stages.map((item, index) => ({
      stage: item,
      descriptors: descriptors.filter((descriptor) => (
        descriptor.stages.includes(item.id)
        && !stages.slice(0, index).some((previous) => descriptor.stages.includes(previous.id))
      )),
    }));
  }, [descriptors, stage]);
  const focused = descriptors.find((descriptor) => descriptor.id === focusedId);

  useEffect(() => setExpanded(new Set([stage])), [stage]);

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
        <div className="artifact-part-directory__sheet" role="dialog" aria-label="全部部件">
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
                    <small aria-hidden="true">{entries.length} 项</small>
                  </button>
                  <div id={panelId} className="artifact-part-directory__entries" hidden={!isExpanded}>
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
