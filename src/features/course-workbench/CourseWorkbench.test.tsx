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

it("renders one semantic three-column workbench for a complete course", () => {
  render(
    <CourseWorkbench
      input={referenceSession.input}
      source={source}
      selectedStage="course"
      onSelectStage={vi.fn()}
      onRestart={vi.fn()}
    />,
  );

  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getByRole("region", { name: "起课上下文" })).toBeVisible();
  expect(screen.getByRole("region", { name: "三维阶段回看" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "推演阶段" })).toBeVisible();
  expect(screen.getByRole("button", { name: "复制结课，已完成" })).toHaveAttribute("aria-current", "page");
});
