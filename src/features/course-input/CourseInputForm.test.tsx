import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CourseInputForm } from "./CourseInputForm";

afterEach(cleanup);

it("shows concrete errors and does not submit invalid input", async () => {
  const onSubmit = vi.fn();
  render(<CourseInputForm onSubmit={onSubmit} />);

  await userEvent.click(screen.getByRole("button", { name: "建立起课上下文" }));

  expect(screen.getByText("请输入地点")).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("associates each invalid base input with its own error", async () => {
  render(<CourseInputForm onSubmit={vi.fn()} />);
  const fields = [
    { label: "日期与时间", errorId: "civilDateTime-error", message: "请输入日期与时间" },
    { label: "地点", errorId: "locationName-error", message: "请输入地点" },
    { label: "经度", errorId: "longitude-error", message: "请输入经度" },
    { label: "纬度", errorId: "latitude-error", message: "请输入纬度" },
  ];

  for (const { label } of fields) {
    expect(screen.getByLabelText(label)).not.toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText(label)).not.toHaveAttribute("aria-invalid");
  }

  await userEvent.click(screen.getByRole("button", { name: "建立起课上下文" }));

  for (const { label, errorId, message } of fields) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("aria-describedby", errorId);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(message)).toHaveAttribute("id", errorId);
  }
});
