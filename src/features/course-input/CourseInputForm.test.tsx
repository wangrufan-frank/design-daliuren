import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CourseInputForm } from "./CourseInputForm";

it("shows concrete errors and does not submit invalid input", async () => {
  const onSubmit = vi.fn();
  render(<CourseInputForm onSubmit={onSubmit} />);

  await userEvent.click(screen.getByRole("button", { name: "建立起课上下文" }));

  expect(screen.getByText("请输入地点")).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();
});
