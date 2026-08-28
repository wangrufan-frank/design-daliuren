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
import { CourseExperience } from "./CourseExperience";

const artifactLoader = vi.hoisted(() => ({
  createRenderer: vi.fn(),
  loadArtifact: vi.fn(),
}));

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
  artifactLoader.createRenderer.mockReset();
  artifactLoader.loadArtifact.mockReset();
  artifactLoader.createRenderer.mockImplementation((canvas: HTMLCanvasElement) => ({
    domElement: canvas,
    dispose: vi.fn(),
  }));
  artifactLoader.loadArtifact.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("opens the three-dimensional experience for a complete guarded bundle and switches modes", async () => {
  const user = userEvent.setup();
  render(<CourseExperience source={source} />);

  expect(screen.getByRole("button", { name: "三维推演" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "文字课式" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByLabelText("大六壬三维器物")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "文字课式" }));

  expect(screen.getByRole("button", { name: "三维推演" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "文字课式" })).toHaveAttribute("aria-pressed", "true");
  const textCourse = screen.getByLabelText("标准文字课式");
  expect(textCourse).toBeVisible();
  expect(textCourse).toHaveTextContent("胜光午");
  expect(textCourse).toHaveTextContent("夜贵寅");
});

it("keeps the artifact mounted while controlled mobile text mode opens", async () => {
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
  function Harness() {
    const [activeTool, setActiveTool] = useState<"context" | "parts" | "timeline" | "evidence" | "course">();
    return (
      <>
        <div id="parts-host" />
        <div id="timeline-host" />
        <CourseExperience
          source={source}
          selectedStage="three-transmissions"
          mobileTools={{
            activeTool,
            onActiveToolChange: setActiveTool,
            partDirectoryHostId: "parts-host",
            timelineHostId: "timeline-host",
          }}
        />
      </>
    );
  }

  render(<Harness />);
  await user.click(within(screen.getByRole("toolbar", { name: "课式视图" })).getByRole("button", { name: "文字课式" }));

  expect(within(screen.getByRole("toolbar", { name: "课式视图" })).getByRole("button", { name: "文字课式" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("大六壬三维器物")).toBeInTheDocument();
});

it("shows the selected stage's shared two-line caption", () => {
  render(<CourseExperience source={source} selectedStage="three-transmissions" />);

  expect(screen.getByLabelText("三传取法阶段说明")).toHaveTextContent("初中末传");
  expect(screen.getByLabelText("三传取法阶段说明")).toHaveTextContent("由课势取其来去");
});

it("keeps the text course and copy action usable when artifact loading fails", async () => {
  artifactLoader.loadArtifact.mockRejectedValueOnce(new Error("missing GLB"));
  const user = userEvent.setup();
  render(<CourseExperience source={source} />);

  expect(await screen.findByRole("alert")).toHaveTextContent("三维器物无法加载");
  await user.click(screen.getByRole("button", { name: "查看文字课式" }));

  expect(screen.getByLabelText("标准文字课式")).toBeVisible();
  expect(screen.getByRole("button", { name: "复制课式" })).toBeEnabled();
});

it("keeps the text course and copy action usable when WebGL renderer creation fails", async () => {
  artifactLoader.createRenderer.mockImplementationOnce(() => {
    throw new Error("WebGL unavailable");
  });
  const user = userEvent.setup();
  render(<CourseExperience source={source} />);

  expect(await screen.findByRole("alert")).toHaveTextContent("三维器物无法加载");
  expect(screen.queryByLabelText("大六壬三维器物")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "查看文字课式" }));

  expect(screen.getByLabelText("标准文字课式")).toBeVisible();
  expect(screen.getByRole("button", { name: "复制课式" })).toBeEnabled();
});

it("opens the ordinary text course when structurally valid artifact facts are inconsistent", () => {
  const inconsistent: ArtifactSourceResults = {
    ...source,
    course: {
      ...source.course,
      transmissions: source.course.transmissions.map((item, index) => index === 0
        ? { ...item, branch: item.branch === "子" ? "丑" : "子" }
        : item),
    },
  };

  render(<CourseExperience source={inconsistent} />);

  expect(screen.getByLabelText("标准文字课式")).toBeVisible();
  expect(screen.getByRole("button", { name: "复制课式" })).toBeEnabled();
  expect(screen.queryByLabelText("大六壬三维器物")).not.toBeInTheDocument();
});
