import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

it("starts at input without a fake model or fake course", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "大六壬演式" })).toBeVisible();
  expect(screen.getByRole("button", { name: "建立起课上下文" })).toBeVisible();
  expect(screen.getByLabelText("传统规则阶段")).toBeVisible();
  expect(screen.queryByLabelText("标准文字课式")).not.toBeInTheDocument();
  expect(screen.queryByText(/三维模型占位/)).not.toBeInTheDocument();
});

it("moves to rule confirmation after a valid input without rendering a course", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByLabelText("日期与时间"), "2026-08-15T12:00");
  await user.type(screen.getByLabelText("地点"), "北京");
  await user.type(screen.getByLabelText("经度"), "116.4074");
  await user.type(screen.getByLabelText("纬度"), "39.9042");
  await user.click(screen.getByRole("button", { name: "建立起课上下文" }));

  expect(screen.getByRole("heading", { name: "规则确认" })).toBeVisible();
  expect(screen.queryByLabelText("标准文字课式")).not.toBeInTheDocument();
});

it("collapses each shell panel and unmounts its content", async () => {
  const user = userEvent.setup();
  render(<App />);

  const inputToggle = screen.getByRole("button", { name: "起课输入" });
  await user.click(inputToggle);
  expect(inputToggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("日期与时间")).not.toBeInTheDocument();

  const railToggle = screen.getByRole("button", { name: "推演依据" });
  await user.click(railToggle);
  expect(railToggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("传统规则阶段")).not.toBeInTheDocument();
});
