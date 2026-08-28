import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ARTIFACT_ASSET_URLS, selectArtifactLod } from "./model/asset-contract";
import { mapArtifactState } from "./model/map-artifact-state";
import type { ArtifactDisplayState, ArtifactSourceResults } from "./model/types";
import { evaluateArtifactPose, ARTIFACT_DURATION_MS } from "./timeline/evaluate-pose";
import { evaluateStageReplay } from "./timeline/evaluate-stage-replay";
import { reviewStageFor, type ArtifactReviewStage } from "./timeline/review-stages";
import type { ArtifactPose } from "./timeline/types";
import type { RuleStageId } from "../../domain/chart/types";
import { ArtifactSceneController, type ArtifactAppliedState } from "./three/ArtifactSceneController";
import { disposeArtifact } from "./three/dispose-artifact";
import { createArtifactRenderer, loadArtifact } from "./three/load-artifact";
import type { LoadedArtifact } from "./three/load-artifact";
import { ArtifactTimeline } from "./ArtifactTimeline";
import { ArtifactAnnotationLayer } from "./ArtifactAnnotationLayer";
import { ArtifactPartDirectory } from "./ArtifactPartDirectory";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "./annotations/descriptors";
import { useReducedMotion } from "./use-reduced-motion";
import { MobileWorkbenchTools, type MobileToolId } from "../course-workbench/MobileWorkbenchTools";
import "./artifact-scene.css";

declare global {
  interface ImportMetaEnv {
    readonly PROD: boolean;
    readonly VITE_ARTIFACT_BENCHMARK?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    __artifactFrameObserver?: (timestampMs: number) => void;
  }
}

interface ArtifactExperienceProps {
  source: ArtifactSourceResults;
  selectedStage?: RuleStageId;
  onShowCourse(): void;
  showTimeline?: boolean;
  showPartDirectory?: boolean;
  mobileTools?: {
    activeTool?: MobileToolId;
    onActiveToolChange(tool?: MobileToolId): void;
    selectedStage: RuleStageId;
    onSelectStage(stage: RuleStageId): void;
    context: ReactNode;
    evidence: ReactNode;
    course: ReactNode;
  };
}

type ExperienceStatus = "loading" | "ready" | "error";

interface ActiveStageReplay {
  stage: ArtifactReviewStage;
  elapsedMs: number;
  lastFrameMs?: number;
}

const observableBuild = () => !import.meta.env.PROD || import.meta.env.VITE_ARTIFACT_BENCHMARK === "1";
const COMPACT_MAX_WIDTH = 520;
const dayNightText = { day: "昼", night: "夜" } as const;
const directionText = { forward: "顺", reverse: "逆" } as const;

function subscribeToViewport(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function compactViewportSnapshot(): boolean {
  return window.innerWidth <= COMPACT_MAX_WIDTH;
}

function useCompactArtifactLayout(): boolean {
  return useSyncExternalStore(subscribeToViewport, compactViewportSnapshot, () => false);
}

function poseHash(state: ArtifactAppliedState): string {
  const values: number[] = [];
  Object.keys(state.nodes).sort().forEach((id) => {
    const node = state.nodes[id];
    values.push(...node.position, ...node.quaternion, ...node.scale);
  });
  (["lessons", "transmissions", "generals"] as const).forEach((key) => {
    const copy = state.copy[key];
    values.push(copy.opacity, copy.sourceLineProgress, copy.sourceLineOpacity);
  });
  let hash = 2_166_136_261;
  for (const character of values.map((value) => Number.isFinite(value) ? value.toFixed(8) : String(value)).join("|")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function AccessibleFacts({ state }: { state: ArtifactDisplayState }) {
  return (
    <ul className="artifact-visually-hidden" data-testid="artifact-accessible-facts">
      <li>{`四柱 ${state.calendar.pillars.join("、")}；月建 ${state.calendar.monthBuild}；月将 ${state.calendar.monthGeneral}${state.calendar.monthGeneralBranch}；占时 ${state.calendar.divinationHour}`}</li>
      {state.lessons.map((lesson) => <li key={lesson.id}>{`${lesson.label} ${lesson.general} ${lesson.upper}/${lesson.lower.value}；查地盘 ${lesson.lookupEarth}`}</li>)}
      {state.transmissions.map((item) => <li key={item.position}>{`${item.label} ${item.general} ${item.branch} ${item.relation}`}</li>)}
      {state.generals.map((item) => <li key={item.general}>{`${item.general} ${item.heaven}/${item.earth}`}</li>)}
      <li>{`贵人 ${dayNightText[state.noble.dayNight]}贵${state.noble.nobleHeaven}；落${state.noble.nobleEarth}宫；${directionText[state.noble.direction]}布`}</li>
    </ul>
  );
}

export function ArtifactExperience({
  source,
  selectedStage = "calendar",
  onShowCourse,
  showTimeline = true,
  showPartDirectory = true,
  mobileTools,
}: ArtifactExperienceProps) {
  const displayState = useMemo(() => mapArtifactState(source), [source]);
  const reducedMotion = useReducedMotion();
  const compactLayout = useCompactArtifactLayout();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<ArtifactSceneController | undefined>(undefined);
  const displayStateRef = useRef(displayState);
  const reducedMotionRef = useRef(reducedMotion);
  const selectedStageRef = useRef(selectedStage);
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);
  const autoCameraRef = useRef(!reducedMotion);
  const frameRef = useRef<number | undefined>(undefined);
  const lastFrameRef = useRef<number | undefined>(undefined);
  const userControlledRef = useRef(false);
  const stageReplayRef = useRef<ActiveStageReplay | undefined>(undefined);
  const [status, setStatus] = useState<ExperienceStatus>("loading");
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoCamera, setAutoCamera] = useState(!reducedMotion);
  const [currentPoseHash, setCurrentPoseHash] = useState<string | undefined>(undefined);
  const [sourceLinesActive, setSourceLinesActive] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | undefined>(undefined);

  const applyAt = useCallback((nextTime: number) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const evaluatedPose = evaluateArtifactPose(displayStateRef.current, nextTime, reducedMotionRef.current);
    const pose = evaluatedPose.cameraOrbitRequested === autoCameraRef.current
      ? evaluatedPose
      : { ...evaluatedPose, cameraOrbitRequested: autoCameraRef.current };
    const appliedState = controller.applyPose(pose);
    if (observableBuild()) {
      setCurrentPoseHash(poseHash(appliedState));
      setSourceLinesActive(Object.values(appliedState.copy).some(
        (copy) => copy.sourceLineProgress > 0 || copy.sourceLineOpacity > 0,
      ));
    }
  }, []);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let inactive = false;
    let rendererDisposed = false;
    let rendererOwnedByController = false;
    let resizeObserverDisconnected = false;
    let loadedArtifact: LoadedArtifact | undefined;
    let ownedController: ArtifactSceneController | undefined;
    let renderer: ReturnType<typeof createArtifactRenderer>;
    try {
      renderer = createArtifactRenderer(canvas);
    } catch {
      setStatus("error");
      return;
    }
    const disposeRenderer = () => {
      if (rendererDisposed || rendererOwnedByController) return;
      rendererDisposed = true;
      renderer.dispose();
    };
    const resizeController = () => {
      const controller = ownedController;
      if (!controller) return;
      const bounds = canvas.getBoundingClientRect();
      controller.resize(
        bounds.width || window.innerWidth,
        bounds.height || 560,
        window.devicePixelRatio || 1,
      );
    };
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(resizeController);
    resizeObserver?.observe(canvas);
    const disconnectResizeObserver = () => {
      if (resizeObserverDisconnected) return;
      resizeObserverDisconnected = true;
      resizeObserver?.disconnect();
    };
    const disposeOwnedController = () => {
      if (!ownedController) return false;
      const controller = ownedController;
      ownedController = undefined;
      if (controllerRef.current === controller) controllerRef.current = undefined;
      controller.dispose();
      loadedArtifact = undefined;
      rendererOwnedByController = false;
      rendererDisposed = true;
      return true;
    };
    const failExperience = () => {
      stopPlayback();
      disconnectResizeObserver();
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
      disposeOwnedController();
      if (!inactive) setStatus("error");
    };

    const frame = (timestamp: number) => {
      frameRef.current = undefined;
      const controller = controllerRef.current;
      if (!controller) return;
      if (observableBuild()) window.__artifactFrameObserver?.(timestamp);
      const previous = lastFrameRef.current ?? timestamp;
      lastFrameRef.current = timestamp;
      const stageReplay = stageReplayRef.current;
      if (stageReplay) {
        const previousReplayFrame = stageReplay.lastFrameMs ?? timestamp;
        stageReplay.lastFrameMs = timestamp;
        stageReplay.elapsedMs += Math.max(0, timestamp - previousReplayFrame);
        const replayState = evaluateStageReplay(stageReplay.stage, stageReplay.elapsedMs, reducedMotionRef.current);
        timeRef.current = replayState.timelineTimeMs;
        accumulatedTimeRef.current = replayState.timelineTimeMs;
        setTimeMs(replayState.timelineTimeMs);
        if (replayState.complete) stageReplayRef.current = undefined;
      } else if (playingRef.current) {
        accumulatedTimeRef.current = Math.min(
          ARTIFACT_DURATION_MS,
          accumulatedTimeRef.current + Math.max(0, timestamp - previous),
        );
        const nextTime = Math.min(ARTIFACT_DURATION_MS, Math.round(accumulatedTimeRef.current));
        timeRef.current = nextTime;
        setTimeMs(nextTime);
        if (nextTime === ARTIFACT_DURATION_MS) {
          accumulatedTimeRef.current = ARTIFACT_DURATION_MS;
          stopPlayback();
        }
      }
      applyAt(timeRef.current);
      controller.render(timestamp);
      if (controllerRef.current) frameRef.current = requestAnimationFrame(frame);
    };

    const dpr = window.devicePixelRatio || 1;
    const lod = selectArtifactLod(window.innerWidth, dpr);
    void loadArtifact(ARTIFACT_ASSET_URLS[lod], renderer).then((artifact) => {
      loadedArtifact = artifact;
      if (inactive) {
        disposeArtifact(artifact.root);
        disposeRenderer();
        return;
      }
      const controller = new ArtifactSceneController(renderer, artifact, {
        onUserControlStart: () => {
          userControlledRef.current = true;
          autoCameraRef.current = false;
          setAutoCamera(false);
          applyAt(timeRef.current);
        },
        onContextLost: failExperience,
        onError: failExperience,
        onAnnotationError: (error) => setAnnotationError(
          error instanceof Error ? error.message : String(error),
        ),
      });
      ownedController = controller;
      controllerRef.current = controller;
      setAnnotationError(undefined);
      rendererOwnedByController = true;
      controller.setDisplayState(displayStateRef.current);
      controller.applyCameraPreset(reviewStageFor(selectedStageRef.current).camera, reducedMotionRef.current);
      if (controllerRef.current !== controller) return;
      resizeController();
      applyAt(timeRef.current);
      setStatus("ready");
      frameRef.current = requestAnimationFrame(frame);
    }).catch(() => {
      disconnectResizeObserver();
      if (!disposeOwnedController()) {
        if (loadedArtifact) disposeArtifact(loadedArtifact.root);
        loadedArtifact = undefined;
        disposeRenderer();
      }
      if (!inactive) setStatus("error");
    });

    return () => {
      inactive = true;
      disconnectResizeObserver();
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
      disposeOwnedController();
      disposeRenderer();
    };
  }, [applyAt, stopPlayback]);

  useEffect(() => {
    displayStateRef.current = displayState;
    timeRef.current = 0;
    accumulatedTimeRef.current = 0;
    lastFrameRef.current = undefined;
    setTimeMs(0);
    stopPlayback();
    const controller = controllerRef.current;
    if (!controller) return;
    controller.setDisplayState(displayState);
    applyAt(0);
  }, [applyAt, displayState, stopPlayback]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    autoCameraRef.current = !reducedMotion && !userControlledRef.current;
    setAutoCamera(autoCameraRef.current);
    const stageReplay = stageReplayRef.current;
    if (reducedMotion && stageReplay) {
      const replayState = evaluateStageReplay(stageReplay.stage, stageReplay.elapsedMs, true);
      stageReplayRef.current = undefined;
      timeRef.current = replayState.timelineTimeMs;
      accumulatedTimeRef.current = replayState.timelineTimeMs;
      setTimeMs(replayState.timelineTimeMs);
      controllerRef.current?.applyCameraPreset(stageReplay.stage.camera, true);
    }
    applyAt(timeRef.current);
  }, [applyAt, reducedMotion]);

  const seek = useCallback((nextTime: number) => {
    stageReplayRef.current = undefined;
    const clamped = Math.round(Math.min(ARTIFACT_DURATION_MS, Math.max(0, nextTime)));
    timeRef.current = clamped;
    accumulatedTimeRef.current = clamped;
    lastFrameRef.current = undefined;
    setTimeMs(clamped);
    stopPlayback();
    applyAt(clamped);
  }, [applyAt, stopPlayback]);

  useEffect(() => {
    selectedStageRef.current = selectedStage;
    const stage = reviewStageFor(selectedStage);
    const replayState = evaluateStageReplay(stage, 0, reducedMotionRef.current);
    stageReplayRef.current = replayState.complete ? undefined : { stage, elapsedMs: 0 };
    timeRef.current = replayState.timelineTimeMs;
    accumulatedTimeRef.current = replayState.timelineTimeMs;
    lastFrameRef.current = undefined;
    setTimeMs(replayState.timelineTimeMs);
    stopPlayback();
    controllerRef.current?.applyCameraPreset(stage.camera, reducedMotionRef.current);
    applyAt(replayState.timelineTimeMs);
  }, [applyAt, displayState, selectedStage, stopPlayback]);

  const togglePlayback = () => {
    if (playingRef.current) {
      stopPlayback();
      return;
    }
    if (timeRef.current === ARTIFACT_DURATION_MS) seek(0);
    stageReplayRef.current = undefined;
    lastFrameRef.current = undefined;
    playingRef.current = true;
    setPlaying(true);
  };
  const observabilityAttributes = observableBuild() ? {
    "data-pose-hash": currentPoseHash,
    "data-source-lines": sourceLinesActive ? "active" : "disabled",
  } : {};
  const partDirectory = (
    <ArtifactPartDirectory
      stage={selectedStage}
      descriptors={ARTIFACT_ANNOTATION_DESCRIPTORS}
      onFocus={(id) => {
        const descriptor = ARTIFACT_ANNOTATION_DESCRIPTORS.find((item) => item.id === id);
        if (descriptor) controllerRef.current?.focusNode(descriptor.nodeId);
      }}
    />
  );
  const timeline = (
    <ArtifactTimeline
      timeMs={timeMs}
      playing={playing}
      onSeek={seek}
      onTogglePlayback={togglePlayback}
      onResetCamera={() => controllerRef.current?.resetCamera()}
      onShowCourse={onShowCourse}
    />
  );

  if (status === "error") {
    return (
      <section className="artifact-experience artifact-experience--fallback" data-testid="artifact-experience" data-auto-camera="false">
        <p role="alert">三维器物无法加载，请改用文字课式。</p>
        <button type="button" onClick={onShowCourse}>查看文字课式</button>
      </section>
    );
  }

  return (
    <section
      className="artifact-experience"
      data-testid="artifact-experience"
      data-auto-camera={String(autoCamera)}
      {...observabilityAttributes}
    >
      <div className="artifact-experience__viewport">
        <canvas ref={canvasRef} aria-label="大六壬三维器物" />
        {status === "loading" && <p className="artifact-experience__loading" role="status">正在加载三维器物</p>}
        {status === "ready" && controllerRef.current && (
          <ArtifactAnnotationLayer
            source={controllerRef.current}
            featuredIds={reviewStageFor(selectedStage).annotationIds}
            allowAll={!compactLayout}
          />
        )}
      </div>
      {status === "loading" && (
        <div className="artifact-experience__loading-actions">
          <button type="button" onClick={onShowCourse}>查看文字课式</button>
        </div>
      )}
      {status === "ready" && (
        <>
          <AccessibleFacts state={displayState} />
          {annotationError && (
            <p className="artifact-visually-hidden" role="status" aria-label="标注状态">
              {annotationError}
            </p>
          )}
          {showPartDirectory && compactLayout && !mobileTools ? partDirectory : null}
          {showTimeline ? timeline : null}
        </>
      )}
      {mobileTools ? (
        <MobileWorkbenchTools
          {...mobileTools}
          parts={status === "ready" && showPartDirectory ? partDirectory : null}
          timeline={status === "ready" && showTimeline ? timeline : null}
        />
      ) : null}
    </section>
  );
}
