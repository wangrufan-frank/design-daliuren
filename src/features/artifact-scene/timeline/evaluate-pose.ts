import type { ArtifactDisplayState } from "../model/types";
import type { ArtifactCopyPose, ArtifactNodePose, ArtifactPose } from "./types";

export const ARTIFACT_DURATION_MS = 12_500;

const GENERAL_NODE_IDS = {
  贵人: "general/noble", 螣蛇: "general/snake", 朱雀: "general/vermilion-bird", 六合: "general/harmony",
  勾陈: "general/hook-array", 青龙: "general/azure-dragon", 天空: "general/void", 白虎: "general/white-tiger",
  太常: "general/constant", 玄武: "general/black-tortoise", 太阴: "general/yin", 天后: "general/queen-of-heaven",
} as const;

const LESSON_TRAVEL_X = { first: 0.092, second: 0.092, third: -0.092, fourth: -0.092 } as const;
const STAGES = {
  calendar: [0, 1_200], plate: [1_200, 3_200], lessons: [3_200, 5_400],
  transmissions: [5_400, 7_600], generals: [7_600, 10_300], copy: [10_300, ARTIFACT_DURATION_MS],
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);

function stageProgress(timeMs: number, stage: readonly [number, number], reducedMotion: boolean): number {
  if (reducedMotion) return timeMs >= stage[1] ? 1 : 0;
  return smoothstep(clamp01((timeMs - stage[0]) / (stage[1] - stage[0])));
}

function node(overrides: Partial<ArtifactNodePose> = {}): ArtifactNodePose {
  return { translationX: 0, translationY: 0, translationZ: 0, rotationZ: 0, ...overrides };
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
  const generals = stageProgress(time, STAGES.generals, reducedMotion);
  const nodes: Record<string, ArtifactNodePose> = {
    "calendar/slip": node({ translationZ: 0.012 * calendar }),
    "plate/heaven": node({ rotationZ: state.plate.offset * Math.PI / 6 * plate }),
    "transmission/bridge": node({ translationY: -0.118 * transmissions }),
  };
  (Object.keys(LESSON_TRAVEL_X) as (keyof typeof LESSON_TRAVEL_X)[]).forEach((lesson) => {
    nodes[`lesson/${lesson}`] = node({ translationX: LESSON_TRAVEL_X[lesson] * lessons });
  });
  state.generals.forEach((placement) => {
    nodes[GENERAL_NODE_IDS[placement.general]] = node({ translationZ: 0.007 * generals, targetEarth: placement.earth });
  });
  const copy = copyPose(time, reducedMotion);
  const generalSequence = [...state.generals]
    .sort((first, second) => first.order - second.order)
    .map((placement) => GENERAL_NODE_IDS[placement.general]);
  if (state.noble.direction === "reverse") generalSequence.reverse();
  return {
    nodes,
    copy: { lessons: { ...copy }, transmissions: { ...copy }, generals: { ...copy } },
    generalDirection: state.noble.direction,
    generalSequence,
    cameraOrbitRequested: !reducedMotion,
  };
}
