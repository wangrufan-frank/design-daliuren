import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ARTIFACT_ASSET_URLS, selectArtifactLod } from "./model/asset-contract";
import { mapArtifactState } from "./model/map-artifact-state";
import { deriveJadePlateLayout, type JadePlateLayout } from "./model/jade-plate-layout";
import { formatVoidBranch, type VoidSurface } from "./model/format-void-branch";
import type { ArtifactDisplayState, ArtifactSourceResults } from "./model/types";
import { evaluateArtifactPose, ARTIFACT_DURATION_MS } from "./timeline/evaluate-pose";
import {
  evaluateInteractiveJadePlateMotion,
  LAND_MS,
  LAND_STAGGER_MS,
} from "./timeline/evaluate-jade-plate-motion";
import { evaluateStageReplay } from "./timeline/evaluate-stage-replay";
import { reviewStageFor, type ArtifactReviewStage } from "./timeline/review-stages";
import type { RuleStageId } from "../../domain/chart/types";
import {
  ArtifactSceneController,
  type ArtifactAppliedState,
  type MonthGeneralInputEvent,
} from "./three/ArtifactSceneController";
import { disposeArtifact } from "./three/dispose-artifact";
import { createArtifactRenderer, loadArtifact } from "./three/load-artifact";
import type { LoadedArtifact } from "./three/load-artifact";
import { ArtifactTimeline } from "./ArtifactTimeline";
import { ArtifactPartDirectory } from "./ArtifactPartDirectory";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "./annotations/descriptors";
import { useReducedMotion } from "./use-reduced-motion";
import {
  createMonthGeneralState,
  reduceMonthGeneralState,
  type MonthGeneralInteractionState,
} from "./interaction/month-general-machine";
import { MonthGeneralControls } from "./MonthGeneralControls";
import "./artifact-scene.css";

declare global {
  interface ImportMetaEnv {
    readonly PROD: boolean;
    readonly BASE_URL: string;
    readonly VITE_ARTIFACT_BENCHMARK?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    __artifactFrameObserver?: (timestampMs: number) => void;
    __artifactSetVisualReviewPose?: (pose: "authored" | "completed") => void;
  }
}

interface ArtifactExperienceProps {
  source: ArtifactSourceResults;
  selectedStage?: RuleStageId;
  onShowCourse(): void;
  showTimeline?: boolean;
  showPartDirectory?: boolean;
  startInteractive?: boolean;
  mobileToolHosts?: { partsId: string; timelineId: string };
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

function authoredVisualReviewMotion(layout: JadePlateLayout) {
  return {
    monthAngleRad: 0,
    activeMonthGeneralNodeId: layout.activeMonthGeneralNodeId,
    activeMonthGoldProgress: 0,
    generals: layout.generalSequence.map((general) => ({
      nodeId: general.nodeId,
      targetEarth: general.earth,
      visible: true,
      heightMeters: 0,
      seatProgress: 1,
      goldProgress: 0,
    })),
  };
}

function createInteractiveMonthGeneralState(layout: JadePlateLayout): MonthGeneralInteractionState {
  return reduceMonthGeneralState(createMonthGeneralState(layout), { type: "demo-complete", nowMs: 0 });
}

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

function settleCompletedLanding(
  state: MonthGeneralInteractionState,
  nowMs: number,
  reducedMotion: boolean,
): MonthGeneralInteractionState {
  if (state.phase !== "landing" || state.transition?.kind !== "landing") return state;
  const landingCompleteAtMs = state.transition.startedAtMs
    + (state.layout.generalSequence.length - 1) * LAND_STAGGER_MS
    + LAND_MS;
  if (!reducedMotion && nowMs < landingCompleteAtMs) return state;
  return { ...state, phase: "seated", transition: undefined };
}

function poseHash(state: ArtifactAppliedState): string {
  const values: number[] = [];
  Object.keys(state.nodes).sort().forEach((id) => {
    const node = state.nodes[id];
    values.push(...node.position, ...node.quaternion, ...node.scale, node.visible ? 1 : 0);
  });
  Object.keys(state.labelOpacity).sort().forEach((id) => {
    values.push(state.labelOpacity[id]);
  });
  values.push(state.courseTraceOpacity);
  let hash = 2_166_136_261;
  for (const character of values.map((value) => Number.isFinite(value) ? value.toFixed(8) : String(value)).join("|")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function AccessibleFacts({
  state,
  interaction,
  seatedCount,
}: {
  state: ArtifactDisplayState;
  interaction: MonthGeneralInteractionState;
  seatedCount: number;
}) {
  const markVoid = (branch: string, surface: VoidSurface = "neutral") => formatVoidBranch(
    branch,
    state.calendar.voidBranches,
    surface,
  );
  return (
    <ul className="artifact-visually-hidden" data-testid="artifact-accessible-facts">
      <li>{`四柱 ${state.calendar.pillars.join("、")}；月建 ${state.calendar.monthBuild}；月将 ${state.calendar.monthGeneral}${state.calendar.monthGeneralBranch}；占时 ${state.calendar.divinationHour}；旬空 ${state.calendar.voidBranches.join("、")}`}</li>
      {state.lessons.map((lesson) => <li key={lesson.id}>{`${lesson.label} ${lesson.general} ${markVoid(lesson.upper, "heaven")}/${lesson.lower.kind === "branch" ? markVoid(lesson.lower.value, "earth") : lesson.lower.value}；查地盘 ${lesson.lookupEarth}`}</li>)}
      {state.transmissions.map((item) => <li key={item.position}>{`${item.label} ${item.general} ${markVoid(item.branch)} ${item.relation}`}</li>)}
      {state.generals.map((item) => <li key={item.general}>{`天将 ${item.general} ${markVoid(item.heaven, "heaven")}/${markVoid(item.earth, "earth")}`}</li>)}
      <li>{`贵人 ${dayNightText[state.noble.dayNight]}贵${state.noble.nobleHeaven}；落${state.noble.nobleEarth}宫；${directionText[state.noble.direction]}布`}</li>
      <li>{`月将 ${state.calendar.monthGeneral}；第${interaction.detent + 1}宫；${interaction.aligned ? "对位" : "未对位"}；神将入位 ${seatedCount} 枚`}</li>
    </ul>
  );
}

export function ArtifactExperience({
  source,
  selectedStage = "calendar",
  onShowCourse,
  showTimeline = true,
  showPartDirectory = true,
  startInteractive = false,
  mobileToolHosts,
}: ArtifactExperienceProps) {
  const displayState = useMemo(() => mapArtifactState(source), [source]);
  const jadePlateLayout = useMemo(() => deriveJadePlateLayout(displayState), [displayState]);
  const reducedMotion = useReducedMotion();
  const compactLayout = useCompactArtifactLayout();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onShowCourseRef = useRef(onShowCourse);
  const fallbackRequestedRef = useRef(false);
  const controllerRef = useRef<ArtifactSceneController | undefined>(undefined);
  const displayStateRef = useRef(displayState);
  const reducedMotionRef = useRef(reducedMotion);
  const selectedStageRef = useRef(selectedStage);
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);
  const frameRef = useRef<number | undefined>(undefined);
  const lastFrameRef = useRef<number | undefined>(undefined);
  const userControlledRef = useRef(false);
  const stageReplayRef = useRef<ActiveStageReplay | undefined>(undefined);
  const interactionRef = useRef<MonthGeneralInteractionState>(
    startInteractive ? createInteractiveMonthGeneralState(jadePlateLayout) : createMonthGeneralState(jadePlateLayout),
  );
  const visualReviewPoseRef = useRef<"authored" | undefined>(undefined);
  const interactionMotionObservabilityRef = useRef({ seatedCount: 0, seatedGeneralIds: "", activeMonthGoldProgress: 0, goldGeneralCount: 0 });
  const [status, setStatus] = useState<ExperienceStatus>("loading");
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoCamera, setAutoCamera] = useState(!reducedMotion);
  const [currentPoseHash, setCurrentPoseHash] = useState<string | undefined>(undefined);
  const [sourceLinesActive, setSourceLinesActive] = useState(false);
  const [minimumBranchProjectionPx, setMinimumBranchProjectionPx] = useState<number | undefined>(undefined);
  const [minimumBranchEdgeMarginPx, setMinimumBranchEdgeMarginPx] = useState<number | undefined>(undefined);
  const [mobileHosts, setMobileHosts] = useState<{ parts: HTMLElement; timeline: HTMLElement }>();
  const [interaction, setInteraction] = useState<MonthGeneralInteractionState>(() => interactionRef.current);
  const [seatedCount, setSeatedCount] = useState(0);
  const [seatedGeneralIds, setSeatedGeneralIds] = useState("");
  const [activeMonthGoldProgress, setActiveMonthGoldProgress] = useState(0);
  const [goldGeneralCount, setGoldGeneralCount] = useState(0);

  const publishInteractionMotion = useCallback((motion: ReturnType<typeof evaluateInteractiveJadePlateMotion>) => {
    const seated = motion.generals.filter((general) => general.seatProgress === 1);
    const gold = motion.generals.filter((general) => general.goldProgress === 1);
    const nextIds = seated.map((general) => general.nodeId).join(",");
    const current = interactionMotionObservabilityRef.current;
    if (current.seatedCount !== seated.length) setSeatedCount(seated.length);
    if (current.seatedGeneralIds !== nextIds) setSeatedGeneralIds(nextIds);
    if (current.activeMonthGoldProgress !== motion.activeMonthGoldProgress) {
      setActiveMonthGoldProgress(motion.activeMonthGoldProgress);
    }
    if (current.goldGeneralCount !== gold.length) setGoldGeneralCount(gold.length);
    interactionMotionObservabilityRef.current = {
      seatedCount: seated.length,
      seatedGeneralIds: nextIds,
      activeMonthGoldProgress: motion.activeMonthGoldProgress,
      goldGeneralCount: gold.length,
    };
  }, []);

  useEffect(() => {
    onShowCourseRef.current = onShowCourse;
  }, [onShowCourse]);

  useEffect(() => {
    if (status !== "error" || fallbackRequestedRef.current) return;
    fallbackRequestedRef.current = true;
    onShowCourseRef.current();
  }, [status]);

  useEffect(() => {
    if (!mobileToolHosts) {
      setMobileHosts(undefined);
      return;
    }
    const parts = document.getElementById(mobileToolHosts.partsId);
    const timeline = document.getElementById(mobileToolHosts.timelineId);
    setMobileHosts(parts && timeline ? { parts, timeline } : undefined);
  }, [mobileToolHosts]);

  const applyAt = useCallback((nextTime: number, nowMs = performance.now()) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const pose = evaluateArtifactPose(displayStateRef.current, nextTime, reducedMotionRef.current);
    const appliedState = controller.applyPose(pose);
    if (visualReviewPoseRef.current === "authored") {
      const motion = authoredVisualReviewMotion(interactionRef.current.layout);
      controller.applyJadePlateMotion(motion);
      publishInteractionMotion(motion);
    } else if (interactionRef.current.phase !== "locked") {
      const currentInteraction = interactionRef.current;
      const motion = evaluateInteractiveJadePlateMotion(currentInteraction, nowMs, reducedMotionRef.current);
      const settledInteraction = settleCompletedLanding(currentInteraction, nowMs, reducedMotionRef.current);
      if (settledInteraction !== currentInteraction) {
        interactionRef.current = settledInteraction;
        setInteraction(settledInteraction);
      }
      controller.applyJadePlateMotion(motion);
      publishInteractionMotion(motion);
    }
    if (observableBuild()) {
      setCurrentPoseHash(poseHash(appliedState));
      setSourceLinesActive(appliedState.courseTraceOpacity > 0);
    }
  }, [publishInteractionMotion]);

  const replaceInteraction = useCallback(() => {
    const next = startInteractive
      ? createInteractiveMonthGeneralState(jadePlateLayout)
      : createMonthGeneralState(jadePlateLayout);
    const completedIds = startInteractive
      ? next.layout.generalSequence.map((general) => general.nodeId).join(",")
      : "";
    const completedCount = startInteractive ? 12 : 0;
    const goldProgress = startInteractive ? 1 : 0;
    interactionRef.current = next;
    setInteraction(next);
    setSeatedCount(completedCount);
    setSeatedGeneralIds(completedIds);
    setActiveMonthGoldProgress(goldProgress);
    setGoldGeneralCount(completedCount);
    interactionMotionObservabilityRef.current = {
      seatedCount: completedCount,
      seatedGeneralIds: completedIds,
      activeMonthGoldProgress: goldProgress,
      goldGeneralCount: completedCount,
    };
    controllerRef.current?.setMonthGeneralInteractionEnabled(startInteractive);
    return next;
  }, [jadePlateLayout, startInteractive]);

  const applyInteractionEvent = useCallback((event: MonthGeneralInputEvent) => {
    const current = interactionRef.current;
    if (current.phase === "locked") return;
    const motion = evaluateInteractiveJadePlateMotion(current, event.nowMs, reducedMotionRef.current);
    const generalProgress = motion.generals.map((general) => general.seatProgress);
    const next = event.type === "drag-start"
      ? reduceMonthGeneralState(current, event)
      : reduceMonthGeneralState(current, { ...event, generalProgress });
    const nextMotion = evaluateInteractiveJadePlateMotion(next, event.nowMs, reducedMotionRef.current);
    const settledNext = settleCompletedLanding(next, event.nowMs, reducedMotionRef.current);
    interactionRef.current = settledNext;
    setInteraction(settledNext);
    controllerRef.current?.applyJadePlateMotion(nextMotion);
    publishInteractionMotion(nextMotion);
  }, [publishInteractionMotion]);

  const finishDemo = useCallback((nowMs: number) => {
    if (interactionRef.current.phase !== "locked") return;
    const next = reduceMonthGeneralState(interactionRef.current, { type: "demo-complete", nowMs });
    interactionRef.current = next;
    setInteraction(next);
    setSeatedCount(12);
    const completedIds = next.layout.generalSequence.map((general) => general.nodeId).join(",");
    setSeatedGeneralIds(completedIds);
    setActiveMonthGoldProgress(1);
    setGoldGeneralCount(12);
    interactionMotionObservabilityRef.current = {
      seatedCount: 12,
      seatedGeneralIds: completedIds,
      activeMonthGoldProgress: 1,
      goldGeneralCount: 12,
    };
    controllerRef.current?.setMonthGeneralInteractionEnabled(true);
  }, []);

  const measureBranchProjection = useCallback(() => {
    if (!observableBuild()) return;
    const controller = controllerRef.current;
    if (controller) {
      setMinimumBranchProjectionPx(controller.measureMinimumBranchProjectionPx());
      setMinimumBranchEdgeMarginPx(controller.measureMinimumBranchEdgeMarginPx());
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
    let ownedVisualReviewPoseHook: Window["__artifactSetVisualReviewPose"];
    let portraitLayout: boolean | undefined;
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
    const resizeController = (measure = true) => {
      const controller = ownedController;
      if (!controller) return;
      const bounds = canvas.getBoundingClientRect();
      const nextPortraitLayout = bounds.width < bounds.height;
      controller.resize(
        bounds.width || window.innerWidth,
        bounds.height || 560,
        window.devicePixelRatio || 1,
      );
      if (portraitLayout !== undefined
        && portraitLayout !== nextPortraitLayout
        && !userControlledRef.current) {
        controller.applyCameraPreset(reviewStageFor(selectedStageRef.current).camera, true);
      }
      portraitLayout = nextPortraitLayout;
      if (measure) measureBranchProjection();
    };
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => resizeController());
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
      if (window.__artifactSetVisualReviewPose === ownedVisualReviewPoseHook) {
        delete window.__artifactSetVisualReviewPose;
      }
      ownedVisualReviewPoseHook = undefined;
      visualReviewPoseRef.current = undefined;
      delete canvas.dataset.visualReviewPose;
      delete canvas.dataset.visualReviewMonthAngle;
      delete canvas.dataset.visualReviewTopPair;
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
      if (timeRef.current === ARTIFACT_DURATION_MS) finishDemo(timestamp);
      applyAt(timeRef.current, timestamp);
      const cameraSettled = controller.render(timestamp);
      if (cameraSettled) measureBranchProjection();
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
          setAutoCamera(false);
        },
        onContextLost: failExperience,
        onError: failExperience,
        onMonthGeneralInput: applyInteractionEvent,
      });
      ownedController = controller;
      controllerRef.current = controller;
      if (observableBuild()) {
        ownedVisualReviewPoseHook = (pose) => {
          if (controllerRef.current !== controller) return;
          const current = interactionRef.current;
          visualReviewPoseRef.current = pose === "authored" ? "authored" : undefined;
          applyAt(timeRef.current);
          const motion = pose === "authored"
            ? authoredVisualReviewMotion(current.layout)
            : evaluateInteractiveJadePlateMotion(current, performance.now(), reducedMotionRef.current);
          canvas.dataset.visualReviewPose = pose;
          canvas.dataset.visualReviewMonthAngle = String(motion.monthAngleRad);
          if (pose === "authored") canvas.dataset.visualReviewTopPair = "午/胜光";
          else delete canvas.dataset.visualReviewTopPair;
          controller.render(performance.now());
        };
        window.__artifactSetVisualReviewPose = ownedVisualReviewPoseHook;
      }
      rendererOwnedByController = true;
      controller.setDisplayState(displayStateRef.current);
      controller.setMonthGeneralInteractionEnabled(startInteractive);
      resizeController(false);
      controller.applyCameraPreset(reviewStageFor(selectedStageRef.current).camera, reducedMotionRef.current);
      if (controllerRef.current !== controller) return;
      applyAt(timeRef.current);
      measureBranchProjection();
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
  }, [applyAt, applyInteractionEvent, finishDemo, measureBranchProjection, startInteractive, stopPlayback]);

  useEffect(() => {
    displayStateRef.current = displayState;
    replaceInteraction();
    timeRef.current = 0;
    accumulatedTimeRef.current = 0;
    lastFrameRef.current = undefined;
    setTimeMs(0);
    stopPlayback();
    const controller = controllerRef.current;
    if (!controller) return;
    controller.setDisplayState(displayState);
    applyAt(0);
  }, [applyAt, displayState, replaceInteraction, stopPlayback]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    setAutoCamera(!reducedMotion && !userControlledRef.current);
    const stageReplay = stageReplayRef.current;
    let cameraAppliedImmediately = false;
    if (reducedMotion && stageReplay) {
      const replayState = evaluateStageReplay(stageReplay.stage, stageReplay.elapsedMs, true);
      stageReplayRef.current = undefined;
      timeRef.current = replayState.timelineTimeMs;
      accumulatedTimeRef.current = replayState.timelineTimeMs;
      setTimeMs(replayState.timelineTimeMs);
      controllerRef.current?.applyCameraPreset(stageReplay.stage.camera, true);
      cameraAppliedImmediately = true;
    }
    applyAt(timeRef.current);
    if (cameraAppliedImmediately) measureBranchProjection();
  }, [applyAt, measureBranchProjection, reducedMotion]);

  const seek = useCallback((nextTime: number) => {
    stageReplayRef.current = undefined;
    const clamped = Math.round(Math.min(ARTIFACT_DURATION_MS, Math.max(0, nextTime)));
    timeRef.current = clamped;
    accumulatedTimeRef.current = clamped;
    lastFrameRef.current = undefined;
    setTimeMs(clamped);
    stopPlayback();
    if (clamped < ARTIFACT_DURATION_MS) replaceInteraction();
    else finishDemo(performance.now());
    applyAt(clamped);
  }, [applyAt, finishDemo, replaceInteraction, stopPlayback]);

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
    replaceInteraction();
    controllerRef.current?.applyCameraPreset(stage.camera, reducedMotionRef.current);
    applyAt(replayState.timelineTimeMs);
    if (reducedMotionRef.current) measureBranchProjection();
  }, [applyAt, displayState, measureBranchProjection, replaceInteraction, selectedStage, stopPlayback]);

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
    "data-min-branch-px": minimumBranchProjectionPx,
    "data-min-branch-edge-px": minimumBranchEdgeMarginPx,
    "data-month-general-phase": interaction.phase,
    "data-month-general-detent": interaction.detent,
    "data-month-general-aligned": String(interaction.aligned),
    "data-seated-generals": seatedCount,
    "data-seated-general-ids": seatedGeneralIds,
    "data-general-sequence": jadePlateLayout.generalSequence.map((general) => general.nodeId).join(","),
    "data-active-month-gold": activeMonthGoldProgress.toFixed(3),
    "data-general-name-gold-count": goldGeneralCount,
    "data-month-general-sequence": jadePlateLayout.generalSequence.map((general) => general.nodeId).join(","),
    "data-month-general-seated-ids": seatedGeneralIds,
    "data-month-general-seated-count": seatedCount,
    "data-month-general-gold-progress": activeMonthGoldProgress,
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
  const monthGeneralControls = (
    <MonthGeneralControls
      enabled={interaction.phase !== "locked"}
      phase={interaction.phase}
      detent={interaction.detent}
      activeMonthGeneral={displayState.calendar.monthGeneral}
      aligned={interaction.aligned}
      seatedCount={seatedCount}
      onStep={(delta) => applyInteractionEvent({ type: "step", delta, nowMs: performance.now() })}
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
      </div>
      {status === "loading" && (
        <div className="artifact-experience__loading-actions">
          <button type="button" onClick={onShowCourse}>查看文字课式</button>
        </div>
      )}
      {status === "ready" && (
        <>
          <AccessibleFacts state={displayState} interaction={interaction} seatedCount={seatedCount} />
          {showPartDirectory && compactLayout && !mobileToolHosts ? partDirectory : null}
          {monthGeneralControls}
          {showTimeline && !mobileToolHosts ? timeline : null}
        </>
      )}
      {status === "ready" && showPartDirectory && mobileHosts ? createPortal(partDirectory, mobileHosts.parts) : null}
      {status === "ready" && showTimeline && mobileHosts ? createPortal(timeline, mobileHosts.timeline) : null}
    </section>
  );
}
