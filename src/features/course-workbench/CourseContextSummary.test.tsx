import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { CourseInput } from "../../domain/chart/types";
import { CourseContextSummary } from "./CourseContextSummary";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const input: CourseInput = {
  civilDateTime: "2026-08-14T23:57:00",
  timeZone: "Asia/Shanghai",
  locationName: "北京",
  reason: "这是一段需要完整保留的商务决策复盘事由",
  corrections: { dayPillar: "乙巳", monthGeneral: "亥" },
};

it("shows the full coordinate-free course context and correction markers", () => {
  render(<CourseContextSummary input={input} onRestart={vi.fn()} />);

  const region = screen.getByRole("region", { name: "起课上下文" });
  expect(region).toHaveTextContent(input.reason);
  expect(region).toHaveTextContent("北京");
  expect(region).toHaveTextContent("2026-08-14 23:57:00");
  expect(region).toHaveTextContent("日柱 · 人工修正");
  expect(region).toHaveTextContent("月将 · 人工修正");
  expect(region).not.toHaveTextContent(/经度|纬度|longitude|latitude/i);
});

it("omits an empty location and restarts through its callback", () => {
  const onRestart = vi.fn();
  render(<CourseContextSummary input={{ ...input, locationName: undefined, corrections: {} }} onRestart={onRestart} />);

  const region = screen.getByRole("region", { name: "起课上下文" });
  expect(within(region).queryByText("地点")).not.toBeInTheDocument();
  expect(region).toHaveTextContent("无人工修正");
  screen.getByRole("button", { name: "重新起课" }).click();
  expect(onRestart).toHaveBeenCalledOnce();
});

it("starts collapsed below 900px and expands from its accessible summary", async () => {
  const mediaQuery = {
    matches: true,
    media: "(max-width: 899px)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
  const user = userEvent.setup();

  render(<CourseContextSummary input={input} onRestart={vi.fn()} />);

  const details = screen.getByRole("region", { name: "起课上下文" }).querySelector("details")!;
  expect(details).not.toHaveAttribute("open");

  await user.click(details.querySelector("summary")!);
  expect(details).toHaveAttribute("open");
});
