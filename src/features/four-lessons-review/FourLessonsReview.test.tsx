import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FourLessonsResult } from "../../domain/four-lessons/types";
import { referenceSession } from "../../test/reference-session";
import { FourLessonsReview } from "./FourLessonsReview";

const result = referenceSession.snapshots["four-lessons"]!.value as FourLessonsResult;

afterEach(cleanup);

describe("FourLessonsReview", () => {
  it("renders four vertical cards in traditional visual order", () => {
    render(<FourLessonsReview result={result} onReviewCalendar={vi.fn()} onReviewHeavenEarth={vi.fn()} />);
    const list = screen.getByRole("list", { name: "四课课体" });
    const cards = within(list).getAllByRole("button");
    expect(cards.map((card) => card.getAttribute("data-lesson"))).toEqual(["fourth", "third", "second", "first"]);
    expect(cards.map((card) => card.textContent)).toEqual([
      "待天将加临酉卯四课", "待天将加临卯酉三课", "待天将加临戌辰二课", "待天将加临辰辛一课",
    ]);
    for (const card of cards) expect(card.querySelectorAll(":scope > *")).toHaveLength(4);
    expect(cards[3]).toHaveAttribute("aria-pressed", "true");
  });

  it("shows selected evidence and restores focus after close", async () => {
    render(<FourLessonsReview result={result} onReviewCalendar={vi.fn()} onReviewHeavenEarth={vi.fn()} />);
    const user = userEvent.setup();
    const fourth = screen.getByRole("button", { name: /四课，上神酉，下神卯/ });
    await user.click(fourth);
    expect(screen.getByRole("complementary", { name: "四课证据" })).toHaveTextContent("地盘卯宫所临天盘为酉");
    await user.click(screen.getByRole("button", { name: "关闭证据" }));
    expect(fourth).toHaveFocus();
  });

  it("explains the stem residence and exposes both upstream review actions", async () => {
    const onReviewCalendar = vi.fn();
    const onReviewHeavenEarth = vi.fn();
    render(<FourLessonsReview result={result} onReviewCalendar={onReviewCalendar} onReviewHeavenEarth={onReviewHeavenEarth} />);
    expect(screen.getByRole("complementary", { name: "一课证据" })).toHaveTextContent("辛寄戌");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "返回历法检查" }));
    await user.click(screen.getByRole("button", { name: "查看天地盘" }));
    expect(onReviewCalendar).toHaveBeenCalledOnce();
    expect(onReviewHeavenEarth).toHaveBeenCalledOnce();
  });
});
