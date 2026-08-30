import type { ArtifactDisplayState } from "../model/types";
import { ARTIFACT_REVIEW_STAGES, reviewStageFor } from "./review-stages";
import type { ArtifactNodePose, ArtifactPose } from "./types";

export const ARTIFACT_DURATION_MS = ARTIFACT_REVIEW_STAGES[ARTIFACT_REVIEW_STAGES.length - 1].settledTimeMs;

const GENERAL_NODE_IDS = {
  贵人: "general/noble", 螣蛇: "general/snake", 朱雀: "general/vermilion-bird", 六合: "general/harmony",
  勾陈: "general/hook-array", 青龙: "general/azure-dragon", 天空: "general/void", 白虎: "general/white-tiger",
  太常: "general/constant", 玄武: "general/black-tortoise", 太阴: "general/yin", 天后: "general/queen-of-heaven",
} as const;

const GENERAL_LABEL_IDS = Object.fromEntries(
  Object.entries(GENERAL_NODE_IDS).map(([general, nodeId]) => [nodeId, `dynamic/general/${nodeId.slice("general/".length)}`]),
) as Record<string, string>;
const LESSONS = ["first", "second", "third", "fourth"] as const;
const TRANSMISSIONS = ["initial", "middle", "final"] as const;
const LESSON_START_MS = [8_000, 9_200, 10_400, 11_600] as const;
const TRANSMISSION_START_MS = [13_000, 14_000, 15_000] as const;
const GENERAL_START_MS = 18_000;
const LESSON_ACTION_MS = 760;
const TRANSMISSION_ACTION_MS = 1_000;
const GENERAL_ACTION_MS = 360;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smootherstep = (value: number) => value ** 3 * (value * (value * 6 - 15) + 10);

function actionProgress(timeMs: number, startMs: number, durationMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return timeMs >= startMs ? 1 : 0;
  return smootherstep(clamp01((timeMs - startMs) / durationMs));
}

function node(overrides: Partial<ArtifactNodePose> = {}): ArtifactNodePose {
  return {
    translationX: 0, translationY: 0, translationZ: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    ...overrides,
  };
}

function movingSlip(
  timeMs: number,
  startMs: number,
  durationMs: number,
  lateralOffset: number,
  reducedMotion: boolean,
): ArtifactNodePose {
  const progress = actionProgress(timeMs, startMs, durationMs, reducedMotion);
  const remaining = progress === 1 ? 0 : 1 - progress;
  return node({
    visible: timeMs >= startMs,
    translationX: remaining ? lateralOffset * remaining : 0,
    translationZ: 0.018 * remaining,
  });
}

function labelOpacity(labelOpacity: Record<string, number>, id: string, progress: number): void {
  labelOpacity[id] = progress;
}

export function evaluateArtifactPose(
  state: ArtifactDisplayState,
  timeMs: number,
  reducedMotion: boolean,
): ArtifactPose {
  const time = clamp01(timeMs / ARTIFACT_DURATION_MS) * ARTIFACT_DURATION_MS;
  const nodes: Record<string, ArtifactNodePose> = {};
  const labels: Record<string, number> = {};

  const calendarProgress = actionProgress(time, 0, LESSON_ACTION_MS, reducedMotion);
  nodes["calendar/slip"] = movingSlip(time, 0, LESSON_ACTION_MS, 0.008, reducedMotion);
  labelOpacity(labels, "dynamic/calendar", calendarProgress);

  const plateProgress = actionProgress(time, reviewStageFor("heaven-earth").startTimeMs, reviewStageFor("heaven-earth").settledTimeMs - reviewStageFor("heaven-earth").startTimeMs, reducedMotion);
  nodes["plate/heaven"] = node({ rotationY: state.plate.offset * Math.PI / 6 * plateProgress });

  LESSONS.forEach((lesson, index) => {
    const progress = actionProgress(time, LESSON_START_MS[index], LESSON_ACTION_MS, reducedMotion);
    nodes[`lesson/${lesson}`] = movingSlip(time, LESSON_START_MS[index], LESSON_ACTION_MS, index % 2 ? 0.008 : -0.008, reducedMotion);
    labelOpacity(labels, `dynamic/lesson/${lesson}`, progress);
  });

  TRANSMISSIONS.forEach((transmission, index) => {
    const progress = actionProgress(time, TRANSMISSION_START_MS[index], TRANSMISSION_ACTION_MS, reducedMotion);
    nodes[`transmission/${transmission}`] = movingSlip(time, TRANSMISSION_START_MS[index], TRANSMISSION_ACTION_MS, (index - 1) * 0.008, reducedMotion);
    labelOpacity(labels, `dynamic/transmission/${transmission}`, progress);
  });
  const methodProgress = actionProgress(time, TRANSMISSION_START_MS[0], TRANSMISSION_ACTION_MS, reducedMotion);
  nodes["transmission/method"] = movingSlip(time, TRANSMISSION_START_MS[0], TRANSMISSION_ACTION_MS, 0, reducedMotion);
  labelOpacity(labels, "dynamic/transmission/method", methodProgress);

  const generalSequence = [...state.generals]
    .sort((first, second) => first.order - second.order)
    .map((placement) => GENERAL_NODE_IDS[placement.general]);
  if (state.noble.direction === "reverse") generalSequence.reverse();
  const sequenceIndexes = new Map(generalSequence.map((id, index) => [id, index]));
  state.generals.forEach((placement) => {
    const id = GENERAL_NODE_IDS[placement.general];
    const index = sequenceIndexes.get(id) ?? 0;
    const progress = actionProgress(time, GENERAL_START_MS + index * GENERAL_ACTION_MS, GENERAL_ACTION_MS, reducedMotion);
    nodes[id] = node({ visible: time >= GENERAL_START_MS + index * GENERAL_ACTION_MS, targetEarth: placement.earth });
    labelOpacity(labels, GENERAL_LABEL_IDS[id], progress);
  });

  const courseTraceOpacity = reducedMotion || time < 24_000 || time >= 26_400
    ? 0
    : Math.sin(Math.PI * (time - 24_000) / 2_400) ** 2;
  return {
    nodes,
    labelOpacity: labels,
    courseTraceOpacity,
    generalDirection: state.noble.direction,
    generalSequence,
  };
}
