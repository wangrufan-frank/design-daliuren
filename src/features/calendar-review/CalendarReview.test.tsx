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
const jiaZi = [
  "甲子", "乙丑", "丙寅", "丁卯", "戊辰", "己巳", "庚午", "辛未", "壬申", "癸酉", "甲戌", "乙亥",
  "丙子", "丁丑", "戊寅", "己卯", "庚辰", "辛巳", "壬午", "癸未", "甲申", "乙酉", "丙戌", "丁亥",
  "戊子", "己丑", "庚寅", "辛卯", "壬辰", "癸巳", "甲午", "乙未", "丙申", "丁酉", "戊戌", "己亥",
  "庚子", "辛丑", "壬寅", "癸卯", "甲辰", "乙巳", "丙午", "丁未", "戊申", "己酉", "庚戌", "辛亥",
  "壬子", "癸丑", "甲寅", "乙卯", "丙辰", "丁巳", "戊午", "己未", "庚申", "辛酉", "壬戌", "癸亥",
] as const;
const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

function calendarResult(input = ordinaryInput) {
  const outcome = computeCalendar(input, adapter);
  if (!outcome.ok) throw new Error(`expected calendar fixture, got ${outcome.error.code}`);
  return outcome.value;
}

afterEach(cleanup);

describe("CalendarReview", () => {
  it("exposes one named region with eight list items and eight real field buttons", () => {
    render(<CalendarReview result={calendarResult()} onSetCorrection={vi.fn()} onResetCorrection={vi.fn()} />);

    const review = screen.getByRole("region", { name: "历法与月将" });
    const matrix = within(review).getByRole("list", { name: "历法结果矩阵" });
    const items = within(matrix).getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(within(matrix).getAllByRole("button")).toHaveLength(8);
    items.forEach((item) => expect(within(item).getByRole("button")).toBeVisible());
    expect(screen.getByText("calendar/zi-initial-rollover-v1")).toBeVisible();
    expect(screen.queryByRole("button", { name: /批准|审核通过/ })).not.toBeInTheDocument();
  });

  it("filters evidence to the active rule and shared Beijing-time rule", async () => {
    render(<CalendarReview result={calendarResult()} onSetCorrection={vi.fn()} onResetCorrection={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /日柱.*甲辰.*自动/ }));
    const evidence = screen.getByRole("complementary");
    expect(within(evidence).getByRole("heading", { name: "日柱证据" })).toBeVisible();
    expect(within(evidence).getByText("calendar/beijing-time-v1")).toBeVisible();
    expect(within(evidence).getByText("calendar/day-cycle-v1")).toBeVisible();
    expect(within(evidence).queryByText("calendar/month-at-jie-v1")).not.toBeInTheDocument();
    expect(within(evidence).queryByText("calendar/zi-initial-rollover-v1")).not.toBeInTheDocument();
  });

  it.each([
    ["yearPillar", "年柱", "乙巳", "丙午", jiaZi],
    ["monthPillar", "月柱", "丁卯", "戊辰", jiaZi],
    ["dayPillar", "日柱", "乙巳", "丙午", jiaZi],
    ["hourPillar", "时柱", "甲子", "乙丑", jiaZi],
    ["monthGeneral", "月将", "亥", "戌", branches],
    ["divinationHour", "占时", "子", "丑", branches],
  ] as const)("controls %s with its exact vocabulary and callback mapping", async (
    field,
    label,
    manualValue,
    nextValue,
    vocabulary,
  ) => {
    const onSetCorrection = vi.fn();
    const onResetCorrection = vi.fn();
    const corrected = setCalendarCorrection(ordinaryInput, field, manualValue);
    render(
      <CalendarReview
        result={calendarResult(corrected)}
        onSetCorrection={onSetCorrection}
        onResetCorrection={onResetCorrection}
      />,
    );

    const cell = screen.getByRole("button", { name: new RegExp(`${label}.*人工修正`) });
    await userEvent.click(cell);
    const select = screen.getByRole("combobox", { name: `修正${label}` });
    expect(select).toHaveValue(manualValue);
    expect(within(select).getAllByRole("option").map((option) => (option as HTMLOptionElement).value)).toEqual(vocabulary);
    await userEvent.selectOptions(select, nextValue);
    expect(onSetCorrection).toHaveBeenCalledWith(field, nextValue);

    await userEvent.click(screen.getByRole("button", { name: `恢复${label}自动值` }));
    expect(onResetCorrection).toHaveBeenCalledWith(field);
  });

  it.each([
    ["农历日期", "calendar/lunar-date-v1"],
    ["月建", "calendar/month-build-at-jie-v1"],
  ] as const)("keeps %s inspectable with field evidence and no correction controls", async (label, ruleId) => {
    render(<CalendarReview result={calendarResult()} onSetCorrection={vi.fn()} onResetCorrection={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
    const evidence = screen.getByRole("complementary");
    expect(within(evidence).getByText("calendar/beijing-time-v1")).toBeVisible();
    expect(within(evidence).getByText(ruleId)).toBeVisible();
    expect(within(evidence).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(evidence).queryByRole("button", { name: /恢复.*自动值/ })).not.toBeInTheDocument();
  });

  it("scopes retained provenance to the selected leaf when several fields are manual", async () => {
    let corrected = setCalendarCorrection(ordinaryInput, "monthPillar", "丁卯");
    corrected = setCalendarCorrection(corrected, "dayPillar", "乙巳");
    const onResetCorrection = vi.fn();
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
    expect(within(dayCell).getByText("人工修正")).toBeVisible();
    expect(screen.getAllByText("人工修正")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "恢复日柱自动值" }));
    expect(onResetCorrection).toHaveBeenCalledWith("dayPillar");
  });

  it("does not expose a month-general name input", async () => {
    render(<CalendarReview result={calendarResult()} onSetCorrection={vi.fn()} onResetCorrection={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /月将.*神后.*子.*自动/ }));
    expect(screen.queryByLabelText("月将名称")).not.toBeInTheDocument();
  });
});
