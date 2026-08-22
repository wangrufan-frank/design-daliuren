import type { ArtifactReviewStage } from "./review-stages";

export interface StageReplayState {
  timelineTimeMs: number;
  decompositionProgress: number;
  complete: boolean;
}

export const STAGE_REPLAY_DURATION_MS = 1_800;

const RECAP_END_MS = 700;
const DECOMPOSITION_END_MS = 1_600;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);

export function evaluateStageReplay(
  stage: ArtifactReviewStage,
  elapsedMs: number,
  reducedMotion: boolean,
): StageReplayState {
  if (reducedMotion) {
    return { timelineTimeMs: stage.settledTimeMs, decompositionProgress: 1, complete: true };
  }

  const elapsed = Math.min(STAGE_REPLAY_DURATION_MS, Math.max(0, elapsedMs));
  if (elapsed <= RECAP_END_MS) {
    const progress = smoothstep(clamp01(elapsed / RECAP_END_MS));
    return {
      timelineTimeMs: Math.round(stage.startTimeMs * progress),
      decompositionProgress: 0,
      complete: false,
    };
  }

  const decompositionProgress = smoothstep(clamp01(
    (elapsed - RECAP_END_MS) / (DECOMPOSITION_END_MS - RECAP_END_MS),
  ));
  return {
    timelineTimeMs: Math.round(
      stage.startTimeMs + (stage.settledTimeMs - stage.startTimeMs) * decompositionProgress,
    ),
    decompositionProgress,
    complete: elapsed >= STAGE_REPLAY_DURATION_MS,
  };
}
