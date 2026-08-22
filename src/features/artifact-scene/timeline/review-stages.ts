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

export const ARTIFACT_REVIEW_STAGES = [
  {
    id: "calendar",
    label: "历法与月将",
    startTimeMs: 0,
    settledTimeMs: 1_200,
    caption: ["历法定时", "月将临占时"] as const,
    camera: { position: [0, 1.45, 3.4], target: [0, 0, 0] },
    annotationIds: ["calendar/slip"],
  },
  {
    id: "heaven-earth",
    label: "天地盘加临",
    startTimeMs: 1_200,
    settledTimeMs: 3_200,
    caption: ["天地相加", "十二宫依时转位"] as const,
    camera: { position: [0, 2.4, 3.1], target: [0, 0, 0] },
    annotationIds: ["plate/earth", "plate/heaven"],
  },
  {
    id: "four-lessons",
    label: "四课生成",
    startTimeMs: 3_200,
    settledTimeMs: 5_400,
    caption: ["四课相承", "以上神照见下神"] as const,
    camera: { position: [-2.4, 1.7, 2.8], target: [0, 0.1, 0] },
    annotationIds: ["lesson/first", "lesson/second", "lesson/third", "lesson/fourth"],
  },
  {
    id: "three-transmissions",
    label: "三传取法",
    startTimeMs: 5_400,
    settledTimeMs: 7_600,
    caption: ["初中末传", "由课势取其来去"] as const,
    camera: { position: [2.5, 1.6, 2.6], target: [0, 0.1, 0] },
    annotationIds: ["transmission/initial", "transmission/middle", "transmission/final"],
  },
  {
    id: "heavenly-generals",
    label: "天将排列",
    startTimeMs: 7_600,
    settledTimeMs: 10_300,
    caption: ["贵人起例", "十二天将顺逆布列"] as const,
    camera: { position: [0, 2.8, 3.5], target: [0, 0, 0] },
    annotationIds: [
      "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
      "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger",
      "general/constant", "general/black-tortoise", "general/yin", "general/queen-of-heaven",
    ],
  },
  {
    id: "course",
    label: "复制结课",
    startTimeMs: 10_300,
    settledTimeMs: 12_500,
    caption: ["课式归一", "可回看每一步依据"] as const,
    camera: { position: [0, 2.1, 4.2], target: [0, 0, 0] },
    annotationIds: [
      "calendar/slip", "plate/earth", "plate/heaven",
      "lesson/first", "lesson/second", "lesson/third", "lesson/fourth",
      "transmission/initial", "transmission/middle", "transmission/final",
      "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
      "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger",
      "general/constant", "general/black-tortoise", "general/yin", "general/queen-of-heaven",
    ],
  },
] as const satisfies readonly ArtifactReviewStage[];

export function reviewStageFor(stageId: RuleStageId): ArtifactReviewStage {
  return ARTIFACT_REVIEW_STAGES.find((stage) => stage.id === stageId)!;
}
