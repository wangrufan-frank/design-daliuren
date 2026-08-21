import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ARTIFACT_ASSET_URLS, selectArtifactLod } from "./model/asset-contract";
import { mapArtifactState } from "./model/map-artifact-state";
import type { ArtifactDisplayState, ArtifactSourceResults } from "./model/types";
import { evaluateArtifactPose, ARTIFACT_DURATION_MS } from "./timeline/evaluate-pose";
import type { ArtifactPose } from "./timeline/types";
import { ArtifactSceneController } from "./three/ArtifactSceneController";
import { disposeArtifact } from "./three/dispose-artifact";
import { createArtifactRenderer, loadArtifact } from "./three/load-artifact";
import type { LoadedArtifact } from "./three/load-artifact";
import { ArtifactTimeline } from "./ArtifactTimeline";
import { useReducedMotion } from "./use-reduced-motion";
import "./artifact-scene.css";

declare global {
  interface ImportMetaEnv {
    readonly PROD: boolean;
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
  onShowCourse(): void;
}

type ExperienceStatus = "loading" | "ready" | "error";

const observableBuild = () => !import.meta.env.PROD;

function poseHash(pose: ArtifactPose): string {
  const values: number[] = [];
  Object.keys(pose.nodes).sort().forEach((id) => {
    const node = pose.nodes[id];
    values.push(node.translationX, node.translationY, node.translationZ, node.rotationZ);
  });
  (["lessons", "transmissions", "generals"] as const).forEach((key) => {
    const copy = pose.copy[key];
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
      <li>{`四柱 ${state.calendar.pillars.join("、")}；月建 ${state.calendar.monthBuild}；月将 ${state.calendar.monthGeneral}；占时 ${state.calendar.divinationHour}`}</li>
      {state.lessons.map((lesson) => <li key={lesson.id}>{`${lesson.label} ${lesson.general} ${lesson.upper}/${lesson.lower.value}`}</li>)}
      {state.transmissions.map((item) => <li key={item.position}>{`${item.label} ${item.general} ${item.branch} ${item.relation}`}</li>)}
      {state.generals.map((item) => <li key={item.general}>{`${item.general} ${item.heaven}/${item.earth}`}</li>)}
    </ul>
  );
}

export function ArtifactExperience({ source, onShowCourse }: ArtifactExperienceProps) {
  const displayState = useMemo(() => mapArtifactState(source), [source]);
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<ArtifactSceneController | undefined>(undefined);
  const displayStateRef = useRef(displayState);
  const reducedMotionRef = useRef(reducedMotion);
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);
  const autoCameraRef = useRef(!reducedMotion);
  const frameRef = useRef<number | undefined>(undefined);
  const lastFrameRef = useRef<number | undefined>(undefined);
  const userControlledRef = useRef(false);
  const [status, setStatus] = useState<ExperienceStatus>("loading");
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoCamera, setAutoCamera] = useState(!reducedMotion);
  const [currentPoseHash, setCurrentPoseHash] = useState<string | undefined>(undefined);

  const applyAt = useCallback((nextTime: number) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const evaluatedPose = evaluateArtifactPose(displayStateRef.current, nextTime, reducedMotionRef.current);
    const pose = evaluatedPose.cameraOrbitRequested === autoCameraRef.current
      ? evaluatedPose
      : { ...evaluatedPose, cameraOrbitRequested: autoCameraRef.current };
    controller.applyPose(pose);
    if (observableBuild()) setCurrentPoseHash(poseHash(pose));
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
      if (playingRef.current) {
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
      controller.render();
      if (controllerRef.current) frameRef.current = requestAnimationFrame(frame);
    };

    const width = canvas.getBoundingClientRect().width || window.innerWidth;
    const dpr = window.devicePixelRatio || 1;
    const lod = selectArtifactLod(width, dpr);
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
      });
      ownedController = controller;
      controllerRef.current = controller;
      rendererOwnedByController = true;
      controller.setDisplayState(displayStateRef.current);
      if (controllerRef.current !== controller) return;
      const bounds = canvas.getBoundingClientRect();
      controller.resize(bounds.width || window.innerWidth, bounds.height || 560, dpr);
      applyAt(timeRef.current);
      setStatus("ready");
      frameRef.current = requestAnimationFrame(frame);
    }).catch(() => {
      if (!disposeOwnedController()) {
        if (loadedArtifact) disposeArtifact(loadedArtifact.root);
        loadedArtifact = undefined;
        disposeRenderer();
      }
      if (!inactive) setStatus("error");
    });

    return () => {
      inactive = true;
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
    applyAt(timeRef.current);
  }, [applyAt, reducedMotion]);

  const seek = (nextTime: number) => {
    const clamped = Math.round(Math.min(ARTIFACT_DURATION_MS, Math.max(0, nextTime)));
    timeRef.current = clamped;
    accumulatedTimeRef.current = clamped;
    lastFrameRef.current = undefined;
    setTimeMs(clamped);
    stopPlayback();
    applyAt(clamped);
  };

  const togglePlayback = () => {
    if (playingRef.current) {
      stopPlayback();
      return;
    }
    if (timeRef.current === ARTIFACT_DURATION_MS) seek(0);
    lastFrameRef.current = undefined;
    playingRef.current = true;
    setPlaying(true);
  };

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
      data-pose-hash={observableBuild() ? currentPoseHash : undefined}
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
          <AccessibleFacts state={displayState} />
          <ArtifactTimeline
            timeMs={timeMs}
            playing={playing}
            onSeek={seek}
            onTogglePlayback={togglePlayback}
            onResetCamera={() => controllerRef.current?.resetCamera()}
            onShowCourse={onShowCourse}
          />
        </>
      )}
    </section>
  );
}
