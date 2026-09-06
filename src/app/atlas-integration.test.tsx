import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { MiniToolApp } from "../minitool/MiniToolApp";
import { CourseExperience } from "../features/course-experience/CourseExperience";
import { referenceSession } from "../test/reference-session";
import type { ArtifactSourceResults } from "../features/artifact-scene/model/types";

vi.mock("../features/artifact-scene/three/load-artifact", () => ({
  createArtifactRenderer: (canvas: HTMLCanvasElement) => ({ domElement: canvas, dispose: () => {} }),
  loadArtifact: () => new Promise(() => {}),
}));

afterEach(cleanup);

it.each([App, MiniToolApp])("makes the atlas available before generating a course", (Component) => {
  render(<Component />);
  expect(screen.getByRole("button", { name: "元素图鉴" })).toBeVisible();
});

it("keeps an atlas entry available in the course result view", () => {
  const source = {
    calendar: referenceSession.snapshots.calendar!.value,
    plate: referenceSession.snapshots["heaven-earth"]!.value,
    lessons: referenceSession.snapshots["four-lessons"]!.value,
    transmissions: referenceSession.snapshots["three-transmissions"]!.value,
    generals: referenceSession.snapshots["heavenly-generals"]!.value,
    course: referenceSession.snapshots.course!.value,
  } as ArtifactSourceResults;
  render(<CourseExperience source={source} />);
  expect(screen.getByRole("button", { name: "元素图鉴" })).toBeVisible();
});

it("passes the generated mini-tool course to its term cards", async () => {
  const user = userEvent.setup();
  render(<MiniToolApp />);
  fireEvent.change(screen.getByLabelText("日期与时间"), { target: { value: "2026-08-14T23:57:00" } });
  fireEvent.change(screen.getByLabelText("出生年份"), { target: { value: "1990" } });
  fireEvent.change(screen.getByLabelText("起课事由"), { target: { value: "图鉴接入验证" } });
  await user.click(screen.getByRole("button", { name: "生成完整课式" }));
  await user.click(screen.getByRole("button", { name: "文字课式" }));
  await user.click(screen.getByRole("button", { name: "了解旬空" }));
  expect(within(screen.getByRole("dialog")).getByLabelText("在这一课中")).toHaveTextContent("本课日柱为");
});
