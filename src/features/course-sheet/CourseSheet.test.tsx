import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
// @ts-expect-error Vitest executes this test in Node and provides the builtin at runtime.
import { readFileSync } from "node:fs";
import type { CourseResult } from "../../domain/course/types";
import { serializeCourseText } from "../../domain/course/policy";
import { referenceSession } from "../../test/reference-session";
import { CourseSheet } from "./CourseSheet";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const result = referenceSession.snapshots.course!.value as CourseResult;
const nextResult: CourseResult = {
  ...result,
  context: { ...result.context, locationName: "更新后的课式" },
};
const globalCss = readFileSync("src/styles/global.css", "utf8");

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
  const palaces = within(plate).getAllByRole("listitem");
  expect(palaces).toHaveLength(12);
  expect(palaces.map((palace) => palace.getAttribute("data-earth")))
    .toEqual(["巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰"]);
  expect(screen.getByTestId("course-plate-center")).toHaveTextContent("月将");
});

it("locks the approved square, perimeter, mobile lesson grid, and host selector scope", () => {
  expect(globalCss).toMatch(/\.course-sheet__plate \{[^}]*grid-template-columns: repeat\(4,[^}]*grid-template-rows: repeat\(4,/);
  const perimeter = [
    "1 / 1", "1 / 2", "1 / 3", "1 / 4",
    "2 / 4", "3 / 4", "4 / 4", "4 / 3",
    "4 / 2", "4 / 1", "3 / 1", "2 / 1",
  ];
  perimeter.forEach((gridArea, index) => {
    expect(globalCss).toContain(`.course-sheet__plate li:nth-child(${index + 1}) { grid-area: ${gridArea}; }`);
  });
  expect(globalCss).toMatch(/@media \(max-width: 760px\) \{[\s\S]*\.course-sheet__lessons ol \{ grid-template-columns: repeat\(2,/);
  expect(globalCss).toContain(".app-stage > h2 {");
  expect(globalCss).toContain(".app-stage > p {");
  expect(globalCss).not.toContain(".app-stage h2 {");
  expect(globalCss).not.toContain(".app-stage p {");
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

it("keeps a later failure after an earlier success timer expires", async () => {
  vi.useFakeTimers();
  const writeText = vi.fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("denied"));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<CourseSheet result={result} />);

  fireEvent.click(screen.getByRole("button", { name: "复制课式" }));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole("status")).toHaveTextContent("课式已复制");

  fireEvent.click(screen.getByRole("button", { name: "已复制" }));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole("alert")).toHaveTextContent("复制失败，请重试");

  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByRole("alert")).toHaveTextContent("复制失败，请重试");
});

it("ignores stale copy completion and allows the latest failure to be retried", async () => {
  const first = deferred();
  const second = deferred();
  const writeText = vi.fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockResolvedValueOnce(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<CourseSheet result={result} />);

  fireEvent.click(screen.getByRole("button", { name: "复制课式" }));
  fireEvent.click(screen.getByRole("button", { name: "复制课式" }));
  await act(async () => {
    second.reject(new Error("denied"));
    await Promise.resolve();
  });
  expect(screen.getByRole("alert")).toHaveTextContent("复制失败，请重试");

  await act(async () => {
    first.resolve();
    await Promise.resolve();
  });
  expect(screen.getByRole("alert")).toHaveTextContent("复制失败，请重试");

  fireEvent.click(screen.getByRole("button", { name: "复制课式" }));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole("status")).toHaveTextContent("课式已复制");
});

it("invalidates a pending copy when the sheet unmounts", async () => {
  vi.useFakeTimers();
  const pending = deferred();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockReturnValue(pending.promise) },
  });
  const { unmount } = render(<CourseSheet result={result} />);
  fireEvent.click(screen.getByRole("button", { name: "复制课式" }));

  unmount();
  await act(async () => {
    pending.resolve();
    await Promise.resolve();
  });
  expect(vi.getTimerCount()).toBe(0);
});

it("resets copied feedback when a new course result is rendered", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  const { rerender } = render(<CourseSheet result={result} />);
  await userEvent.click(screen.getByRole("button", { name: "复制课式" }));
  expect(screen.getByRole("status")).toHaveTextContent("课式已复制");

  rerender(<CourseSheet result={nextResult} />);
  expect(screen.getByText("更新后的课式", { exact: false })).toBeVisible();
  expect(screen.getByRole("button", { name: "复制课式" })).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("ignores an old clipboard completion after the course result changes", async () => {
  const pending = deferred();
  const writeText = vi.fn().mockReturnValue(pending.promise);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const { rerender } = render(<CourseSheet result={result} />);
  fireEvent.click(screen.getByRole("button", { name: "复制课式" }));

  rerender(<CourseSheet result={nextResult} />);
  await act(async () => {
    pending.resolve();
    await Promise.resolve();
  });

  expect(writeText).toHaveBeenCalledWith(serializeCourseText(result));
  expect(screen.getByText("更新后的课式", { exact: false })).toBeVisible();
  expect(screen.getByRole("button", { name: "复制课式" })).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
