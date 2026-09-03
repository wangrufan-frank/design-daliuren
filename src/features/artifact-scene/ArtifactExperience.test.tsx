import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarResult } from "../../domain/calendar/types";
import type { CourseResult } from "../../domain/course/types";
import type { FourLessonsResult } from "../../domain/four-lessons/types";
import type { HeavenlyGeneralsResult } from "../../domain/heavenly-generals/types";
import type { HeavenEarthResult } from "../../domain/heaven-earth/types";
import type { ThreeTransmissionsResult } from "../../domain/three-transmissions/types";
import type { ArtifactDisplayState, ArtifactSourceResults } from "./model/types";
import { reviewStageFor } from "./timeline/review-stages";
import { ARTIFACT_DURATION_MS } from "./timeline/evaluate-pose";
import type { ArtifactPose } from "./timeline/types";
import type { MonthGeneralInputEvent } from "./three/ArtifactSceneController";
import { referenceSession } from "../../test/reference-session";
import { useReducedMotion } from "./use-reduced-motion";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "./annotations/descriptors";

interface ControllerDouble {
  callbacks: {
    onUserControlStart(): void;
    onContextLost(): void;
    onError(error: unknown): void;
    onAnnotationError?(error: unknown): void;
    onMonthGeneralInput(event: MonthGeneralInputEvent): void;
  };
  resize: any;
  setDisplayState: any;
  applyPose: any;
  applyJadePlateMotion: any;
  setMonthGeneralInteractionEnabled: any;
  applyCameraPreset: any;
  measureMinimumBranchProjectionPx: any;
  measureMinimumBranchEdgeMarginPx: any;
  captureAnnotationFrame: any;
  focusNode: any;
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
      visible: value.visible ?? true,
    }])),
    labelOpacity: { ...pose.labelOpacity },
    courseTraceOpacity: pose.courseTraceOpacity,
  };
}

const mocks = {
  controllers: [] as ControllerDouble[],
  createRenderer: vi.fn(),
  loadArtifact: vi.fn(),
  disposeArtifact: vi.fn(),
  evaluateArtifactPose: vi.fn(),
  mapArtifactState: vi.fn(),
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
      callbacks: ControllerDouble["callbacks"];
      resize = vi.fn();
      setDisplayState = vi.fn();
      applyPose = vi.fn((pose: ArtifactPose) => appliedStateFromPose(pose));
      applyJadePlateMotion = vi.fn();
      setMonthGeneralInteractionEnabled = vi.fn();
      applyCameraPreset = vi.fn();
      measureMinimumBranchProjectionPx = vi.fn(() => 21.6);
      measureMinimumBranchEdgeMarginPx = vi.fn(() => 4.25);
      captureAnnotationFrame = vi.fn((ids: readonly string[]) => ({
        viewport: { width: 800, height: 560 },
        anchors: ids.map((id, index) => ({
          id,
          x: 220 + index * 12,
          y: 80 + index * 18,
          depth: 0,
          behindCamera: false,
          occluded: false,
        })),
      }));
      focusNode = vi.fn();
      resetCamera = vi.fn();
      render = vi.fn(() => false);
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
  const artifactState = await vi.importActual<typeof import("./model/map-artifact-state")>("./model/map-artifact-state");
  mocks.mapArtifactState.mockImplementation(artifactState.mapArtifactState);
  vi.doMock("./model/map-artifact-state", () => ({
    mapArtifactState: (...args: Parameters<typeof artifactState.mapArtifactState>) => mocks.mapArtifactState(...args),
  }));
  ({ ArtifactExperience } = await import("./ArtifactExperience"));
});

afterAll(() => {
  vi.doUnmock("./three/load-artifact");
  vi.doUnmock("./three/dispose-artifact");
  vi.doUnmock("./three/ArtifactSceneController");
  vi.doUnmock("./timeline/evaluate-pose");
  vi.doUnmock("./model/map-artifact-state");
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

  it("replaces a stalled mobile artifact with the texture-free fallback", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("devicePixelRatio", 3);
    mocks.loadArtifact
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce(resolvedArtifact());

    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.loadArtifact).toHaveBeenNthCalledWith(
      2,
      "/models/daliuren/daliuren-artifact-mobile.glb",
      expect.anything(),
    );
    expect(latestController().resize).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 1.5);
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
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveAttribute("max", "8200");
    await user.click(screen.getByRole("button", { name: "查看文字课式" }));
    expect(onShowCourse).toHaveBeenCalledOnce();
  });

  it("can hide the timeline without removing the artifact canvas", async () => {
    render(<ArtifactExperience source={referenceSourceResults} showTimeline={false} onShowCourse={vi.fn()} />);
    await waitFor(() => expect(mocks.controllers).toHaveLength(1));

    expect(screen.getByLabelText("大六壬三维器物")).toBeVisible();
    expect(screen.queryByRole("region", { name: "器物推演控制" })).not.toBeInTheDocument();
  });

  it("can hide the compact part directory without removing the artifact canvas", async () => {
    vi.stubGlobal("innerWidth", 390);
    render(<ArtifactExperience source={referenceSourceResults} showPartDirectory={false} onShowCourse={vi.fn()} />);
    await waitFor(() => expect(mocks.controllers).toHaveLength(1));

    expect(screen.getByLabelText("大六壬三维器物")).toBeVisible();
    expect(screen.queryByRole("region", { name: "部件目录" })).not.toBeInTheDocument();
  });

  it("mounts exactly one timeline range in the mobile timeline host", async () => {
    const { container } = render(
      <>
        <div id="mobile-parts-host" />
        <div id="mobile-timeline-host" />
        <ArtifactExperience
          source={referenceSourceResults}
          mobileToolHosts={{ partsId: "mobile-parts-host", timelineId: "mobile-timeline-host" }}
          onShowCourse={vi.fn()}
        />
      </>,
    );
    await screen.findByRole("slider", { name: "推演时间轴" });

    const timelineHost = container.querySelector<HTMLElement>("#mobile-timeline-host")!;
    expect(within(timelineHost).getByRole("slider", { name: "推演时间轴" })).toBeVisible();
    expect(container.querySelectorAll("#artifact-timeline-range")).toHaveLength(1);
  });

  it("automatically requests the text course once after loader failure", async () => {
    const renderer = { domElement: document.createElement("canvas"), dispose: vi.fn() };
    mocks.createRenderer.mockReturnValue(renderer);
    mocks.loadArtifact.mockRejectedValue(new Error("404"));
    const onShowCourse = vi.fn();
    const replacementOnShowCourse = vi.fn();

    const { rerender, unmount } = render(
      <StrictMode>
        <ArtifactExperience source={referenceSourceResults} onShowCourse={onShowCourse} />
      </StrictMode>,
    );

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByLabelText("大六壬三维器物")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看文字课式" })).toBeVisible();
    await waitFor(() => expect(onShowCourse).toHaveBeenCalledOnce());

    rerender(
      <StrictMode>
        <ArtifactExperience source={referenceSourceResults} onShowCourse={replacementOnShowCourse} />
      </StrictMode>,
    );
    expect(onShowCourse).toHaveBeenCalledOnce();
    expect(replacementOnShowCourse).not.toHaveBeenCalled();

    unmount();
    expect(renderer.dispose).toHaveBeenCalledTimes(2);
  });

  it("automatically requests the text course once after WebGL context loss", async () => {
    const onShowCourse = vi.fn();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={onShowCourse} />);
    await waitFor(() => expect(mocks.controllers).toHaveLength(1));

    act(() => {
      latestController().callbacks.onContextLost();
      latestController().callbacks.onContextLost();
    });

    expect(await screen.findByRole("alert")).toBeVisible();
    await waitFor(() => expect(onShowCourse).toHaveBeenCalledOnce());
    expect(latestController().dispose).toHaveBeenCalledOnce();
  });

  it("requests automatic fallback again when a new 3D attempt fails", async () => {
    const onShowCourse = vi.fn();
    const firstAttempt = render(
      <ArtifactExperience source={referenceSourceResults} onShowCourse={onShowCourse} />,
    );
    await waitFor(() => expect(mocks.controllers).toHaveLength(1));

    act(() => latestController().callbacks.onContextLost());
    await waitFor(() => expect(onShowCourse).toHaveBeenCalledOnce());
    firstAttempt.unmount();

    mocks.loadArtifact.mockRejectedValueOnce(new Error("404"));
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={onShowCourse} />);

    await waitFor(() => expect(onShowCourse).toHaveBeenCalledTimes(2));
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

  it("cancels the scene and annotation frame loops and disposes the controller exactly once on unmount", async () => {
    const { unmount } = render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledTimes(2);
    expect(latestController().dispose).toHaveBeenCalledOnce();
  });

  it("keeps external annotation cards out of the model viewport", async () => {
    render(<ArtifactExperience source={referenceSourceResults} selectedStage="calendar" onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(document.querySelectorAll(".artifact-annotations__card")).toHaveLength(0);
    expect(document.querySelectorAll(".artifact-annotations__leader")).toHaveLength(0);
  });

  it("starts the simplified artifact in its immediately interactive state", async () => {
    render(<ArtifactExperience source={referenceSourceResults} startInteractive onShowCourse={vi.fn()} />);
    await waitFor(() => expect(mocks.controllers).toHaveLength(1));

    expect(latestController().setMonthGeneralInteractionEnabled).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeEnabled();
  });

  it("keeps compact canvases to stage annotations and focuses parts from the complete directory", async () => {
    vi.stubGlobal("innerWidth", 390);
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} selectedStage="heaven-earth" onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(document.querySelectorAll(".artifact-annotations__card")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "全部" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看文字课式" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "打开部件目录" }));
    const dialog = screen.getByRole("dialog", { name: "全部部件" });
    expect(dialog.querySelectorAll("button[data-part-id]")).toHaveLength(ARTIFACT_ANNOTATION_DESCRIPTORS.length);
    await user.click(dialog.querySelector<HTMLButtonElement>('button[data-part-id="plate/heaven"]')!);

    expect(latestController().focusNode).toHaveBeenCalledWith("plate/heaven");
    expect(screen.queryByRole("dialog", { name: "全部部件" })).not.toBeInTheDocument();
    expect(screen.getByText("当前聚焦：月将环")).toBeVisible();
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
        "calendar/slip": expect.objectContaining({ visible: false }),
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
    frames.step(100);
    frames.step(250);
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("150");
    expect(screen.getByRole("button", { name: "暂停推演" })).toBeVisible();
    expect(latestController().applyPose).toHaveBeenLastCalledWith(expect.not.objectContaining({ cameraOrbitRequested: expect.anything() }));
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

    expect(latestController().applyCameraPreset).toHaveBeenCalledWith(
      reviewStageFor("four-lessons").camera,
      false,
    );
    frames.step(100);
    frames.step(800);
    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("8700");

    act(() => latestController().callbacks.onUserControlStart());
    frames.step(6_000);

    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("13000");
    expect(screen.getByRole("button", { name: "播放推演" })).toBeVisible();
    expect(latestController().applyPose).toHaveBeenLastCalledWith(expect.objectContaining({
      nodes: expect.objectContaining({
        "lesson/first": expect.objectContaining({ visible: true }),
        "lesson/fourth": expect.objectContaining({ visible: true }),
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
    frames.step(27_200);

    expect(screen.getByRole("slider", { name: "推演时间轴" })).toHaveValue("8200");
    expect(screen.getByRole("button", { name: "播放推演" })).toBeVisible();
  });

  it("hands the completed demonstration directly to the enabled month-general controls", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });

    expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(ARTIFACT_DURATION_MS + 100);

    expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeEnabled();
    expect(latestController().setMonthGeneralInteractionEnabled).toHaveBeenLastCalledWith(true);
    expect(latestController().setMonthGeneralInteractionEnabled.mock.calls.filter(([enabled]: [boolean]) => enabled)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /试玩|进入操作|重置月将环/ })).not.toBeInTheDocument();
  });

  it("relocks month-general interaction when seeking before the final demonstration frame", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(ARTIFACT_DURATION_MS + 100);

    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "400" } });

    expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeDisabled();
    expect(latestController().setMonthGeneralInteractionEnabled).toHaveBeenLastCalledWith(false);
  });

  it("ignores controller month-general input while the demonstration remains locked", async () => {
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    const controller = latestController();
    controller.applyJadePlateMotion.mockClear();

    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: 1, nowMs: 200 }));

    expect(controller.applyJadePlateMotion).not.toHaveBeenCalled();
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-detent", "0");
  });

  it("uses the shared reducer for controller steps after the handoff", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(ARTIFACT_DURATION_MS + 100);

    act(() => latestController().callbacks.onMonthGeneralInput({ type: "step", delta: 1, nowMs: 28_000 }));

    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-detent", "7");
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-aligned", "false");
    expect(latestController().applyJadePlateMotion).toHaveBeenCalled();
  });

  it("reverses an interrupted partial landing from the exact current progress", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(27_100);

    const controller = latestController();
    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: -1, nowMs: 28_000 }));
    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: 1, nowMs: 30_000 }));
    frames.step(33_600);
    act(() => controller.callbacks.onMonthGeneralInput({ type: "drag-start", angleRad: 0, nowMs: 33_600 }));
    const partialLanding = controller.applyJadePlateMotion.mock.lastCall[0];

    expect(partialLanding.generals[8].seatProgress).toBeGreaterThan(0);
    expect(partialLanding.generals[8].seatProgress).toBeLessThan(1);
    act(() => controller.callbacks.onMonthGeneralInput({
      type: "drag-move", angleRad: 3 * Math.PI / 180, nowMs: 33_600,
    }));
    const exitAtInterruption = controller.applyJadePlateMotion.mock.lastCall[0];

    expect(exitAtInterruption.generals.map((general: { seatProgress: number }) => general.seatProgress))
      .toEqual(partialLanding.generals.map((general: { seatProgress: number }) => general.seatProgress));

    frames.step(34_000);
    const reversingExit = controller.applyJadePlateMotion.mock.lastCall[0];
    expect(reversingExit.generals[8].seatProgress).toBeLessThan(partialLanding.generals[8].seatProgress);
    expect(reversingExit.generals[0].seatProgress).toBe(partialLanding.generals[0].seatProgress);
  });

  it("settles a completed manual landing and keeps a stationary click seated", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(27_100);

    const controller = latestController();
    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: -1, nowMs: 28_000 }));
    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: 1, nowMs: 30_000 }));
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-phase", "landing");

    frames.step(35_230);
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-phase", "seated");

    act(() => controller.callbacks.onMonthGeneralInput({ type: "drag-start", angleRad: 0, nowMs: 35_240 }));
    act(() => controller.callbacks.onMonthGeneralInput({
      type: "drag-end", angularVelocityRadMs: 0, nowMs: 35_250,
    }));
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-phase", "seated");
  });

  it("keeps an immediate re-entry in landing until its gold and landing window completes", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(27_100);

    const controller = latestController();
    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: -1, nowMs: 28_000 }));
    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: 1, nowMs: 28_000 }));
    frames.step(28_100);

    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-phase", "landing");
    expect(Number(screen.getByTestId("artifact-experience").getAttribute("data-active-month-gold"))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId("artifact-experience").getAttribute("data-active-month-gold"))).toBeLessThan(1);
  });

  it("settles a reduced-motion manual landing immediately", async () => {
    installMatchMedia(true);
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(27_100);

    const controller = latestController();
    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: -1, nowMs: 28_000 }));
    act(() => controller.callbacks.onMonthGeneralInput({ type: "step", delta: 1, nowMs: 30_000 }));

    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-phase", "seated");
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-active-month-gold", "1.000");
  });

  it("replaces completed interaction with the locked state when its source changes", async () => {
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    const { rerender } = render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(ARTIFACT_DURATION_MS + 100);

    rerender(<ArtifactExperience source={{ ...referenceSourceResults }} onShowCourse={vi.fn()} />);

    expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeDisabled();
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-detent", "0");
  });

  it("reaches the same completed interactive state with reduced motion", async () => {
    installMatchMedia(true);
    const frames = installAnimationFrames();
    const user = userEvent.setup();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    await user.click(screen.getByRole("button", { name: "播放推演" }));
    frames.step(100);
    frames.step(ARTIFACT_DURATION_MS + 100);

    expect(screen.getByRole("button", { name: "月将环向左一宫" })).toBeEnabled();
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-aligned", "true");
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-month-general-seated-count", "12");
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

    expect(latestController().applyPose).toHaveBeenCalledWith(expect.not.objectContaining({ cameraOrbitRequested: expect.anything() }));
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-auto-camera", "false");
    expect(screen.getByTestId("artifact-accessible-facts")).toHaveTextContent("初传");
    expect(screen.getByTestId("artifact-accessible-facts")).toHaveTextContent("贵人");
  });

  it("preserves exact month-general, lesson lookup, and noble timing facts for assistive text", async () => {
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);

    const facts = await screen.findByTestId("artifact-accessible-facts");
    expect(facts).toHaveTextContent("月将 胜光午");
    expect(facts).toHaveTextContent("旬空 子、丑");
    expect(facts).toHaveTextContent("天将 螣蛇 丑（天盘空）/未");
    expect(facts).toHaveTextContent("四课");
    expect(facts).toHaveTextContent("查地盘 卯");
    expect(facts).toHaveTextContent("夜贵寅");
  });

  it("identifies void branches by their source plate in assistive text", async () => {
    const plateAwareState = mocks.mapArtifactState(referenceSourceResults) as ArtifactDisplayState;
    const source = { ...referenceSourceResults };
    mocks.mapArtifactState.mockImplementationOnce(() => ({
      ...plateAwareState,
      calendar: { ...plateAwareState.calendar, voidBranches: ["寅", "卯"] },
      transmissions: [{ ...plateAwareState.transmissions[0], branch: "寅" }, ...plateAwareState.transmissions.slice(1)],
      generals: plateAwareState.generals.map((item) => item.general === "天后"
        ? { ...item, heaven: "寅", earth: "酉" }
        : item.general === "太阴" ? { ...item, heaven: "卯", earth: "戌" } : item),
    }));
    render(
      <ArtifactExperience
        source={source}
        onShowCourse={vi.fn()}
      />,
    );

    const facts = await screen.findByTestId("artifact-accessible-facts");
    expect(facts).toHaveTextContent("天后 寅（天盘空）/酉");
    expect(facts).toHaveTextContent("太阴 卯（天盘空）/戌");
    expect(facts).toHaveTextContent(/初传 .*寅（空）/);
    expect(facts).toHaveTextContent("旬空 寅、卯");
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

  it("resizes without rounding a 19.99 CSS px branch projection through the desktop floor", async () => {
    let width = 800;
    let height = 560;
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      width, height, x: 0, y: 0, top: 0, right: width, bottom: height, left: 0,
      toJSON: () => ({}),
    }));
    vi.stubGlobal("devicePixelRatio", 1);
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    expect(latestController().resize.mock.invocationCallOrder[0]).toBeLessThan(
      latestController().applyCameraPreset.mock.invocationCallOrder[0],
    );
    width = 940;
    height = 620;
    vi.stubGlobal("devicePixelRatio", 2);
    latestController().measureMinimumBranchProjectionPx.mockReturnValue(19.99);

    act(() => resizeObservers[0].trigger());

    expect(latestController().resize).toHaveBeenLastCalledWith(940, 620, 2);
    const projection = screen.getByTestId("artifact-experience").getAttribute("data-min-branch-px");
    expect(projection).toBe("19.99");
    expect(Number(projection)).toBeLessThan(20);
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-min-branch-edge-px", "4.25");
  });

  it("measures branch projection after applying the current pose on setup and immediate stage changes", async () => {
    installMatchMedia(true);
    const { rerender } = render(
      <ArtifactExperience source={referenceSourceResults} selectedStage="calendar" onShowCourse={vi.fn()} />,
    );
    await screen.findByRole("slider", { name: "推演时间轴" });
    expect(latestController().applyPose.mock.invocationCallOrder[0]).toBeLessThan(
      latestController().measureMinimumBranchProjectionPx.mock.invocationCallOrder[0],
    );
    latestController().measureMinimumBranchProjectionPx.mockReturnValue(27.4);
    const applyCount = latestController().applyPose.mock.calls.length;
    const measureCount = latestController().measureMinimumBranchProjectionPx.mock.calls.length;

    rerender(
      <ArtifactExperience source={referenceSourceResults} selectedStage="heaven-earth" onShowCourse={vi.fn()} />,
    );

    expect(latestController().applyCameraPreset).toHaveBeenLastCalledWith(
      reviewStageFor("heaven-earth").camera,
      true,
    );
    expect(latestController().applyPose.mock.invocationCallOrder[applyCount]).toBeLessThan(
      latestController().measureMinimumBranchProjectionPx.mock.invocationCallOrder[measureCount],
    );
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-min-branch-px", "27.4");
  });

  it("remeasures branch projection from the camera frame that finishes settling", async () => {
    const frames = installAnimationFrames();
    render(<ArtifactExperience source={referenceSourceResults} onShowCourse={vi.fn()} />);
    await screen.findByRole("slider", { name: "推演时间轴" });
    const controller = latestController();
    const initialMeasurements = controller.measureMinimumBranchProjectionPx.mock.calls.length;
    controller.measureMinimumBranchProjectionPx.mockReturnValue(30.2);
    controller.render.mockReturnValueOnce(true);

    frames.step(700);

    expect(controller.measureMinimumBranchProjectionPx).toHaveBeenCalledTimes(initialMeasurements + 1);
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-min-branch-px", "30.2");
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
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-min-branch-px", "21.6");
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-source-lines", "disabled");
    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "25200" } });
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-source-lines", "active");
    fireEvent.change(screen.getByRole("slider", { name: "推演时间轴" }), { target: { value: "0" } });
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-pose-hash", firstHash);
    frames.step(16);
    expect(observer).toHaveBeenCalledWith(16);
    delete window.__artifactFrameObserver;
  });

  it("publishes source-line diagnostics from the controller-applied physical trace", async () => {
    mocks.onControllerCreate = (controller) => {
      controller.applyPose.mockImplementation((pose: ArtifactPose) => ({
        ...appliedStateFromPose(pose),
        courseTraceOpacity: 0.25,
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
    expect(screen.getByTestId("artifact-experience")).not.toHaveAttribute("data-min-branch-px");
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
    expect(screen.getByTestId("artifact-experience")).toHaveAttribute("data-min-branch-px", "21.6");
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
