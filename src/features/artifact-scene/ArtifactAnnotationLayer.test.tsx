import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactAnnotationId, ProjectedAnchor } from "./annotations/types";
import type { AnnotationFrameSource } from "./three/ArtifactSceneController";
import { ArtifactAnnotationLayer } from "./ArtifactAnnotationLayer";

const featuredIds = ["calendar/slip", "plate/earth", "plate/heaven"] as const;

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

function sourceFixture(initialAnchors: ProjectedAnchor[]) {
  let anchors = initialAnchors;
  const source: AnnotationFrameSource = {
    captureAnnotationFrame: vi.fn((ids: readonly ArtifactAnnotationId[]) => ({
      viewport: { width: 900, height: 600 },
      anchors: anchors.filter(({ id }) => ids.includes(id)),
    })),
    focusNode: vi.fn(),
  };
  return {
    source,
    setAnchors(next: ProjectedAnchor[]) { anchors = next; },
  };
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
    const fixture = sourceFixture(featuredIds.map((id, index) => anchor(id, 240 + index * 120, 160 + index * 90)));
    render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} />);
    frames.step(16);

    const stageCards = [...document.querySelectorAll<HTMLButtonElement>(".artifact-annotations__card")];
    expect(stageCards).toHaveLength(featuredIds.length);
    expect(stageCards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "历书：记载占时与月将的历法依据。",
      "地盘：承载十二支方位，作为加临的基准。",
      "天盘：随月将转动，显示天盘加临位置。",
    ]);

    await user.click(screen.getByRole("button", { name: "全部" }));
    expect(document.querySelectorAll(".artifact-annotations__card")).toHaveLength(22);
    await user.click(screen.getByRole("button", { name: "隐藏" }));
    expect(document.querySelectorAll(".artifact-annotations__card")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "本阶段" }));
    frames.step(32);
    await user.click(screen.getByRole("button", { name: "历书：记载占时与月将的历法依据。" }));

    expect(fixture.source.focusNode).toHaveBeenCalledWith("calendar/slip");
  });

  it("limits compact layouts to current-stage or hidden annotations", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    const fixture = sourceFixture(featuredIds.map((id, index) => anchor(id, 240 + index * 120, 160 + index * 90)));
    render(<ArtifactAnnotationLayer source={fixture.source} featuredIds={featuredIds} allowAll={false} />);
    frames.step(16);

    expect(document.querySelectorAll(".artifact-annotations__card")).toHaveLength(3);
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
