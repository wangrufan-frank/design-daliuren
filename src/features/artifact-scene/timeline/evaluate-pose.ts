import type { ArtifactDisplayState } from "../model/types";
import { deriveJadePlateLayout } from "../model/jade-plate-layout";
import { evaluateDemoJadePlateMotion } from "./evaluate-jade-plate-motion";
import type { ArtifactNodePose, ArtifactPose } from "./types";

export const ARTIFACT_DURATION_MS = 8_200;

const LEGACY_EXPLANATION_NODES = [
  "calendar/slip",
  "lesson/first", "lesson/second", "lesson/third", "lesson/fourth",
  "transmission/initial", "transmission/middle", "transmission/final", "transmission/method",
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function node(overrides: Partial<ArtifactNodePose> = {}): ArtifactNodePose {
  return {
    translationX: 0, translationY: 0, translationZ: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    ...overrides,
  };
}

export function evaluateArtifactPose(
  state: ArtifactDisplayState,
  timeMs: number,
  reducedMotion: boolean,
): ArtifactPose {
  const time = clamp01(timeMs / ARTIFACT_DURATION_MS) * ARTIFACT_DURATION_MS;
  const nodes: Record<string, ArtifactNodePose> = {};
  const jadePlate = evaluateDemoJadePlateMotion(deriveJadePlateLayout(state), time, reducedMotion);

  for (const id of LEGACY_EXPLANATION_NODES) nodes[id] = node({ visible: false });

  nodes["plate/heaven"] = node({ rotationY: jadePlate.monthAngleRad });
  nodes["plate/generals"] = node();
  for (const piece of jadePlate.generals) {
    nodes[piece.nodeId] = node({
      visible: piece.visible,
      translationY: piece.heightMeters,
      targetEarth: piece.targetEarth,
    });
  }

  return {
    nodes,
    jadePlate,
    labelOpacity: {},
    courseTraceOpacity: 0,
    generalDirection: state.noble.direction,
    generalSequence: jadePlate.generals.map((piece) => piece.nodeId),
  };
}
