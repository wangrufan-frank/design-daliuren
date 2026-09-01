export type ArtifactAnnotationId =
  | "calendar/slip" | "plate/earth" | "plate/heaven" | "plate/generals"
  | "lesson/first" | "lesson/second" | "lesson/third" | "lesson/fourth"
  | "transmission/initial" | "transmission/middle" | "transmission/final"
  | "general/noble" | "general/snake" | "general/vermilion-bird" | "general/harmony"
  | "general/hook-array" | "general/azure-dragon" | "general/void" | "general/white-tiger"
  | "general/constant" | "general/black-tortoise" | "general/yin" | "general/queen-of-heaven";

import type { RuleStageId } from "../../../domain/chart/types";

export interface ArtifactAnnotationDescriptor {
  id: ArtifactAnnotationId;
  nodeId: string;
  label: string;
  detail: string;
  stages: readonly RuleStageId[];
}

export interface ProjectedAnchor {
  id: ArtifactAnnotationId;
  x: number;
  y: number;
  depth: number;
  behindCamera: boolean;
  occluded: boolean;
}

export interface AnnotationLayout {
  id: ArtifactAnnotationId;
  anchor: readonly [number, number];
  labelRect: { x: number; y: number; width: number; height: number };
  leaderPath: string;
  occluded: boolean;
}

export interface AnnotationSafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
  subject?: { x: number; y: number; width: number; height: number };
}

export interface AnnotationLayoutOptions {
  previous?: readonly AnnotationLayout[];
  safeArea?: AnnotationSafeArea;
}
