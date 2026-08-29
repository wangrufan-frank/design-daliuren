import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CourseInputForm } from "./CourseInputForm";

afterEach(cleanup);

it("shows concrete errors and does not submit invalid input", async () => {
  const onSubmit = vi.fn();
  render(<CourseInputForm onSubmit={onSubmit} />);

  await userEvent.click(screen.getByRole("button", { name: "生成完整课式" }));

  expect(screen.getByText("请输入起课事由")).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("associates each invalid base input with its own error", async () => {
  render(<CourseInputForm onSubmit={vi.fn()} />);
  const fields = [
    { label: "日期与时间", errorId: "civilDateTime-error", message: "请输入日期与时间" },
    { label: "出生年份", errorId: "birthYear-error", message: "请输入 1900 年至今年之间的出生年份" },
    { label: "起课事由", errorId: "reason-error", message: "请输入起课事由" },
  ];

  for (const { label } of fields) {
    expect(screen.getByLabelText(label)).not.toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText(label)).not.toHaveAttribute("aria-invalid");
  }

  await userEvent.click(screen.getByRole("button", { name: "生成完整课式" }));

  for (const { label, errorId, message } of fields) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("aria-describedby", errorId);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(message)).toHaveAttribute("id", errorId);
  }
});

it("accepts second-level Beijing time within the supported range", () => {
  render(<CourseInputForm onSubmit={vi.fn()} />);

  const input = screen.getByLabelText("日期与时间");
  expect(input).toHaveAttribute("step", "1");
  expect(input).toHaveAttribute("min", "1900-01-01T00:00:00");
  expect(input).toHaveAttribute("max", "2100-12-31T23:59:59");
});

it("derives the natal branch from birth year and allows a manual override", async () => {
  const onSubmit = vi.fn();
  render(<CourseInputForm onSubmit={onSubmit} />);

  const birthYear = screen.getByRole("spinbutton", { name: "出生年份" });
  await userEvent.type(birthYear, "1990");
  expect(screen.getByText("自动换算：午命")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "手动选择本命" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "本命地支" }), "子");
  expect(screen.getByText("手动选择：子命")).toBeVisible();

  await userEvent.type(screen.getByLabelText("日期与时间"), "2024-02-10T14:30:00");
  await userEvent.type(screen.getByLabelText("起课事由"), "商务决策复盘");
  await userEvent.click(screen.getByRole("button", { name: "生成完整课式" }));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    natal: { birthYear: 1990, branch: "子", source: "manual" },
  }));
});

it("keeps ordinary entry to base context fields and submits empty corrections", async () => {
  const onSubmit = vi.fn();
  render(<CourseInputForm onSubmit={onSubmit} />);

  expect(screen.queryByLabelText("月将")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("占时")).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("日期与时间"), "2024-02-10T14:30:00");
  await userEvent.type(screen.getByRole("spinbutton", { name: "出生年份" }), "1990");
  await userEvent.type(screen.getByLabelText("地点（选填）"), "北京");
  await userEvent.type(screen.getByLabelText("起课事由"), "商务决策复盘");
  await userEvent.click(screen.getByRole("button", { name: "生成完整课式" }));

  expect(onSubmit).toHaveBeenCalledOnce();
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ corrections: {} }));
});

it("requires a reason textarea and keeps location optional without coordinates", () => {
  render(<CourseInputForm onSubmit={vi.fn()} />);

  expect(screen.getByRole("textbox", { name: "起课事由" })).toHaveAttribute("required");
  expect(screen.getByRole("textbox", { name: "起课事由" }).tagName).toBe("TEXTAREA");
  expect(screen.getByLabelText("地点（选填）")).toBeInTheDocument();
  expect(screen.queryByLabelText(/经度|纬度/)).not.toBeInTheDocument();
});

it("names the action by the complete result it creates", () => {
  render(<CourseInputForm onSubmit={vi.fn()} />);

  expect(screen.getByRole("button", { name: "生成完整课式" })).toBeVisible();
});
