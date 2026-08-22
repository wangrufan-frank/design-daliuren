import type { ArtifactDisplayState } from "../model/types";
import { ARTIFACT_REVIEW_STAGES, reviewStageFor } from "./review-stages";
import type { ArtifactCopyPose, ArtifactNodePose, ArtifactPose } from "./types";

export const ARTIFACT_DURATION_MS = ARTIFACT_REVIEW_STAGES[ARTIFACT_REVIEW_STAGES.length - 1].settledTimeMs;

const GENERAL_NODE_IDS = {
  贵人: "general/noble", 螣蛇: "general/snake", 朱雀: "general/vermilion-bird", 六合: "general/harmony",
  勾陈: "general/hook-array", 青龙: "general/azure-dragon", 天空: "general/void", 白虎: "general/white-tiger",
  太常: "general/constant", 玄武: "general/black-tortoise", 太阴: "general/yin", 天后: "general/queen-of-heaven",
} as const;

const intervalFor = (stageId: Parameters<typeof reviewStageFor>[0]) => {
  const stage = reviewStageFor(stageId);
  return [stage.startTimeMs, stage.settledTimeMs] as const;
};
const STAGES = {
  calendar: intervalFor("calendar"),
  plate: intervalFor("heaven-earth"),
  lessons: intervalFor("four-lessons"),
  transmissions: intervalFor("three-transmissions"),
  generals: intervalFor("heavenly-generals"),
  copy: intervalFor("course"),
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);

function stageProgress(timeMs: number, stage: readonly [number, number], reducedMotion: boolean): number {
  if (reducedMotion) return timeMs >= stage[1] ? 1 : 0;
  return smoothstep(clamp01((timeMs - stage[0]) / (stage[1] - stage[0])));
}

function node(overrides: Partial<ArtifactNodePose> = {}): ArtifactNodePose {
  return {
    translationX: 0,
    translationY: 0,
    translationZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    ...overrides,
  };
}

function copyPose(timeMs: number, reducedMotion: boolean): ArtifactCopyPose {
  const [start, end] = STAGES.copy;
  if (timeMs < start) return { opacity: 0, sourceLineProgress: 0, sourceLineOpacity: 0 };
  const progress = stageProgress(timeMs, STAGES.copy, reducedMotion);
  if (reducedMotion) {
    const sourceLineOpacity = clamp01(1 - (timeMs - start) / 150);
    return { opacity: progress, sourceLineProgress: sourceLineOpacity, sourceLineOpacity };
  }
  const sourceLineProgress = 4 * progress * (1 - progress);
  return { opacity: progress, sourceLineProgress, sourceLineOpacity: sourceLineProgress };
}

export function evaluateArtifactPose(
  state: ArtifactDisplayState,
  timeMs: number,
  reducedMotion: boolean,
): ArtifactPose {
  const time = clamp01(timeMs / ARTIFACT_DURATION_MS) * ARTIFACT_DURATION_MS;
  const calendar = stageProgress(time, STAGES.calendar, reducedMotion);
  const plate = stageProgress(time, STAGES.plate, reducedMotion);
  const lessons = stageProgress(time, STAGES.lessons, reducedMotion);
  const transmissions = stageProgress(time, STAGES.transmissions, reducedMotion);
  const generalSequence = [...state.generals]
    .sort((first, second) => first.order - second.order)
    .map((placement) => GENERAL_NODE_IDS[placement.general]);
  if (state.noble.direction === "reverse") generalSequence.reverse();
  const generalSequenceIndexes = new Map(generalSequence.map((id, index) => [id, index]));
  const generalStepMs = (STAGES.generals[1] - STAGES.generals[0]) / generalSequence.length;
  const nodes: Record<string, ArtifactNodePose> = {
    "calendar/slip": node({ translationZ: 0.035 * calendar, rotationX: -0.12 * calendar }),
    "plate/heaven": node({
      translationZ: 0.03 * plate,
      rotationZ: state.plate.offset * Math.PI / 6 * plate,
    }),
    "transmission/bridge": node({ translationY: -0.118 * transmissions }),
    "transmission/initial": node({ translationY: -0.035 * transmissions }),
    "transmission/middle": node({ translationY: -0.055 * transmissions }),
    "transmission/final": node({ translationY: -0.075 * transmissions }),
  };
  const lessonSeparations = { first: -0.045, second: -0.015, third: 0.015, fourth: 0.045 } as const;
  (Object.keys(lessonSeparations) as (keyof typeof lessonSeparations)[]).forEach((lesson) => {
    nodes[`lesson/${lesson}`] = node({ translationX: lessonSeparations[lesson] * lessons });
  });
  state.generals.forEach((placement) => {
    const id = GENERAL_NODE_IDS[placement.general];
    const sequenceIndex = generalSequenceIndexes.get(id) ?? 0;
    const stage = [
      STAGES.generals[0] + sequenceIndex * generalStepMs,
      STAGES.generals[0] + (sequenceIndex + 1) * generalStepMs,
    ] as const;
    nodes[id] = node({
      translationZ: 0.004 * (sequenceIndex + 1) * stageProgress(time, stage, reducedMotion),
      targetEarth: placement.earth,
    });
  });
  const course = stageProgress(time, STAGES.copy, reducedMotion);
  nodes["anchor/course-copy/lessons"] = node({ translationX: -0.025 * course });
  nodes["anchor/course-copy/transmissions"] = node({ translationX: 0.025 * course });
  const copy = copyPose(time, reducedMotion);
  return {
    nodes,
    copy: { lessons: { ...copy }, transmissions: { ...copy }, generals: { ...copy } },
    generalDirection: state.noble.direction,
    generalSequence,
    cameraOrbitRequested: !reducedMotion,
  };
}
