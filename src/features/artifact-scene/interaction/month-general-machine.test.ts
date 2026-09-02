import { describe, expect, it } from "vitest";
import { EARTHLY_BRANCHES } from "../../../domain/calendar/constants";
import { GENERAL_ORDER } from "../../../domain/heavenly-generals/policy";
import {
  GENERAL_LABEL_IDS,
  GENERAL_NODE_IDS,
  DETENT_RADIANS,
  type JadePlateLayout,
} from "../model/jade-plate-layout";
import {
  createMonthGeneralState,
  reduceMonthGeneralState,
  type MonthGeneralInteractionState,
} from "./month-general-machine";

const layout: JadePlateLayout = {
  correctDetent: 6,
  correctAngleRad: Math.PI,
  activeMonthGeneralNodeId: "month-general/胜光",
  direction: "forward",
  generalSequence: GENERAL_ORDER.map((general, sequenceIndex) => ({
    sequenceIndex,
    general,
    nodeId: GENERAL_NODE_IDS[general],
    labelId: GENERAL_LABEL_IDS[general],
    earth: EARTHLY_BRANCHES[sequenceIndex],
  })),
};

const completedState = (atMs: number) => reduceMonthGeneralState(
  createMonthGeneralState(layout),
  { type: "demo-complete", nowMs: atMs },
);

const exploringState = (detent = 0): MonthGeneralInteractionState => ({
  ...completedState(27_000),
  phase: "exploring",
  aligned: false,
  angleRad: detent * DETENT_RADIANS,
  detent,
  transition: undefined,
});

const emptyProgress = Array(12).fill(0);

describe("month-general interaction", () => {
  it("does not invalidate a seated plate on pointer-down alone", () => {
    const seated = completedState(27_000);

    expect(reduceMonthGeneralState(seated, { type: "drag-start", angleRad: 1, nowMs: 28_000 })).toMatchObject({
      phase: "seated", aligned: true,
    });
  });

  it("invalidates beyond two degrees and captures a reverse exit", () => {
    const started = reduceMonthGeneralState(completedState(27_000), {
      type: "drag-start", angleRad: 1, nowMs: 28_000,
    });
    const moved = reduceMonthGeneralState(started, {
      type: "drag-move", angleRad: 1 + 2.1 * Math.PI / 180, nowMs: 28_020,
      generalProgress: Array(12).fill(1),
    });

    expect(moved).toMatchObject({ phase: "exiting", aligned: false });
    expect(moved.transition?.kind).toBe("exit");
    expect(moved.transition?.fromProgress).toEqual(Array(12).fill(1));
  });

  it("preserves an exit transition through continued same-direction dragging", () => {
    const started = reduceMonthGeneralState(completedState(27_000), {
      type: "drag-start", angleRad: 0, nowMs: 28_000,
    });
    const exiting = reduceMonthGeneralState(started, {
      type: "drag-move", angleRad: 3 * Math.PI / 180, nowMs: 28_020,
      generalProgress: Array(12).fill(1),
    });
    const continued = reduceMonthGeneralState(exiting, {
      type: "drag-move", angleRad: 5 * Math.PI / 180, nowMs: 28_040,
      generalProgress: [1, 1, 0.6, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
    });

    expect(continued).toMatchObject({ phase: "exiting", aligned: false });
    expect(continued.transition).toEqual({
      kind: "exit", startedAtMs: 28_020, fromProgress: Array(12).fill(1),
    });
  });

  it("preserves an exit transition when release snaps to a wrong detent", () => {
    const started = reduceMonthGeneralState(completedState(27_000), {
      type: "drag-start", angleRad: 0, nowMs: 28_000,
    });
    const exiting = reduceMonthGeneralState(started, {
      type: "drag-move", angleRad: 20 * Math.PI / 180, nowMs: 28_020,
      generalProgress: Array(12).fill(1),
    });
    const released = reduceMonthGeneralState(exiting, {
      type: "drag-end", angularVelocityRadMs: 0, nowMs: 28_040,
      generalProgress: [1, 1, 0.6, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
    });

    expect(released).toMatchObject({ phase: "exiting", aligned: false, detent: 7 });
    expect(released.transition).toEqual({
      kind: "exit", startedAtMs: 28_020, fromProgress: Array(12).fill(1),
    });
  });

  it("snaps wrong positions quietly and re-enters at the unique correct detent", () => {
    const wrong = reduceMonthGeneralState(exploringState(), {
      type: "step", delta: 1, nowMs: 30_000, generalProgress: emptyProgress,
    });
    const correct = reduceMonthGeneralState(exploringState(layout.correctDetent - 1), {
      type: "step", delta: 1, nowMs: 30_100, generalProgress: emptyProgress,
    });

    expect(wrong).toMatchObject({ phase: "exploring", aligned: false, detent: 1 });
    expect(wrong.transition).toBeUndefined();
    expect(correct).toMatchObject({ phase: "landing", aligned: true, detent: layout.correctDetent });
    expect(correct.transition?.startedAtMs).toBe(30_320);
  });

  it("cancels a partial landing from its current progress without delayed work", () => {
    const landing: MonthGeneralInteractionState = {
      ...exploringState(layout.correctDetent),
      phase: "landing",
      aligned: true,
      transition: { kind: "landing", startedAtMs: 40_000, fromProgress: emptyProgress },
    };

    const interrupted = reduceMonthGeneralState(landing, {
      type: "step", delta: 1, nowMs: 41_400,
      generalProgress: [1, 1, 0.6, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
    });

    expect(interrupted.transition?.kind).toBe("exit");
    expect(interrupted.transition?.fromProgress.some((value) => value > 0 && value < 1)).toBe(true);
  });

  it("uses the shortest signed drag delta across the zero-angle boundary", () => {
    const started = reduceMonthGeneralState(completedState(27_000), {
      type: "drag-start", angleRad: 359 * Math.PI / 180, nowMs: 28_000,
    });
    const moved = reduceMonthGeneralState(started, {
      type: "drag-move", angleRad: Math.PI / 180, nowMs: 28_010, generalProgress: Array(12).fill(1),
    });

    expect(moved.drag?.movedRad).toBeCloseTo(2 * Math.PI / 180);
    expect(moved).toMatchObject({ phase: "seated", aligned: true });
  });

  it("snaps a released drag to its nearest detent", () => {
    const started = reduceMonthGeneralState(exploringState(), {
      type: "drag-start", angleRad: 0, nowMs: 31_000,
    });
    const moved = reduceMonthGeneralState(started, {
      type: "drag-move", angleRad: DETENT_RADIANS * 0.6, nowMs: 31_010, generalProgress: emptyProgress,
    });
    const released = reduceMonthGeneralState(moved, {
      type: "drag-end", angularVelocityRadMs: 0, nowMs: 31_020, generalProgress: emptyProgress,
    });

    expect(released).toMatchObject({ detent: 1, angleRad: DETENT_RADIANS, phase: "exploring", aligned: false });
  });

  it("adds no more than one detent on a fast release", () => {
    const started = reduceMonthGeneralState(exploringState(), {
      type: "drag-start", angleRad: 0, nowMs: 32_000,
    });
    const released = reduceMonthGeneralState(started, {
      type: "drag-end", angularVelocityRadMs: 100, nowMs: 32_020, generalProgress: emptyProgress,
    });

    expect(released.detent).toBe(1);
    expect(released.angleRad).toBe(DETENT_RADIANS);
  });

  it.each(["wheel", "keyboard", "button"])("routes %s input through one-detent steps", (_source) => {
    const stepped = reduceMonthGeneralState(exploringState(3), {
      type: "step", delta: 1, nowMs: 33_000, generalProgress: emptyProgress,
    });

    expect(stepped).toMatchObject({ detent: 4, angleRad: 4 * DETENT_RADIANS, phase: "exploring", aligned: false });
  });

  it("returns to locked when a new source resets the interaction", () => {
    const reset = reduceMonthGeneralState(completedState(27_000), { type: "reset" });

    expect(reset).toMatchObject({ phase: "locked", angleRad: 0, detent: 0, aligned: false });
    expect(reset.drag).toBeUndefined();
    expect(reset.transition).toBeUndefined();
  });

  it("rejects invalid transition progress snapshots", () => {
    expect(() => reduceMonthGeneralState(exploringState(), {
      type: "step", delta: 1, nowMs: 34_000, generalProgress: Array(11).fill(0),
    })).toThrow(/generalProgress/);
  });
});
