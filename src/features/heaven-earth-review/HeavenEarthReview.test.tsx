import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { deriveHeavenEarth } from "../../domain/heaven-earth/policy";
import { referenceSession } from "../../test/reference-session";
import { HeavenEarthReview } from "./HeavenEarthReview";

const visualEarthOrder = [
  "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰",
] as const;

function renderReview() {
  const calendar = referenceSession.snapshots.calendar!.value;
  const result = deriveHeavenEarth(calendar);
  render(<HeavenEarthReview result={result} voidBranches={calendar.voidBranches} />);
  return result;
}

afterEach(cleanup);

describe("HeavenEarthReview", () => {
  it("marks void branches on both the heaven and earth plates", () => {
    renderReview();
    const plate = screen.getByRole("list", { name: "天地盘十二宫" });

    expect(within(plate).getByRole("button", { name: /天盘子加临地盘午，天盘空亡/ })).toBeVisible();
    expect(within(plate).getByRole("button", { name: /天盘午加临地盘子，占时宫，地盘空亡/ })).toBeVisible();
    expect(within(plate).getAllByLabelText("空亡")).toHaveLength(4);
  });

  it("renders twelve snapshot palaces in the traditional square perimeter order", () => {
    const result = renderReview();
    const plate = screen.getByRole("list", { name: "天地盘十二宫" });
    const items = within(plate).getAllByRole("listitem");
    const buttons = within(plate).getAllByRole("button");

    expect(items).toHaveLength(12);
    expect(buttons).toHaveLength(12);
    expect(buttons.map((button) => button.getAttribute("data-earth"))).toEqual(visualEarthOrder);
    expect(within(plate).getByRole("button", {
      name: "天盘午加临地盘子，占时宫，地盘空亡",
    })).toBeVisible();
    expect(screen.getByText("上南 · 下北 · 左东 · 右西")).toBeVisible();
    expect(screen.getByText("胜光（午）加临占时子")).toBeVisible();

    const divinationHour = within(plate).getByRole("button", { name: /地盘子/ });
    expect(divinationHour).toHaveAttribute("data-month-general", "true");
    expect(divinationHour).toHaveAttribute("data-divination-hour", "true");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(result.palaces.find(({ earth }) => earth === "巳")?.heaven).toBe("亥");
  });

  it("selects a palace, filters its evidence, and follows the perimeter with arrow keys", async () => {
    renderReview();
    const user = userEvent.setup();
    const palace = screen.getByRole("button", { name: /天盘亥加临地盘巳/ });

    await user.click(palace);

    const evidence = screen.getByRole("complementary", { name: "巳宫证据" });
    expect(within(evidence).getByRole("heading", { name: "巳宫证据" })).toBeVisible();
    expect(within(evidence).getByText("heaven-earth/month-general-over-hour-v1")).toBeVisible();
    expect(within(evidence).getByText("胜光（午）· 自动计算")).toBeVisible();
    expect(within(evidence).getByText("子 · 自动计算")).toBeVisible();
    expect(within(evidence).getByText(/检查地盘 巳/)).toBeVisible();
    expect(within(evidence).getByText("天盘亥加临地盘巳")).toBeVisible();
    expect(within(evidence).queryByText("天盘子加临地盘午")).not.toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /地盘午/ })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(palace).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: /地盘辰/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(palace).toHaveFocus();
  });

  it("keeps each narrow-screen palace comparison as two ordered text lines", () => {
    renderReview();
    const fallback = screen.getByRole("list", { name: "十二宫文字对照" });
    const haiPalace = within(fallback).getByText("天盘 巳").closest("li");
    const lines = haiPalace?.querySelectorAll(":scope > p");

    expect(within(fallback).getAllByRole("listitem")).toHaveLength(12);
    expect(lines).toHaveLength(2);
    expect(lines?.[0]).toHaveTextContent("天盘 巳");
    expect(lines?.[1]).toHaveTextContent("地盘 亥");
  });

  it("restores focus to the palace that opened evidence", async () => {
    renderReview();
    const user = userEvent.setup();
    const palace = screen.getByRole("button", { name: /天盘巳加临地盘亥/ });

    await user.click(palace);
    await user.click(screen.getByRole("button", { name: "关闭证据" }));

    expect(palace).toHaveFocus();
  });

  it("restores focus to the initially selected palace when evidence closes first", async () => {
    renderReview();
    const user = userEvent.setup();
    const initialPalace = screen.getByRole("button", { name: /天盘亥加临地盘巳/ });

    await user.click(screen.getByRole("button", { name: "关闭证据" }));

    expect(initialPalace).toHaveFocus();
  });
});
