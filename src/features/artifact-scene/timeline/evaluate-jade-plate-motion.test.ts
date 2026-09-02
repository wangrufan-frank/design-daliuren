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

    const monthSettledAtMs = Math.max(0, layout.correctDetent * (175 + 60) - 60);
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
    expect([0, 500, 700, 719].every(
      (timeMs) => evaluateGeneralTransition(layout, landing, timeMs, false).generals[0].goldProgress === 0,
    )).toBe(true);
    expect(evaluateGeneralTransition(layout, landing, 720, false).generals[0]).toMatchObject({
      heightMeters: 0, seatProgress: 1, goldProgress: 1,
    });
    expect(before.generals.map((item) => item.nodeId).slice(0, 2)).toEqual([
      "general/noble", "general/snake",
    ]);
  });

  it("joins the final six-millimeter descent continuously before a nonnegative bounce", () => {
    const landing: GeneralTransition = {
      kind: "landing", startedAtMs: 0, fromProgress: Array(12).fill(0),
    };
    const heightAt = (timeMs: number) => evaluateGeneralTransition(layout, landing, timeMs, false).generals[0].heightMeters;
    const downwardSpeedAt = (timeMs: number) => heightAt(timeMs) - heightAt(timeMs + 1);

    expect(heightAt(500)).toBeCloseTo(0.006);
    expect(downwardSpeedAt(499)).toBeCloseTo(downwardSpeedAt(500), 6);
    const speeds = [500, 540, 580, 620, 660, 678].map(downwardSpeedAt);
    expect(speeds.every((speed) => speed >= 0)).toBe(true);
    expect(speeds.slice(1).every((speed, index) => speed <= speeds[index])).toBe(true);
    expect(downwardSpeedAt(679)).toBeLessThan(downwardSpeedAt(660));
    expect(heightAt(680)).toBe(0);
    expect(heightAt(700)).toBeGreaterThanOrEqual(0.0003);
    expect(heightAt(700)).toBeLessThanOrEqual(0.0005);
  });

  it("exits the same noble-first sequence in reverse physical order", () => {
    const exiting: GeneralTransition = {
      kind: "exit", startedAtMs: 0, fromProgress: Array(12).fill(1),
    };
    const exit = evaluateGeneralTransition(layout, exiting, 120, false);
    expect(exit.generals[11].seatProgress).toBeLessThan(1);
    expect(exit.generals[10].seatProgress).toBe(1);
    expect(evaluateGeneralTransition(layout, exiting, 1_700, false).generals.every((item) => item.visible === false)).toBe(true);
    expect(evaluateGeneralTransition(layout, exiting, 1_740, false).generals.every((item) => item.seatProgress === 0)).toBe(true);
  });

  it("exits only started pieces in their actual reverse order without waiting for unstarted pieces", () => {
    const exiting: GeneralTransition = {
      kind: "exit", startedAtMs: 10_000,
      fromProgress: [1, 0.65, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };

    const firstFrame = evaluateGeneralTransition(layout, exiting, 10_001, false).generals;
    expect(firstFrame[2].seatProgress).toBeLessThan(0.2);
    expect(firstFrame[1].seatProgress).toBe(0.65);
    expect(firstFrame[0].seatProgress).toBe(1);

    const secondStarts = evaluateGeneralTransition(layout, exiting, 10_121, false).generals;
    expect(secondStarts[1].seatProgress).toBeLessThan(0.65);
    expect(secondStarts[0].seatProgress).toBe(1);

    const thirdStarts = evaluateGeneralTransition(layout, exiting, 10_241, false).generals;
    expect(thirdStarts[0].seatProgress).toBeLessThan(1);
    expect(evaluateGeneralTransition(layout, exiting, 10_660, false).generals.every((item) => item.seatProgress === 0)).toBe(true);
  });

  it("turns the aligned month general gold for 220ms before the first general starts landing", () => {
    const interactive = {
      layout,
      phase: "landing" as const,
      angleRad: layout.correctAngleRad,
      detent: layout.correctDetent,
      aligned: true,
      transition: {
        kind: "landing" as const,
        startedAtMs: 20_220,
        fromProgress: Array(12).fill(0),
      },
    };

    const aligned = evaluateInteractiveJadePlateMotion(interactive, 20_000, false);
    const halfwayGold = evaluateInteractiveJadePlateMotion(interactive, 20_110, false);
    const goldComplete = evaluateInteractiveJadePlateMotion(interactive, 20_220, false);

    expect(aligned.activeMonthGoldProgress).toBe(0);
    expect(halfwayGold.activeMonthGoldProgress).toBeGreaterThan(0);
    expect(halfwayGold.activeMonthGoldProgress).toBeLessThan(1);
    expect(goldComplete.activeMonthGoldProgress).toBe(1);
    expect(aligned.generals.every((item) => item.visible === false)).toBe(true);
    expect(halfwayGold.generals.every((item) => item.visible === false)).toBe(true);
    expect(goldComplete.generals[0].seatProgress).toBe(0);
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
