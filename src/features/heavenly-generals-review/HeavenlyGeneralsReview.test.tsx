import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FourLessonsResult } from "../../domain/four-lessons/types";
import { generalForHeaven } from "../../domain/heavenly-generals/policy";
import type { HeavenlyGeneralsResult } from "../../domain/heavenly-generals/types";
import type { ThreeTransmissionsResult } from "../../domain/three-transmissions/types";
import { referenceSession } from "../../test/reference-session";
import { HeavenlyGeneralsReview } from "./HeavenlyGeneralsReview";

const VISUAL_EARTH_ORDER = [
  "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰",
] as const;

const generals = referenceSession.snapshots["heavenly-generals"]!.value as HeavenlyGeneralsResult;
const fourLessons = referenceSession.snapshots["four-lessons"]!.value as FourLessonsResult;
const transmissions = referenceSession.snapshots["three-transmissions"]!.value as ThreeTransmissionsResult;

function renderReview() {
  render(
    <HeavenlyGeneralsReview
      result={generals}
      fourLessons={fourLessons}
      threeTransmissions={transmissions}
      onReviewCalendar={vi.fn()}
      onReviewHeavenEarth={vi.fn()}
      onReviewFourLessons={vi.fn()}
      onReviewThreeTransmissions={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("HeavenlyGeneralsReview", () => {
  it("renders the reviewed palace order and resolves every upstream general", () => {
    renderReview();

    expect(screen.getByRole("heading", { name: "贵人起例 · 十二天将布列" })).toBeInTheDocument();
    expect(screen.getByText(`昼夜：${generals.dayNight === "day" ? "昼贵" : "夜贵"}`)).toBeVisible();
    const palaces = screen.getByRole("list", { name: "十二天将方盘" });
    const palaceButtons = within(palaces).getAllByRole("button");
    expect(within(palaces).getAllByRole("listitem")).toHaveLength(12);
    expect(palaceButtons.map((button) => button.getAttribute("data-earth"))).toEqual(VISUAL_EARTH_ORDER);

    for (const lesson of fourLessons.lessons) {
      expect(screen.getByLabelText(new RegExp(`${lesson.label}.*${generalForHeaven(generals, lesson.upper)}`))).toBeVisible();
    }
    for (const transmission of transmissions.transmissions) {
      expect(screen.getByLabelText(new RegExp(`${transmission.label}.*${generalForHeaven(generals, transmission.branch)}`))).toBeVisible();
    }
  });

  it("marks the noble palace and returns focus after evidence closes", async () => {
    renderReview();
    const user = userEvent.setup();
    const palaceButton = screen.getByRole("button", { name: /申宫.*贵人/ });

    expect(palaceButton).toHaveAttribute("data-noble", "true");
    await user.click(palaceButton);
    expect(palaceButton).toHaveAttribute("aria-pressed", "true");
    expect(palaceButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "申宫布将证据" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "关闭证据" }));
    expect(palaceButton).toHaveFocus();
  });

  it("returns focus to the initial palace when evidence closes before selection", async () => {
    renderReview();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "关闭证据" }));

    expect(screen.getAllByRole("button", { name: /宫/ })[0]).toHaveFocus();
  });

  it("keeps the required review order and exposes every evidence phase without manual approval", () => {
    renderReview();
    const review = screen.getByRole("region", { name: "贵人起例 · 十二天将布列" });
    const classNames = Array.from(review.children).map((child) => child.className);

    expect(classNames).toEqual([
      "heavenly-generals-review__summary",
      "heavenly-generals-review__plate-region",
      "heavenly-generals-review__four-lessons",
      "heavenly-generals-review__three-transmissions",
      "heavenly-generals-review__evidence",
    ]);
    const evidence = screen.getByRole("complementary", { name: "巳宫布将证据" });
    for (const phase of ["昼夜", "贵人天盘", "贵人落宫", "布将方向", "十二天将"]) {
      expect(within(evidence).getByRole("heading", { name: phase, level: 4 })).toBeVisible();
    }
    expect(screen.queryByRole("button", { name: /修正|批准|确认/ })).not.toBeInTheDocument();
  });
});
