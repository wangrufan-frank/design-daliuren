import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { CourseResult } from "../../domain/course/types";
import { serializeCourseText } from "../../domain/course/policy";
import { referenceSession } from "../../test/reference-session";
import { CourseSheet } from "./CourseSheet";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const result = referenceSession.snapshots.course!.value as CourseResult;

it("renders the approved reading order and enclosing palace square", () => {
  render(<CourseSheet result={result} />);
  expect(screen.getAllByTestId("course-transmission").map((node) => node.getAttribute("data-position")))
    .toEqual(["initial", "middle", "final"]);
  expect(screen.getAllByTestId("course-lesson").map((node) => node.getAttribute("data-lesson")))
    .toEqual(["fourth", "third", "second", "first"]);
  const firstTransmission = screen.getAllByTestId("course-transmission")[0];
  expect([...firstTransmission.children].map((node) => node.getAttribute("data-layer")))
    .toEqual(["general", "content"]);
  const firstLesson = screen.getAllByTestId("course-lesson")[0];
  expect(firstLesson.firstElementChild).toHaveAttribute("data-layer", "general");
  const plate = screen.getByRole("list", { name: "标准课式十二宫方盘" });
  expect(within(plate).getAllByRole("listitem")).toHaveLength(12);
  expect(screen.getByTestId("course-plate-center")).toHaveTextContent("月将");
});

it("copies the exact serializer output and reports success", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<CourseSheet result={result} />);
  await userEvent.click(screen.getByRole("button", { name: "复制课式" }));
  expect(writeText).toHaveBeenCalledWith(serializeCourseText(result));
  expect(screen.getByRole("status")).toHaveTextContent("课式已复制");
  await userEvent.click(screen.getByRole("button", { name: "已复制" }));
  expect(writeText).toHaveBeenCalledTimes(2);
});

it("keeps the result visible and reports clipboard failure", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  render(<CourseSheet result={result} />);
  await userEvent.click(screen.getByRole("button", { name: "复制课式" }));
  expect(screen.getByRole("alert")).toHaveTextContent("复制失败，请重试");
  expect(screen.getByRole("article", { name: "标准文字课式" })).toBeVisible();
});
