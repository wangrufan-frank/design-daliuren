import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CalendarResult } from "../../domain/calendar/types";
import type { CourseResult } from "../../domain/course/types";
import type { FourLessonsResult } from "../../domain/four-lessons/types";
import type { HeavenEarthResult } from "../../domain/heaven-earth/types";
import type { HeavenlyGeneralsResult } from "../../domain/heavenly-generals/types";
import type { ThreeTransmissionsResult } from "../../domain/three-transmissions/types";
import { referenceSession } from "../../test/reference-session";
import type { ArtifactSourceResults } from "../artifact-scene/model/types";
import { CourseWorkbench } from "./CourseWorkbench";

const artifactLoader = vi.hoisted(() => ({ createRenderer: vi.fn(), loadArtifact: vi.fn() }));

vi.mock("../artifact-scene/three/load-artifact", () => ({
  createArtifactRenderer: (...args: unknown[]) => artifactLoader.createRenderer(...args),
  loadArtifact: (...args: unknown[]) => artifactLoader.loadArtifact(...args),
}));

const source: ArtifactSourceResults = {
  calendar: referenceSession.snapshots.calendar!.value as CalendarResult,
  plate: referenceSession.snapshots["heaven-earth"]!.value as HeavenEarthResult,
  lessons: referenceSession.snapshots["four-lessons"]!.value as FourLessonsResult,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value as ThreeTransmissionsResult,
  generals: referenceSession.snapshots["heavenly-generals"]!.value as HeavenlyGeneralsResult,
  course: referenceSession.snapshots.course!.value as CourseResult,
};

beforeEach(() => {
  artifactLoader.createRenderer.mockImplementation((canvas: HTMLCanvasElement) => ({ domElement: canvas, dispose: vi.fn() }));
  artifactLoader.loadArtifact.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("renders only the course display without workbench tools or stage navigation", () => {
  render(
    <CourseWorkbench
      input={referenceSession.input}
      source={source}
      selectedStage="course"
      onSelectStage={vi.fn()}
      onRestart={vi.fn()}
    />,
  );

  expect(screen.getByRole("region", { name: "课式展示" })).toBeVisible();
  expect(screen.getByRole("toolbar", { name: "课式视图" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "起课上下文" })).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: /推演阶段/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("toolbar", { name: "工作台工具" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "查看阶段证据" })).not.toBeInTheDocument();
});

it("keeps calculation errors visible above the simplified display", () => {
  render(
    <CourseWorkbench
      input={referenceSession.input}
      source={source}
      selectedStage="calendar"
      stageErrorMessage="历法数据读取失败"
      onSelectStage={vi.fn()}
      onRestart={vi.fn()}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("历法数据读取失败");
  expect(screen.getByRole("region", { name: "课式展示" })).toBeVisible();
});
