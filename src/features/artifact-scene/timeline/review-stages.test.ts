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

  it("uses the v10-calibrated camera focused on the modeled dial center", () => {
    for (const { camera } of ARTIFACT_REVIEW_STAGES) {
      expect(camera.position).toEqual([0.19096628, 1.48967427, 1.03677363]);
      expect(camera.target).toEqual([0.0064732, 0.13488113, 0.07347428]);
    }
  });
});
