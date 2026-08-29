import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactAnnotationId, ProjectedAnchor } from "./annotations/types";
import type { AnnotationFrameSource } from "./three/ArtifactSceneController";
import { ArtifactAnnotationLayer } from "./ArtifactAnnotationLayer";

const featuredIds = ["calendar/slip", "plate/earth", "plate/heaven"] as const;
const allIds = [
  "calendar/slip", "plate/earth", "plate/heaven", "lesson/first", "lesson/second", "lesson/third", "lesson/fourth",
  "transmission/initial", "transmission/middle", "transmission/final", "general/noble", "general/snake", "general/vermilion-bird",
  "general/harmony", "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger", "general/constant",
  "general/black-tortoise", "general/yin", "general/queen-of-heaven",
] as const;

function installAnimationFrames() {
  let nextId = 1;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
  return {
    step(timestamp: number) {
      const pending = [...frames.values()];
      frames.clear();
      act(() => pending.forEach((callback) => callback(timestamp)));
    },
  };
}

function anchor(id: ArtifactAnnotationId, x: number, y: number, occluded = false): ProjectedAnchor {
  return { id, x, y, depth: 0, behindCamera: false, occluded };
}

function sourceFixture(initialAnchors: ProjectedAnchor[], viewport = { width: 900, height: 600 }) {
  let anchors = initialAnchors;
  const source: AnnotationFrameSource = {
    captureAnnotationFrame: vi.fn((ids: readonly ArtifactAnnotationId[]) => ({
      viewport,
      anchors: anchors.filter(({ id }) => ids.includes(id)),
    })),
    focusNode: vi.fn(),
  };
  return {
    source,
    setAnchors(next: ProjectedAnchor[]) { anchors = next; },
  };
}

function cardRectangle(card: HTMLButtonElement) {
  const [x, y] = card.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/)!.slice(1).map(Number);
  return { x, y, width: Number.parseFloat(card.style.width), height: Number.parseFloat(card.style.height) };
}

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function visibleCards() {
  return [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")]
    .filter((card) => !card.hidden && card.style.display !== "none");
}

beforeEach(() => installAnimationFrames());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ArtifactAnnotationLayer", () => {
  it("renders semantic cards and SVG leaders for the featured annotation set", () => {
    const frames = installAnimationFrames();
    const fixture = sourceFixture([
      anchor("calendar/slip", 450, 100),
      anchor("plate/earth", 520, 260),
      anchor("plate/heaven", 360, 420),
    ]);

    render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} />);
    frames.step(16);

    expect(screen.getByRole("button", { name: "历书：记载占时与月将的历法依据。" })).toBeVisible();
    expect(screen.getByRole("button", { name: "地盘：承载十二支方位，作为加临的基准。" })).toBeVisible();
    expect(document.querySelectorAll(".artifact-annotations__leader")).toHaveLength(3);
    expect(document.querySelectorAll(".artifact-annotations__anchor")).toHaveLength(3);
  });

  it("keeps newly mounted density cards hidden until their first layout frame", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    const fixture = sourceFixture(
      allIds.map((id, index) => anchor(id, index % 2 === 0 ? 180 : 1_020, 100 + (index % 11) * 60)),
      { width: 1_200, height: 800 },
    );

    render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} />);

    const initialCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    expect(initialCards).toHaveLength(featuredIds.length);
    initialCards.forEach((card) => expect(card).not.toBeVisible());

    frames.step(16);
    initialCards.forEach((card) => expect(card).toBeVisible());

    await user.click(screen.getByRole("button", { name: "全部" }));
    const allCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    expect(allCards).toHaveLength(22);
    allCards.forEach((card) => expect(card).not.toBeVisible());

    frames.step(32);
    allCards.forEach((card) => expect(card).toBeVisible());
  });

  it("keeps positioned cards visible when the featured set is only reordered", () => {
    const frames = installAnimationFrames();
    const fixture = sourceFixture(featuredIds.map((id, index) => anchor(id, 260 + index * 180, 160 + index * 120)));
    const { rerender } = render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} />);
    frames.step(16);

    const originalCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    const transforms = new Map(originalCards.map((card) => [card.getAttribute("aria-label"), card.style.transform]));

    rerender(
      <ArtifactAnnotationLayer
        source={fixture.source}
        featuredIds={["plate/heaven", "plate/earth", "calendar/slip"]}
      />,
    );

    const reorderedCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    expect(reorderedCards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "天盘：随月将转动，显示天盘加临位置。",
      "地盘：承载十二支方位，作为加临的基准。",
      "历书：记载占时与月将的历法依据。",
    ]);
    reorderedCards.forEach((card) => {
      expect(card).toBeVisible();
      expect(card.style.transform).toBe(transforms.get(card.getAttribute("aria-label")));
    });
  });

  it("invalidates readiness after an empty set or a featured-set replacement", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    const fixture = sourceFixture([
      ...featuredIds.map((id, index) => anchor(id, 260 + index * 180, 160 + index * 120)),
      anchor("lesson/first", 760, 520),
    ]);
    const { rerender } = render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} />);
    frames.step(16);

    await user.click(screen.getByRole("button", { name: "隐藏" }));
    expect(document.querySelectorAll(".artifact-annotations__card")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "本阶段" }));
    const remountedCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    expect(remountedCards).toHaveLength(featuredIds.length);
    remountedCards.forEach((card) => expect(card).not.toBeVisible());
    frames.step(32);
    remountedCards.forEach((card) => expect(card).toBeVisible());

    rerender(
      <ArtifactAnnotationLayer
        source={fixture.source}
        featuredIds={["calendar/slip", "plate/earth", "lesson/first"]}
      />,
    );
    const replacementCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    expect(replacementCards).toHaveLength(featuredIds.length);
    replacementCards.forEach((card) => expect(card).not.toBeVisible());
    frames.step(48);
    replacementCards.forEach((card) => expect(card).toBeVisible());
  });

  it("updates coordinates and occlusion state through refs without replacing semantic nodes", () => {
    const frames = installAnimationFrames();
    const fixture = sourceFixture([anchor("calendar/slip", 240, 180)]);
    render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={["calendar/slip"]} />);
    frames.step(16);
    const card = screen.getByRole("button", { name: "历书：记载占时与月将的历法依据。" });
    const path = document.querySelector<SVGPathElement>('[data-annotation-id="calendar/slip"]')!;
    const firstTransform = card.style.transform;
    const firstPath = path.getAttribute("d");

    fixture.setAnchors([anchor("calendar/slip", 640, 360, true)]);
    frames.step(32);

    expect(screen.getByRole("button", { name: "历书：记载占时与月将的历法依据。" })).toBe(card);
    expect(card.style.transform).not.toBe(firstTransform);
    expect(path.getAttribute("d")).not.toBe(firstPath);
    expect(card).toHaveClass("is-occluded");
    expect(path).toHaveClass("is-occluded");
    expect(path).toHaveAttribute("stroke-dasharray", "4 4");
  });

  it("switches between the stage, all 22, and hidden density sets and focuses cards", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    const fixture = sourceFixture(
      allIds.map((id, index) => anchor(id, index % 2 === 0 ? 180 : 1_020, 100 + (index % 11) * 60)),
      { width: 1_200, height: 800 },
    );
    render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} />);
    frames.step(16);

    expect(document.querySelector(".artifact-annotations")).toHaveAttribute("data-density", "stage");
    expect(screen.getByRole("button", { name: "本阶段" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "全部" })).toBeInTheDocument();
    const stageCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    expect(stageCards).toHaveLength(featuredIds.length);
    expect(stageCards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "历书：记载占时与月将的历法依据。",
      "地盘：承载十二支方位，作为加临的基准。",
      "天盘：随月将转动，显示天盘加临位置。",
    ]);

    await user.click(screen.getByRole("button", { name: "全部" }));
    frames.step(32);
    const allCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    expect(allCards).toHaveLength(22);
    allCards.forEach((card) => expect(card).toBeVisible());
    await user.click(screen.getByRole("button", { name: "隐藏" }));
    expect(document.querySelectorAll(".artifact-annotations__card")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "本阶段" }));
    frames.step(32);
    await user.click(screen.getByRole("button", { name: "历书：记载占时与月将的历法依据。" }));

    expect(fixture.source.focusNode).toHaveBeenCalledWith("calendar/slip");
  });

  it("protects the centered desktop subject across stage changes without exposing stale cards", () => {
    const frames = installAnimationFrames();
    const viewport = { width: 1_000, height: 640 };
    const protectedSubject = { x: 160, y: 96, width: 680, height: 448 };
    const fixture = sourceFixture([
      anchor("calendar/slip", 100, 120),
      anchor("plate/earth", 500, 280),
      anchor("plate/heaven", 900, 440),
      anchor("lesson/first", 120, 160),
      anchor("lesson/second", 420, 260),
      anchor("lesson/third", 620, 360),
      anchor("lesson/fourth", 880, 460),
    ], viewport);
    const { rerender } = render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} />);
    frames.step(16);

    const initialCards = visibleCards();
    expect(initialCards).toHaveLength(3);
    initialCards.forEach((card) => {
      const rectangle = cardRectangle(card);
      expect(rectangle.x).toBeGreaterThanOrEqual(12);
      expect(rectangle.y).toBeGreaterThanOrEqual(72);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(988);
      expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(512);
      expect(rectanglesOverlap(rectangle, protectedSubject)).toBe(false);
    });

    rerender(
      <ArtifactAnnotationLayer
        source={fixture.source}
        featuredIds={["lesson/first", "lesson/second", "lesson/third", "lesson/fourth"]}
      />,
    );
    expect(visibleCards()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "历书：记载占时与月将的历法依据。" })).not.toBeInTheDocument();

    frames.step(32);
    const nextCards = visibleCards();
    expect(nextCards).toHaveLength(4);
    nextCards.forEach((card) => expect(rectanglesOverlap(cardRectangle(card), protectedSubject)).toBe(false));
  });

  it("limits compact layouts to current-stage or hidden annotations", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    const viewport = { width: 900, height: 600 };
    const protectedSubject = { x: 189, y: 126, width: 522, height: 348 };
    const fixture = sourceFixture(featuredIds.map((id, index) => anchor(id, 240 + index * 120, 160 + index * 90)), viewport);
    render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} allowAll={false} />);
    frames.step(16);

    expect(visibleCards()).toHaveLength(3);
    visibleCards().forEach((card) => {
      const rectangle = cardRectangle(card);
      expect(rectangle.x).toBeGreaterThanOrEqual(8);
      expect(rectangle.y).toBeGreaterThanOrEqual(56);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(892);
      expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(584);
      expect(rectanglesOverlap(rectangle, protectedSubject)).toBe(false);
    });
    expect(screen.queryByRole("button", { name: "全部" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "隐藏" }));
    expect(document.querySelectorAll(".artifact-annotations__card")).toHaveLength(0);
  });

  it("cancels its annotation frame loop on unmount", () => {
    const fixture = sourceFixture([anchor("calendar/slip", 240, 180)]);
    const { unmount } = render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={["calendar/slip"]} />);

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
