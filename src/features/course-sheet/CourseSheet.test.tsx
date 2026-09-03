import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { CourseResult } from "../../domain/course/types";
import { referenceSession } from "../../test/reference-session";
import { CourseSheet } from "./CourseSheet";

const imageMocks = vi.hoisted(() => ({ toBlob: vi.fn() }));
vi.mock("html-to-image", () => ({ toBlob: (...args: unknown[]) => imageMocks.toBlob(...args) }));

const pngBlob = new Blob(["course-image"], { type: "image/png" });

beforeEach(() => {
  imageMocks.toBlob.mockReset();
  imageMocks.toBlob.mockResolvedValue(pngBlob);
  vi.stubGlobal("ClipboardItem", class {
    constructor(readonly data: Record<string, Blob>) {}
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const result = referenceSession.snapshots.course!.value as CourseResult;
const nextResult: CourseResult = {
  ...result,
  context: { ...result.context, locationName: "更新后的课式" },
};
const globalCss = readFileSync("src/styles/global.css", "utf8");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
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

it("shows natal context and marks void branches across transmissions, lessons, and palaces", () => {
  const annotated: CourseResult = {
    ...result,
    transmissions: result.transmissions.map((item, index) => index === 0 ? { ...item, branch: "子" } : item),
    lessons: result.lessons.map((item, index) => index === 0
      ? { ...item, upper: "丑", lower: { kind: "branch", value: "子" } }
      : item),
    palaces: result.palaces,
  };

  render(<CourseSheet result={annotated} />);

  expect(screen.getByText("旬空").nextElementSibling).toHaveTextContent(/子\s+丑/);
  expect(screen.getByText("本命").nextElementSibling).toHaveTextContent("1990年 · 午命 · 自动换算");
  expect(screen.getAllByLabelText("空亡")).toHaveLength(7);
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

it("keeps a saveable preview visible after copying the PNG", async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } });
  render(<CourseSheet result={result} />);
  await userEvent.click(screen.getByRole("button", { name: "复制课式图片" }));
  expect(imageMocks.toBlob).toHaveBeenCalledWith(
    screen.getByRole("article", { name: "标准文字课式" }),
    expect.objectContaining({ backgroundColor: "#f3efe6", pixelRatio: 1 }),
  );
  expect(write).toHaveBeenCalledOnce();
  expect(await screen.findByRole("status")).toHaveTextContent("课式图片已复制");
  expect(screen.getByRole("img", { name: "生成的大六壬课式" }))
    .toHaveAttribute("src", "data:image/png;base64,Y291cnNlLWltYWdl");
  expect(screen.getByRole("link", { name: "保存课式图片" }))
    .toHaveAttribute("href", "data:image/png;base64,Y291cnNlLWltYWdl");
});

it("keeps the result visible and reports image generation failure", async () => {
  imageMocks.toBlob.mockRejectedValueOnce(new Error("render failed"));
  render(<CourseSheet result={result} />);
  await userEvent.click(screen.getByRole("button", { name: "复制课式图片" }));
  expect(screen.getByRole("alert")).toHaveTextContent("图片生成失败，请重试");
  expect(screen.getByRole("article", { name: "标准文字课式" })).toBeVisible();
});

it("does not trust image clipboard writes inside WeChat and shows the save preview", async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("MicroMessenger");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } });
  render(<CourseSheet result={result} />);
  await userEvent.click(screen.getByRole("button", { name: "复制课式图片" }));
  expect(write).not.toHaveBeenCalled();
  expect(await screen.findByRole("status")).toHaveTextContent("微信内请长按图片保存");
  expect(screen.getByRole("img", { name: "生成的大六壬课式" }))
    .toHaveAttribute("src", "data:image/png;base64,Y291cnNlLWltYWdl");
  expect(screen.getByRole("link", { name: "保存课式图片" })).toBeVisible();
});

it("ignores stale image generation after the course result changes", async () => {
  const pending = deferred<Blob | null>();
  imageMocks.toBlob.mockReturnValueOnce(pending.promise);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write: vi.fn() } });
  const { rerender } = render(<CourseSheet result={result} />);
  fireEvent.click(screen.getByRole("button", { name: "复制课式图片" }));

  rerender(<CourseSheet result={nextResult} />);
  await act(async () => {
    pending.resolve(pngBlob);
    await Promise.resolve();
  });

  expect(screen.getByText("更新后的课式", { exact: false })).toBeVisible();
  expect(screen.getByRole("button", { name: "复制课式图片" })).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
