import { DETENT_RADIANS, type JadePlateLayout } from "../model/jade-plate-layout";

const FULL_TURN_RADIANS = Math.PI * 2;
const DETENT_COUNT = 12;
const DRAG_INVALIDATION_RADIANS = 2 * Math.PI / 180;
const INERTIA_THRESHOLD_RAD_MS = 0.01;

export type MonthGeneralPhase = "locked" | "landing" | "seated" | "exiting" | "exploring";

export interface GeneralTransition {
  kind: "landing" | "exit";
  startedAtMs: number;
  fromProgress: readonly number[];
}

export interface MonthGeneralInteractionState {
  layout: JadePlateLayout;
  phase: MonthGeneralPhase;
  angleRad: number;
  detent: number;
  aligned: boolean;
  drag?: { pointerStartRad: number; ringStartRad: number; movedRad: number };
  transition?: GeneralTransition;
}

export type MonthGeneralEvent =
  | { type: "demo-complete"; nowMs: number }
  | { type: "reset" }
  | { type: "drag-start"; angleRad: number; nowMs: number }
  | { type: "drag-move"; angleRad: number; nowMs: number; generalProgress: readonly number[] }
  | { type: "drag-end"; angularVelocityRadMs: number; nowMs: number; generalProgress: readonly number[] }
  | { type: "step"; delta: -1 | 1; nowMs: number; generalProgress: readonly number[] };

export function normalizeAngle(angleRad: number): number {
  return ((angleRad % FULL_TURN_RADIANS) + FULL_TURN_RADIANS) % FULL_TURN_RADIANS;
}

export function signedAngleDelta(fromRad: number, toRad: number): number {
  const delta = normalizeAngle(toRad - fromRad + Math.PI) - Math.PI;
  return delta === -Math.PI ? Math.PI : delta;
}

export function detentForAngle(angleRad: number): number {
  return Math.round(normalizeAngle(angleRad) / DETENT_RADIANS) % DETENT_COUNT;
}

export function angleForDetent(detent: number): number {
  return modulo(detent, DETENT_COUNT) * DETENT_RADIANS;
}

export function createMonthGeneralState(layout: JadePlateLayout): MonthGeneralInteractionState {
  return { layout, phase: "locked", angleRad: 0, detent: 0, aligned: false };
}

export function reduceMonthGeneralState(
  state: MonthGeneralInteractionState,
  event: MonthGeneralEvent,
): MonthGeneralInteractionState {
  switch (event.type) {
    case "demo-complete":
      return {
        ...state,
        phase: "seated",
        angleRad: angleForDetent(state.layout.correctDetent),
        detent: state.layout.correctDetent,
        aligned: true,
        drag: undefined,
        transition: undefined,
      };
    case "reset":
      return createMonthGeneralState(state.layout);
    case "drag-start":
      return state.phase === "locked"
        ? state
        : {
          ...state,
          drag: {
            pointerStartRad: normalizeAngle(event.angleRad),
            ringStartRad: state.angleRad,
            movedRad: 0,
          },
        };
    case "drag-move": {
      const progress = validatedProgress(event.generalProgress);
      if (!state.drag || state.phase === "locked") return state;

      const movedRad = signedAngleDelta(state.drag.pointerStartRad, event.angleRad);
      const drag = { ...state.drag, movedRad };
      if (Math.abs(movedRad) <= DRAG_INVALIDATION_RADIANS + 1e-12 && state.aligned) {
        return { ...state, drag };
      }

      const angleRad = normalizeAngle(state.drag.ringStartRad + movedRad);
      if (state.aligned) {
        return leavingAlignment(state, angleRad, state.detent, drag, event.nowMs, progress);
      }
      if (state.phase === "exiting" && state.transition?.kind === "exit") {
        return { ...state, angleRad, drag };
      }
      return { ...state, phase: "exploring", angleRad, drag, transition: undefined };
    }
    case "drag-end": {
      const progress = validatedProgress(event.generalProgress);
      if (!state.drag || state.phase === "locked") return state;

      const inertialDetent = Math.abs(event.angularVelocityRadMs) >= INERTIA_THRESHOLD_RAD_MS
        ? Math.sign(event.angularVelocityRadMs)
        : 0;
      const detent = modulo(detentForAngle(state.angleRad) + inertialDetent, DETENT_COUNT);
      return snapToDetent({ ...state, drag: undefined }, detent, event.nowMs, progress);
    }
    case "step": {
      const progress = validatedProgress(event.generalProgress);
      if (state.phase === "locked") return state;
      const detent = modulo(state.detent + event.delta, DETENT_COUNT);
      return snapToDetent({ ...state, drag: undefined }, detent, event.nowMs, progress);
    }
  }
}

function snapToDetent(
  state: MonthGeneralInteractionState,
  detent: number,
  nowMs: number,
  progress: readonly number[],
): MonthGeneralInteractionState {
  const angleRad = angleForDetent(detent);
  if (detent === state.layout.correctDetent) {
    if (state.aligned && state.phase === "seated") {
      return { ...state, angleRad, detent, drag: undefined };
    }
    return {
      ...state,
      phase: "landing",
      angleRad,
      detent,
      aligned: true,
      drag: undefined,
      transition: transition("landing", nowMs, progress),
    };
  }
  if (state.aligned) return leavingAlignment(state, angleRad, detent, undefined, nowMs, progress);
  if (state.phase === "exiting" && state.transition?.kind === "exit") {
    return { ...state, angleRad, detent, aligned: false, drag: undefined };
  }
  return {
    ...state,
    phase: "exploring",
    angleRad,
    detent,
    aligned: false,
    drag: undefined,
    transition: undefined,
  };
}

function leavingAlignment(
  state: MonthGeneralInteractionState,
  angleRad: number,
  detent: number,
  drag: MonthGeneralInteractionState["drag"],
  nowMs: number,
  progress: readonly number[],
): MonthGeneralInteractionState {
  return {
    ...state,
    phase: "exiting",
    angleRad,
    detent,
    aligned: false,
    drag,
    transition: transition("exit", nowMs, progress),
  };
}

function transition(kind: GeneralTransition["kind"], startedAtMs: number, progress: readonly number[]): GeneralTransition {
  return { kind, startedAtMs, fromProgress: [...progress] };
}

function validatedProgress(progress: readonly number[]): readonly number[] {
  if (progress.length !== DETENT_COUNT || !progress.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new Error("generalProgress must contain twelve finite values from 0 to 1");
  }
  return progress;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
