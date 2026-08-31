import { expect, it } from "vitest";
import type { GeneralDirection } from "../../../domain/heavenly-generals/types";
import { GENERAL_ORDER } from "../../../domain/heavenly-generals/policy";
import { referenceSession } from "../../../test/reference-session";
import { mapArtifactState } from "./map-artifact-state";
import { deriveJadePlateLayout, MONTH_GENERAL_NODE_IDS } from "./jade-plate-layout";
import type { ArtifactDisplayState, ArtifactSourceResults } from "./types";

const referenceState = mapArtifactState({
  calendar: referenceSession.snapshots.calendar!.value,
  plate: referenceSession.snapshots["heaven-earth"]!.value,
  lessons: referenceSession.snapshots["four-lessons"]!.value,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value,
  generals: referenceSession.snapshots["heavenly-generals"]!.value,
  course: referenceSession.snapshots.course!.value,
} as ArtifactSourceResults);

function fixtureForDirection(direction: GeneralDirection): ArtifactDisplayState {
  const earths = direction === "forward"
    ? ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
    : ["子", "亥", "戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑"];
  return {
    ...referenceState,
    noble: { ...referenceState.noble, direction, nobleEarth: "子" },
    generals: GENERAL_ORDER.map((general, order) => ({
      order, general, earth: earths[order], heaven: earths[order], evidenceId: `test-${order}`,
    })),
  } as ArtifactDisplayState;
}

it("uses offset as the sole correct detent and keeps noble first", () => {
  const layout = deriveJadePlateLayout(referenceState);

  expect(layout.correctDetent).toBe(6);
  expect(layout.correctAngleRad).toBeCloseTo(Math.PI);
  expect(layout.activeMonthGeneralNodeId).toBe("month-general/胜光");
  expect(layout.generalSequence.map((item) => item.general)).toEqual([
    "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙",
    "天空", "白虎", "太常", "玄武", "太阴", "天后",
  ]);
});

it.each(["forward", "reverse"] as const)("trusts upstream %s placement order", (direction) => {
  const state = fixtureForDirection(direction);
  const layout = deriveJadePlateLayout(state);

  expect(layout.direction).toBe(direction);
  expect(layout.generalSequence[0]).toMatchObject({ general: "贵人", sequenceIndex: 0 });
  expect(layout.generalSequence.map((item) => item.earth)).toEqual(
    [...state.generals].sort((a, b) => a.order - b.order).map((item) => item.earth),
  );
});

expect(Object.keys(MONTH_GENERAL_NODE_IDS)).toHaveLength(12);
