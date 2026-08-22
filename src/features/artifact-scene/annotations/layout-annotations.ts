import type { AnnotationLayout, ProjectedAnchor } from "./types";
import type { AnnotationViewport } from "./project-annotations";

const CARD_WIDTH = 216;
const CARD_HEIGHT = 56;
const EDGE_INSET = 12;
const CARD_GAP = 8;
const HYSTERESIS_PX = 12;

export interface AnnotationLayoutOptions {
  previous?: readonly AnnotationLayout[];
}

type Side = "left" | "right";

interface PositionedAnchor {
  anchor: ProjectedAnchor;
  side: Side;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function previousSide(anchor: ProjectedAnchor, previous: readonly AnnotationLayout[], viewport: AnnotationViewport): Side | undefined {
  const prior = previous.find(({ id }) => id === anchor.id);
  if (!prior || Math.hypot(prior.anchor[0] - anchor.x, prior.anchor[1] - anchor.y) >= HYSTERESIS_PX) return undefined;
  return prior.labelRect.x + prior.labelRect.width / 2 < viewport.width / 2 ? "left" : "right";
}

function positionSide(items: readonly PositionedAnchor[], viewport: AnnotationViewport): PositionedAnchor[] {
  const ordered = [...items].sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.id.localeCompare(b.anchor.id));
  const minimumY = EDGE_INSET;
  const maximumY = viewport.height - CARD_HEIGHT - EDGE_INSET;
  let nextY = minimumY;
  ordered.forEach((item) => {
    item.y = Math.max(clamp(item.anchor.y - CARD_HEIGHT / 2, minimumY, maximumY), nextY);
    nextY = item.y + CARD_HEIGHT + CARD_GAP;
  });
  nextY = maximumY;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    ordered[index].y = Math.min(ordered[index].y, nextY);
    nextY = ordered[index].y - CARD_HEIGHT - CARD_GAP;
  }
  return ordered;
}

export function layoutArtifactAnnotations(
  anchors: readonly ProjectedAnchor[],
  viewport: AnnotationViewport,
  options: AnnotationLayoutOptions = {},
): AnnotationLayout[] {
  const visible = anchors.filter(({ behindCamera }) => !behindCamera);
  const positioned = visible.map((anchor): PositionedAnchor => ({
    anchor,
    side: previousSide(anchor, options.previous ?? [], viewport) ?? (anchor.x < viewport.width / 2 ? "left" : "right"),
    y: 0,
  }));
  const left = positionSide(positioned.filter(({ side }) => side === "left"), viewport);
  const right = positionSide(positioned.filter(({ side }) => side === "right"), viewport);

  return [...left, ...right].map(({ anchor, side, y }) => {
    const x = side === "left" ? EDGE_INSET : viewport.width - CARD_WIDTH - EDGE_INSET;
    const cardEdgeX = side === "left" ? x + CARD_WIDTH : x;
    const bendX = clamp((anchor.x + cardEdgeX) / 2, 0, viewport.width);
    const cardCenterY = y + CARD_HEIGHT / 2;
    return {
      id: anchor.id,
      anchor: [anchor.x, anchor.y] as const,
      labelRect: { x, y, width: CARD_WIDTH, height: CARD_HEIGHT },
      leaderPath: `M ${anchor.x} ${anchor.y} L ${bendX} ${anchor.y} L ${cardEdgeX} ${cardCenterY}`,
      occluded: anchor.occluded,
    };
  });
}
