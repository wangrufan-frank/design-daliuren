import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import type { CourseResult } from "../../domain/course/types";
import { MiniToolCourseSheet } from "../../minitool/course/MiniToolCourseSheet";
import { ElementAtlasProvider } from "../element-atlas/ElementAtlas";
import { CourseSheet } from "./CourseSheet";

afterEach(cleanup);
const result = referenceSession.snapshots.course!.value as CourseResult;

it.each([CourseSheet, MiniToolCourseSheet])("opens every displayed branch and general without changing plain text", async (Sheet) => {
  const user = userEvent.setup();
  render(<Sheet result={result} />);
  const plainText = screen.getByRole("article").textContent;
  cleanup();
  render(<ElementAtlasProvider course={result}><Sheet result={result} /></ElementAtlasProvider>);
  const article = screen.getByRole("article");
  expect(article.textContent).toBe(plainText);
  const buttons = within(article).getAllByRole("button");
  for (const term of ["子", "亥", "贵人", "旬空"]) {
    expect(buttons.some((button) => button.textContent === term)).toBe(true);
  }
  expect(buttons.some((button) => ["天", "天盘"].includes(button.textContent!))).toBe(true);
  expect(buttons.some((button) => ["地", "地盘"].includes(button.textContent!))).toBe(true);
  expect(buttons.some((button) => ["丑", "螣蛇", "天空"].includes(button.textContent!))).toBe(true);
  await user.click(buttons.find((button) => button.textContent === "亥")!);
  expect(screen.getByRole("dialog")).toBeVisible();
});
