import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LunarTypescriptAdapter } from "../../adapters/calendar/lunar-typescript-adapter";
import { computeCalendar } from "../../domain/calendar/compute-calendar";
import { setCalendarCorrection } from "../../domain/calendar/corrections";
import type { CourseInput } from "../../domain/chart/types";
import { CalendarReview } from "./CalendarReview";

const adapter = new LunarTypescriptAdapter();
const ordinaryInput: CourseInput = {
  civilDateTime: "2024-02-10T14:30:00",
  timeZone: "Asia/Shanghai",
  locationName: "北京",
  longitude: 116.4074,
  latitude: 39.9042,
  corrections: {},
};

function calendarResult(input = ordinaryInput) {
  const outcome = computeCalendar(input, adapter);
  if (!outcome.ok) throw new Error(`expected calendar fixture, got ${outcome.error.code}`);
  return outcome.value;
}

afterEach(cleanup);

describe("CalendarReview", () => {
  it("renders eight inspectable fields and filters evidence to the selected rule", async () => {
    render(
      <CalendarReview
        result={calendarResult()}
        onSetCorrection={vi.fn()}
        onResetCorrection={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "历法与月将" })).toBeVisible();
    expect(screen.getByLabelText("历法结果矩阵").children).toHaveLength(8);
    expect(screen.getByRole("button", { name: /日柱.*甲辰.*自动/ })).toBeVisible();
    expect(screen.getByText("calendar/zi-initial-rollover-v1")).toBeVisible();
    expect(screen.queryByRole("button", { name: /批准|审核通过/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /日柱.*甲辰.*自动/ }));
    const evidence = screen.getByRole("complementary");
    expect(within(evidence).getByRole("heading", { name: "日柱证据" })).toBeVisible();
    expect(within(evidence).getByText("calendar/beijing-time-v1")).toBeVisible();
    expect(within(evidence).getByText("calendar/day-cycle-v1")).toBeVisible();
    expect(within(evidence).queryByText("calendar/month-at-jie-v1")).not.toBeInTheDocument();
    expect(within(evidence).queryByText("calendar/zi-initial-rollover-v1")).not.toBeInTheDocument();
  });

  it("sends a pillar correction from the complete Jiazi list", async () => {
    const onSetCorrection = vi.fn();
    render(
      <CalendarReview
        result={calendarResult()}
        onSetCorrection={onSetCorrection}
        onResetCorrection={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /日柱.*甲辰.*自动/ }));
    const correction = screen.getByRole("combobox", { name: "修正日柱" });
    expect(within(correction).getAllByRole("option")).toHaveLength(60);
    await userEvent.selectOptions(correction, "乙巳");

    expect(onSetCorrection).toHaveBeenCalledWith("dayPillar", "乙巳");
  });

  it("keeps automatic provenance visible for a manual value and resets that field", async () => {
    const onResetCorrection = vi.fn();
    const corrected = setCalendarCorrection(ordinaryInput, "dayPillar", "乙巳");
    render(
      <CalendarReview
        result={calendarResult(corrected)}
        onSetCorrection={vi.fn()}
        onResetCorrection={onResetCorrection}
      />,
    );

    const dayCell = screen.getByRole("button", { name: /日柱.*甲辰.*乙巳.*人工/ });
    await userEvent.click(dayCell);
    expect(within(dayCell).getByText("自动：甲辰")).toBeVisible();
    expect(within(dayCell).getByText("有效：乙巳")).toBeVisible();
    expect(screen.getByText("人工修正")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "恢复日柱自动值" }));

    expect(onResetCorrection).toHaveBeenCalledWith("dayPillar");
  });

  it("uses branch-only correction choices and leaves fixed fields inspectable", async () => {
    render(
      <CalendarReview
        result={calendarResult()}
        onSetCorrection={vi.fn()}
        onResetCorrection={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /月将.*神后.*子.*自动/ }));
    const monthGeneral = screen.getByRole("combobox", { name: "修正月将" });
    expect(within(monthGeneral).getAllByRole("option")).toHaveLength(12);
    expect(screen.queryByLabelText("月将名称")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /农历日期/ }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /恢复.*自动值/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /月建/ }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
