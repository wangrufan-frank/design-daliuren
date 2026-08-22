import type { AnnotationLayout, ProjectedAnchor } from "./types";
import type { AnnotationViewport } from "./project-annotations";

const DEFAULT_CARD = { width: 216, height: 56, inset: 12 } as const;
const COMPACT_CARD = { width: 180, height: 44, inset: 8 } as const;
const DENSE_CARD = { width: 144, height: 44, inset: 4 } as const;
const CARD_GAP = 8;
const HYSTERESIS_PX = 12;
const MIN_CARD_WIDTH = 24;
const MIN_LAYOUT_WIDTH = DENSE_CARD.inset * 2 + CARD_GAP + MIN_CARD_WIDTH * 2;

export interface AnnotationLayoutOptions {
  previous?: readonly AnnotationLayout[];
}

type Side = "left" | "right";

interface PositionedAnchor {
  anchor: ProjectedAnchor;
  side: Side;
  y: number;
  retained: boolean;
}

interface CardDensity {
  width: number;
  height: number;
  inset: number;
  capacity: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function previousSide(anchor: ProjectedAnchor, previous: readonly AnnotationLayout[], viewport: AnnotationViewport): Side | undefined {
  const prior = previous.find(({ id }) => id === anchor.id);
  if (!prior || Math.hypot(prior.anchor[0] - anchor.x, prior.anchor[1] - anchor.y) >= HYSTERESIS_PX) return undefined;
  return prior.labelRect.x + prior.labelRect.width / 2 < viewport.width / 2 ? "left" : "right";
}

function cardDensity(viewport: AnnotationViewport, count: number): CardDensity {
  if (viewport.width < MIN_LAYOUT_WIDTH) {
    throw new RangeError("Viewport is too narrow to place bounded left and right annotation cards");
  }
  const requiredPerSide = Math.ceil(count / 2);
  for (const card of [DEFAULT_CARD, COMPACT_CARD, DENSE_CARD]) {
    const capacity = Math.floor((viewport.height - card.inset * 2 + CARD_GAP) / (card.height + CARD_GAP));
    const fitsWidth = viewport.width >= card.inset * 2 + CARD_GAP + MIN_CARD_WIDTH * 2;
    if (capacity >= requiredPerSide && fitsWidth) {
      return {
        ...card,
        width: Math.max(MIN_CARD_WIDTH, Math.min(card.width, Math.floor((viewport.width - card.inset * 2 - CARD_GAP) / 2))),
        capacity,
      };
    }
  }

  const inset = 0;
  const height = DENSE_CARD.height;
  const capacity = Math.floor((viewport.height + CARD_GAP) / (height + CARD_GAP));
  if (capacity < requiredPerSide) {
    throw new RangeError("Viewport is too short to place 44px annotation cards with an 8px gap");
  }
  return {
    width: Math.max(MIN_CARD_WIDTH, Math.min(DENSE_CARD.width, Math.floor((viewport.width - inset * 2 - CARD_GAP) / 2))),
    height,
    inset,
    capacity,
  };
}

function positionSide(items: readonly PositionedAnchor[], viewport: AnnotationViewport, density: CardDensity): PositionedAnchor[] {
  const ordered = [...items].sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.id.localeCompare(b.anchor.id));
  const minimumY = density.inset;
  const maximumY = viewport.height - density.height - density.inset;
  let nextY = minimumY;
  ordered.forEach((item) => {
    item.y = Math.max(clamp(item.anchor.y - density.height / 2, minimumY, maximumY), nextY);
    nextY = item.y + density.height + CARD_GAP;
  });
  nextY = maximumY;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    ordered[index].y = Math.min(ordered[index].y, nextY);
    nextY = ordered[index].y - density.height - CARD_GAP;
  }
  return ordered;
}

function rebalance(positioned: readonly PositionedAnchor[], capacity: number): PositionedAnchor[] {
  for (const side of ["left", "right"] as const) {
    const sideItems = positioned.filter((item) => item.side === side);
    const overflow = sideItems.length - capacity;
    if (overflow <= 0) continue;
    const movable = sideItems.filter(({ retained }) => !retained).sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.id.localeCompare(b.anchor.id));
    const required = overflow - movable.length;
    const candidates = required > 0
      ? [...movable, ...sideItems.filter(({ retained }) => retained).sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.id.localeCompare(b.anchor.id))]
      : movable;
    candidates.slice(-overflow).forEach((item) => { item.side = side === "left" ? "right" : "left"; });
  }
  return [...positioned];
}

export function layoutArtifactAnnotations(
  anchors: readonly ProjectedAnchor[],
  viewport: AnnotationViewport,
  options: AnnotationLayoutOptions = {},
): AnnotationLayout[] {
  const visible = anchors.filter(({ behindCamera }) => !behindCamera);
  const density = cardDensity(viewport, visible.length);
  const positioned = visible.map((anchor): PositionedAnchor => {
    const retainedSide = previousSide(anchor, options.previous ?? [], viewport);
    return {
      anchor,
      side: retainedSide ?? (anchor.x < viewport.width / 2 ? "left" : "right"),
      y: 0,
      retained: retainedSide !== undefined,
    };
  });
  const balanced = rebalance(positioned, density.capacity);
  const left = positionSide(balanced.filter(({ side }) => side === "left"), viewport, density);
  const right = positionSide(balanced.filter(({ side }) => side === "right"), viewport, density);

  return [...left, ...right].map(({ anchor, side, y }) => {
    const x = side === "left" ? density.inset : viewport.width - density.width - density.inset;
    const cardEdgeX = side === "left" ? x + density.width : x;
    const bendX = clamp((anchor.x + cardEdgeX) / 2, 0, viewport.width);
    const cardCenterY = y + density.height / 2;
    return {
      id: anchor.id,
      anchor: [anchor.x, anchor.y] as const,
      labelRect: { x, y, width: density.width, height: density.height },
      leaderPath: `M ${anchor.x} ${anchor.y} L ${bendX} ${anchor.y} L ${cardEdgeX} ${cardCenterY}`,
      occluded: anchor.occluded,
    };
  });
}
