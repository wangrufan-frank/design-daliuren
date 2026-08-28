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

  it("keeps featured annotation sets concise while allowing complex stages up to six", () => {
    for (const stage of ARTIFACT_REVIEW_STAGES) {
      expect(stage.annotationIds.length).toBeGreaterThanOrEqual(3);
      expect(stage.annotationIds.length).toBeLessThanOrEqual(
        stage.id === "heavenly-generals" || stage.id === "course" ? 6 : 4,
      );
    }
  });

  it("keeps every distinct camera direction inspection-safe", () => {
    const offsets = ARTIFACT_REVIEW_STAGES.map(({ camera }) => camera.position.map(
      (value, index) => value - camera.target[index],
    ) as [number, number, number]);

    expect(new Set(offsets.map(([x, y, z]) => {
      const length = Math.hypot(x, y, z);
      return [x / length, y / length, z / length].map((value) => value.toFixed(3)).join("/");
    })).size).toBe(6);

    ARTIFACT_REVIEW_STAGES.forEach(({ camera }, index) => {
      const [x, y, z] = offsets[index];
      const distance = Math.hypot(x, y, z);
      const polarAngle = Math.atan2(Math.hypot(x, z), y);
      expect(distance).toBeGreaterThanOrEqual(1.04);
      expect(distance).toBeLessThanOrEqual(1.18);
      expect(camera.position[1]).toBeGreaterThan(camera.target[1] + 0.32);
      expect(Math.abs(camera.target[0])).toBeLessThanOrEqual(0.12);
      expect(Math.abs(camera.target[2])).toBeLessThanOrEqual(0.12);
      expect(polarAngle).toBeGreaterThanOrEqual(Math.PI / 9);
      expect(polarAngle).toBeLessThanOrEqual(5 * Math.PI / 12);
    });

  });
});
