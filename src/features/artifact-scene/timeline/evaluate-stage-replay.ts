import type { ArtifactReviewStage } from "./review-stages";

export interface StageReplayState {
  timelineTimeMs: number;
  decompositionProgress: number;
  complete: boolean;
}

export const HOLD_MS = 600;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function stageReplayDuration(stage: ArtifactReviewStage): number {
  return stage.settledTimeMs - stage.startTimeMs + HOLD_MS;
}

export function evaluateStageReplay(
  stage: ArtifactReviewStage,
  elapsedMs: number,
  reducedMotion: boolean,
): StageReplayState {
  if (reducedMotion) {
    return { timelineTimeMs: stage.settledTimeMs, decompositionProgress: 1, complete: true };
  }

  const actionDurationMs = stage.settledTimeMs - stage.startTimeMs;
  const elapsed = Math.max(0, elapsedMs);
  const decompositionProgress = clamp01(elapsed / actionDurationMs);
  return {
    timelineTimeMs: stage.startTimeMs + Math.min(elapsed, actionDurationMs),
    decompositionProgress,
    complete: elapsed >= stageReplayDuration(stage),
  };
}
