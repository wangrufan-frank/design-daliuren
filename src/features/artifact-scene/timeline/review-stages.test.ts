import { describe, expect, it } from "vitest";
import { RULE_STAGE_ORDER } from "../../../domain/chart/stages";
import { ARTIFACT_REVIEW_STAGES } from "./review-stages";

describe("ARTIFACT_REVIEW_STAGES", () => {
  it("keeps the six physical stages on their exact 27-second intervals", () => {
    expect(ARTIFACT_REVIEW_STAGES.map(({ id }) => id)).toEqual(RULE_STAGE_ORDER);
    expect(ARTIFACT_REVIEW_STAGES.map(({ startTimeMs, settledTimeMs }) => [startTimeMs, settledTimeMs])).toEqual([
      [0, 3_200], [3_200, 8_000], [8_000, 13_000],
      [13_000, 18_000], [18_000, 24_000], [24_000, 27_000],
    ]);
  });

  it("uses a stable high camera focused on the plate center", () => {
    for (const { camera } of ARTIFACT_REVIEW_STAGES) {
      const [x, y, z] = camera.position;
      expect(y).toBeGreaterThanOrEqual(0.68);
      expect(y).toBeLessThanOrEqual(0.78);
      expect(camera.target).toEqual([0, 0.05, 0]);
      expect(Math.hypot(x, y - camera.target[1], z)).toBeGreaterThanOrEqual(1.02);
      expect(Math.hypot(x, y - camera.target[1], z)).toBeLessThanOrEqual(1.12);
    }
  });
});
