import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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
  vi.unstubAllGlobals();
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
  const desktopStages = screen.getByRole("navigation", { name: "推演阶段" });
  expect(desktopStages).toBeVisible();
  expect(within(desktopStages).getByRole("button", { name: "复制结课，已完成" })).toHaveAttribute("aria-current", "page");
});

it("keeps a general stage error visible without replacing the completed workbench", () => {
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
  expect(screen.getByRole("region", { name: "三维阶段回看" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "推演阶段" })).toBeVisible();
});

it("keeps stage selection inside the workbench and updates the central caption", async () => {
  const user = userEvent.setup();
  function Workbench() {
    const [selectedStage, setSelectedStage] = useState<"calendar" | "heaven-earth" | "four-lessons" | "three-transmissions" | "heavenly-generals" | "course">("course");
    return <CourseWorkbench input={referenceSession.input} source={source} selectedStage={selectedStage} onSelectStage={setSelectedStage} onRestart={vi.fn()} />;
  }

  render(<Workbench />);
  await user.click(within(screen.getByRole("navigation", { name: "推演阶段" })).getByRole("button", { name: "三传取法，已完成" }));

  expect(screen.getByLabelText("三传取法阶段说明")).toHaveTextContent("初中末传");
});

it("keeps the selected stage when text mode opens and closes on mobile", async () => {
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query === "(max-width: 899px)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  const user = userEvent.setup();
  function Workbench() {
    const [selectedStage, setSelectedStage] = useState<"calendar" | "heaven-earth" | "four-lessons" | "three-transmissions" | "heavenly-generals" | "course">("course");
    return <CourseWorkbench input={referenceSession.input} source={source} selectedStage={selectedStage} onSelectStage={setSelectedStage} onRestart={vi.fn()} />;
  }

  render(<Workbench />);
  const mobileStages = screen.getByRole("navigation", { name: "移动推演阶段" });
  expect(screen.getByRole("toolbar", { name: "工作台工具" })).toBeInTheDocument();
  await user.click(within(mobileStages).getByRole("button", { name: "三传取法，已完成" }));
  await user.click(within(screen.getByRole("toolbar", { name: "课式视图" })).getByRole("button", { name: "文字课式" }));

  expect(screen.getByRole("region", { name: "移动工具面板" })).toHaveTextContent("大六壬 · 标准文字课式");
  expect(within(mobileStages).getByRole("button", { name: "三传取法，已完成" })).toHaveAttribute("aria-current", "page");

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "移动工具面板" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("三传取法阶段说明")).toHaveTextContent("初中末传");
  expect(within(screen.getByRole("toolbar", { name: "课式视图" })).getByRole("button", { name: "三维推演" })).toHaveAttribute("aria-pressed", "true");
});
