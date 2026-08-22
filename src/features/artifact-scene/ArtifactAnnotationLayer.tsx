import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "./annotations/descriptors";
import { layoutArtifactAnnotations } from "./annotations/layout-annotations";
import type { AnnotationLayout, ArtifactAnnotationDescriptor, ArtifactAnnotationId } from "./annotations/types";
import type { AnnotationFrameSource } from "./three/ArtifactSceneController";

type AnnotationDensity = "stage" | "all" | "hidden";

interface ArtifactAnnotationLayerProps {
  source: AnnotationFrameSource;
  featuredIds: readonly ArtifactAnnotationId[];
  allowAll?: boolean;
}

const DESCRIPTORS_BY_ID = new Map(
  ARTIFACT_ANNOTATION_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor]),
);

const DENSITY_OPTIONS = [
  { id: "stage", label: "本阶段" },
  { id: "all", label: "全部" },
  { id: "hidden", label: "隐藏" },
] as const satisfies readonly { id: AnnotationDensity; label: string }[];

function sameIds(left: readonly ArtifactAnnotationId[], right: readonly ArtifactAnnotationId[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function AnnotationLayer({ source, featuredIds, allowAll = true }: ArtifactAnnotationLayerProps) {
  const [density, setDensity] = useState<AnnotationDensity>("stage");
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRefs = useRef(new Map<ArtifactAnnotationId, HTMLButtonElement>());
  const pathRefs = useRef(new Map<ArtifactAnnotationId, SVGPathElement>());
  const dotRefs = useRef(new Map<ArtifactAnnotationId, SVGCircleElement>());
  const previousLayoutsRef = useRef<readonly AnnotationLayout[]>([]);
  const featuredKey = featuredIds.join("|");
  const effectiveDensity = density === "all" && !allowAll ? "stage" : density;
  const descriptors = useMemo((): readonly ArtifactAnnotationDescriptor[] => {
    if (effectiveDensity === "hidden") return [];
    if (effectiveDensity === "all") return ARTIFACT_ANNOTATION_DESCRIPTORS;
    return featuredIds.flatMap((id) => {
      const descriptor = DESCRIPTORS_BY_ID.get(id);
      return descriptor ? [descriptor] : [];
    });
  }, [effectiveDensity, featuredKey]);
  const ids = useMemo(() => descriptors.map(({ id }) => id), [descriptors]);
  const idsKey = ids.join("|");

  useEffect(() => {
    previousLayoutsRef.current = [];
    let frameId = 0;
    const update = () => {
      const root = rootRef.current;
      const svg = svgRef.current;
      if (!root || !svg) return;
      try {
        const frame = source.captureAnnotationFrame(ids);
        const layouts = layoutArtifactAnnotations(frame.anchors, frame.viewport, {
          previous: previousLayoutsRef.current,
        });
        previousLayoutsRef.current = layouts;
        root.removeAttribute("data-annotation-error");
        svg.setAttribute("viewBox", `0 0 ${frame.viewport.width} ${frame.viewport.height}`);
        const layoutById = new Map(layouts.map((layout) => [layout.id, layout]));
        for (const descriptor of descriptors) {
          const layout = layoutById.get(descriptor.id);
          const card = cardRefs.current.get(descriptor.id);
          const path = pathRefs.current.get(descriptor.id);
          const dot = dotRefs.current.get(descriptor.id);
          if (!layout) {
            if (card) card.style.display = "none";
            if (path) path.style.display = "none";
            if (dot) dot.style.display = "none";
            continue;
          }
          if (card) {
            card.style.display = "";
            card.style.width = `${layout.labelRect.width}px`;
            card.style.height = `${layout.labelRect.height}px`;
            card.style.transform = `translate3d(${layout.labelRect.x}px, ${layout.labelRect.y}px, 0)`;
            card.classList.toggle("is-occluded", layout.occluded);
          }
          if (path) {
            path.style.display = "";
            path.setAttribute("d", layout.leaderPath);
            path.setAttribute("stroke-dasharray", layout.occluded ? "4 4" : "none");
            path.classList.toggle("is-occluded", layout.occluded);
          }
          if (dot) {
            dot.style.display = "";
            dot.setAttribute("cx", String(layout.anchor[0]));
            dot.setAttribute("cy", String(layout.anchor[1]));
            dot.classList.toggle("is-occluded", layout.occluded);
          }
        }
      } catch (error) {
        root.setAttribute("data-annotation-error", error instanceof Error ? error.message : String(error));
      }
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [descriptors, ids, idsKey, source]);

  return (
    <div ref={rootRef} className="artifact-annotations" data-density={effectiveDensity}>
      <svg ref={svgRef} className="artifact-annotations__leaders" aria-hidden="true">
        {descriptors.map(({ id }) => (
          <path
            key={id}
            ref={(element) => {
              if (element) pathRefs.current.set(id, element);
              else pathRefs.current.delete(id);
            }}
            className="artifact-annotations__leader"
            data-annotation-id={id}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {descriptors.map(({ id }) => (
          <circle
            key={id}
            ref={(element) => {
              if (element) dotRefs.current.set(id, element);
              else dotRefs.current.delete(id);
            }}
            className="artifact-annotations__anchor"
            data-anchor-id={id}
            r="2.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="artifact-annotations__cards">
        {descriptors.map((descriptor) => (
          <button
            key={descriptor.id}
            ref={(element) => {
              if (element) cardRefs.current.set(descriptor.id, element);
              else cardRefs.current.delete(descriptor.id);
            }}
            type="button"
            className="artifact-annotations__card"
            aria-label={`${descriptor.label}：${descriptor.detail}`}
            onClick={() => source.focusNode(descriptor.nodeId)}
          >
            <strong>{descriptor.label}</strong>
            <span>{descriptor.detail}</span>
          </button>
        ))}
      </div>
      <div className="artifact-annotations__density" role="group" aria-label="标注密度">
        {DENSITY_OPTIONS.filter((option) => allowAll || option.id !== "all").map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={effectiveDensity === option.id}
            onClick={() => setDensity(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const ArtifactAnnotationLayer = memo(AnnotationLayer, (previous, next) => (
  previous.source === next.source
  && previous.allowAll === next.allowAll
  && sameIds(previous.featuredIds, next.featuredIds)
));
