import { describe, expect, it } from "vitest";
import { evaluateStageReplay } from "./evaluate-stage-replay";
import { reviewStageFor } from "./review-stages";

describe("evaluateStageReplay", () => {
  it("recaps prior stages, separates the current stage, then holds for inspection", () => {
    const stage = reviewStageFor("four-lessons");

    expect(evaluateStageReplay(stage, 0, false)).toEqual({
      timelineTimeMs: 0, decompositionProgress: 0, complete: false,
    });
    expect(evaluateStageReplay(stage, 350, false).timelineTimeMs).toBe(1_600);
    expect(evaluateStageReplay(stage, 700, false)).toEqual({
      timelineTimeMs: 3_200, decompositionProgress: 0, complete: false,
    });
    expect(evaluateStageReplay(stage, 1_150, false)).toEqual({
      timelineTimeMs: 4_300, decompositionProgress: 0.5, complete: false,
    });
    expect(evaluateStageReplay(stage, 1_600, false)).toEqual({
      timelineTimeMs: 5_400, decompositionProgress: 1, complete: false,
    });
    expect(evaluateStageReplay(stage, 1_700, false)).toEqual({
      timelineTimeMs: 5_400, decompositionProgress: 1, complete: false,
    });
    expect(evaluateStageReplay(stage, 1_800, false)).toEqual({
      timelineTimeMs: 5_400, decompositionProgress: 1, complete: true,
    });
  });

  it("jumps reduced motion directly to the settled state", () => {
    expect(evaluateStageReplay(reviewStageFor("heavenly-generals"), 0, true)).toEqual({
      timelineTimeMs: 10_300, decompositionProgress: 1, complete: true,
    });
  });

  it("returns the same stage-four state regardless of prior click history", () => {
    const stage = reviewStageFor("three-transmissions");
    const afterForwardClicks = ["calendar", "heaven-earth", "four-lessons"]
      .map((id) => reviewStageFor(id as "calendar" | "heaven-earth" | "four-lessons"))
      .reduce(() => evaluateStageReplay(stage, 1_800, false), evaluateStageReplay(stage, 0, false));
    const afterReverseClicks = ["course", "heavenly-generals"]
      .map((id) => reviewStageFor(id as "course" | "heavenly-generals"))
      .reduce(() => evaluateStageReplay(stage, 1_800, false), evaluateStageReplay(stage, 900, false));

    expect(afterForwardClicks).toEqual(afterReverseClicks);
  });
});
