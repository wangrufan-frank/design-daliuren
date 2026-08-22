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

  it("keeps every distinct camera direction inspection-sized through preset tweens", () => {
    const viewportAspect = 804 / 760;
    const horizontalFov = 2 * Math.atan(Math.tan(38 * Math.PI / 360) * viewportAspect);
    const projectedWidthPercent = (distance: number) => 0.52 / (2 * distance * Math.tan(horizontalFov / 2)) * 100;
    const offsets = ARTIFACT_REVIEW_STAGES.map(({ camera }) => camera.position.map(
      (value, index) => value - camera.target[index],
    ) as [number, number, number]);

    expect(new Set(offsets.map(([x, y, z]) => {
      const length = Math.hypot(x, y, z);
      return [x / length, y / length, z / length].map((value) => value.toFixed(3)).join("/");
    })).size).toBe(6);

    offsets.forEach(([x, y, z]) => {
      const distance = Math.hypot(x, y, z);
      const polarAngle = Math.atan2(Math.hypot(x, z), y);
      expect(distance).toBeCloseTo(0.9, 5);
      expect(projectedWidthPercent(distance)).toBeGreaterThanOrEqual(60);
      expect(projectedWidthPercent(distance)).toBeLessThanOrEqual(85);
      expect(polarAngle).toBeGreaterThanOrEqual(Math.PI / 9);
      expect(polarAngle).toBeLessThanOrEqual(5 * Math.PI / 12);
    });

    offsets.forEach((from, fromIndex) => offsets.slice(fromIndex + 1).forEach((to) => {
      const midpointDistance = Math.hypot(...from.map((value, index) => (value + to[index]) / 2));
      expect(projectedWidthPercent(midpointDistance)).toBeGreaterThanOrEqual(60);
    }));
  });
});
