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
import type { ArtifactPose } from "./timeline/types";
import { referenceSession } from "../../test/reference-session";
import { useReducedMotion } from "./use-reduced-motion";

interface ControllerDouble {
  callbacks: { onUserControlStart(): void; onContextLost(): void; onError(error: unknown): void };
  resize: any;
  setDisplayState: any;
  applyPose: any;
  applyCameraPreset: any;
  resetCamera: any;
  render: any;
  dispose: any;
}

function appliedStateFromPose(pose: ArtifactPose) {
  return {
    nodes: Object.fromEntries(Object.entries(pose.nodes).map(([id, value]) => [id, {
      position: [value.translationX, value.translationY, value.translationZ],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
    }])),
    copy: {
      lessons: { ...pose.copy.lessons },
      transmissions: { ...pose.copy.transmissions },
      generals: { ...pose.copy.generals },
    },
    generalDirection: pose.generalDirection,
    generalSequence: [...pose.generalSequence],
    cameraOrbitRequested: pose.cameraOrbitRequested,
  };
}

const mocks = {
  controllers: [] as ControllerDouble[],
  createRenderer: vi.fn(),
  loadArtifact: vi.fn(),
  disposeArtifact: vi.fn(),
  evaluateArtifactPose: vi.fn(),
  onControllerCreate: undefined as ((controller: ControllerDouble) => void) | undefined,
};
const resizeObservers: TestResizeObserver[] = [];

class TestResizeObserver {
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}
let ArtifactExperience: typeof import("./ArtifactExperience")["ArtifactExperience"];

beforeAll(async () => {
  vi.doMock("./three/load-artifact", () => ({
    createArtifactRenderer: (...args: unknown[]) => mocks.createRenderer(...args),
    loadArtifact: (...args: unknown[]) => mocks.loadArtifact(...args),
  }));
  vi.doMock("./three/dispose-artifact", () => ({
    disposeArtifact: (...args: unknown[]) => mocks.disposeArtifact(...args),
  }));
  vi.doMock("./three/ArtifactSceneController", () => ({
    ArtifactSceneController: class {
      callbacks: { onUserControlStart(): void; onContextLost(): void; onError(error: unknown): void };
      resize = vi.fn();
      setDisplayState = vi.fn();
      applyPose = vi.fn((pose: ArtifactPose) => appliedStateFromPose(pose));
      applyCameraPreset = vi.fn();
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
  const timeline = await vi.importActual<typeof import("./timeline/evaluate-pose")>("./timeline/evaluate-pose");
  mocks.evaluateArtifactPose.mockImplementation(timeline.evaluateArtifactPose);
  vi.doMock("./timeline/evaluate-pose", () => ({
    ...timeline,
    evaluateArtifactPose: (...args: Parameters<typeof timeline.evaluateArtifactPose>) => mocks.evaluateArtifactPose(...args),
  }));
  ({ ArtifactExperience } = await import("./ArtifactExperience"));
});

afterAll(() => {
  vi.doUnmock("./three/load-artifact");
  vi.doUnmock("./three/dispose-artifact");
  vi.doUnmock("./three/ArtifactSceneController");
  vi.doUnmock("./timeline/evaluate-pose");
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
  mocks.disposeArtifact.mockReset();
  mocks.evaluateArtifactPose.mockClear();
  resizeObservers.length = 0;
  mocks.createRenderer.mockImplementation((canvas: HTMLCanvasElement) => ({
    domElement: canvas,
    dispose: vi.fn(),
  }));
  mocks.loadArtifact.mockResolvedValue(resolvedArtifact());
  installMatchMedia();
  installAnimationFrames();
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ArtifactExperience", () => {
  it("keeps the text-course escape accessible while the artifact is loading", async () => {
    mocks.loadArtifact.mockReturnValue(new Promise(() => undefined));
    const onShowCourse = vi.fn();
    const user = userEvent.setup();

    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={onShowCourse} />);
    expect(screen.getByRole("status")).toHaveTextContent("正在加载三维器物");
    await user.click(screen.getByRole("button", { name: "查看文字课式" }));

    expect(onShowCourse).toHaveBeenCalledOnce();
  });

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

  it("routes post-ownership setup failures through controller disposal exactly once", async () => {
    const renderer = { domElement: document.createElement("canvas"), dispose: vi.fn() };
    mocks.createRenderer.mockReturnValue(renderer);
    mocks.onControllerCreate = (controller) => {
      controller.resize.mockImplementation(() => { throw new Error("resize failed"); });
    };

    const { unmount } = render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(latestController().dispose).toHaveBeenCalledOnce();
    expect(mocks.disposeArtifact).not.toHaveBeenCalled();
    expect(renderer.dispose).not.toHaveBeenCalled();
    unmount();
    expect(latestController().dispose).toHaveBeenCalledOnce();
    expect(mocks.disposeArtifact).not.toHaveBeenCalled();
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

  it("stops camera requests without stopping mechanism playback when scene reports user control", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));

    act(() => latestController().callbacks.onUserControlStart());

    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-auto-camera", "false");
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-source-lines", "disabled");
    expect(latestController().applyPose).toHaveBeenLastCalledWith(expect.objectContaining({ cameraOrbitRequested: false }));
    frames.step(100);
    frames.step(250);
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("150");
    expect(screen.getByRole("button", { name: "暂停推演" })).toBeVisible();
    expect(latestController().applyPose).toHaveBeenLastCalledWith(expect.objectContaining({ cameraOrbitRequested: false }));
  });

  it("replays a selected stage through recap and separation after camera drag", async () => {
    const frames = installAnimationFrames();
    render(
      <ArtifactExperience
        source={referenceSourceResults}
        selectedStage="four-lessons"
        onShowCourse={vi.fn()}
      />,
    );
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(latestController().applyCameraPreset).toHaveBeenCalledWith({
      position: [-2.4, 1.7, 2.8],
      target: [0, 0.1, 0],
    }, false);
    frames.step(100);
    frames.step(800);
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("3200");

    act(() => latestController().callbacks.onUserControlStart());
    frames.step(1_700);

    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("5400");
    expect(screen.getByRole("button", { name: "播放推演" })).toBeVisible();
    expect(latestController().applyPose).toHaveBeenLastCalledWith(expect.objectContaining({
      cameraOrbitRequested: false,
      nodes: expect.objectContaining({
        "lesson/first": expect.objectContaining({ translationX: -0.045 }),
        "lesson/fourth": expect.objectContaining({ translationX: 0.045 }),
      }),
    }));
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

  it("rounds fractional frame accumulation before exposing and evaluating timeline time", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));

    frames.step(100.2);
    frames.step(110.8);

    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("11");
    expect(mocks.evaluateArtifactPose).toHaveBeenLastCalledWith(expect.anything(), 11, false);
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

  it("preserves exact month-general, lesson lookup, and noble timing facts for assistive text", async () => {
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);

    const facts = await screen.findByTestId("artifact-accessible-facts");
    expect(facts).toHaveTextContent("月将 胜光午");
    expect(facts).toHaveTextContent("四课");
    expect(facts).toHaveTextContent("查地盘 卯");
    expect(facts).toHaveTextContent("夜贵寅");
  });

  it("selects the initial LOD from viewport width instead of canvas width", async () => {
    vi.stubGlobal("innerWidth", 1920);
    vi.stubGlobal("devicePixelRatio", 1);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 800, height: 560, x: 0, y: 0, top: 0, right: 800, bottom: 560, left: 0,
      toJSON: () => ({}),
    });

    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(mocks.loadArtifact).toHaveBeenCalledWith(
      "/models/daliuren/daliuren-artifact-lod0.glb",
      expect.anything(),
    );
  });

  it("resizes from current bounds and DPR when ResizeObserver reports a change", async () => {
    let width = 800;
    let height = 560;
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      width, height, x: 0, y: 0, top: 0, right: width, bottom: height, left: 0,
      toJSON: () => ({}),
    }));
    vi.stubGlobal("devicePixelRatio", 1);
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    width = 940;
    height = 620;
    vi.stubGlobal("devicePixelRatio", 2);

    act(() => resizeObservers[0].trigger());

    expect(latestController().resize).toHaveBeenLastCalledWith(940, 620, 2);
  });

  it("disconnects its ResizeObserver during teardown", async () => {
    const { unmount } = render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    const observer = resizeObservers[0];

    unmount();

    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("publishes deterministic pose hashes and frame samples only outside production", async () => {
    const frames = installAnimationFrames();
    const observer = vi.fn();
    window.__artifactFrameObserver = observer;
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    const firstHash = screen.getByTestId("artifact-experience").getAttribute("data-pose-hash");
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-source-lines", "disabled");
    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "11400" } });
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-source-lines", "active");
    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "0" } });
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-pose-hash", firstHash);
    frames.step(16);
    expect(observer).toHaveBeenCalledWith(16);
    delete window.__artifactFrameObserver;
  });

  it("publishes source-line diagnostics from controller-applied state", async () => {
    mocks.onControllerCreate = (controller) => {
      controller.applyPose.mockImplementation((pose: ArtifactPose) => ({
        ...appliedStateFromPose(pose),
        copy: {
          ...pose.copy,
          lessons: { opacity: 0.4, sourceLineProgress: 0.5, sourceLineOpacity: 0.25 },
        },
      }));
    };

    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-source-lines", "active");
  });

  it("omits pose hashes and frame sampling in production", async () => {
    vi.stubEnv("PROD", true);
    const frames = installAnimationFrames();
    const observer = vi.fn();
    window.__artifactFrameObserver = observer;
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(screen.getByTestId("artifact-experience")).not.toHaveAttribute("data-pose-hash");
    expect(screen.getByTestId("artifact-experience")).not.toHaveAttribute("data-source-lines");
    frames.step(16);
    expect(observer).not.toHaveBeenCalled();
    delete window.__artifactFrameObserver;
  });

  it("publishes observability for the isolated benchmark build", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_ARTIFACT_BENCHMARK", "1");
    const frames = installAnimationFrames();
    const observer = vi.fn();
    window.__artifactFrameObserver = observer;
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-pose-hash", expect.stringMatching(/\S+/));
    frames.step(16);
    expect(observer).toHaveBeenCalledWith(16);
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
