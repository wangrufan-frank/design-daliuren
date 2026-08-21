import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarResult } from "../../domain/calendar/types";
import type { CourseResult } from "../../domain/course/types";
import type { FourLessonsResult } from "../../domain/four-lessons/types";
import type { HeavenlyGeneralsResult } from "../../domain/heavenly-generals/types";
import type { HeavenEarthResult } from "../../domain/heaven-earth/types";
import type { ThreeTransmissionsResult } from "../../domain/three-transmissions/types";
import type { ArtifactSourceResults } from "./model/types";
import { referenceSession } from "../../test/reference-session";
import { useReducedMotion } from "./use-reduced-motion";

interface ControllerDouble {
  callbacks: { onUserControlStart(): void; onContextLost(): void; onError(error: unknown): void };
  resize: any;
  setDisplayState: any;
  applyPose: any;
  resetCamera: any;
  render: any;
  dispose: any;
}

const mocks = {
  controllers: [] as ControllerDouble[],
  createRenderer: vi.fn(),
  loadArtifact: vi.fn(),
  onControllerCreate: undefined as ((controller: ControllerDouble) => void) | undefined,
};
let ArtifactExperience: typeof import("./ArtifactExperience")["ArtifactExperience"];

beforeAll(async () => {
  vi.doMock("./three/load-artifact", () => ({
    createArtifactRenderer: (...args: unknown[]) => mocks.createRenderer(...args),
    loadArtifact: (...args: unknown[]) => mocks.loadArtifact(...args),
  }));
  vi.doMock("./three/ArtifactSceneController", () => ({
    ArtifactSceneController: class {
      callbacks: { onUserControlStart(): void; onContextLost(): void; onError(error: unknown): void };
      resize = vi.fn();
      setDisplayState = vi.fn();
      applyPose = vi.fn();
      resetCamera = vi.fn();
      render = vi.fn();
      dispose = vi.fn();

      constructor(_renderer: unknown, _artifact: unknown, callbacks: typeof this.callbacks) {
        this.callbacks = callbacks;
        mocks.controllers.push(this);
        mocks.onControllerCreate?.(this);
      }
    },
  }));
  ({ ArtifactExperience } = await import("./ArtifactExperience"));
});

afterAll(() => {
  vi.doUnmock("./three/load-artifact");
  vi.doUnmock("./three/ArtifactSceneController");
});

const referenceSourceResults: ArtifactSourceResults = {
  calendar: referenceSession.snapshots.calendar!.value as CalendarResult,
  plate: referenceSession.snapshots["heaven-earth"]!.value as HeavenEarthResult,
  lessons: referenceSession.snapshots["four-lessons"]!.value as FourLessonsResult,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value as ThreeTransmissionsResult,
  generals: referenceSession.snapshots["heavenly-generals"]!.value as HeavenlyGeneralsResult,
  course: referenceSession.snapshots.course!.value as CourseResult,
};

function resolvedArtifact() {
  return { root: {}, nodes: new Map(), animations: [], url: "/artifact.glb" };
}

function installMatchMedia(initial = false) {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    get matches() { return matches; },
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  return {
    media,
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener({ matches, media: media.media } as MediaQueryListEvent));
    },
  };
}

function installAnimationFrames() {
  let nextId = 1;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
  return {
    step(timestamp: number) {
      const pending = [...frames.values()];
      frames.clear();
      act(() => pending.forEach((callback) => callback(timestamp)));
    },
  };
}

function latestController() {
  return mocks.controllers.at(-1)!;
}

beforeEach(() => {
  mocks.controllers.length = 0;
  mocks.onControllerCreate = undefined;
  mocks.createRenderer.mockReset();
  mocks.loadArtifact.mockReset();
  mocks.createRenderer.mockImplementation((canvas: HTMLCanvasElement) => ({
    domElement: canvas,
    dispose: vi.fn(),
  }));
  mocks.loadArtifact.mockResolvedValue(resolvedArtifact());
  installMatchMedia();
  installAnimationFrames();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ArtifactExperience", () => {
  it("shows loading, then exposes deterministic controls and the text-course escape", async () => {
    let resolveLoad!: (artifact: ReturnType<typeof resolvedArtifact>) => void;
    mocks.loadArtifact.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
    const onShowCourse = vi.fn();
    const user = userEvent.setup();

    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={onShowCourse} />);
    expect(screen.getByText("正在加载三维器物")).toBeVisible();
    await act(async () => resolveLoad(resolvedArtifact()));

    expect(screen.getByRole("button", { name: "播放推演" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveAttribute("max", "12500");
    await user.click(screen.getByRole("button", { name: "查看文字课式" }));
    expect(onShowCourse).toHaveBeenCalledOnce();
  });

  it("disposes the renderer after loader failure and removes the empty canvas", async () => {
    const renderer = { domElement: document.createElement("canvas"), dispose: vi.fn() };
    mocks.createRenderer.mockReturnValue(renderer);
    mocks.loadArtifact.mockRejectedValue(new Error("404"));

    const { unmount } = render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByLabelText("大六壬三维器物")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看文字课式" })).toBeVisible();
    unmount();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it("keeps the fallback when display-state setup reports a controller error", async () => {
    mocks.onControllerCreate = (controller) => {
      controller.setDisplayState.mockImplementation(() => controller.callbacks.onError(new Error("label failed")));
    };

    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByRole("slider", { name: "推演时间轴" })).not.toBeInTheDocument();
    expect(latestController().dispose).toHaveBeenCalledOnce();
  });

  it("cancels its single frame loop and disposes the controller exactly once on unmount", async () => {
    const { unmount } = render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledOnce();
    expect(latestController().dispose).toHaveBeenCalledOnce();
  });

  it("reuses the loaded artifact and resets the absolute pose when source changes", async () => {
    const { rerender } = render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "8450" } });

    rerender(<ArtifactExperience source={{ ...referenceSourceResults }} onShowCourse={vi.fn()} />);

    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("0");
    expect(mocks.loadArtifact).toHaveBeenCalledOnce();
    expect(latestController().setDisplayState).toHaveBeenCalledTimes(2);
    expect(latestController().applyPose).toHaveBeenLastCalledWith(expect.objectContaining({
      nodes: expect.objectContaining({
        "calendar/slip": expect.objectContaining({ translationZ: 0 }),
      }),
    }));
  });

  it("stops auto camera when scene reports user control", async () => {
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    act(() => latestController().callbacks.onUserControlStart());

    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-auto-camera", "false");
  });

  it("clamps playback at the exact duration and returns to the play label", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(12_700);

    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("12500");
    expect(screen.getByRole("button", { name: "播放推演" })).toBeVisible();
  });

  it("passes reduced motion to pose evaluation, disables auto camera, and keeps semantic labels", async () => {
    installMatchMedia(true);
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);

    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(latestController().applyPose).toHaveBeenCalledWith(expect.objectContaining({ cameraOrbitRequested: false }));
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-auto-camera", "false");
    expect(screen.getByTestId("artifact-accessible-facts")).toHaveTextContent("初传");
    expect(screen.getByTestId("artifact-accessible-facts")).toHaveTextContent("贵人");
  });

  it("publishes deterministic pose hashes and frame samples only outside production", async () => {
    const frames = installAnimationFrames();
    const observer = vi.fn();
    window.__artifactFrameObserver = observer;
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    const firstHash = screen.getByTestId("artifact-experience").getAttribute("data-pose-hash");
    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "8450" } });
    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "0" } });
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-pose-hash", firstHash);
    frames.step(16);
    expect(observer).toHaveBeenCalledWith(16);
    delete window.__artifactFrameObserver;
  });

  it("omits pose hashes and frame sampling in production", async () => {
    vi.stubEnv("PROD", true);
    const frames = installAnimationFrames();
    const observer = vi.fn();
    window.__artifactFrameObserver = observer;
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(screen.getByTestId("artifact-experience")).not.toHaveAttribute("data-pose-hash");
    frames.step(16);
    expect(observer).not.toHaveBeenCalled();
    delete window.__artifactFrameObserver;
  });
});

describe("useReducedMotion", () => {
  function Probe() {
    return <output>{useReducedMotion() ? "reduce" : "animate"}</output>;
  }

  it("subscribes to media-query changes and removes the listener on unmount", () => {
    const query = installMatchMedia(false);
    const { unmount } = render(<Probe />);
    expect(screen.getByText("animate")).toBeVisible();

    act(() => query.set(true));
    expect(screen.getByText("reduce")).toBeVisible();
    unmount();

    expect(query.media.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(query.media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
