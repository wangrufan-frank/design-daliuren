import { describe, expect, it } from "vitest";
import { RULE_STAGE_ORDER } from "../../../domain/chart/stages";
import { ARTIFACT_REVIEW_STAGES } from "./review-stages";

const annotationIds = new Set([
  "calendar/slip", "plate/earth", "plate/heaven",
  "lesson/first", "lesson/second", "lesson/third", "lesson/fourth",
  "transmission/initial", "transmission/middle", "transmission/final",
  "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
  "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger",
  "general/constant", "general/black-tortoise", "general/yin", "general/queen-of-heaven",
]);

describe("ARTIFACT_REVIEW_STAGES", () => {
  it("defines the six rule stages in their domain order", () => {
    expect(ARTIFACT_REVIEW_STAGES.map(({ id }) => id)).toEqual(RULE_STAGE_ORDER);
    expect(new Set(ARTIFACT_REVIEW_STAGES.map(({ id }) => id)).size).toBe(6);
  });

  it("keeps settled times, concise captions, and frozen artifact IDs valid", () => {
    let previousSettledTime = -1;
    ARTIFACT_REVIEW_STAGES.forEach((stage) => {
      expect(stage.startTimeMs).toBeLessThan(stage.settledTimeMs);
      expect(stage.settledTimeMs).toBeGreaterThan(previousSettledTime);
      expect(stage.caption).toHaveLength(2);
      stage.annotationIds.forEach((id) => expect(annotationIds.has(id)).toBe(true));
      previousSettledTime = stage.settledTimeMs;
    });
  });
});
