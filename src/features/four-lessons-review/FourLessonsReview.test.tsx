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
    expect(screen.getByText("从左至右：四、三、二、一课")).toBeVisible();
  });

  it("closes the initially open evidence and restores focus to 一课", async () => {
    render(<FourLessonsReview result={result} onReviewCalendar={vi.fn()} onReviewHeavenEarth={vi.fn()} />);
    const first = screen.getByRole("button", { name: /一课，上神辰，下神辛/ });

    await userEvent.click(screen.getByRole("button", { name: "关闭证据" }));

    expect(screen.getByRole("complementary", { hidden: true })).not.toBeVisible();
    expect(first).toHaveFocus();
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
    const evidence = screen.getByRole("complementary", { name: "一课证据" });
    const records = within(evidence).getAllByRole("listitem");
    expect(records).toHaveLength(2);
    expect(records[0]).toHaveTextContent("four-lessons/stem-residence-v1");
    expect(records[0]).toHaveTextContent("辛寄戌");
    expect(records[1]).toHaveTextContent("four-lessons/derive-v1");
    expect(records[1]).toHaveTextContent("一课：生效日干辛，固定寄宫戌，查地盘戌宫");
    expect(evidence).not.toHaveTextContent("地盘辰宫所临天盘为戌");
    expect(evidence).not.toHaveTextContent("地盘酉宫所临天盘为卯");
    expect(evidence).not.toHaveTextContent("地盘卯宫所临天盘为酉");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "返回历法检查" }));
    await user.click(screen.getByRole("button", { name: "查看天地盘" }));
    expect(onReviewCalendar).toHaveBeenCalledOnce();
    expect(onReviewHeavenEarth).toHaveBeenCalledOnce();
  });

  it("shows the approved lower-source relationship for every derived lesson", async () => {
    render(<FourLessonsReview result={result} onReviewCalendar={vi.fn()} onReviewHeavenEarth={vi.fn()} />);
    const user = userEvent.setup();
    const expectedInputs = [
      ["二课，上神戌，下神辰", "二课：下神来自一课上神辰，查地盘辰宫"],
      ["三课，上神卯，下神酉", "三课：下神为生效日支酉，查地盘酉宫"],
      ["四课，上神酉，下神卯", "四课：下神来自三课上神卯，查地盘卯宫"],
    ] as const;

    for (const [accessibleName, input] of expectedInputs) {
      await user.click(screen.getByRole("button", { name: new RegExp(accessibleName) }));
      expect(screen.getByText(input, { exact: true })).toBeVisible();
    }
  });
});
