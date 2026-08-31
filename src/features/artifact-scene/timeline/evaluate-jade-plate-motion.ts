import type { GeneralTransition, MonthGeneralInteractionState } from "../interaction/month-general-machine";
import { DETENT_RADIANS, type JadePlateLayout } from "../model/jade-plate-layout";
import type { JadePlateGeneralMotion, JadePlateMotion } from "./types";

export const MONTH_STEP_MS = 175;
export const MONTH_PAUSE_MS = 60;
export const LAND_MS = 720;
export const LAND_STAGGER_MS = 390;
export const EXIT_MS = 420;
export const EXIT_STAGGER_MS = 120;
export const DROP_HEIGHT_M = 0.0275;
export const MONTH_GOLD_MS = 220;

const HEAVEN_EARTH_START_MS = 3_200;
const GENERAL_START_MS = 18_000;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smootherstep = (value: number) => value ** 3 * (value * (value * 6 - 15) + 10);

function emptyGeneralMotion(layout: JadePlateLayout): readonly JadePlateGeneralMotion[] {
  return layout.generalSequence.map((piece) => ({
    nodeId: piece.nodeId,
    targetEarth: piece.earth,
    visible: false,
    heightMeters: DROP_HEIGHT_M,
    seatProgress: 0,
    goldProgress: 0,
  }));
}

function seatedGeneralMotion(layout: JadePlateLayout): readonly JadePlateGeneralMotion[] {
  return layout.generalSequence.map((piece) => ({
    nodeId: piece.nodeId,
    targetEarth: piece.earth,
    visible: true,
    heightMeters: 0,
    seatProgress: 1,
    goldProgress: 1,
  }));
}

function landingHeight(localMs: number): number {
  if (localMs <= 0) return DROP_HEIGHT_M;
  if (localMs >= LAND_MS) return 0;
  if (localMs <= 600) return DROP_HEIGHT_M - 0.0215 * (localMs / 600) ** 2;
  if (localMs <= 680) return 0.006 * (1 - smootherstep((localMs - 600) / 80));
  return 0.0004 * Math.sin(Math.PI * (localMs - 680) / 40);
}

function landingMotion(
  layout: JadePlateLayout,
  transition: GeneralTransition,
  elapsedMs: number,
): readonly JadePlateGeneralMotion[] {
  return layout.generalSequence.map((piece, index) => {
    const from = transition.fromProgress[index] ?? 0;
    const localMs = elapsedMs - index * LAND_STAGGER_MS;
    const progress = from + (1 - from) * smootherstep(clamp01(localMs / LAND_MS));
    const started = localMs >= 0;
    return {
      nodeId: piece.nodeId,
      targetEarth: piece.earth,
      visible: from > 0 || started,
      heightMeters: from === 0 ? landingHeight(localMs) : DROP_HEIGHT_M * (1 - progress),
      seatProgress: progress,
      goldProgress: progress,
    };
  });
}

function exitMotion(
  layout: JadePlateLayout,
  transition: GeneralTransition,
  elapsedMs: number,
): readonly JadePlateGeneralMotion[] {
  return layout.generalSequence.map((piece, index) => {
    const from = transition.fromProgress[index] ?? 0;
    const localMs = elapsedMs - (layout.generalSequence.length - 1 - index) * EXIT_STAGGER_MS;
    const seatProgress = from * (1 - smootherstep(clamp01(localMs / EXIT_MS)));
    return {
      nodeId: piece.nodeId,
      targetEarth: piece.earth,
      visible: seatProgress > 0.01,
      heightMeters: DROP_HEIGHT_M * (1 - seatProgress),
      seatProgress,
      goldProgress: seatProgress,
    };
  });
}

export function evaluateGeneralTransition(
  layout: JadePlateLayout,
  transition: GeneralTransition,
  nowMs: number,
  reducedMotion: boolean,
): Pick<JadePlateMotion, "generals"> {
  if (reducedMotion) {
    return { generals: transition.kind === "landing" ? seatedGeneralMotion(layout) : emptyGeneralMotion(layout) };
  }
  const elapsedMs = nowMs - transition.startedAtMs;
  return {
    generals: transition.kind === "landing"
      ? landingMotion(layout, transition, elapsedMs)
      : exitMotion(layout, transition, elapsedMs),
  };
}

function demoMonthMotion(layout: JadePlateLayout, timeMs: number, reducedMotion: boolean): Pick<JadePlateMotion, "monthAngleRad" | "activeMonthGoldProgress"> {
  const elapsedMs = timeMs - HEAVEN_EARTH_START_MS;
  if (elapsedMs < 0) return { monthAngleRad: 0, activeMonthGoldProgress: 0 };
  if (reducedMotion) return { monthAngleRad: layout.correctAngleRad, activeMonthGoldProgress: 1 };

  const settledAtMs = Math.max(0, layout.correctDetent * (MONTH_STEP_MS + MONTH_PAUSE_MS) - MONTH_PAUSE_MS);
  const wholeSteps = Math.min(layout.correctDetent, Math.floor(elapsedMs / (MONTH_STEP_MS + MONTH_PAUSE_MS)));
  const stepElapsedMs = elapsedMs - wholeSteps * (MONTH_STEP_MS + MONTH_PAUSE_MS);
  const detents = wholeSteps >= layout.correctDetent
    ? layout.correctDetent
    : wholeSteps + clamp01(stepElapsedMs / MONTH_STEP_MS);
  return {
    monthAngleRad: detents * DETENT_RADIANS,
    activeMonthGoldProgress: smootherstep(clamp01((elapsedMs - settledAtMs) / MONTH_GOLD_MS)),
  };
}

export function evaluateDemoJadePlateMotion(
  layout: JadePlateLayout,
  timeMs: number,
  reducedMotion: boolean,
): JadePlateMotion {
  const month = demoMonthMotion(layout, timeMs, reducedMotion);
  const generals = timeMs < GENERAL_START_MS
    ? emptyGeneralMotion(layout)
    : evaluateGeneralTransition(layout, {
      kind: "landing",
      startedAtMs: GENERAL_START_MS,
      fromProgress: Array(layout.generalSequence.length).fill(0),
    }, timeMs, reducedMotion).generals;
  return { ...month, activeMonthGeneralNodeId: layout.activeMonthGeneralNodeId, generals };
}

export function evaluateInteractiveJadePlateMotion(
  state: MonthGeneralInteractionState,
  nowMs: number,
  reducedMotion: boolean,
): JadePlateMotion {
  const generals = state.transition
    ? evaluateGeneralTransition(state.layout, state.transition, nowMs, reducedMotion).generals
    : state.aligned ? seatedGeneralMotion(state.layout) : emptyGeneralMotion(state.layout);
  return {
    monthAngleRad: state.angleRad,
    activeMonthGeneralNodeId: state.layout.activeMonthGeneralNodeId,
    activeMonthGoldProgress: state.aligned ? 1 : 0,
    generals,
  };
}
