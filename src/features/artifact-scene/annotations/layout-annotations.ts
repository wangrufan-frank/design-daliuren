import type { AnnotationLayout, AnnotationLayoutOptions, AnnotationSafeArea, ProjectedAnchor } from "./types";
import type { AnnotationViewport } from "./project-annotations";

export type { AnnotationLayoutOptions } from "./types";

const DEFAULT_CARD = { width: 216, height: 56, inset: 12 } as const;
const COMPACT_CARD = { width: 180, height: 44, inset: 8 } as const;
const DENSE_CARD = { width: 144, height: 44, inset: 4 } as const;
const CARD_GAP = 8;
const HYSTERESIS_PX = 12;
const MIN_CARD_WIDTH = 24;
const MIN_LAYOUT_WIDTH = DENSE_CARD.inset * 2 + CARD_GAP + MIN_CARD_WIDTH * 2;

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

interface Rail {
  start: number;
  end: number;
}

interface LayoutBounds {
  top: number;
  bottom: number;
  left: Rail;
  right: Rail;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function previousSide(anchor: ProjectedAnchor, previous: readonly AnnotationLayout[], viewport: AnnotationViewport): Side | undefined {
  const prior = previous.find(({ id }) => id === anchor.id);
  if (!prior || Math.hypot(prior.anchor[0] - anchor.x, prior.anchor[1] - anchor.y) >= HYSTERESIS_PX) return undefined;
  return prior.labelRect.x + prior.labelRect.width / 2 < viewport.width / 2 ? "left" : "right";
}

function layoutBounds(viewport: AnnotationViewport, safeArea?: AnnotationSafeArea): LayoutBounds {
  const left = clamp(safeArea?.left ?? 0, 0, viewport.width);
  const right = clamp(viewport.width - (safeArea?.right ?? 0), left, viewport.width);
  const top = clamp(safeArea?.top ?? 0, 0, viewport.height);
  const bottom = clamp(viewport.height - (safeArea?.bottom ?? 0), top, viewport.height);
  const subjectStart = safeArea?.subject
    ? clamp(safeArea.subject.x, left, right)
    : clamp(viewport.width / 2 - CARD_GAP / 2, left, right);
  const subjectEnd = safeArea?.subject
    ? clamp(safeArea.subject.x + safeArea.subject.width, subjectStart, right)
    : clamp(viewport.width / 2 + CARD_GAP / 2, subjectStart, right);
  return {
    top,
    bottom,
    left: { start: left, end: subjectStart },
    right: { start: subjectEnd, end: right },
  };
}

function railWidth(rail: Rail, inset: number): number {
  return Math.max(0, rail.end - rail.start - inset);
}

function cardDensity(viewport: AnnotationViewport, count: number, bounds: LayoutBounds, canOmit: boolean): CardDensity {
  if (!canOmit && viewport.width < MIN_LAYOUT_WIDTH) {
    throw new RangeError("Viewport is too narrow to place bounded left and right annotation cards");
  }
  const availableHeight = bounds.bottom - bounds.top;
  const candidates = [DEFAULT_CARD, COMPACT_CARD, DENSE_CARD, { ...DENSE_CARD, inset: 0 }];
  for (const card of candidates) {
    const capacity = Math.max(0, Math.floor((availableHeight - card.inset * 2 + CARD_GAP) / (card.height + CARD_GAP)));
    const widths = [railWidth(bounds.left, card.inset), railWidth(bounds.right, card.inset)]
      .filter((width) => width >= MIN_CARD_WIDTH);
    if (capacity * widths.length >= count) {
      return {
        ...card,
        width: Math.min(card.width, Math.floor(Math.min(...widths))),
        capacity,
      };
    }
  }

  if (!canOmit) {
    throw new RangeError("Viewport is too short to place 44px annotation cards with an 8px gap");
  }
  const inset = DENSE_CARD.inset;
  const widths = [railWidth(bounds.left, inset), railWidth(bounds.right, inset)]
    .filter((width) => width >= MIN_CARD_WIDTH);
  return {
    width: widths.length > 0 ? Math.min(DENSE_CARD.width, Math.floor(Math.min(...widths))) : MIN_CARD_WIDTH,
    height: DENSE_CARD.height,
    inset,
    capacity: Math.max(0, Math.floor((availableHeight - inset * 2 + CARD_GAP) / (DENSE_CARD.height + CARD_GAP))),
  };
}

function positionSide(items: readonly PositionedAnchor[], bounds: LayoutBounds, density: CardDensity): PositionedAnchor[] {
  const ordered = [...items].sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.id.localeCompare(b.anchor.id));
  const minimumY = bounds.top + density.inset;
  const maximumY = bounds.bottom - density.height - density.inset;
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

function rebalance(positioned: readonly PositionedAnchor[], capacities: Record<Side, number>): PositionedAnchor[] {
  for (const side of ["left", "right"] as const) {
    const sideItems = positioned.filter((item) => item.side === side);
    const overflow = sideItems.length - capacities[side];
    if (overflow <= 0) continue;
    const destination = side === "left" ? "right" : "left";
    const destinationFree = capacities[destination] - positioned.filter((item) => item.side === destination).length;
    sideItems
      .sort((a, b) => Number(a.retained) - Number(b.retained) || b.anchor.y - a.anchor.y || b.anchor.id.localeCompare(a.anchor.id))
      .slice(0, Math.min(overflow, destinationFree))
      .forEach((item) => { item.side = destination; });
  }
  return [...positioned];
}

function retainWithinCapacity(anchors: readonly ProjectedAnchor[], capacity: number): ProjectedAnchor[] {
  if (anchors.length <= capacity) return [...anchors];
  const removalCount = anchors.length - capacity;
  const removed = new Set(
    anchors
      .map((anchor, index) => ({ anchor, index }))
      .sort((a, b) => Number(b.anchor.occluded) - Number(a.anchor.occluded) || b.index - a.index)
      .slice(0, removalCount)
      .map(({ index }) => index),
  );
  return anchors.filter((_, index) => !removed.has(index));
}

export function layoutArtifactAnnotations(
  anchors: readonly ProjectedAnchor[],
  viewport: AnnotationViewport,
  options: AnnotationLayoutOptions = {},
): AnnotationLayout[] {
  const visible = anchors.filter(({ behindCamera }) => !behindCamera);
  const bounds = layoutBounds(viewport, options.safeArea);
  const density = cardDensity(viewport, visible.length, bounds, options.safeArea !== undefined);
  const capacities = {
    left: railWidth(bounds.left, density.inset) >= density.width ? density.capacity : 0,
    right: railWidth(bounds.right, density.inset) >= density.width ? density.capacity : 0,
  };
  const retained = retainWithinCapacity(visible, capacities.left + capacities.right);
  const positioned = retained.map((anchor): PositionedAnchor => {
    const retainedSide = previousSide(anchor, options.previous ?? [], viewport);
    return {
      anchor,
      side: retainedSide ?? (anchor.x < viewport.width / 2 ? "left" : "right"),
      y: 0,
      retained: retainedSide !== undefined,
    };
  });
  const balanced = rebalance(positioned, capacities);
  const left = positionSide(balanced.filter(({ side }) => side === "left"), bounds, density);
  const right = positionSide(balanced.filter(({ side }) => side === "right"), bounds, density);

  return [...left, ...right].map(({ anchor, side, y }) => {
    const rail = bounds[side];
    const x = side === "left" ? rail.start + density.inset : rail.end - density.width - density.inset;
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
