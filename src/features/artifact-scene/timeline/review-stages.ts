import type { RuleStageId } from "../../../domain/chart/types";
import type { ArtifactAnnotationId } from "../annotations/types";

export interface ArtifactReviewStage {
  id: RuleStageId;
  label: string;
  startTimeMs: number;
  settledTimeMs: number;
  caption: readonly [string, string];
  camera: { position: readonly [number, number, number]; target: readonly [number, number, number] };
  annotationIds: readonly ArtifactAnnotationId[];
}

const STABLE_CAMERA = {
  position: [0.12044204, 1.65952395, 0.95771196] as const,
  target: [0.00243791, 0.03725838, -0.00050031] as const,
};

export const ARTIFACT_REVIEW_STAGES = [
  {
    id: "calendar", label: "历法与月将", startTimeMs: 0, settledTimeMs: 3_200,
    caption: ["历法定时", "月将临占时"] as const, camera: STABLE_CAMERA,
    annotationIds: ["calendar/slip", "plate/earth", "plate/heaven"],
  },
  {
    id: "heaven-earth", label: "天地盘加临", startTimeMs: 3_200, settledTimeMs: 8_000,
    caption: ["天地相加", "十二宫依时转位"] as const, camera: STABLE_CAMERA,
    annotationIds: ["calendar/slip", "plate/earth", "plate/heaven"],
  },
  {
    id: "four-lessons", label: "四课生成", startTimeMs: 8_000, settledTimeMs: 13_000,
    caption: ["四课相承", "以上神照见下神"] as const, camera: STABLE_CAMERA,
    annotationIds: ["lesson/first", "lesson/second", "lesson/third", "lesson/fourth"],
  },
  {
    id: "three-transmissions", label: "三传取法", startTimeMs: 13_000, settledTimeMs: 18_000,
    caption: ["初中末传", "由课势取其来去"] as const, camera: STABLE_CAMERA,
    annotationIds: ["transmission/initial", "transmission/middle", "transmission/final"],
  },
  {
    id: "heavenly-generals", label: "天将排列", startTimeMs: 18_000, settledTimeMs: 24_000,
    caption: ["贵人起例", "十二天将顺逆布列"] as const, camera: STABLE_CAMERA,
    annotationIds: [
      "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
      "general/hook-array", "general/azure-dragon",
    ],
  },
  {
    id: "course", label: "复制结课", startTimeMs: 24_000, settledTimeMs: 27_000,
    caption: ["课式归一", "可回看每一步依据"] as const, camera: STABLE_CAMERA,
    annotationIds: [
      "calendar/slip", "plate/earth", "plate/heaven", "lesson/first",
      "transmission/initial", "general/noble",
    ],
  },
] as const satisfies readonly ArtifactReviewStage[];

export function reviewStageFor(stageId: RuleStageId): ArtifactReviewStage {
  return ARTIFACT_REVIEW_STAGES.find((stage) => stage.id === stageId)!;
}
