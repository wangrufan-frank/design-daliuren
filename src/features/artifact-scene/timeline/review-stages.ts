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
    camera: { position: [0, 0.353057, 0.827859], target: [0, 0, 0] },
    annotationIds: ["calendar/slip", "plate/earth", "plate/heaven"],
  },
  {
    id: "heaven-earth",
    label: "天地盘加临",
    startTimeMs: 1_200,
    settledTimeMs: 3_200,
    caption: ["天地相加", "十二宫依时转位"] as const,
    camera: { position: [0, 0.550956, 0.711651], target: [0, 0, 0] },
    annotationIds: ["calendar/slip", "plate/earth", "plate/heaven"],
  },
  {
    id: "four-lessons",
    label: "四课生成",
    startTimeMs: 3_200,
    settledTimeMs: 5_400,
    caption: ["四课相承", "以上神照见下神"] as const,
    camera: { position: [-0.53732, 0.458213, 0.626873], target: [0, 0.1, 0] },
    annotationIds: ["lesson/first", "lesson/second", "lesson/third", "lesson/fourth"],
  },
  {
    id: "three-transmissions",
    label: "三传取法",
    startTimeMs: 5_400,
    settledTimeMs: 7_600,
    caption: ["初中末传", "由课势取其来去"] as const,
    camera: { position: [0.575977, 0.445586, 0.599016], target: [0, 0.1, 0] },
    annotationIds: ["transmission/initial", "transmission/middle", "transmission/final"],
  },
  {
    id: "heavenly-generals",
    label: "天将排列",
    startTimeMs: 7_600,
    settledTimeMs: 10_300,
    caption: ["贵人起例", "十二天将顺逆布列"] as const,
    camera: { position: [0, 0.562226, 0.702782], target: [0, 0, 0] },
    annotationIds: [
      "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
      "general/hook-array", "general/azure-dragon",
    ],
  },
  {
    id: "course",
    label: "复制结课",
    startTimeMs: 10_300,
    settledTimeMs: 12_500,
    caption: ["课式归一", "可回看每一步依据"] as const,
    camera: { position: [0, 0.402492, 0.804984], target: [0, 0, 0] },
    annotationIds: [
      "calendar/slip", "plate/earth", "plate/heaven", "lesson/first",
      "transmission/initial", "general/noble",
    ],
  },
] as const satisfies readonly ArtifactReviewStage[];

export function reviewStageFor(stageId: RuleStageId): ArtifactReviewStage {
  return ARTIFACT_REVIEW_STAGES.find((stage) => stage.id === stageId)!;
}
