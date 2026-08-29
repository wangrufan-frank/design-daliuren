import { describe, expect, it } from "vitest";
import { evaluateStageReplay, HOLD_MS, stageReplayDuration } from "./evaluate-stage-replay";
import { reviewStageFor } from "./review-stages";

describe("evaluateStageReplay", () => {
  it("replays each real stage duration and holds the settled state for inspection", () => {
    const stage = reviewStageFor("four-lessons");
    expect(stageReplayDuration(stage)).toBe(5_600);
    expect(evaluateStageReplay(stage, 0, false)).toEqual({
      timelineTimeMs: 8_000, decompositionProgress: 0, complete: false,
    });
    expect(evaluateStageReplay(stage, 2_500, false)).toEqual({
      timelineTimeMs: 10_500, decompositionProgress: 0.5, complete: false,
    });
    expect(evaluateStageReplay(stage, 5_000, false)).toEqual({
      timelineTimeMs: 13_000, decompositionProgress: 1, complete: false,
    });
    expect(evaluateStageReplay(stage, 5_000 + HOLD_MS, false)).toEqual({
      timelineTimeMs: 13_000, decompositionProgress: 1, complete: true,
    });
  });

  it("jumps reduced motion directly to the complete settled state", () => {
    expect(evaluateStageReplay(reviewStageFor("heavenly-generals"), 0, true)).toEqual({
      timelineTimeMs: 24_000, decompositionProgress: 1, complete: true,
    });
  });
});
