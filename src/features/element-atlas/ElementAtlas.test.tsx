import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import type { CourseResult } from "../../domain/course/types";
import { referenceSession } from "../../test/reference-session";
import { AtlasLauncher, AtlasTerm, ElementAtlasProvider } from "./ElementAtlas";

afterEach(cleanup);
const course = referenceSession.snapshots.course!.value as CourseResult;

it("shows category totals and can clear an empty combined search", async () => {
  const user = userEvent.setup();
  render(<ElementAtlasProvider><AtlasLauncher /></ElementAtlasProvider>);
  await user.click(screen.getByRole("button", { name: "元素图鉴" }));
  const category = screen.getByRole("button", { name: "地支" });
  expect(category).toHaveTextContent("12");
  await user.click(category);
  await user.type(screen.getByRole("searchbox"), "不存在的词");
  await user.click(screen.getByRole("button", { name: "查看全部" }));
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
  await user.type(screen.getByRole("searchbox"), "天盘");
  expect(document.querySelector(".atlas-tile")).toHaveAccessibleName("天地盘");
  await user.click(screen.getByRole("button", { name: "清空搜索" }));
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getByRole("searchbox")).toHaveFocus();
});

it("restores list position and the selected tile when returning from a detail", async () => {
  const user = userEvent.setup();
  render(<ElementAtlasProvider><AtlasLauncher /></ElementAtlasProvider>);
  await user.click(screen.getByRole("button", { name: "元素图鉴" }));
  const dialog = screen.getByRole("dialog");
  dialog.scrollTop = 420;
  await user.click(screen.getByRole("button", { name: "子 · 神后" }));
  expect(dialog.scrollTop).toBe(0);
  await user.click(screen.getByRole("button", { name: "← 全部图鉴" }));
  expect(dialog.scrollTop).toBe(420);
  expect(screen.getByRole("button", { name: "子 · 神后" })).toHaveFocus();
});

it("browses without a course, compares water branches and restores launch focus", async () => {
  const user = userEvent.setup();
  render(<ElementAtlasProvider><AtlasLauncher /></ElementAtlasProvider>);
  const trigger = screen.getByRole("button", { name: "元素图鉴" });
  await user.click(trigger);
  let dialog = screen.getByRole("dialog", { name: "元素图鉴" });
  await user.click(within(dialog).getByRole("button", { name: /子 · 神后/ }));
  dialog = screen.getByRole("dialog", { name: "子 · 神后" });
  expect(within(dialog).getByText(/起课后/)).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "子与亥对照" }));
  expect(screen.getByRole("table", { name: "子与亥对照" })).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("opens known terms but leaves unknown terms and provider-free text alone", async () => {
  const user = userEvent.setup();
  render(<ElementAtlasProvider><AtlasTerm value="子" /><AtlasTerm value="未收录术语" /></ElementAtlasProvider>);
  expect(screen.queryByRole("button", { name: /未收录术语/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "了解子" }));
  expect(screen.getByRole("dialog", { name: "子 · 神后" })).toBeVisible();
  cleanup();
  render(<AtlasTerm value="子" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText("子")).toBeVisible();
});

it("derives current context from the supplied course and updates it without remounting children", async () => {
  const user = userEvent.setup();
  const view = (result: CourseResult) => <ElementAtlasProvider course={result}><input aria-label="保留内容" defaultValue="初始" /><AtlasTerm value="旬空" /></ElementAtlasProvider>;
  const { rerender } = render(view(course));
  const input = screen.getByRole("textbox", { name: "保留内容" });
  await user.type(input, "保留");
  await user.click(screen.getByRole("button", { name: "了解旬空" }));
  expect(screen.getByLabelText("在这一课中")).toHaveTextContent("子、丑");
  rerender(view({ ...course, context: { ...course.context, voidBranches: ["戌", "亥"] } }));
  expect(screen.getByLabelText("在这一课中")).toHaveTextContent("戌、亥");
  await user.keyboard("{Escape}");
  expect(input).toHaveValue("初始保留");
});

it("keeps knowledge readable when the background image fails", async () => {
  const user = userEvent.setup();
  render(<ElementAtlasProvider><AtlasTerm value="贵人" /></ElementAtlasProvider>);
  await user.click(screen.getByRole("button", { name: "了解贵人" }));
  fireEvent.error(screen.getByRole("img", { name: /艺术配图/ }));
  expect(screen.getByText("画作暂不可用，仍可阅读下方释义。")).toBeVisible();
  expect(screen.getByText(/十二天将的起布之首/)).toBeVisible();
});

it("closes with Escape even when focus has left the reader after an async action", async () => {
  const user = userEvent.setup();
  render(<ElementAtlasProvider><AtlasLauncher /></ElementAtlasProvider>);
  await user.click(screen.getByRole("button", { name: "元素图鉴" }));
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("searches aliases across the full atlas and bounds the visible cards", async () => {
  const user = userEvent.setup();
  render(<ElementAtlasProvider><AtlasLauncher /></ElementAtlasProvider>);
  await user.click(screen.getByRole("button", { name: "元素图鉴" }));
  expect(document.querySelectorAll(".atlas-tile").length).toBeLessThanOrEqual(12);
  await user.type(screen.getByRole("searchbox", { name: "搜索元素" }), "腾蛇");
  expect(document.querySelectorAll(".atlas-tile")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: /螣蛇/ }));
  expect(screen.getByRole("dialog")).toHaveAccessibleName(/螣蛇/);
  await user.click(screen.getByRole("button", { name: "← 全部图鉴" }));
  await user.clear(screen.getByRole("searchbox", { name: "搜索元素" }));
  await user.type(screen.getByRole("searchbox", { name: "搜索元素" }), "不存在的词");
  expect(screen.getByText("没有找到相关条目，请换个名称或分类。")).toBeVisible();
});
