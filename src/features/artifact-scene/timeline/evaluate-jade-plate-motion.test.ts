import { describe, expect, it } from "vitest";
import { EARTHLY_BRANCHES } from "../../../domain/calendar/constants";
import { GENERAL_ORDER } from "../../../domain/heavenly-generals/policy";
import type { GeneralTransition } from "../interaction/month-general-machine";
import {
  GENERAL_LABEL_IDS,
  GENERAL_NODE_IDS,
  type JadePlateLayout,
} from "../model/jade-plate-layout";
import {
  evaluateDemoJadePlateMotion,
  evaluateGeneralTransition,
  evaluateInteractiveJadePlateMotion,
} from "./evaluate-jade-plate-motion";

const layout: JadePlateLayout = {
  correctDetent: 6,
  correctAngleRad: Math.PI,
  activeMonthGeneralNodeId: "month-general/胜光",
  direction: "reverse",
  generalSequence: GENERAL_ORDER.map((general, sequenceIndex) => ({
    sequenceIndex,
    general,
    nodeId: GENERAL_NODE_IDS[general],
    labelId: GENERAL_LABEL_IDS[general],
    earth: EARTHLY_BRANCHES[sequenceIndex],
  })),
};

describe("jade plate motion", () => {
  it("moves the month ring through its positive traditional detents", () => {
    expect(evaluateDemoJadePlateMotion(layout, 0, false).monthAngleRad).toBe(0);

    const monthSettledAtMs = 3_200 + Math.max(0, layout.correctDetent * (175 + 60) - 60);
    expect(evaluateDemoJadePlateMotion(layout, monthSettledAtMs, false).monthAngleRad)
      .toBeCloseTo(layout.correctAngleRad);
  });

  it("lands the noble-first sequence at the specified stagger and contact timing", () => {
    const landing: GeneralTransition = {
      kind: "landing", startedAtMs: 0, fromProgress: Array(12).fill(0),
    };
    const before = evaluateGeneralTransition(layout, landing, 389, false);
    expect(before.generals[0].seatProgress).toBeGreaterThan(0);
    expect(before.generals[1].seatProgress).toBe(0);

    const secondStarts = evaluateGeneralTransition(layout, landing, 390, false);
    expect(secondStarts.generals[1].seatProgress).toBe(0);
    expect(evaluateGeneralTransition(layout, landing, 5_010, false).generals.every((item) => item.seatProgress === 1)).toBe(true);

    const contact = evaluateGeneralTransition(layout, landing, 700, false).generals[0];
    expect(contact.heightMeters).toBeGreaterThanOrEqual(0);
    expect(contact.heightMeters).toBeLessThanOrEqual(0.0005);
    expect(evaluateGeneralTransition(layout, landing, 720, false).generals[0]).toMatchObject({
      heightMeters: 0, seatProgress: 1, goldProgress: 1,
    });
    expect(before.generals.map((item) => item.nodeId).slice(0, 2)).toEqual([
      "general/noble", "general/snake",
    ]);
  });

  it("exits the same noble-first sequence in reverse physical order", () => {
    const exiting: GeneralTransition = {
      kind: "exit", startedAtMs: 0, fromProgress: Array(12).fill(1),
    };
    const exit = evaluateGeneralTransition(layout, exiting, 120, false);
    expect(exit.generals[11].seatProgress).toBeLessThan(1);
    expect(exit.generals[10].seatProgress).toBe(1);
    expect(evaluateGeneralTransition(layout, exiting, 1_700, false).generals.every((item) => item.visible === false)).toBe(true);
  });

  it("settles reduced motion immediately and is seek-safe", () => {
    const landing: GeneralTransition = {
      kind: "landing", startedAtMs: 40_000, fromProgress: Array(12).fill(0),
    };
    const reduced = evaluateGeneralTransition(layout, landing, 40_000, true);
    expect(reduced.generals.map((item) => item.seatProgress)).toEqual(Array(12).fill(1));
    expect(reduced.generals.map((item) => item.goldProgress)).toEqual(Array(12).fill(1));

    const interactive = {
      layout,
      phase: "landing" as const,
      angleRad: layout.correctAngleRad,
      detent: layout.correctDetent,
      aligned: true,
      transition: landing,
    };
    expect(evaluateInteractiveJadePlateMotion(interactive, 40_389, false))
      .toEqual(evaluateInteractiveJadePlateMotion(interactive, 40_389, false));
  });
});
